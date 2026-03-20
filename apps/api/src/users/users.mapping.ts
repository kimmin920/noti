import { ManagedUserFieldType, ManagedUserStatus, Prisma } from '@prisma/client';

export type UserSystemFieldKey =
  | 'source'
  | 'externalId'
  | 'name'
  | 'email'
  | 'phone'
  | 'status'
  | 'userType'
  | 'segment'
  | 'gradeOrLevel'
  | 'marketingConsent'
  | 'registeredAt'
  | 'lastLoginAt'
  | 'tags'
  | 'createdAt'
  | 'updatedAt';

type ImportableUserSystemFieldKey = Exclude<UserSystemFieldKey, 'source' | 'createdAt' | 'updatedAt'>;

export type UserFieldDefinition = {
  key: string;
  label: string;
  kind: 'system' | 'custom';
  dataType: ManagedUserFieldType;
  importable: boolean;
  visibleByDefault: boolean;
};

export type UserImportMapping = {
  sourcePath: string;
  kind: 'IGNORE' | 'SYSTEM' | 'CUSTOM';
  systemField?: string;
  customKey?: string;
  customLabel?: string;
  dataType?: ManagedUserFieldType;
};

export type NormalizedManagedUserImport = {
  externalId?: string;
  name?: string;
  email?: string;
  phone?: string;
  status?: ManagedUserStatus;
  userType?: string;
  segment?: string;
  gradeOrLevel?: string;
  marketingConsent?: boolean;
  registeredAt?: Date;
  lastLoginAt?: Date;
  tags?: string[];
  customAttributes: Record<string, Prisma.InputJsonValue>;
  rawPayload: Prisma.InputJsonObject;
  assignedFieldCount: number;
};

export const USER_SYSTEM_FIELDS: UserFieldDefinition[] = [
  { key: 'source', label: '소스', kind: 'system', dataType: ManagedUserFieldType.TEXT, importable: false, visibleByDefault: true },
  { key: 'externalId', label: '외부 ID', kind: 'system', dataType: ManagedUserFieldType.TEXT, importable: true, visibleByDefault: true },
  { key: 'name', label: '이름', kind: 'system', dataType: ManagedUserFieldType.TEXT, importable: true, visibleByDefault: true },
  { key: 'email', label: '이메일', kind: 'system', dataType: ManagedUserFieldType.TEXT, importable: true, visibleByDefault: true },
  { key: 'phone', label: '전화번호', kind: 'system', dataType: ManagedUserFieldType.TEXT, importable: true, visibleByDefault: true },
  { key: 'status', label: '상태', kind: 'system', dataType: ManagedUserFieldType.TEXT, importable: true, visibleByDefault: true },
  { key: 'userType', label: '유형', kind: 'system', dataType: ManagedUserFieldType.TEXT, importable: true, visibleByDefault: true },
  { key: 'segment', label: '세그먼트', kind: 'system', dataType: ManagedUserFieldType.TEXT, importable: true, visibleByDefault: true },
  { key: 'gradeOrLevel', label: '등급/레벨', kind: 'system', dataType: ManagedUserFieldType.TEXT, importable: true, visibleByDefault: true },
  { key: 'marketingConsent', label: '마케팅 수신', kind: 'system', dataType: ManagedUserFieldType.BOOLEAN, importable: true, visibleByDefault: true },
  { key: 'registeredAt', label: '가입일', kind: 'system', dataType: ManagedUserFieldType.DATETIME, importable: true, visibleByDefault: true },
  { key: 'lastLoginAt', label: '최근 로그인', kind: 'system', dataType: ManagedUserFieldType.DATETIME, importable: true, visibleByDefault: true },
  { key: 'tags', label: '태그', kind: 'system', dataType: ManagedUserFieldType.JSON, importable: true, visibleByDefault: true },
  { key: 'createdAt', label: '생성일', kind: 'system', dataType: ManagedUserFieldType.DATETIME, importable: false, visibleByDefault: false },
  { key: 'updatedAt', label: '수정일', kind: 'system', dataType: ManagedUserFieldType.DATETIME, importable: false, visibleByDefault: false }
];

export function buildUserFieldDefinitions(
  customFields: Array<{ key: string; label: string; dataType: ManagedUserFieldType }>
): UserFieldDefinition[] {
  return [
    ...USER_SYSTEM_FIELDS,
    ...customFields.map((field) => ({
      key: field.key,
      label: field.label,
      kind: 'custom' as const,
      dataType: field.dataType,
      importable: true,
      visibleByDefault: true
    }))
  ];
}

export function sanitizeCustomFieldKey(value: string): string {
  const normalized = value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();

  const safe = normalized || 'custom_field';
  return USER_SYSTEM_FIELDS.some((field) => field.key === safe) ? `${safe}_custom` : safe;
}

export function normalizeManagedUserImportRecord(
  record: Record<string, unknown>,
  mappings: UserImportMapping[],
  fallbackName: string
): NormalizedManagedUserImport {
  const normalized: NormalizedManagedUserImport = {
    customAttributes: {},
    rawPayload: toJsonObject(record),
    assignedFieldCount: 0
  };

  for (const mapping of mappings) {
    const sourcePath = mapping.sourcePath.trim();
    if (!sourcePath || mapping.kind === 'IGNORE') {
      continue;
    }

    const rawValue = getValueByPath(record, sourcePath);
    if (rawValue === undefined) {
      continue;
    }

    if (mapping.kind === 'SYSTEM') {
      const systemField = mapping.systemField as ImportableUserSystemFieldKey | undefined;
      if (!systemField) {
        continue;
      }

      const applied = assignSystemField(normalized, systemField, rawValue);
      if (applied) {
        normalized.assignedFieldCount += 1;
      }
      continue;
    }

    const customKey = sanitizeCustomFieldKey(mapping.customKey || mapping.customLabel || 'custom_field');
    const customValue = normalizeCustomFieldValue(rawValue, mapping.dataType ?? ManagedUserFieldType.TEXT);
    if (customValue !== undefined) {
      normalized.customAttributes[customKey] = customValue;
      normalized.assignedFieldCount += 1;
    }
  }

  if (!normalized.name) {
    normalized.name = normalized.email ?? normalized.phone ?? normalized.externalId ?? fallbackName;
  }

  return normalized;
}

function getValueByPath(value: unknown, sourcePath: string): unknown {
  const segments = sourcePath
    .split('.')
    .map((segment) => segment.trim())
    .filter(Boolean);

  return resolveSegments(value, segments);
}

function resolveSegments(currentValue: unknown, segments: string[]): unknown {
  if (segments.length === 0) {
    return currentValue;
  }

  if (currentValue === null || currentValue === undefined) {
    return undefined;
  }

  const [segment, ...rest] = segments;

  if (Array.isArray(currentValue)) {
    if (/^\d+$/.test(segment)) {
      return resolveSegments(currentValue[Number(segment)], rest);
    }

    const values = currentValue
      .map((item) => resolveSegments(item, segments))
      .filter((value) => value !== undefined);

    if (values.length === 0) {
      return undefined;
    }

    return values.length === 1 ? values[0] : values;
  }

  if (typeof currentValue === 'object') {
    return resolveSegments((currentValue as Record<string, unknown>)[segment], rest);
  }

  return undefined;
}

function assignSystemField(
  normalized: NormalizedManagedUserImport,
  systemField: ImportableUserSystemFieldKey,
  rawValue: unknown
): boolean {
  switch (systemField) {
    case 'externalId': {
      const value = normalizeString(rawValue);
      if (!value) return false;
      normalized.externalId = value;
      return true;
    }
    case 'name': {
      const value = normalizeString(rawValue);
      if (!value) return false;
      normalized.name = value;
      return true;
    }
    case 'email': {
      const value = normalizeString(rawValue)?.toLowerCase();
      if (!value) return false;
      normalized.email = value;
      return true;
    }
    case 'phone': {
      const value = normalizePhone(rawValue);
      if (!value) return false;
      normalized.phone = value;
      return true;
    }
    case 'status': {
      const value = normalizeStatus(rawValue);
      if (!value) return false;
      normalized.status = value;
      return true;
    }
    case 'userType': {
      const value = normalizeString(rawValue);
      if (!value) return false;
      normalized.userType = value;
      return true;
    }
    case 'segment': {
      const value = normalizeString(rawValue);
      if (!value) return false;
      normalized.segment = value;
      return true;
    }
    case 'gradeOrLevel': {
      const value = normalizeString(rawValue);
      if (!value) return false;
      normalized.gradeOrLevel = value;
      return true;
    }
    case 'marketingConsent': {
      const value = normalizeBoolean(rawValue);
      if (value === undefined) return false;
      normalized.marketingConsent = value;
      return true;
    }
    case 'registeredAt': {
      const value = normalizeDate(rawValue);
      if (!value) return false;
      normalized.registeredAt = value;
      return true;
    }
    case 'lastLoginAt': {
      const value = normalizeDate(rawValue);
      if (!value) return false;
      normalized.lastLoginAt = value;
      return true;
    }
    case 'tags': {
      const value = normalizeTags(rawValue);
      if (!value || value.length === 0) return false;
      normalized.tags = value;
      return true;
    }
    default:
      return false;
  }
}

function normalizeCustomFieldValue(rawValue: unknown, dataType: ManagedUserFieldType): Prisma.InputJsonValue | undefined {
  switch (dataType) {
    case ManagedUserFieldType.NUMBER:
      return normalizeNumber(rawValue);
    case ManagedUserFieldType.BOOLEAN:
      return normalizeBoolean(rawValue);
    case ManagedUserFieldType.DATE:
    case ManagedUserFieldType.DATETIME: {
      const dateValue = normalizeDate(rawValue);
      return dateValue ? dateValue.toISOString() : undefined;
    }
    case ManagedUserFieldType.JSON:
      return toJsonValue(rawValue);
    case ManagedUserFieldType.TEXT:
    default:
      return normalizeString(rawValue);
  }
}

function normalizeString(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    for (const item of value) {
      const normalized = normalizeString(item);
      if (normalized) {
        return normalized;
      }
    }
    return undefined;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return undefined;
}

export function normalizeManagedUserPhone(value: unknown): string | undefined {
  const raw = normalizeString(value);
  if (!raw) {
    return undefined;
  }

  const normalized = raw.replace(/[^0-9+]/g, '');
  if (!normalized) {
    return undefined;
  }

  if (normalized.startsWith('746010')) {
    return normalized.slice(3);
  }

  return normalized;
}

function normalizePhone(value: unknown): string | undefined {
  return normalizeManagedUserPhone(value);
}

function normalizeNumber(value: unknown): number | undefined {
  if (Array.isArray(value)) {
    for (const item of value) {
      const normalized = normalizeNumber(item);
      if (normalized !== undefined) {
        return normalized;
      }
    }
    return undefined;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.replace(/,/g, '').trim();
    if (!normalized) {
      return undefined;
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function normalizeBoolean(value: unknown): boolean | undefined {
  if (Array.isArray(value)) {
    for (const item of value) {
      const normalized = normalizeBoolean(item);
      if (normalized !== undefined) {
        return normalized;
      }
    }
    return undefined;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
    return undefined;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }

  if (['y', 'yes', 'true', '1', '동의', '수신', 'consent'].includes(normalized)) {
    return true;
  }

  if (['n', 'no', 'false', '0', '미동의', '거부'].includes(normalized)) {
    return false;
  }

  return undefined;
}

function normalizeDate(value: unknown): Date | undefined {
  if (Array.isArray(value)) {
    for (const item of value) {
      const normalized = normalizeDate(item);
      if (normalized) {
        return normalized;
      }
    }
    return undefined;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }

  if (typeof value !== 'string' && typeof value !== 'number') {
    return undefined;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function normalizeStatus(value: unknown): ManagedUserStatus | undefined {
  const raw = normalizeString(value)?.toLowerCase();
  if (!raw) {
    return undefined;
  }

  if (['active', 'enabled', 'member', 'normal', 'approved', 'open', '사용중', '정상'].includes(raw)) {
    return ManagedUserStatus.ACTIVE;
  }

  if (['inactive', 'disabled', 'deleted', 'withdrawn', '휴면예정', '비활성'].includes(raw)) {
    return ManagedUserStatus.INACTIVE;
  }

  if (['dormant', 'sleep', '휴면'].includes(raw)) {
    return ManagedUserStatus.DORMANT;
  }

  if (['blocked', 'ban', 'banned', 'suspended', '정지', '차단'].includes(raw)) {
    return ManagedUserStatus.BLOCKED;
  }

  return undefined;
}

function normalizeTags(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    const normalized = value
      .map((item) => normalizeString(item))
      .filter(Boolean) as string[];
    return normalized.length > 0 ? normalized : undefined;
  }

  if (typeof value === 'string') {
    const normalized = value
      .split(/[,\n|]/)
      .map((item) => item.trim())
      .filter(Boolean);
    return normalized.length > 0 ? normalized : undefined;
  }

  return undefined;
}

function toJsonObject(record: Record<string, unknown>): Prisma.InputJsonObject {
  const normalizedEntries = Object.entries(record)
    .map(([key, value]) => [key, toJsonValue(value)] as const)
    .filter((entry): entry is [string, Prisma.InputJsonValue] => entry[1] !== undefined);

  return Object.fromEntries(normalizedEntries) as Prisma.InputJsonObject;
}

function toJsonValue(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => toJsonValue(item))
      .filter((item): item is Prisma.InputJsonValue => item !== undefined) as Prisma.InputJsonArray;
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .map(([key, innerValue]) => [key, toJsonValue(innerValue)] as const)
      .filter((entry): entry is [string, Prisma.InputJsonValue] => entry[1] !== undefined);

    return Object.fromEntries(entries) as Prisma.InputJsonObject;
  }

  return String(value);
}
