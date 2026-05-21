import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ManagedUserFieldType, Prisma } from '@prisma/client';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { EnvService } from '../../common/env';
import { PrismaService } from '../../database/prisma.service';
import { ImportUsersDto, ImportUsersMappingDto } from '../../users/users.dto';
import { sanitizeCustomFieldKey } from '../../users/users.mapping';
import { UsersService } from '../../users/users.service';
import { NotionCustomMappingDto, NotionRecipientMappingsDto, SyncNotionRecipientsDto } from './notion-integrations.dto';

const NOTION_API_BASE_URL = 'https://api.notion.com';
const NOTION_PREVIEW_PAGE_SIZE = 20;

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

type NotionOption = {
  name?: string;
  color?: string;
};

type NotionUser = {
  name?: string | null;
  person?: {
    email?: string | null;
  };
};

type NotionFile = {
  name?: string;
  file?: {
    url?: string;
  };
  external?: {
    url?: string;
  };
};

type NotionDateValue = {
  start?: string | null;
  end?: string | null;
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
  select?: NotionOption | null;
  status?: NotionOption | null;
  multi_select?: NotionOption[];
  date?: NotionDateValue | null;
  created_time?: string;
  last_edited_time?: string;
  created_by?: NotionUser | null;
  last_edited_by?: NotionUser | null;
  people?: NotionUser[];
  files?: NotionFile[];
  relation?: Array<{ id?: string }>;
  formula?: NotionPropertyValue & {
    string?: string | null;
    boolean?: boolean | null;
  };
  rollup?: {
    type?: string;
    number?: number | null;
    date?: NotionDateValue | null;
    array?: NotionPropertyValue[];
  };
  unique_id?: { prefix?: string | null; number?: number | null };
};

type NotionFormulaValue = NotionPropertyValue & {
  string?: string | null;
  boolean?: boolean | null;
};

type SerializedNotionDataSourceProperty = {
  id: string;
  name: string;
  type: string;
};

type NotionPreviewCell = {
  kind: 'text' | 'number' | 'checkbox' | 'labels' | 'date' | 'url' | 'empty';
  type: string;
  text: string;
  value: string | number | boolean | string[] | null;
  checked?: boolean;
  href?: string | null;
  labels?: Array<{
    name: string;
    color: string | null;
  }>;
};

type NormalizedNotionCustomMapping = {
  sourcePath: string;
  customLabel: string;
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

  async previewDataSource(ownerUserId: string, dataSourceId: string) {
    const connection = await this.requireConnection(ownerUserId);
    const accessToken = this.decryptSecret(connection.accessToken);
    const dataSource = await this.retrieveDataSource(accessToken, dataSourceId);
    const response = await this.queryDataSourcePageBatch(accessToken, dataSourceId, undefined, NOTION_PREVIEW_PAGE_SIZE);
    const pages = response.results.filter((item) => item.object === 'page');
    const columns = this.serializeDataSourceProperties(dataSource, false);

    return {
      dataSource: this.serializeDataSource(dataSource),
      columns,
      rows: pages.map((page) => this.pageToPreviewRow(page, columns)),
      totalPages: pages.length,
      hasMore: response.has_more
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
    const customMappings = dto.customMappings === undefined
      ? this.buildDefaultCustomMappings(mappings, dataSource)
      : this.normalizeCustomMappings(dto.customMappings, mappings, dataSource);
    const importMappings = this.buildImportMappings(mappings, dataSource, customMappings);

    const importResult = await this.usersService.importUsers(ownerUserId, {
      source,
      records,
      mappings: importMappings
    } as ImportUsersDto);

    const selectedMappings = this.buildSelectedMappingsPayload(mappings, customMappings);
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
    const selectedMappings = this.toJsonRecord(connection.selectedMappings);

    return {
      id: connection.id,
      workspaceId: connection.workspaceId,
      workspaceName: connection.workspaceName,
      workspaceIcon: connection.workspaceIcon,
      botId: connection.botId,
      selectedDataSourceId: connection.selectedDataSourceId,
      selectedDataSourceName: connection.selectedDataSourceName,
      selectedDataSourceUrl: connection.selectedDataSourceUrl,
      selectedMappings: this.extractSystemMappings(selectedMappings),
      selectedCustomMappings: this.extractCustomMappings(selectedMappings),
      selectedCustomMappingsConfigured: Object.prototype.hasOwnProperty.call(selectedMappings, '_custom'),
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
      properties: this.serializeDataSourceProperties(item, true)
    };
  }

  private serializeDataSourceProperties(item: NotionDataSource, sort: boolean): SerializedNotionDataSourceProperty[] {
    const properties = Object.entries(item.properties ?? {})
      .map(([fallbackName, property]) => ({
        id: property.id ?? fallbackName,
        name: property.name ?? fallbackName,
        type: property.type ?? 'unknown'
      }));

    return sort ? properties.sort((left, right) => left.name.localeCompare(right.name, 'ko')) : properties;
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

    if (!mappings.name) {
      throw new BadRequestException('이름 컬럼을 선택해 주세요.');
    }

    if (!mappings.phone) {
      throw new BadRequestException('전화번호 컬럼을 선택해 주세요.');
    }

    return mappings;
  }

  private normalizeCustomMappings(
    dtoMappings: NotionCustomMappingDto[],
    systemMappings: Partial<Record<NotionSystemField, string>>,
    dataSource: NotionDataSource
  ): NormalizedNotionCustomMapping[] {
    const properties = new Map(this.serializeDataSourceProperties(dataSource, false).map((property) => [property.name, property]));
    const mappedSystemPaths = new Set(Object.values(systemMappings).filter(Boolean));
    const usedSourcePaths = new Set<string>();
    const customMappings: NormalizedNotionCustomMapping[] = [];

    for (const dtoMapping of dtoMappings) {
      const sourcePath = dtoMapping.sourcePath?.trim();
      if (!sourcePath || mappedSystemPaths.has(sourcePath) || usedSourcePaths.has(sourcePath)) {
        continue;
      }

      const property = properties.get(sourcePath);
      if (!property || !this.notionPropertyTypeToManagedUserFieldType(property.type)) {
        continue;
      }

      usedSourcePaths.add(sourcePath);
      customMappings.push({
        sourcePath,
        customLabel: dtoMapping.customLabel?.trim() || sourcePath
      });
    }

    return customMappings;
  }

  private buildSelectedMappingsPayload(
    mappings: Partial<Record<NotionSystemField, string>>,
    customMappings: NormalizedNotionCustomMapping[]
  ) {
    return {
      ...(mappings as Record<string, string>),
      _custom: customMappings
    } as Prisma.InputJsonValue;
  }

  private buildImportMappings(
    mappings: Partial<Record<NotionSystemField, string>>,
    dataSource: NotionDataSource,
    customMappings?: NormalizedNotionCustomMapping[]
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
    const customSourceProperties = this.serializeDataSourceProperties(dataSource, false);
    const selectedCustomMappings = customMappings ?? this.buildDefaultCustomMappings(mappings, dataSource);

    for (const customMapping of selectedCustomMappings) {
      const sourcePath = customMapping.sourcePath.trim();
      if (!sourcePath || mappedSourcePaths.has(sourcePath)) {
        continue;
      }

      const property = customSourceProperties.find((item) => item.name === sourcePath);
      if (!property) {
        continue;
      }

      const dataType = this.notionPropertyTypeToManagedUserFieldType(property.type);
      if (!dataType) {
        continue;
      }

      importMappings.push({
        sourcePath,
        kind: 'CUSTOM',
        customKey: this.buildUniqueCustomFieldKey(customMapping.customLabel || sourcePath, usedCustomKeys),
        customLabel: customMapping.customLabel || sourcePath,
        dataType
      } as ImportUsersMappingDto);
    }

    return importMappings;
  }

  private buildDefaultCustomMappings(
    mappings: Partial<Record<NotionSystemField, string>>,
    dataSource: NotionDataSource
  ): NormalizedNotionCustomMapping[] {
    const mappedSourcePaths = new Set(Object.values(mappings).filter(Boolean));

    return this.serializeDataSourceProperties(dataSource, false)
      .filter((property) => !mappedSourcePaths.has(property.name))
      .filter((property) => this.notionPropertyTypeToManagedUserFieldType(property.type))
      .map((property) => ({
        sourcePath: property.name,
        customLabel: property.name
      }));
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
      case 'people':
      case 'files':
      case 'relation':
      case 'multi_select':
      case 'formula':
      case 'rollup':
        return ManagedUserFieldType.JSON;
      case 'title':
      case 'rich_text':
      case 'phone_number':
      case 'email':
      case 'url':
      case 'select':
      case 'status':
      case 'created_by':
      case 'last_edited_by':
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
      const response = await this.queryDataSourcePageBatch(accessToken, dataSourceId, cursor, 100);

      pages.push(...response.results.filter((item) => item.object === 'page'));
      cursor = response.has_more && response.next_cursor ? response.next_cursor : undefined;
    } while (cursor);

    return pages;
  }

  private async queryDataSourcePageBatch(
    accessToken: string,
    dataSourceId: string,
    cursor: string | undefined,
    pageSize: number
  ): Promise<NotionListResponse<NotionPage>> {
    return this.fetchNotionJson<NotionListResponse<NotionPage>>(
      `/v1/data_sources/${encodeURIComponent(dataSourceId)}/query`,
      accessToken,
      {
        method: 'POST',
        body: {
          page_size: pageSize,
          start_cursor: cursor,
          result_type: 'page'
        }
      }
    );
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

  private pageToPreviewRow(page: NotionPage, columns: SerializedNotionDataSourceProperty[]) {
    const cells: Record<string, NotionPreviewCell> = {};

    for (const column of columns) {
      const property = page.properties?.[column.name];
      cells[column.name] = property ? this.propertyToPreviewCell(property) : this.emptyPreviewCell(column.type);
    }

    return {
      id: page.id,
      url: page.url ?? null,
      createdTime: page.created_time ?? null,
      lastEditedTime: page.last_edited_time ?? null,
      cells
    };
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
      case 'created_by':
        return this.notionUserName(property.created_by);
      case 'last_edited_by':
        return this.notionUserName(property.last_edited_by);
      case 'people':
        return property.people?.map((user) => this.notionUserName(user)).filter(Boolean);
      case 'files':
        return property.files?.map((file) => file.name ?? file.file?.url ?? file.external?.url).filter(Boolean);
      case 'relation':
        return property.relation?.map((item) => item.id).filter(Boolean);
      case 'formula':
        return property.formula ? this.propertyToValue(property.formula) : undefined;
      case 'rollup':
        return property.rollup ? this.rollupToValue(property.rollup) : undefined;
      case 'unique_id':
        return [
          property.unique_id?.prefix ?? '',
          property.unique_id?.number == null ? '' : String(property.unique_id.number)
        ].join('');
      default:
        return undefined;
    }
  }

  private propertyToPreviewCell(property: NotionPropertyValue): NotionPreviewCell {
    const type = property.type ?? 'unknown';

    switch (type) {
      case 'title':
        return this.textPreviewCell(type, this.richTextPlainText(property.title));
      case 'rich_text':
        return this.textPreviewCell(type, this.richTextPlainText(property.rich_text));
      case 'phone_number':
        return this.textPreviewCell(type, property.phone_number ?? undefined);
      case 'email':
        return this.textPreviewCell(type, property.email ?? undefined);
      case 'url':
        return this.urlPreviewCell(type, property.url ?? undefined);
      case 'number':
        return this.numberPreviewCell(type, property.number ?? undefined);
      case 'checkbox':
        return {
          kind: 'checkbox',
          type,
          text: property.checkbox ? '체크됨' : '체크 안 됨',
          value: property.checkbox ?? false,
          checked: property.checkbox === true
        };
      case 'select':
        return this.labelsPreviewCell(type, property.select ? [property.select] : []);
      case 'status':
        return this.labelsPreviewCell(type, property.status ? [property.status] : []);
      case 'multi_select':
        return this.labelsPreviewCell(type, property.multi_select ?? []);
      case 'date':
        return this.datePreviewCell(type, property.date);
      case 'created_time':
        return this.datePreviewCell(type, { start: property.created_time });
      case 'last_edited_time':
        return this.datePreviewCell(type, { start: property.last_edited_time });
      case 'created_by':
        return this.textPreviewCell(type, this.notionUserName(property.created_by));
      case 'last_edited_by':
        return this.textPreviewCell(type, this.notionUserName(property.last_edited_by));
      case 'people':
        return this.labelsPreviewCell(
          type,
          (property.people ?? []).map((user) => ({ name: this.notionUserName(user), color: 'default' }))
        );
      case 'files':
        return this.labelsPreviewCell(
          type,
          (property.files ?? []).map((file) => ({ name: file.name ?? file.file?.url ?? file.external?.url, color: 'default' }))
        );
      case 'relation': {
        const count = property.relation?.length ?? 0;
        return count > 0 ? this.textPreviewCell(type, `${count}개 연결`) : this.emptyPreviewCell(type);
      }
      case 'formula':
        return this.formulaPreviewCell(type, property.formula);
      case 'rollup':
        return this.rollupPreviewCell(type, property.rollup);
      case 'unique_id':
        return this.textPreviewCell(
          type,
          [
            property.unique_id?.prefix ?? '',
            property.unique_id?.number == null ? '' : String(property.unique_id.number)
          ].join('')
        );
      default:
        return this.emptyPreviewCell(type);
    }
  }

  private formulaPreviewCell(type: string, formula: NotionFormulaValue | undefined): NotionPreviewCell {
    if (!formula) {
      return this.emptyPreviewCell(type);
    }

    switch (formula.type) {
      case 'string':
        return this.textPreviewCell(type, formula.string ?? undefined);
      case 'number':
        return this.numberPreviewCell(type, formula.number ?? undefined);
      case 'boolean':
        return {
          kind: 'checkbox',
          type,
          text: formula.boolean ? '체크됨' : '체크 안 됨',
          value: formula.boolean ?? false,
          checked: formula.boolean === true
        };
      case 'date':
        return this.datePreviewCell(type, formula.date);
      default: {
        const cell = this.propertyToPreviewCell(formula);
        return {
          ...cell,
          type
        };
      }
    }
  }

  private rollupPreviewCell(type: string, rollup: NotionPropertyValue['rollup']): NotionPreviewCell {
    if (!rollup) {
      return this.emptyPreviewCell(type);
    }

    switch (rollup.type) {
      case 'number':
        return this.numberPreviewCell(type, rollup.number ?? undefined);
      case 'date':
        return this.datePreviewCell(type, rollup.date);
      case 'array': {
        const values = (rollup.array ?? [])
          .map((item) => this.propertyToPreviewCell(item).text)
          .filter(Boolean);
        return values.length > 0 ? this.textPreviewCell(type, values.join(', ')) : this.emptyPreviewCell(type);
      }
      default:
        return this.emptyPreviewCell(type);
    }
  }

  private rollupToValue(rollup: NonNullable<NotionPropertyValue['rollup']>): unknown {
    switch (rollup.type) {
      case 'number':
        return rollup.number ?? undefined;
      case 'date':
        return rollup.date?.start ?? undefined;
      case 'array':
        return (rollup.array ?? [])
          .map((item) => this.propertyToValue(item))
          .filter((value) => value !== undefined);
      default:
        return undefined;
    }
  }

  private textPreviewCell(type: string, value: string | undefined): NotionPreviewCell {
    const text = value?.trim() ?? '';
    return text
      ? {
          kind: 'text',
          type,
          text,
          value: text
        }
      : this.emptyPreviewCell(type);
  }

  private urlPreviewCell(type: string, value: string | undefined): NotionPreviewCell {
    const text = value?.trim() ?? '';
    return text
      ? {
          kind: 'url',
          type,
          text,
          value: text,
          href: text
        }
      : this.emptyPreviewCell(type);
  }

  private numberPreviewCell(type: string, value: number | undefined): NotionPreviewCell {
    return value == null
      ? this.emptyPreviewCell(type)
      : {
          kind: 'number',
          type,
          text: String(value),
          value
        };
  }

  private labelsPreviewCell(type: string, options: NotionOption[]): NotionPreviewCell {
    const labels = options
      .map((option) => ({
        name: option.name?.trim() ?? '',
        color: option.color ?? null
      }))
      .filter((option) => Boolean(option.name));

    return labels.length > 0
      ? {
          kind: 'labels',
          type,
          text: labels.map((label) => label.name).join(', '),
          value: labels.map((label) => label.name),
          labels
        }
      : this.emptyPreviewCell(type);
  }

  private datePreviewCell(type: string, value: NotionDateValue | null | undefined): NotionPreviewCell {
    const start = value?.start?.trim();
    const end = value?.end?.trim();

    if (!start) {
      return this.emptyPreviewCell(type);
    }

    const text = end && end !== start ? `${start} ~ ${end}` : start;
    return {
      kind: 'date',
      type,
      text,
      value: text
    };
  }

  private emptyPreviewCell(type: string): NotionPreviewCell {
    return {
      kind: 'empty',
      type,
      text: '',
      value: null
    };
  }

  private notionUserName(user: NotionUser | null | undefined): string | undefined {
    return user?.name?.trim() || user?.person?.email?.trim() || undefined;
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

  private toJsonRecord(value: Prisma.JsonValue | null): Record<string, Prisma.JsonValue> {
    if (!value || Array.isArray(value) || typeof value !== 'object') {
      return {};
    }

    return value as Record<string, Prisma.JsonValue>;
  }

  private extractSystemMappings(value: Record<string, Prisma.JsonValue>): Record<string, string> {
    return Object.fromEntries(
      NOTION_SYSTEM_FIELDS
        .map((field) => [field, typeof value[field] === 'string' ? value[field] : ''] as const)
        .filter(([, item]) => Boolean(item))
    );
  }

  private extractCustomMappings(value: Record<string, Prisma.JsonValue>): NormalizedNotionCustomMapping[] {
    const customValue = value._custom;
    if (!Array.isArray(customValue)) {
      return [];
    }

    return customValue
      .filter((item): item is Prisma.JsonObject => Boolean(item) && !Array.isArray(item) && typeof item === 'object')
      .map((item) => ({
        sourcePath: typeof item.sourcePath === 'string' ? item.sourcePath : '',
        customLabel: typeof item.customLabel === 'string' ? item.customLabel : ''
      }))
      .filter((item) => Boolean(item.sourcePath));
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
