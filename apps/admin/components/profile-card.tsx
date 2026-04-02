import { Mail, Shield, UserCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { ViewerProfile } from '@/types/admin';

export type { ViewerProfile };

type ProfileCardProps = {
  profile: ViewerProfile | null;
  compact?: boolean;
};

export function ProfileCard({ profile, compact = false }: ProfileCardProps) {
  const rows = profile
    ? [
        {
          label: '로그인 방식',
          value:
            profile.loginProvider === 'GOOGLE_OAUTH'
              ? 'Google OAuth'
              : profile.loginProvider === 'LOCAL_PASSWORD'
                ? 'Local Password'
                : 'Publ SSO'
        },
        {
          label: '로그인 ID',
          value:
            profile.loginProvider === 'GOOGLE_OAUTH' || profile.loginProvider === 'LOCAL_PASSWORD'
              ? profile.email || '저장된 이메일 없음. 다시 로그인하면 채워집니다.'
              : 'Publ SSO 로그인'
        },
        {
          label: '권한',
          value: profile.role
        },
        {
          label: 'Tenant',
          value: profile.tenantId
        },
        {
          label: 'User ID',
          value: profile.userId
        },
        {
          label: 'Publ User ID',
          value: profile.providerUserId
        }
      ]
    : [];

  return (
    <Card className={compact ? 'border-border/70 bg-card/90' : 'border-border/80 bg-card/95'}>
      <CardHeader className={compact ? 'p-4' : undefined}>
        <div className='flex items-start justify-between gap-4'>
          <div>
            <CardTitle className='flex items-center gap-2 text-lg'>
              <UserCircle2 className='h-5 w-5 text-secondary' />
              내 프로필
            </CardTitle>
            <CardDescription>
              현재 로그인한 사용자의 세션 정보입니다.
            </CardDescription>
          </div>
          {profile ? (
            <Badge variant={profile.role === 'OPERATOR' ? 'secondary' : 'outline'}>
              <Shield className='mr-1 h-3.5 w-3.5' />
              {profile.role}
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className={compact ? 'p-4 pt-0' : undefined}>
        {profile ? (
          <div className='grid gap-3 md:grid-cols-2'>
            {rows.map((row) => (
              <div key={row.label} className='rounded-xl border border-border/70 bg-muted/35 p-3'>
                <div className='mb-1 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground'>
                  {row.label}
                </div>
                <div className='break-all text-sm text-foreground'>
                  {row.label === '로그인 ID' ? (
                    <span className='inline-flex items-center gap-2'>
                      <Mail className='h-4 w-4 text-secondary' />
                      {row.value}
                    </span>
                  ) : (
                    row.value
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className='rounded-xl border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground'>
            아직 로그인 세션이 없습니다.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
