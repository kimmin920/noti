import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ManagedUserFieldType, Prisma } from '@prisma/client';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { EnvService } from '../../common/env';
import { PrismaService } from '../../database/prisma.service';
import { ImportUsersDto, ImportUsersMappingDto } from '../../users/users.dto';
import { sanitizeCustomFieldKey } from '../../users/users.mapping';
import { UsersService } from '../../users/users.service';
import { NotionRecipientMappingsDto, SyncNotionRecipientsDto } from './notion-integrations.dto';

const NOTION_API_BASE_URL = 'https://api.notion.com';

const NOTION_SYSTEM_FIELDS = [
  'name',
  'phone',
  'email',
  'status',
  'userType',
  'segment',
  'gradeOrLevel',
  'marketingConsent',
  'registeredAt',
  'lastLoginAt',
  'tags'
] as const;

type NotionSystemField = typeof NOTION_SYSTEM_FIELDS[number];

type NotionTokenResponse = {
  access_token: string;
  refresh_token: string | null;
  token_type: string;
  bot_id: string;
  workspace_id: string;
  workspace_name: string | null;
  workspace_icon: string | null;
  owner: unknown;
};

type NotionListResponse<T> = {
  object: 'list';
  results: T[];
  next_cursor: string | null;
  has_more: boolean;
};

type NotionDataSource = {
  object: 'data_source';
  id: string;
  title?: NotionRichText[];
  name?: string;
  url?: string;
  properties?: Record<string, NotionDataSourceProperty>;
};

type NotionDataSourceProperty = {
  id?: string;
  name?: string;
  type?: string;
};

type NotionPage = {
  object: 'page';
  id: string;
  url?: string;
  created_time?: string;
  last_edited_time?: string;
  properties?: Record<string, NotionPropertyValue>;
};

type NotionRichText = {
  plain_text?: string;
};

type NotionPropertyValue = {
  type?: string;
  title?: NotionRichText[];
  rich_text?: NotionRichText[];
  phone_number?: string | null;
  email?: string | null;
  url?: string | null;
  number?: number | null;
  checkbox?: boolean;
  select?: { name?: string } | null;
  status?: { name?: string } | null;
  multi_select?: Array<{ name?: string }>;
  date?: { start?: string | null; end?: string | null } | null;
  created_time?: string;
  last_edited_time?: string;
  formula?: NotionPropertyValue;
  unique_id?: { prefix?: string | null; number?: number | null };
};

@Injectable()
export class NotionIntegrationsService {
  constructor(
    private readonly env: EnvService,
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService
  ) {}

  isConfigured(): boolean {
    return Boolean(this.env.notionOauthClientId && this.env.notionOauthClientSecret);
  }

  buildAuthorizeUrl(state: string, redirectUri: string): string {
    this.assertConfigured();

    const url = new URL('/v1/oauth/authorize', NOTION_API_BASE_URL);
    url.searchParams.set('owner', 'user');
    url.searchParams.set('client_id', this.env.notionOauthClientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('state', state);
    return url.toString();
  }

  async completeOauth(ownerUserId: string, code: string, redirectUri: string) {
    this.assertConfigured();

    const token = await this.exchangeCode(code, redirectUri);
    const connection = await this.prisma.notionConnection.upsert({
      where: {
        ownerUserId_workspaceId: {
          ownerUserId,
          workspaceId: token.workspace_id
        }
      },
      create: {
        ownerUserId,
        workspaceId: token.workspace_id,
        workspaceName: token.workspace_name,
        workspaceIcon: token.workspace_icon,
        botId: token.bot_id,
        accessToken: this.encryptSecret(token.access_token),
        refreshToken: token.refresh_token ? this.encryptSecret(token.refresh_token) : null
      },
      update: {
        workspaceName: token.workspace_name,
        workspaceIcon: token.workspace_icon,
        botId: token.bot_id,
        accessToken: this.encryptSecret(token.access_token),
        refreshToken: token.refresh_token ? this.encryptSecret(token.refresh_token) : null
      }
    });

    return this.serializeConnection(connection);
  }

  async getStatus(ownerUserId: string) {
    const connection = await this.findLatestConnection(ownerUserId);

    return {
      configured: this.isConfigured(),
      connected: Boolean(connection),
      connection: connection ? this.serializeConnection(connection) : null
    };
  }

  async listDataSources(ownerUserId: string) {
    const connection = await this.requireConnection(ownerUserId);
    const accessToken = this.decryptSecret(connection.accessToken);
    const results: NotionDataSource[] = [];
    let cursor: string | undefined;

    do {
      const response = await this.fetchNotionJson<NotionListResponse<NotionDataSource>>(
        '/v1/search',
        accessToken,
        {
          method: 'POST',
          body: {
            page_size: 100,
            start_cursor: cursor,
            filter: {
              property: 'object',
              value: 'data_source'
            },
            sort: {
              direction: 'descending',
              timestamp: 'last_edited_time'
            }
          }
        }
      );

      results.push(...response.results.filter((item) => item.object === 'data_source'));
      cursor = response.has_more && response.next_cursor ? response.next_cursor : undefined;
    } while (cursor);

    return {
      items: results.map((item) => this.serializeDataSource(item))
    };
  }

  async syncRecipients(ownerUserId: string, dto: SyncNotionRecipientsDto) {
    const connection = await this.requireConnection(ownerUserId);
    const mappings = this.normalizeRecipientMappings(dto.mappings);
    const accessToken = this.decryptSecret(connection.accessToken);
    const dataSource = await this.retrieveDataSource(accessToken, dto.dataSourceId);
    const pages = await this.queryDataSourcePages(accessToken, dto.dataSourceId);
    const records = pages.map((page) => this.pageToRecord(page));
    const source = `notion:${connection.workspaceId}:${dto.dataSourceId}`;
    const importMappings = this.buildImportMappings(mappings, dataSource);

    const importResult = await this.usersService.importUsers(ownerUserId, {
      source,
      records,
      mappings: importMappings
    } as ImportUsersDto);

    const selectedMappings = mappings as Record<string, string>;
    const updated = await this.prisma.notionConnection.update({
      where: { id: connection.id },
      data: {
        selectedDataSourceId: dataSource.id,
        selectedDataSourceName: this.getDataSourceName(dataSource),
        selectedDataSourceUrl: dataSource.url ?? null,
        selectedMappings: selectedMappings as Prisma.InputJsonValue,
        lastSyncedAt: new Date()
      }
    });

    return {
      connection: this.serializeConnection(updated),
      dataSource: this.serializeDataSource(dataSource),
      totalPages: pages.length,
      import: importResult
    };
  }

  private assertConfigured(): void {
    if (!this.isConfigured()) {
      throw new UnauthorizedException('Notion OAuth is not configured');
    }
  }

  private async requireConnection(ownerUserId: string) {
    const connection = await this.findLatestConnection(ownerUserId);
    if (!connection) {
      throw new UnauthorizedException('Notion connection is required');
    }
    return connection;
  }

  private findLatestConnection(ownerUserId: string) {
    return this.prisma.notionConnection.findFirst({
      where: { ownerUserId },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }]
    });
  }

  private serializeConnection(connection: {
    id: string;
    workspaceId: string;
    workspaceName: string | null;
    workspaceIcon: string | null;
    botId: string;
    selectedDataSourceId: string | null;
    selectedDataSourceName: string | null;
    selectedDataSourceUrl: string | null;
    selectedMappings: Prisma.JsonValue | null;
    lastSyncedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: connection.id,
      workspaceId: connection.workspaceId,
      workspaceName: connection.workspaceName,
      workspaceIcon: connection.workspaceIcon,
      botId: connection.botId,
      selectedDataSourceId: connection.selectedDataSourceId,
      selectedDataSourceName: connection.selectedDataSourceName,
      selectedDataSourceUrl: connection.selectedDataSourceUrl,
      selectedMappings: this.toRecord(connection.selectedMappings),
      lastSyncedAt: connection.lastSyncedAt,
      createdAt: connection.createdAt,
      updatedAt: connection.updatedAt
    };
  }

  private serializeDataSource(item: NotionDataSource) {
    return {
      id: item.id,
      name: this.getDataSourceName(item),
      url: item.url ?? null,
      properties: Object.entries(item.properties ?? {})
        .map(([fallbackName, property]) => ({
          id: property.id ?? fallbackName,
          name: property.name ?? fallbackName,
          type: property.type ?? 'unknown'
        }))
        .sort((left, right) => left.name.localeCompare(right.name, 'ko'))
    };
  }

  private getDataSourceName(item: NotionDataSource): string {
    return this.richTextPlainText(item.title) || item.name || 'Untitled';
  }

  private normalizeRecipientMappings(dto: NotionRecipientMappingsDto): Partial<Record<NotionSystemField, string>> {
    const mappings: Partial<Record<NotionSystemField, string>> = {};

    for (const field of NOTION_SYSTEM_FIELDS) {
      const value = dto[field]?.trim();
      if (value) {
        mappings[field] = value;
      }
    }

    if (!mappings.phone) {
      throw new BadRequestException('전화번호 컬럼을 선택해 주세요.');
    }

    return mappings;
  }

  private buildImportMappings(
    mappings: Partial<Record<NotionSystemField, string>>,
    dataSource: NotionDataSource
  ): ImportUsersMappingDto[] {
    const importMappings: ImportUsersMappingDto[] = [
      {
        sourcePath: 'pageId',
        kind: 'SYSTEM',
        systemField: 'externalId'
      } as ImportUsersMappingDto
    ];

    for (const field of NOTION_SYSTEM_FIELDS) {
      const sourcePath = mappings[field];
      if (!sourcePath) {
        continue;
      }

      importMappings.push({
        sourcePath,
        kind: 'SYSTEM',
        systemField: field
      } as ImportUsersMappingDto);
    }

    const mappedSourcePaths = new Set(Object.values(mappings).filter(Boolean));
    const usedCustomKeys = new Set<string>();
    for (const [fallbackName, property] of Object.entries(dataSource.properties ?? {})) {
      const sourcePath = (property.name ?? fallbackName).trim();
      if (!sourcePath || mappedSourcePaths.has(sourcePath)) {
        continue;
      }

      const dataType = this.notionPropertyTypeToManagedUserFieldType(property.type);
      if (!dataType) {
        continue;
      }

      importMappings.push({
        sourcePath,
        kind: 'CUSTOM',
        customKey: this.buildUniqueCustomFieldKey(sourcePath, usedCustomKeys),
        customLabel: sourcePath,
        dataType
      } as ImportUsersMappingDto);
    }

    return importMappings;
  }

  private buildUniqueCustomFieldKey(label: string, usedKeys: Set<string>): string {
    const baseKey = sanitizeCustomFieldKey(label);
    let key = baseKey;
    let suffix = 2;

    while (usedKeys.has(key)) {
      key = `${baseKey}_${suffix}`;
      suffix += 1;
    }

    usedKeys.add(key);
    return key;
  }

  private notionPropertyTypeToManagedUserFieldType(type: string | undefined): ManagedUserFieldType | null {
    switch (type) {
      case 'number':
        return ManagedUserFieldType.NUMBER;
      case 'checkbox':
        return ManagedUserFieldType.BOOLEAN;
      case 'date':
        return ManagedUserFieldType.DATE;
      case 'created_time':
      case 'last_edited_time':
        return ManagedUserFieldType.DATETIME;
      case 'multi_select':
      case 'formula':
        return ManagedUserFieldType.JSON;
      case 'title':
      case 'rich_text':
      case 'phone_number':
      case 'email':
      case 'url':
      case 'select':
      case 'status':
      case 'unique_id':
        return ManagedUserFieldType.TEXT;
      default:
        return null;
    }
  }

  private async exchangeCode(code: string, redirectUri: string): Promise<NotionTokenResponse> {
    const credentials = Buffer.from(
      `${this.env.notionOauthClientId}:${this.env.notionOauthClientSecret}`,
      'utf8'
    ).toString('base64');

    const response = await fetch(`${NOTION_API_BASE_URL}/v1/oauth/token`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'Notion-Version': this.env.notionApiVersion,
        Authorization: `Basic ${credentials}`
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri
      })
    });

    if (!response.ok) {
      throw new BadRequestException(await this.readNotionError(response));
    }

    return (await response.json()) as NotionTokenResponse;
  }

  private async retrieveDataSource(accessToken: string, dataSourceId: string): Promise<NotionDataSource> {
    return this.fetchNotionJson<NotionDataSource>(`/v1/data_sources/${encodeURIComponent(dataSourceId)}`, accessToken);
  }

  private async queryDataSourcePages(accessToken: string, dataSourceId: string): Promise<NotionPage[]> {
    const pages: NotionPage[] = [];
    let cursor: string | undefined;

    do {
      const response = await this.fetchNotionJson<NotionListResponse<NotionPage>>(
        `/v1/data_sources/${encodeURIComponent(dataSourceId)}/query`,
        accessToken,
        {
          method: 'POST',
          body: {
            page_size: 100,
            start_cursor: cursor,
            result_type: 'page'
          }
        }
      );

      pages.push(...response.results.filter((item) => item.object === 'page'));
      cursor = response.has_more && response.next_cursor ? response.next_cursor : undefined;
    } while (cursor);

    return pages;
  }

  private async fetchNotionJson<T>(
    path: string,
    accessToken: string,
    init?: {
      method?: 'GET' | 'POST';
      body?: Record<string, unknown>;
    }
  ): Promise<T> {
    const response = await fetch(`${NOTION_API_BASE_URL}${path}`, {
      method: init?.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'Notion-Version': this.env.notionApiVersion,
        Authorization: `Bearer ${accessToken}`
      },
      body: init?.body ? JSON.stringify(this.removeUndefined(init.body)) : undefined
    });

    if (!response.ok) {
      throw new BadRequestException(await this.readNotionError(response));
    }

    return (await response.json()) as T;
  }

  private pageToRecord(page: NotionPage): Record<string, unknown> {
    const record: Record<string, unknown> = {
      pageId: page.id,
      notionUrl: page.url,
      createdTime: page.created_time,
      lastEditedTime: page.last_edited_time
    };

    for (const [name, property] of Object.entries(page.properties ?? {})) {
      const value = this.propertyToValue(property);
      if (value !== undefined) {
        record[name] = value;
      }
    }

    return record;
  }

  private propertyToValue(property: NotionPropertyValue): unknown {
    switch (property.type) {
      case 'title':
        return this.richTextPlainText(property.title);
      case 'rich_text':
        return this.richTextPlainText(property.rich_text);
      case 'phone_number':
        return property.phone_number ?? undefined;
      case 'email':
        return property.email ?? undefined;
      case 'url':
        return property.url ?? undefined;
      case 'number':
        return property.number ?? undefined;
      case 'checkbox':
        return property.checkbox;
      case 'select':
        return property.select?.name;
      case 'status':
        return property.status?.name;
      case 'multi_select':
        return property.multi_select?.map((item) => item.name).filter(Boolean);
      case 'date':
        return property.date?.start ?? undefined;
      case 'created_time':
        return property.created_time;
      case 'last_edited_time':
        return property.last_edited_time;
      case 'formula':
        return property.formula ? this.propertyToValue(property.formula) : undefined;
      case 'unique_id':
        return [
          property.unique_id?.prefix ?? '',
          property.unique_id?.number == null ? '' : String(property.unique_id.number)
        ].join('');
      default:
        return undefined;
    }
  }

  private richTextPlainText(value: NotionRichText[] | undefined): string | undefined {
    const text = (value ?? [])
      .map((item) => item.plain_text ?? '')
      .join('')
      .trim();

    return text || undefined;
  }

  private encryptSecret(value: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    return [
      'v1',
      iv.toString('base64url'),
      tag.toString('base64url'),
      encrypted.toString('base64url')
    ].join(':');
  }

  private decryptSecret(value: string): string {
    if (!value.startsWith('v1:')) {
      return value;
    }

    const [, ivValue, tagValue, encryptedValue] = value.split(':');
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.encryptionKey(),
      Buffer.from(ivValue, 'base64url')
    );
    decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));

    return Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, 'base64url')),
      decipher.final()
    ]).toString('utf8');
  }

  private encryptionKey(): Buffer {
    const secret =
      this.env.notionTokenEncryptionSecret ||
      this.env.sessionSecret ||
      this.env.notionOauthClientSecret;

    return createHash('sha256').update(secret).digest();
  }

  private toRecord(value: Prisma.JsonValue | null): Record<string, string> {
    if (!value || Array.isArray(value) || typeof value !== 'object') {
      return {};
    }

    return Object.fromEntries(
      Object.entries(value)
        .map(([key, item]) => [key, typeof item === 'string' ? item : ''] as const)
        .filter(([, item]) => Boolean(item))
    );
  }

  private removeUndefined(value: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
  }

  private async readNotionError(response: Response): Promise<string> {
    try {
      const body = (await response.json()) as { message?: string; code?: string };
      return body.message || body.code || `Notion request failed with status ${response.status}`;
    } catch {
      return `Notion request failed with status ${response.status}`;
    }
  }
}
