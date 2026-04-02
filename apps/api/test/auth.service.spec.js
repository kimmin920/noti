"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const jsonwebtoken_1 = require("jsonwebtoken");
const auth_service_1 = require("../src/auth/auth.service");
function fixture() {
    const sessions = [];
    const prisma = {
        tenant: {
            upsert: jest.fn(async ({ where, create }) => ({ id: where.id || create.id, name: 'Tenant' }))
        },
        adminUser: {
            upsert: jest.fn(async ({ create }) => ({ id: 'user_1', providerUserId: create.providerUserId, role: 'TENANT_ADMIN' }))
        },
        session: {
            create: jest.fn(async ({ data }) => {
                sessions.push(data);
                return data;
            }),
            deleteMany: jest.fn(async () => ({ count: 1 }))
        }
    };
    const env = {
        publSsoSecret: 'test-secret',
        sessionSecret: 'session-secret',
        cookieMaxAgeSeconds: 86400,
        isPlaceholder: (value) => value.includes('__REPLACE_ME__')
    };
    const service = new auth_service_1.AuthService(prisma, env);
    return { service, sessions };
}
describe('AuthService', () => {
    it('exchanges valid HS256 token and creates session', async () => {
        const { service, sessions } = fixture();
        const jwt = (0, jsonwebtoken_1.sign)({
            sub: 'publ_user_1',
            tenant_id: 'tenant_demo',
            role: 'TENANT_ADMIN'
        }, 'test-secret', {
            algorithm: 'HS256',
            issuer: 'publ',
            audience: 'publ-messaging',
            expiresIn: '2m'
        });
        const token = await service.exchangeSsoToken(jwt);
        expect(token).toBeTruthy();
        expect(sessions).toHaveLength(1);
    });
    it('rejects invalid role', async () => {
        const { service } = fixture();
        const jwt = (0, jsonwebtoken_1.sign)({
            sub: 'publ_user_1',
            tenant_id: 'tenant_demo',
            role: 'USER'
        }, 'test-secret', {
            algorithm: 'HS256',
            issuer: 'publ',
            audience: 'publ-messaging',
            expiresIn: '2m'
        });
        await expect(service.exchangeSsoToken(jwt)).rejects.toBeInstanceOf(common_1.UnauthorizedException);
    });
});
//# sourceMappingURL=auth.service.spec.js.map
