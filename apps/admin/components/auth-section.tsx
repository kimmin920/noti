'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ProfileCard, type ViewerProfile } from '@/components/profile-card';

interface AuthSectionProps {
    me: ViewerProfile | null;
    error: string;
    localLoginId: string;
    setLocalLoginId: (val: string) => void;
    localPassword: string;
    setLocalPassword: (val: string) => void;
    loginWithPassword: () => void;
    ssoToken: string;
    setSsoToken: (val: string) => void;
    exchangeSso: () => void;
    startGoogleLogin: () => void;
    publServiceToken: string;
    setPublServiceToken: (val: string) => void;
    isOperator: boolean;
}

export function AuthSection({
    me,
    error,
    localLoginId,
    setLocalLoginId,
    localPassword,
    setLocalPassword,
    loginWithPassword,
    ssoToken,
    setSsoToken,
    exchangeSso,
    startGoogleLogin,
    publServiceToken,
    setPublServiceToken,
    isOperator
}: AuthSectionProps) {
    return (
        <div className="space-y-6">
            <Card className="glass">
                <CardHeader>
                    <CardTitle className="text-2xl font-bold">인증 및 로그인</CardTitle>
                    <CardDescription>
                        서비스 운영을 위한 권한을 획득합니다. SSO, Google OAuth 또는 테스트 계정을 사용하세요.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid gap-4 rounded-2xl bg-slate-50 p-6 dark:bg-slate-900/50">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="local-login-id">로그인 ID</Label>
                                <Input
                                    id="local-login-id"
                                    value={localLoginId}
                                    onChange={(e) => setLocalLoginId(e.target.value)}
                                    className="bg-white"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="local-password">비밀번호</Label>
                                <Input
                                    id="local-password"
                                    type="password"
                                    value={localPassword}
                                    onChange={(e) => setLocalPassword(e.target.value)}
                                    className="bg-white"
                                />
                            </div>
                        </div>
                        <Button onClick={loginWithPassword} className="w-full shadow-lg shadow-primary/20">
                            테스트 계정으로 로그인
                        </Button>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="sso">Authorization Bearer JWT</Label>
                        <Textarea
                            id="sso"
                            value={ssoToken}
                            onChange={(e) => setSsoToken(e.target.value)}
                            placeholder="eyJhbGciOiJIUzI1Ni..."
                            className="bg-slate-50 dark:bg-slate-900/50"
                        />
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <Button variant="outline" onClick={exchangeSso} className="flex-1">
                            SSO 교환 실행
                        </Button>
                        <Button variant="outline" onClick={startGoogleLogin} className="flex-1">
                            운영자 Google 로그인
                        </Button>
                    </div>

                    <div className="space-y-2 text-sm">
                        <Label>현재 세션 정보</Label>
                        <div className="flex items-center justify-between rounded-lg border bg-slate-50 px-3 py-2 text-xs font-medium dark:bg-slate-900/50">
                            <span>{me ? `${me.tenantId} / ${me.publUserId}` : '미인증'}</span>
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                                {me?.role || 'Guest'}
                            </span>
                        </div>
                    </div>

                    {isOperator && (
                        <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 text-sm text-blue-900 dark:border-blue-900/30 dark:bg-blue-900/20 dark:text-blue-100">
                            내부 운영자 세션입니다. 상세 심사는
                            <Link href="/internal" className="ml-1 font-bold underline underline-offset-4">
                                내부 심사 도구
                            </Link>
                            에서 처리하세요.
                        </div>
                    )}

                    {error && (
                        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
                            {error}
                        </div>
                    )}
                </CardContent>
            </Card>

            {me && <ProfileCard profile={me} />}
        </div>
    );
}
