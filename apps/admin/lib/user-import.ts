import type {
  ManagedUser,
  ManagedUserFieldDefinition,
  ManagedUserFieldType,
  ManagedUserStatus
} from '@/types/admin';

type ImportableSystemFieldKey =
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
  | 'tags';

export type ManagedUserImportMapping = {
  kind: 'SYSTEM' | 'CUSTOM';
  targetKey: string;
  label: string;
  dataType: ManagedUserFieldType;
  sourcePath: string;
};

export type SourcePathOption = {
  path: string;
  samples: string[];
};

export type PreviewManagedUser = Omit<ManagedUser, 'id' | 'createdAt' | 'updatedAt'>;

const FIELD_ALIASES: Record<ImportableSystemFieldKey, string[]> = {
  externalId: ['id', 'userId', 'user_id', 'memberId', 'member_id', 'customerId', 'customer_id', 'studentId', 'student_id', 'uid'],
  name: ['name', 'fullName', 'full_name', 'userName', 'user_name', 'memberName', 'member_name', 'customerName', 'customer_name', 'studentName', 'student_name', 'nickname'],
  email: ['email', 'emailAddress', 'email_address', 'mail'],
  phone: ['phone', 'phoneNumber', 'phone_number', 'mobile', 'mobileNumber', 'mobile_number', 'tel'],
  status: ['status', 'userStatus', 'user_status', 'memberStatus', 'member_status', 'state', 'statusName', 'status_name'],
  userType: ['type', 'userType', 'user_type', 'memberType', 'member_type', 'role', 'accountType', 'account_type'],
  segment: ['segment', 'group', 'groupName', 'group_name', 'cohort', 'cohortName', 'cohort_name', 'category'],
  gradeOrLevel: ['grade', 'level', 'tier', 'membershipLevel', 'membership_level', 'courseLevel', 'course_level', 'progressStep', 'progress_step'],
  marketingConsent: ['marketingConsent', 'marketing_consent', 'marketingYn', 'marketing_yn', 'smsConsent', 'sms_consent', 'emailConsent', 'email_consent', 'consent'],
  registeredAt: ['registeredAt', 'registered_at', 'createdAt', 'created_at', 'joinedAt', 'joined_at', 'signupAt', 'signup_at', 'enrolledAt', 'enrolled_at'],
  lastLoginAt: ['lastLoginAt', 'last_login_at', 'loginAt', 'login_at', 'lastSeenAt', 'last_seen_at', 'lastActiveAt', 'last_active_at'],
  tags: ['tags', 'labels', 'segments', 'interests']
};

export const DEFAULT_MANAGED_USER_FIELDS: ManagedUserFieldDefinition[] = [
  { key: 'source', label: '소스', kind: 'system', dataType: 'TEXT', importable: false, visibleByDefault: true },
  { key: 'externalId', label: '외부 ID', kind: 'system', dataType: 'TEXT', importable: true, visibleByDefault: true },
  { key: 'name', label: '이름', kind: 'system', dataType: 'TEXT', importable: true, visibleByDefault: true },
  { key: 'email', label: '이메일', kind: 'system', dataType: 'TEXT', importable: true, visibleByDefault: true },
  { key: 'phone', label: '전화번호', kind: 'system', dataType: 'TEXT', importable: true, visibleByDefault: true },
  { key: 'status', label: '상태', kind: 'system', dataType: 'TEXT', importable: true, visibleByDefault: true },
  { key: 'userType', label: '유형', kind: 'system', dataType: 'TEXT', importable: true, visibleByDefault: true },
  { key: 'segment', label: '세그먼트', kind: 'system', dataType: 'TEXT', importable: true, visibleByDefault: true },
  { key: 'gradeOrLevel', label: '등급/레벨', kind: 'system', dataType: 'TEXT', importable: true, visibleByDefault: true },
  { key: 'marketingConsent', label: '수신 여부', kind: 'system', dataType: 'BOOLEAN', importable: true, visibleByDefault: true },
  { key: 'registeredAt', label: '가입일', kind: 'system', dataType: 'DATETIME', importable: true, visibleByDefault: true },
  { key: 'lastLoginAt', label: '최근 로그인', kind: 'system', dataType: 'DATETIME', importable: true, visibleByDefault: true },
  { key: 'tags', label: '태그', kind: 'system', dataType: 'JSON', importable: true, visibleByDefault: true }
];

export const SAMPLE_USER_IMPORT_JSON = `[
  {
    "user": {
      "id": "publ_user_1001",
      "name": "김민우",
      "email": "minwoo@example.com",
      "marketingConsent": "Y",
      "profileAdditionalInformations": {
        "value": "010-1234-5678"
      }
    }
  },
  {
    "user": {
      "id": "publ_user_1002",
      "name": "이서윤",
      "email": "seoyoon@example.com",
      "marketingConsent": "N",
      "profileAdditionalInformations": {
        "value": "010-5555-4444"
      }
    }
  }
]`;

export function extractImportRecords(rawJson: string): Record<string, unknown>[] {
  const parsed = JSON.parse(rawJson) as unknown;
  return unwrapRecordArray(parsed);
}

export function unwrapRecordArray(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    const records = value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item));
    if (records.length === 0) {
      throw new Error('JSON 배열 안에 객체 레코드가 없습니다.');
    }
    return records;
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const listKeys = ['users', 'items', 'data', 'members', 'results', 'list'];

    for (const key of listKeys) {
      if (Array.isArray(record[key])) {
        return unwrapRecordArray(record[key]);
      }
    }
  }

  throw new Error('배열 형태의 유저 JSON을 넣어주세요.');
}

export function collectSourcePathOptions(records: Record<string, unknown>[]): SourcePathOption[] {
  const samples = new Map<string, string[]>();

  for (const record of records) {
    collectPathSamples(record, '', samples, 0);
  }

  return [...samples.entries()]
    .map(([path, values]) => ({ path, samples: values }))
    .sort((left, right) => left.path.localeCompare(right.path));
}

export function buildSystemMappings(
  availableFields: ManagedUserFieldDefinition[],
  sourcePathOptions: SourcePathOption[]
): ManagedUserImportMapping[] {
  return availableFields
    .filter((field) => field.kind === 'system' && field.importable)
    .map((field) => ({
      kind: 'SYSTEM' as const,
      targetKey: field.key,
      label: field.label,
      dataType: field.dataType,
      sourcePath: inferSuggestedSourcePath(field.key as ImportableSystemFieldKey, sourcePathOptions)
    }));
}

export function buildPreviewUsers(
  records: Record<string, unknown>[],
  source: string,
  mappings: ManagedUserImportMapping[]
): PreviewManagedUser[] {
  return records
    .slice(0, 5)
    .map((record, index) => normalizePreviewUser(record, source, mappings, index + 1))
    .filter((record): record is PreviewManagedUser => record !== null);
}

export function findSamplesForPath(pathOptions: SourcePathOption[], path: string) {
  if (!path) {
    return [];
  }

  return pathOptions.find((option) => option.path === path)?.samples ?? [];
}

export function sanitizeCustomFieldKey(value: string): string {
  const normalized = value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();

  const safe = normalized || 'custom_field';
  return DEFAULT_MANAGED_USER_FIELDS.some((field) => field.key === safe) ? `${safe}_custom` : safe;
}

function collectPathSamples(
  value: unknown,
  basePath: string,
  samples: Map<string, string[]>,
  depth: number
) {
  if (depth > 5 || value === null || value === undefined) {
    return;
  }

  if (Array.isArray(value)) {
    const primitiveSamples = value
      .map((item) => formatSampleValue(item))
      .filter(Boolean)
      .slice(0, 3);

    if (primitiveSamples.length > 0 && basePath) {
      addSample(samples, basePath, primitiveSamples.join(', '));
    }

    value.slice(0, 3).forEach((item) => {
      if (item && typeof item === 'object') {
        collectPathSamples(item, basePath, samples, depth + 1);
      }
    });
    return;
  }

  if (typeof value === 'object') {
    for (const [key, innerValue] of Object.entries(value as Record<string, unknown>)) {
      const nextPath = basePath ? `${basePath}.${key}` : key;
      collectPathSamples(innerValue, nextPath, samples, depth + 1);
    }
    return;
  }

  if (basePath) {
    addSample(samples, basePath, formatSampleValue(value));
  }
}

function addSample(samples: Map<string, string[]>, path: string, sample: string) {
  if (!sample) {
    return;
  }

  const existing = samples.get(path) ?? [];
  if (!existing.includes(sample) && existing.length < 3) {
    existing.push(sample);
  }
  samples.set(path, existing);
}

function inferSuggestedSourcePath(fieldKey: ImportableSystemFieldKey, pathOptions: SourcePathOption[]) {
  const aliases = FIELD_ALIASES[fieldKey];

  for (const option of pathOptions) {
    const leaf = option.path.split('.').at(-1) ?? option.path;
    const normalizedLeaf = normalizeLookupKey(leaf);
    if (aliases.some((alias) => normalizeLookupKey(alias) === normalizedLeaf)) {
      return option.path;
    }
  }

  for (const option of pathOptions) {
    const normalizedPath = normalizeLookupKey(option.path);
    if (aliases.some((alias) => normalizedPath.endsWith(normalizeLookupKey(alias)))) {
      return option.path;
    }
  }

  return '';
}

function normalizePreviewUser(
  record: Record<string, unknown>,
  source: string,
  mappings: ManagedUserImportMapping[],
  index: number
): PreviewManagedUser | null {
  const previewUser: PreviewManagedUser = {
    source,
    externalId: null,
    name: '',
    email: null,
    phone: null,
    status: 'ACTIVE',
    userType: null,
    segment: null,
    gradeOrLevel: null,
    marketingConsent: null,
    tags: [],
    registeredAt: null,
    lastLoginAt: null,
    customAttributes: {}
  };

  let assignedCount = 0;

  for (const mapping of mappings) {
    if (!mapping.sourcePath.trim()) {
      continue;
    }

    const rawValue = resolvePathValue(record, mapping.sourcePath.trim());
    if (rawValue === undefined) {
      continue;
    }

    if (mapping.kind === 'SYSTEM') {
      const applied = assignPreviewSystemField(previewUser, mapping.targetKey as ImportableSystemFieldKey, rawValue);
      if (applied) {
        assignedCount += 1;
      }
      continue;
    }

    const customValue = normalizeCustomFieldValue(rawValue, mapping.dataType);
    if (customValue !== undefined) {
      previewUser.customAttributes[mapping.targetKey] = customValue;
      assignedCount += 1;
    }
  }

  if (assignedCount === 0) {
    return null;
  }

  previewUser.name = previewUser.name || previewUser.email || previewUser.phone || previewUser.externalId || `${source} user ${index}`;
  return previewUser;
}

function assignPreviewSystemField(user: PreviewManagedUser, systemField: ImportableSystemFieldKey, rawValue: unknown) {
  switch (systemField) {
    case 'externalId': {
      const value = normalizeString(rawValue);
      if (!value) return false;
      user.externalId = value;
      return true;
    }
    case 'name': {
      const value = normalizeString(rawValue);
      if (!value) return false;
      user.name = value;
      return true;
    }
    case 'email': {
      const value = normalizeString(rawValue)?.toLowerCase() ?? null;
      if (!value) return false;
      user.email = value;
      return true;
    }
    case 'phone': {
      const value = normalizePhone(rawValue);
      if (!value) return false;
      user.phone = value;
      return true;
    }
    case 'status': {
      const value = normalizeStatus(rawValue);
      if (!value) return false;
      user.status = value;
      return true;
    }
    case 'userType': {
      const value = normalizeString(rawValue);
      if (!value) return false;
      user.userType = value;
      return true;
    }
    case 'segment': {
      const value = normalizeString(rawValue);
      if (!value) return false;
      user.segment = value;
      return true;
    }
    case 'gradeOrLevel': {
      const value = normalizeString(rawValue);
      if (!value) return false;
      user.gradeOrLevel = value;
      return true;
    }
    case 'marketingConsent': {
      const value = normalizeBoolean(rawValue);
      if (value === undefined) return false;
      user.marketingConsent = value;
      return true;
    }
    case 'registeredAt': {
      const value = normalizeDate(rawValue);
      if (!value) return false;
      user.registeredAt = value.toISOString();
      return true;
    }
    case 'lastLoginAt': {
      const value = normalizeDate(rawValue);
      if (!value) return false;
      user.lastLoginAt = value.toISOString();
      return true;
    }
    case 'tags': {
      const value = normalizeTags(rawValue);
      if (!value || value.length === 0) return false;
      user.tags = value;
      return true;
    }
    default:
      return false;
  }
}

function resolvePathValue(value: unknown, sourcePath: string): unknown {
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

function normalizeCustomFieldValue(rawValue: unknown, dataType: ManagedUserFieldType): unknown {
  switch (dataType) {
    case 'NUMBER':
      return normalizeNumber(rawValue);
    case 'BOOLEAN':
      return normalizeBoolean(rawValue);
    case 'DATE':
    case 'DATETIME': {
      const dateValue = normalizeDate(rawValue);
      return dateValue ? dateValue.toISOString() : undefined;
    }
    case 'JSON':
      return rawValue === undefined ? undefined : rawValue;
    case 'TEXT':
    default:
      return normalizeString(rawValue);
  }
}

function formatSampleValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => formatSampleValue(item))
      .filter(Boolean)
      .join(', ');
  }

  return JSON.stringify(value);
}

function normalizeLookupKey(value: string) {
  return value.replace(/[^A-Za-z0-9]+/g, '').toLowerCase();
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
    return trimmed || undefined;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return undefined;
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
    const parsed = Number(value.replace(/,/g, '').trim());
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function normalizePhone(value: unknown): string | undefined {
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
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['y', 'yes', 'true', '1', '동의', '수신', 'consent'].includes(normalized)) {
      return true;
    }
    if (['n', 'no', 'false', '0', '미동의', '거부'].includes(normalized)) {
      return false;
    }
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
    return 'ACTIVE';
  }

  if (['inactive', 'disabled', 'deleted', 'withdrawn', '휴면예정', '비활성'].includes(raw)) {
    return 'INACTIVE';
  }

  if (['dormant', 'sleep', '휴면'].includes(raw)) {
    return 'DORMANT';
  }

  if (['blocked', 'ban', 'banned', 'suspended', '정지', '차단'].includes(raw)) {
    return 'BLOCKED';
  }

  return undefined;
}

function normalizeTags(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    const normalized = value.map((item) => normalizeString(item)).filter(Boolean) as string[];
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
