import { NotionOauthStateService } from '../src/integrations/notion/notion-oauth-state.service';

function createRequest() {
  return {
    get(name: string) {
      const headers: Record<string, string> = {
        'user-agent': 'Mozilla/5.0 Test Browser',
        'accept-language': 'ko,en;q=0.9',
        'sec-ch-ua': '"Not:A-Brand";v="99", "Chromium";v="145"',
        'sec-ch-ua-platform': '"macOS"'
      };

      return headers[name.toLowerCase()] ?? '';
    }
  };
}

describe('NotionOauthStateService', () => {
  it('stores the owner user id needed by the public OAuth callback', () => {
    const service = new NotionOauthStateService({
      googleOauthStateMaxAgeSeconds: 600
    } as any);
    const req = createRequest();
    const state = service.issue(req as any, {
      ownerUserId: 'admin_1',
      redirectUri: 'http://localhost:3000/v1/integrations/notion/callback',
      returnTo: 'http://localhost:3010/recipients'
    });

    expect(service.consume(state, req as any)).toEqual({
      ownerUserId: 'admin_1',
      redirectUri: 'http://localhost:3000/v1/integrations/notion/callback',
      returnTo: 'http://localhost:3010/recipients'
    });
  });
});
