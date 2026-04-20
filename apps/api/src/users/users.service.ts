import { BadRequestException, Injectable } from '@nestjs/common';
import { ManagedUserFieldType, ManagedUserStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CreateManagedUserDto, ImportUsersDto, ImportUsersMappingDto } from './users.dto';
import {
  buildUserFieldDefinitions,
  normalizeManagedUserImportRecord,
  normalizeManagedUserPhone,
  sanitizeCustomFieldKey,
  type UserImportMapping
} from './users.mapping';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async listFields(ownerUserId: string) {
    const customFields = await this.prisma.managedUserField.findMany({
      where: { ownerUserId: ownerUserId },
      orderBy: [{ createdAt: 'asc' }, { label: 'asc' }]
    });

    return {
      fields: buildUserFieldDefinitions(customFields)
    };
  }

  async list(ownerUserId: string) {
    const [customFields, users] = await Promise.all([
      this.prisma.managedUserField.findMany({
        where: { ownerUserId: ownerUserId },
        orderBy: [{ createdAt: 'asc' }, { label: 'asc' }]
      }),
      this.prisma.managedUser.findMany({
        where: { ownerUserId: ownerUserId },
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }]
      })
    ]);

    const sourceCounts = new Map<string, number>();
    for (const user of users) {
      sourceCounts.set(user.source, (sourceCounts.get(user.source) ?? 0) + 1);
    }

    return {
      fields: buildUserFieldDefinitions(customFields),
      users: users.map((user) => ({
        ...user,
        phone: normalizeManagedUserPhone(user.phone) ?? null,
        tags: Array.isArray(user.tags) ? user.tags : [],
        customAttributes: isJsonRecord(user.customAttributes) ? user.customAttributes : {}
      })),
      summary: {
        totalUsers: users.length,
        activeUsers: users.filter((user) => user.status === ManagedUserStatus.ACTIVE).length,
        inactiveUsers: users.filter((user) => user.status === ManagedUserStatus.INACTIVE).length,
        dormantUsers: users.filter((user) => user.status === ManagedUserStatus.DORMANT).length,
        blockedUsers: users.filter((user) => user.status === ManagedUserStatus.BLOCKED).length,
        sourceCount: sourceCounts.size,
        customFieldCount: customFields.length
      },
      sourceBreakdown: Array.from(sourceCounts.entries())
        .map(([source, count]) => ({ source, count }))
        .sort((left, right) => right.count - left.count)
    };
  }

  async createManualUser(ownerUserId: string, dto: CreateManagedUserDto) {
    const source = dto.source?.trim() || 'manual';
    const name = dto.name.trim();
    if (!name) {
      throw new BadRequestException('name is required');
    }

    const email = normalizeOptionalString(dto.email)?.toLowerCase();
    const phone = normalizeOptionalPhone(dto.phone);
    const externalId = normalizeOptionalString(dto.externalId);
    const userType = normalizeOptionalString(dto.userType);
    const segment = normalizeOptionalString(dto.segment);
    const gradeOrLevel = normalizeOptionalString(dto.gradeOrLevel);
    const tags = normalizeTagsInput(dto.tags);
    const registeredAt = normalizeOptionalDate(dto.registeredAt, 'registeredAt');
    const lastLoginAt = normalizeOptionalDate(dto.lastLoginAt, 'lastLoginAt');
    const customAttributes = normalizeManualCustomAttributes(dto.customAttributes);

    await this.ensureCustomFieldsForManualUser(ownerUserId, customAttributes);

    const payload = {
      source,
      externalId: externalId ?? null,
      name,
      email: email ?? null,
      phone: phone ?? null,
      status: dto.status ?? ManagedUserStatus.ACTIVE,
      userType: userType ?? null,
      segment: segment ?? null,
      gradeOrLevel: gradeOrLevel ?? null,
      marketingConsent: dto.marketingConsent ?? null,
      tags,
      registeredAt: registeredAt?.toISOString() ?? null,
      lastLoginAt: lastLoginAt?.toISOString() ?? null,
      customAttributes
    };

    const existingUser = await this.findExistingUser(ownerUserId, source, {
      externalId,
      email,
      phone
    });

    const userData = {
      source,
      rawPayload: payload as Prisma.InputJsonValue,
      customAttributes: Object.keys(customAttributes).length > 0 ? customAttributes : undefined,
      ...(externalId !== undefined ? { externalId } : {}),
      name,
      ...(email !== undefined ? { email } : {}),
      ...(phone !== undefined ? { phone } : {}),
      status: dto.status ?? ManagedUserStatus.ACTIVE,
      ...(userType !== undefined ? { userType } : {}),
      ...(segment !== undefined ? { segment } : {}),
      ...(gradeOrLevel !== undefined ? { gradeOrLevel } : {}),
      ...(dto.marketingConsent !== undefined ? { marketingConsent: dto.marketingConsent } : {}),
      ...(tags !== undefined ? { tags } : {}),
      ...(registeredAt !== undefined ? { registeredAt } : {}),
      ...(lastLoginAt !== undefined ? { lastLoginAt } : {})
    };

    const user = existingUser
      ? await this.prisma.managedUser.update({
          where: { id: existingUser.id },
          data: userData
        })
      : await this.prisma.managedUser.create({
        data: {
          ownerUserId: ownerUserId,
          ...userData
        }
      });

    return {
      mode: existingUser ? 'updated' : 'created',
      user: {
        ...user,
        phone: normalizeManagedUserPhone(user.phone) ?? null,
        tags: Array.isArray(user.tags) ? user.tags : [],
        customAttributes: isJsonRecord(user.customAttributes) ? user.customAttributes : {}
      }
    };
  }

  async importUsers(ownerUserId: string, dto: ImportUsersDto) {
    const source = dto.source.trim();
    const mappings = dto.mappings.map((mapping) => this.normalizeMapping(mapping));
    const existingFields = await this.prisma.managedUserField.findMany({
      where: { ownerUserId: ownerUserId }
    });
    const existingFieldKeys = new Set(existingFields.map((field) => field.key));

    const customFieldDrafts = this.extractCustomFieldDrafts(mappings);
    let customFieldsCreated = 0;

    for (const field of customFieldDrafts) {
      if (existingFieldKeys.has(field.key)) {
        continue;
      }

      await this.prisma.managedUserField.create({
        data: {
          ownerUserId: ownerUserId,
          key: field.key,
          label: field.label,
          dataType: field.dataType
        }
      });
      existingFieldKeys.add(field.key);
      customFieldsCreated += 1;
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const [index, record] of dto.records.entries()) {
      const normalized = normalizeManagedUserImportRecord(record, mappings, `${source} user ${index + 1}`);
      if (normalized.assignedFieldCount === 0) {
        skipped += 1;
        continue;
      }

      const existingUser = await this.findExistingUser(ownerUserId, source, normalized);
      const mergedCustomAttributes = {
        ...toJsonInputRecord(existingUser?.customAttributes),
        ...normalized.customAttributes
      };

      const userData = {
        source,
        rawPayload: normalized.rawPayload,
        customAttributes: Object.keys(mergedCustomAttributes).length > 0 ? mergedCustomAttributes : undefined,
        ...(normalized.externalId !== undefined ? { externalId: normalized.externalId } : {}),
        ...(normalized.name !== undefined ? { name: normalized.name } : {}),
        ...(normalized.email !== undefined ? { email: normalized.email } : {}),
        ...(normalized.phone !== undefined ? { phone: normalized.phone } : {}),
        ...(normalized.status !== undefined ? { status: normalized.status } : {}),
        ...(normalized.userType !== undefined ? { userType: normalized.userType } : {}),
        ...(normalized.segment !== undefined ? { segment: normalized.segment } : {}),
        ...(normalized.gradeOrLevel !== undefined ? { gradeOrLevel: normalized.gradeOrLevel } : {}),
        ...(normalized.marketingConsent !== undefined ? { marketingConsent: normalized.marketingConsent } : {}),
        ...(normalized.tags !== undefined ? { tags: normalized.tags } : {}),
        ...(normalized.registeredAt !== undefined ? { registeredAt: normalized.registeredAt } : {}),
        ...(normalized.lastLoginAt !== undefined ? { lastLoginAt: normalized.lastLoginAt } : {})
      };

      if (existingUser) {
        await this.prisma.managedUser.update({
          where: { id: existingUser.id },
          data: userData
        });
        updated += 1;
        continue;
      }

      await this.prisma.managedUser.create({
        data: {
          ownerUserId: ownerUserId,
          name: normalized.name ?? `${source} user ${index + 1}`,
          status: normalized.status ?? ManagedUserStatus.ACTIVE,
          ...userData
        }
      });
      created += 1;
    }

    return {
      totalReceived: dto.records.length,
      created,
      updated,
      skipped,
      customFieldsCreated
    };
  }

  private normalizeMapping(mapping: ImportUsersMappingDto): UserImportMapping {
    return {
      sourcePath: (mapping.sourcePath ?? mapping.sourceKey ?? '').trim(),
      kind: mapping.kind,
      systemField: mapping.systemField,
      customKey: mapping.customKey,
      customLabel: mapping.customLabel,
      dataType: mapping.dataType
    };
  }

  private extractCustomFieldDrafts(mappings: UserImportMapping[]) {
    const fieldMap = new Map<string, { key: string; label: string; dataType: ManagedUserFieldType }>();

    for (const mapping of mappings) {
      if (mapping.kind !== 'CUSTOM') {
        continue;
      }

      const key = sanitizeCustomFieldKey(mapping.customKey || mapping.customLabel || 'custom_field');
      fieldMap.set(key, {
        key,
        label: mapping.customLabel?.trim() || mapping.customKey || key,
        dataType: mapping.dataType ?? ManagedUserFieldType.TEXT
      });
    }

    return [...fieldMap.values()];
  }

  private async findExistingUser(
    ownerUserId: string,
    source: string,
    normalized: { externalId?: string; email?: string; phone?: string }
  ) {
    if (normalized.externalId) {
      const existingByExternalId = await this.prisma.managedUser.findFirst({
        where: {
          ownerUserId: ownerUserId,
          source,
          externalId: normalized.externalId
        }
      });

      if (existingByExternalId) {
        return existingByExternalId;
      }
    }

    if (normalized.email) {
      const existingByEmail = await this.prisma.managedUser.findFirst({
        where: {
          ownerUserId: ownerUserId,
          source,
          email: normalized.email
        }
      });

      if (existingByEmail) {
        return existingByEmail;
      }
    }

    if (normalized.phone) {
      const existingByPhone = await this.prisma.managedUser.findFirst({
        where: {
          ownerUserId: ownerUserId,
          source,
          phone: normalized.phone
        }
      });

      if (existingByPhone) {
        return existingByPhone;
      }
    }

    return null;
  }

  private async ensureCustomFieldsForManualUser(
    ownerUserId: string,
    customAttributes: Record<string, Prisma.InputJsonValue>
  ) {
    const existingFields = await this.prisma.managedUserField.findMany({
      where: { ownerUserId: ownerUserId },
      select: { key: true }
    });
    const existingFieldKeys = new Set(existingFields.map((field) => field.key));

    for (const [key, value] of Object.entries(customAttributes)) {
      if (existingFieldKeys.has(key)) {
        continue;
      }

      await this.prisma.managedUserField.create({
        data: {
          ownerUserId: ownerUserId,
          key,
          label: key,
          dataType: inferManagedUserFieldType(value)
        }
      });
      existingFieldKeys.add(key);
    }
  }

}

function isJsonRecord(value: Prisma.JsonValue | null): value is Prisma.JsonObject {
  return value !== null && !Array.isArray(value) && typeof value === 'object';
}

function toJsonInputRecord(value: Prisma.JsonValue | null | undefined): Record<string, Prisma.InputJsonValue> {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([key, innerValue]) => [key, toJsonInputValue(innerValue)] as const)
      .filter((entry): entry is [string, Prisma.InputJsonValue] => entry[1] !== undefined)
  ) as Record<string, Prisma.InputJsonValue>;
}

function toJsonInputValue(value: Prisma.JsonValue | undefined): Prisma.InputJsonValue | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => toJsonInputValue(item))
      .filter((item): item is Prisma.InputJsonValue => item !== undefined) as Prisma.InputJsonArray;
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([key, innerValue]) => [key, toJsonInputValue(innerValue)] as const)
      .filter((entry): entry is [string, Prisma.InputJsonValue] => entry[1] !== undefined)
  ) as Prisma.InputJsonObject;
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeOptionalPhone(value: string | undefined): string | undefined {
  const normalized = normalizeOptionalString(value);
  if (!normalized) {
    return undefined;
  }

  const phone = normalizeManagedUserPhone(normalized);
  if (!phone) {
    throw new BadRequestException('phone must be a valid phone number');
  }

  return phone;
}

function normalizeOptionalDate(value: string | undefined, fieldName: string): Date | undefined {
  if (!value?.trim()) {
    return undefined;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException(`${fieldName} must be a valid ISO 8601 datetime`);
  }

  return parsed;
}

function normalizeTagsInput(value: string[] | undefined): string[] | undefined {
  if (!value || value.length === 0) {
    return undefined;
  }

  const tags = [...new Set(value.map((tag) => tag.trim()).filter(Boolean))];
  return tags.length > 0 ? tags : undefined;
}

function normalizeManualCustomAttributes(
  value: Record<string, unknown> | undefined
): Record<string, Prisma.InputJsonValue> {
  if (!value || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([key, innerValue]) => {
        const normalizedKey = sanitizeCustomFieldKey(key);
        const normalizedValue = normalizeUnknownToInputJson(innerValue);
        return normalizedKey && normalizedValue !== undefined ? ([normalizedKey, normalizedValue] as const) : null;
      })
      .filter((entry): entry is readonly [string, Prisma.InputJsonValue] => entry !== null)
  );
}

function normalizeUnknownToInputJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    const items = value
      .map((item) => normalizeUnknownToInputJson(item))
      .filter((item): item is Prisma.InputJsonValue => item !== undefined);
    return items as Prisma.InputJsonArray;
  }

  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .map(([key, innerValue]) => [key, normalizeUnknownToInputJson(innerValue)] as const)
        .filter((entry): entry is [string, Prisma.InputJsonValue] => entry[1] !== undefined)
    ) as Prisma.InputJsonObject;
  }

  return undefined;
}

function inferManagedUserFieldType(value: Prisma.InputJsonValue): ManagedUserFieldType {
  if (typeof value === 'number') {
    return ManagedUserFieldType.NUMBER;
  }

  if (typeof value === 'boolean') {
    return ManagedUserFieldType.BOOLEAN;
  }

  if (Array.isArray(value) || typeof value === 'object') {
    return ManagedUserFieldType.JSON;
  }

  return ManagedUserFieldType.TEXT;
}
