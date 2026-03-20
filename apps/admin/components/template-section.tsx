'use client';

import { FileText, FolderKanban, LayoutTemplate, Plus, Search, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { statusVariant } from '@/lib/status';

// Re-using types from page.tsx (should eventually move to a types file)
type Template = any;
type AlimtalkTemplateLibraryItem = any;
type GroupTemplate = any;

interface TemplateSectionProps {
    alimtalkTemplateLibrary: AlimtalkTemplateLibraryItem[];
    defaultGroupTemplates: GroupTemplate[];
    templates: Template[];
    filteredAlimtalkTemplateLibrary: AlimtalkTemplateLibraryItem[];
    templateLibrarySearch: string;
    setTemplateLibrarySearch: (val: string) => void;
    selectedTemplateLibraryKey: string;
    setSelectedTemplateLibraryKey: (val: string) => void;
    selectedAlimtalkTemplate: AlimtalkTemplateLibraryItem | null;
    showTemplateComposer: boolean;
    setShowTemplateComposer: (val: boolean) => void;
    templateForm: { channel: string; name: string; body: string };
    setTemplateForm: (val: any) => void;
    createTemplate: () => void;
    updateTemplate: (template: Template) => void;
    previewTemplate: (templateId: string) => void;
    syncTemplate: (templateId: string) => void;
}

export function TemplateSection({
    alimtalkTemplateLibrary,
    defaultGroupTemplates,
    templates,
    filteredAlimtalkTemplateLibrary,
    templateLibrarySearch,
    setTemplateLibrarySearch,
    selectedTemplateLibraryKey,
    setSelectedTemplateLibraryKey,
    selectedAlimtalkTemplate,
    showTemplateComposer,
    setShowTemplateComposer,
    templateForm,
    setTemplateForm,
    createTemplate,
    updateTemplate,
    previewTemplate,
    syncTemplate
}: TemplateSectionProps) {
    return (
            <Card className="glass overflow-hidden">
                <CardHeader>
                    <CardTitle>알림톡 템플릿</CardTitle>
                    <CardDescription>
                        승인 상태를 확인하고 새로운 알림톡 템플릿을 생성합니다.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                <div className="rounded-3xl border border-blue-100 bg-blue-50/30 p-6 dark:border-blue-900/20 dark:bg-blue-900/10">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <h3 className="text-xl font-bold">알림톡 템플릿 라이브러리</h3>
                            <p className="text-sm text-muted-foreground">
                                그룹 및 개별 채널의 템플릿을 통합 관리합니다.
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Badge variant="secondary">총 {alimtalkTemplateLibrary.length}개</Badge>
                            <Button
                                onClick={() => {
                                    setTemplateForm((current: any) => ({ ...current, channel: 'ALIMTALK' }));
                                    setShowTemplateComposer(true);
                                }}
                                size="sm"
                                className="rounded-xl shadow-md transition-all hover:scale-105"
                            >
                                <Plus className="mr-2 h-4 w-4" />
                                템플릿 등록
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
                    <div className="space-y-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder="템플릿 이름, 코드, 그룹명 검색..."
                                value={templateLibrarySearch}
                                onChange={(e) => setTemplateLibrarySearch(e.target.value)}
                                className="pl-10 h-11 rounded-xl"
                            />
                        </div>

                        <div className="h-[600px] overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                            {filteredAlimtalkTemplateLibrary.map((template) => {
                                const isSelected = selectedTemplateLibraryKey === template.key;
                                const Icon = template.source === 'GROUP' ? FolderKanban : FileText;

                                return (
                                    <button
                                        key={template.key}
                                        onClick={() => setSelectedTemplateLibraryKey(template.key)}
                                        className={`flex w-full items-start gap-4 rounded-2xl border p-4 text-left transition-all duration-200 ${isSelected
                                                ? 'border-primary bg-primary/5 shadow-sm'
                                                : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800'
                                            }`}
                                    >
                                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isSelected ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'
                                            }`}>
                                            <Icon className="h-5 w-5" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center justify-between gap-2">
                                                <p className="truncate font-semibold">{template.name}</p>
                                                <Badge variant={template.source === 'GROUP' ? 'secondary' : 'outline'} className="text-[10px] h-4">
                                                    {template.source === 'GROUP' ? '그룹' : '개별'}
                                                </Badge>
                                            </div>
                                            <div className="mt-2 flex items-center gap-2">
                                                {template.providerStatus && (
                                                    <Badge variant={statusVariant(template.providerStatus)} className="text-[10px]">
                                                        {template.providerStatus}
                                                    </Badge>
                                                )}
                                                <span className="text-[11px] text-muted-foreground truncate">
                                                    {template.ownerLabel}
                                                </span>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="rounded-3xl border bg-slate-50/50 p-6 dark:bg-slate-900/50">
                        {selectedAlimtalkTemplate ? (
                            <div className="space-y-6">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h4 className="text-xl font-bold">{selectedAlimtalkTemplate.name}</h4>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            {selectedAlimtalkTemplate.ownerLabel} · {selectedAlimtalkTemplate.templateCode || '-'}
                                        </p>
                                    </div>
                                    <Badge variant={statusVariant(selectedAlimtalkTemplate.providerStatus || selectedAlimtalkTemplate.lifecycleStatus)}>
                                        {selectedAlimtalkTemplate.providerStatus || selectedAlimtalkTemplate.lifecycleStatus}
                                    </Badge>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-sm font-semibold">
                                        <LayoutTemplate className="h-4 w-4 text-primary" />
                                        메시지 본문
                                    </div>
                                    <div className="rounded-2xl border bg-white p-4 text-sm leading-relaxed dark:bg-slate-950">
                                        <pre className="whitespace-pre-wrap font-sans">
                                            {selectedAlimtalkTemplate.body || '본문 내용이 없습니다.'}
                                        </pre>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="rounded-xl border bg-white p-3 dark:bg-slate-950">
                                        <p className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">메시지 유형</p>
                                        <p className="mt-1 text-sm font-medium">{selectedAlimtalkTemplate.messageType || 'TEXT'}</p>
                                    </div>
                                    <div className="rounded-xl border bg-white p-3 dark:bg-slate-950">
                                        <p className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">필수 변수</p>
                                        <div className="mt-1 flex flex-wrap gap-1">
                                            {selectedAlimtalkTemplate.requiredVariables.length > 0 ? (
                                                selectedAlimtalkTemplate.requiredVariables.map((v: string) => (
                                                    <span key={v} className="text-[11px] text-primary bg-primary/5 px-1.5 py-0.5 rounded">
                                                        {v}
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="text-xs text-muted-foreground">없음</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-2 pt-4 border-t">
                                    {selectedAlimtalkTemplate.source === 'LOCAL' && selectedAlimtalkTemplate.templateId ? (
                                        <>
                                            <Button variant="outline" size="sm" onClick={() => updateTemplate(templates.find((t: any) => t.id === selectedAlimtalkTemplate.templateId))}>
                                                수정
                                            </Button>
                                            <Button variant="outline" size="sm" onClick={() => previewTemplate(selectedAlimtalkTemplate.templateId)}>
                                                미리보기
                                            </Button>
                                            <Button size="sm" onClick={() => syncTemplate(selectedAlimtalkTemplate.templateId)}>
                                                승인 재요청
                                            </Button>
                                        </>
                                    ) : (
                                        <p className="text-xs text-muted-foreground italic">
                                            그룹 템플릿은 상세 미리보기와 상태 조회가 가능합니다.
                                        </p>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="flex h-full min-h-[400px] flex-col items-center justify-center text-center">
                                <div className="rounded-full bg-slate-100 p-4 dark:bg-slate-800">
                                    <LayoutTemplate className="h-8 w-8 text-slate-400" />
                                </div>
                                <p className="mt-4 text-sm text-muted-foreground">
                                    왼쪽 목록에서 템플릿을 선택하여 상세 내용을 확인하세요.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>

            {showTemplateComposer && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4">
                        <Card className="w-full max-w-xl shadow-2xl scale-in">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0">
                                <div>
                                <CardTitle>새 알림톡 템플릿 등록</CardTitle>
                                <CardDescription>알림톡 템플릿을 생성하고 승인 요청까지 이어집니다.</CardDescription>
                                </div>
                                <Button variant="ghost" size="icon" onClick={() => setShowTemplateComposer(false)} className="rounded-full">
                                    <X className="h-4 w-4" />
                                </Button>
                            </CardHeader>
                            <CardContent className="space-y-4 pt-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>채널</Label>
                                    <div className="flex h-10 items-center rounded-xl border bg-slate-50 px-3 text-sm font-medium text-foreground dark:bg-slate-900/50">
                                        ALIMTALK
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>템플릿 이름</Label>
                                    <Input
                                        placeholder="예: 회원가입 환영"
                                        value={templateForm.name}
                                        onChange={(e) => setTemplateForm((p: any) => ({ ...p, name: e.target.value }))}
                                        className="rounded-xl"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>메시지 본문</Label>
                                <Textarea
                                    placeholder="본문 내용을 입력하세요. {{변수명}} 형식으로 변수 삽입이 가능합니다."
                                    className="min-h-[200px] rounded-2xl resize-none"
                                    value={templateForm.body}
                                    onChange={(e) => setTemplateForm((p: any) => ({ ...p, body: e.target.value }))}
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-4">
                                <Button variant="outline" onClick={() => setShowTemplateComposer(false)}>취소</Button>
                                <Button onClick={createTemplate} className="shadow-lg shadow-primary/20">생성 및 승인 요청</Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </Card>
    );
}
