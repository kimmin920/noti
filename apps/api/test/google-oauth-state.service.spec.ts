import { GoogleOauthStateService } from '../src/auth/google-oauth-state.service';

function createRequest(host: string) {
  return {
    get(name: string) {
      const headers: Record<string, string> = {
        host,
        'user-agent': 'Mozilla/5.0 Test Browser',
        'accept-language': 'ko,en;q=0.9',
        'sec-ch-ua': '"Not:A-Brand";v="99", "Chromium";v="145"',
        'sec-ch-ua-platform': '"macOS"'
      };

      return headers[name.toLowerCase()] ?? '';
    }
  };
}

describe('GoogleOauthStateService', () => {
  it('accepts the same browser when OAuth starts on localhost and returns on the public host', () => {
    const service = new GoogleOauthStateService({
      googleOauthStateMaxAgeSeconds: 600
    } as any);

    const startReq = createRequest('localhost:3000');
    const callbackReq = createRequest('api-speed-demon.vizuo.work');
    const state = service.issue(startReq as any, {
      redirectUri: 'http://localhost:3000/v1/auth/google/callback',
      returnTo: 'http://localhost:3001/login'
    });

    expect(service.consume(state, callbackReq as any)).toEqual({
      redirectUri: 'http://localhost:3000/v1/auth/google/callback',
      returnTo: 'http://localhost:3001/login'
    });
  });
});
