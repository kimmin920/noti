import { NotionIntegrationsService } from '../src/integrations/notion/notion-integrations.service';

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn(async () => body)
  } as any;
}

function createFixture() {
  const env = {
    notionOauthClientId: 'notion-client-id',
    notionOauthClientSecret: 'notion-client-secret',
    notionApiVersion: '2026-03-11',
    notionTokenEncryptionSecret: 'test-encryption-secret',
    sessionSecret: 'session-secret'
  };

  const connection = {
    id: 'notion_conn_1',
    ownerUserId: 'admin_1',
    workspaceId: 'workspace_1',
    workspaceName: '민우의 Notion',
    workspaceIcon: null,
    botId: 'bot_1',
    accessToken: 'notion-access-token',
    refreshToken: null,
    selectedDataSourceId: null,
    selectedDataSourceName: null,
    selectedDataSourceUrl: null,
    selectedMappings: null,
    lastSyncedAt: null,
    createdAt: new Date('2026-05-13T08:00:00.000Z'),
    updatedAt: new Date('2026-05-13T08:00:00.000Z')
  };

  const prisma = {
    notionConnection: {
      findFirst: jest.fn(async () => connection),
      update: jest.fn(async ({ data }: any) => ({
        ...connection,
        ...data,
        updatedAt: new Date('2026-05-13T08:10:00.000Z')
      })),
      upsert: jest.fn()
    }
  };

  const usersService = {
    importUsers: jest.fn(async () => ({
      totalReceived: 1,
      created: 1,
      updated: 0,
      skipped: 0,
      customFieldsCreated: 0
    }))
  };

  const service = new NotionIntegrationsService(env as any, prisma as any, usersService as any);
  return { connection, env, prisma, service, usersService };
}

describe('NotionIntegrationsService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('builds the Notion OAuth authorize URL with user owner and state', () => {
    const { service } = createFixture();

    const url = new URL(service.buildAuthorizeUrl('state_123', 'http://localhost:3000/v1/integrations/notion/callback'));

    expect(url.origin).toBe('https://api.notion.com');
    expect(url.pathname).toBe('/v1/oauth/authorize');
    expect(url.searchParams.get('owner')).toBe('user');
    expect(url.searchParams.get('client_id')).toBe('notion-client-id');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('state')).toBe('state_123');
  });

  it('rejects sync without a name mapping', async () => {
    const { service, usersService } = createFixture();

    await expect(
      service.syncRecipients('admin_1', {
        dataSourceId: 'data_source_1',
        mappings: {
          phone: '전화번호'
        } as any
      })
    ).rejects.toThrow('이름 컬럼을 선택해 주세요.');

    expect(usersService.importUsers).not.toHaveBeenCalled();
  });

  it('syncs a selected data source through the existing managed user import flow', async () => {
    const { prisma, service, usersService } = createFixture();
    const fetchMock = jest.fn(async (url: string, _init?: RequestInit) => {
      if (url.endsWith('/v1/data_sources/data_source_1')) {
        return jsonResponse({
          object: 'data_source',
          id: 'data_source_1',
          title: [{ plain_text: '회원 DB' }],
          url: 'https://notion.so/data_source_1',
          properties: {
            이름: { id: 'title', type: 'title' },
            전화번호: { id: 'phone', type: 'phone_number' },
            이메일: { id: 'email', type: 'email' },
            마케팅: { id: 'marketing', type: 'checkbox' },
            메모: { id: 'note', type: 'rich_text' }
          }
        });
      }

      if (url.endsWith('/v1/data_sources/data_source_1/query')) {
        return jsonResponse({
          object: 'list',
          has_more: false,
          next_cursor: null,
          results: [
            {
              object: 'page',
              id: 'page_1',
              url: 'https://notion.so/page_1',
              created_time: '2026-05-13T08:00:00.000Z',
              last_edited_time: '2026-05-13T08:05:00.000Z',
              properties: {
                이름: { type: 'title', title: [{ plain_text: '김민우' }] },
                전화번호: { type: 'phone_number', phone_number: '010-1234-5678' },
                이메일: { type: 'email', email: 'minu@example.com' },
                마케팅: { type: 'checkbox', checkbox: true },
                메모: { type: 'rich_text', rich_text: [{ plain_text: '첫 상담 완료' }] }
              }
            }
          ]
        });
      }

      return jsonResponse({ message: 'unexpected url' }, 404);
    });
    global.fetch = fetchMock as any;

    const result = await service.syncRecipients('admin_1', {
      dataSourceId: 'data_source_1',
      mappings: {
        name: '이름',
        phone: '전화번호',
        email: '이메일',
        marketingConsent: '마케팅'
      }
    });

    expect(usersService.importUsers).toHaveBeenCalledWith(
      'admin_1',
      expect.objectContaining({
        source: 'notion:workspace_1:data_source_1',
        records: [
          expect.objectContaining({
            pageId: 'page_1',
            이름: '김민우',
            전화번호: '010-1234-5678',
            이메일: 'minu@example.com',
            마케팅: true,
            메모: '첫 상담 완료'
          })
        ],
        mappings: expect.arrayContaining([
          expect.objectContaining({ sourcePath: 'pageId', systemField: 'externalId' }),
          expect.objectContaining({ sourcePath: '전화번호', systemField: 'phone' }),
          expect.objectContaining({
            sourcePath: '메모',
            kind: 'CUSTOM',
            customKey: '메모',
            customLabel: '메모',
            dataType: 'TEXT'
          })
        ])
      })
    );
    expect(prisma.notionConnection.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'notion_conn_1' },
        data: expect.objectContaining({
          selectedDataSourceId: 'data_source_1',
          selectedDataSourceName: '회원 DB',
          selectedDataSourceUrl: 'https://notion.so/data_source_1',
          selectedMappings: expect.objectContaining({
            phone: '전화번호',
            _custom: [
              expect.objectContaining({
                sourcePath: '메모',
                customLabel: '메모'
              })
            ]
          })
        })
      })
    );
    expect(result.connection.selectedCustomMappingsConfigured).toBe(true);
    expect(result.import.created).toBe(1);
  });

  it('syncs only selected Notion custom mappings when provided', async () => {
    const { prisma, service, usersService } = createFixture();
    const fetchMock = jest.fn(async (url: string) => {
      if (url.endsWith('/v1/data_sources/data_source_1')) {
        return jsonResponse({
          object: 'data_source',
          id: 'data_source_1',
          title: [{ plain_text: '회원 DB' }],
          url: 'https://notion.so/data_source_1',
          properties: {
            이름: { id: 'title', type: 'title' },
            전화번호: { id: 'phone', type: 'phone_number' },
            메모: { id: 'note', type: 'rich_text' },
            점수: { id: 'score', type: 'number' }
          }
        });
      }

      if (url.endsWith('/v1/data_sources/data_source_1/query')) {
        return jsonResponse({
          object: 'list',
          has_more: false,
          next_cursor: null,
          results: [
            {
              object: 'page',
              id: 'page_1',
              properties: {
                이름: { type: 'title', title: [{ plain_text: '김민우' }] },
                전화번호: { type: 'phone_number', phone_number: '010-1234-5678' },
                메모: { type: 'rich_text', rich_text: [{ plain_text: '첫 상담 완료' }] },
                점수: { type: 'number', number: 42 }
              }
            }
          ]
        });
      }

      return jsonResponse({ message: 'unexpected url' }, 404);
    });
    global.fetch = fetchMock as any;

    const result = await service.syncRecipients('admin_1', {
      dataSourceId: 'data_source_1',
      mappings: {
        name: '이름',
        phone: '전화번호'
      },
      customMappings: [{ sourcePath: '메모' }]
    });

    const importDto = (usersService.importUsers.mock.calls[0] as unknown as [string, { mappings: unknown[] }])[1];
    expect(importDto.mappings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourcePath: '메모', kind: 'CUSTOM', customLabel: '메모' })
      ])
    );
    expect(importDto.mappings).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourcePath: '점수', kind: 'CUSTOM' })
      ])
    );
    expect(prisma.notionConnection.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          selectedMappings: expect.objectContaining({
            _custom: [
              expect.objectContaining({
                sourcePath: '메모',
                customLabel: '메모'
              })
            ]
          })
        })
      })
    );
    expect(result.connection.selectedCustomMappings).toEqual([{ sourcePath: '메모', customLabel: '메모' }]);
    expect(result.connection.selectedCustomMappingsConfigured).toBe(true);
  });

  it('returns a Notion data source preview with columns and formatted cells', async () => {
    const { service } = createFixture();
    const fetchMock = jest.fn(async (url: string) => {
      if (url.endsWith('/v1/data_sources/data_source_1')) {
        return jsonResponse({
          object: 'data_source',
          id: 'data_source_1',
          title: [{ plain_text: '회원 DB' }],
          url: 'https://notion.so/data_source_1',
          properties: {
            이름: { id: 'title', type: 'title' },
            상태: { id: 'status', type: 'status' },
            마케팅: { id: 'marketing', type: 'checkbox' },
            태그: { id: 'tags', type: 'multi_select' },
            점수: { id: 'score', type: 'number' }
          }
        });
      }

      if (url.endsWith('/v1/data_sources/data_source_1/query')) {
        return jsonResponse({
          object: 'list',
          has_more: true,
          next_cursor: 'cursor_2',
          results: [
            {
              object: 'page',
              id: 'page_1',
              url: 'https://notion.so/page_1',
              created_time: '2026-05-13T08:00:00.000Z',
              last_edited_time: '2026-05-13T08:05:00.000Z',
              properties: {
                이름: { type: 'title', title: [{ plain_text: '김민우' }] },
                상태: { type: 'status', status: { name: '활성', color: 'green' } },
                마케팅: { type: 'checkbox', checkbox: true },
                태그: {
                  type: 'multi_select',
                  multi_select: [
                    { name: 'VIP', color: 'purple' },
                    { name: '서울', color: 'blue' }
                  ]
                },
                점수: { type: 'number', number: 42 }
              }
            }
          ]
        });
      }

      return jsonResponse({ message: 'unexpected url' }, 404);
    });
    global.fetch = fetchMock as any;

    const result = await service.previewDataSource('admin_1', 'data_source_1');
    const queryInit = (fetchMock.mock.calls[1] as unknown as [string, RequestInit])[1];
    const queryBody = JSON.parse(String(queryInit.body));

    expect(queryBody.page_size).toBe(20);
    expect(result.dataSource.name).toBe('회원 DB');
    expect(result.hasMore).toBe(true);
    expect(result.columns.map((column) => column.name)).toEqual(['이름', '상태', '마케팅', '태그', '점수']);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].cells.이름).toEqual(expect.objectContaining({ kind: 'text', text: '김민우' }));
    expect(result.rows[0].cells.상태).toEqual(expect.objectContaining({
      kind: 'labels',
      text: '활성',
      labels: [{ name: '활성', color: 'green' }]
    }));
    expect(result.rows[0].cells.마케팅).toEqual(expect.objectContaining({ kind: 'checkbox', checked: true }));
    expect(result.rows[0].cells.태그).toEqual(expect.objectContaining({ text: 'VIP, 서울' }));
    expect(result.rows[0].cells.점수).toEqual(expect.objectContaining({ kind: 'number', value: 42 }));
  });
});
