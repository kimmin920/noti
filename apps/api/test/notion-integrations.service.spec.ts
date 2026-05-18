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

  it('syncs a selected data source through the existing managed user import flow', async () => {
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
            phone: '전화번호'
          })
        })
      })
    );
    expect(result.import.created).toBe(1);
  });
});
