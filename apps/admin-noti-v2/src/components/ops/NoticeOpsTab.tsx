"use client";

import { useState } from "react";
import { AppIcon } from "@/components/icons/AppIcon";
import { SkeletonStatGrid, SkeletonTableBox } from "@/components/loading/PageSkeleton";
import { MarkdownContent } from "@/components/ui/MarkdownContent";
import { useMountEffect } from "@/lib/hooks/use-mount-effect";
import { useAppStore } from "@/lib/store/app-store";
import {
  archiveV2OpsNotice,
  createV2OpsNotice,
  fetchV2OpsNotices,
  updateV2OpsNotice,
  type V2OpsNotice,
  type V2OpsNoticesResponse,
} from "@/lib/api/v2";

type NoticeFormState = {
  title: string;
  body: string;
  isPinned: boolean;
};

const EMPTY_FORM: NoticeFormState = {
  title: "",
  body: "",
  isPinned: false,
};

export function NoticeOpsTab() {
  const showDraftToast = useAppStore((state) => state.showDraftToast);
  const [data, setData] = useState<V2OpsNoticesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<NoticeFormState>(EMPTY_FORM);
  const [editingNoticeId, setEditingNoticeId] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(true);

  const loadNotices = async (background = false) => {
    if (background) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError(null);

    try {
      const next = await fetchV2OpsNotices();
      setData(next);
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "공지사항을 불러오지 못했습니다.";
      setError(message);
      if (background) {
        showDraftToast(message);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useMountEffect(() => {
    void loadNotices();
  });

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingNoticeId(null);
  };

  const applyNoticeToForm = (notice: V2OpsNotice) => {
    setEditingNoticeId(notice.id);
    setForm({
      title: notice.title,
      body: notice.body,
      isPinned: notice.isPinned,
    });
  };

  const handleSubmit = async () => {
    if (saving) {
      return;
    }

    if (!form.title.trim() || !form.body.trim()) {
      showDraftToast("공지 제목과 본문을 입력해 주세요.");
      return;
    }

    setSaving(true);
    try {
      if (editingNoticeId) {
        await updateV2OpsNotice(editingNoticeId, {
          title: form.title.trim(),
          body: form.body.trim(),
          isPinned: form.isPinned,
        });
        showDraftToast("공지사항을 수정했습니다.");
      } else {
        await createV2OpsNotice({
          title: form.title.trim(),
          body: form.body.trim(),
          isPinned: form.isPinned,
        });
        showDraftToast("공지사항을 등록했습니다.");
      }

      resetForm();
      await loadNotices(true);
    } catch (submitError) {
      showDraftToast(submitError instanceof Error ? submitError.message : "공지사항 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (noticeId: string) => {
    if (archivingId) {
      return;
    }

    setArchivingId(noticeId);
    try {
      await archiveV2OpsNotice(noticeId);
      if (editingNoticeId === noticeId) {
        resetForm();
      }
      showDraftToast("공지사항을 보관했습니다.");
      await loadNotices(true);
    } catch (archiveError) {
      showDraftToast(archiveError instanceof Error ? archiveError.message : "공지사항 보관에 실패했습니다.");
    } finally {
      setArchivingId(null);
    }
  };

  const hasData = Boolean(data);
  const resolvedData = data;

  return (
    <>
      {loading && !hasData ? (
        <>
          <SkeletonStatGrid columns={3} />
          <SkeletonTableBox titleWidth={120} rows={6} columns={["1.5fr", "100px", "120px", "120px", "140px"]} />
        </>
      ) : null}

      {!loading && error && !hasData ? (
        <div className="flash flash-attention">
          <AppIcon name="warn" className="icon icon-16 flash-icon" />
          <div className="flash-body">{error}</div>
          <div className="flash-actions">
            <button className="btn btn-default btn-sm" onClick={() => void loadNotices()}>
              <AppIcon name="refresh" className="icon icon-14" />
              다시 불러오기
            </button>
          </div>
        </div>
      ) : null}

      {resolvedData ? (
        <>
          <div className="box">
            <div className="box-header">
              <div>
                <div className="box-title">공지사항 작성</div>
                <div className="box-subtitle">Markdown 본문을 붙여넣고 바로 사용자 대시보드에 노출할 공지를 작성합니다.</div>
              </div>
              <button className="btn btn-default btn-sm" onClick={() => void loadNotices(true)}>
                <AppIcon name="refresh" className={`icon icon-14${refreshing ? " spin" : ""}`} />
                새로고침
              </button>
            </div>
            <div className="box-body notice-ops-editor">
              <div className="notice-ops-editor-fields">
                <label className="form-group">
                  <span className="field-label">제목</span>
                  <input
                    className="form-control"
                    value={form.title}
                    onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                    placeholder="공지 제목을 입력하세요"
                    maxLength={160}
                  />
                </label>
                <label className="form-group">
                  <span className="field-label">본문 (Markdown)</span>
                  <textarea
                    className="form-control"
                    rows={14}
                    value={form.body}
                    onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))}
                    placeholder={"# 공지 제목\n\n- 핵심 내용 1\n- 핵심 내용 2\n\n[링크](https://example.com)"}
                    maxLength={10000}
                    style={{ resize: "vertical", minHeight: 280 }}
                  />
                </label>
                <div className="notice-ops-editor-actions">
                  <label className="checkbox-inline">
                    <input
                      type="checkbox"
                      checked={form.isPinned}
                      onChange={(event) => setForm((current) => ({ ...current, isPinned: event.target.checked }))}
                    />
                    상단 고정
                  </label>
                  <label className="checkbox-inline">
                    <input
                      type="checkbox"
                      checked={previewOpen}
                      onChange={(event) => setPreviewOpen(event.target.checked)}
                    />
                    미리보기
                  </label>
                  <div className="notice-ops-editor-buttons">
                    {editingNoticeId ? (
                      <button className="btn btn-default btn-sm" onClick={resetForm} disabled={saving}>
                        초기화
                      </button>
                    ) : null}
                    <button className="btn btn-accent btn-sm" onClick={() => void handleSubmit()} disabled={saving}>
                      <AppIcon name={editingNoticeId ? "check" : "plus"} className="icon icon-14" />
                      {editingNoticeId ? "수정 저장" : "공지 등록"}
                    </button>
                  </div>
                </div>
              </div>
              {previewOpen ? (
                <div className="notice-ops-preview">
                  <div className="notice-ops-preview-header">
                    <div className="box-title" style={{ fontSize: 14 }}>미리보기</div>
                    {form.isPinned ? <span className="label label-yellow"><span className="label-dot" />상단 고정</span> : null}
                  </div>
                  <div className="notice-ops-preview-title">{form.title.trim() || "제목 미리보기"}</div>
                  <div className="notice-ops-preview-meta">대시보드 공지사항 상세에 표시됩니다.</div>
                  <div className="notice-ops-preview-body">
                    <MarkdownContent value={form.body.trim() || "본문 미리보기"} />
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {error ? (
            <div className="flash flash-attention">
              <AppIcon name="warn" className="icon icon-16 flash-icon" />
              <div className="flash-body">{error}</div>
            </div>
          ) : null}

          <div className="box">
            <div className="box-header">
              <div>
                <div className="box-title">노출 중인 공지</div>
                <div className="box-subtitle">고정 공지가 먼저 보이고, 최신순으로 사용자 대시보드에 노출됩니다.</div>
              </div>
            </div>
            <div className="box-body" style={{ padding: 0 }}>
              <div className="ops-summary-grid" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
                <SummaryStat label="전체 공지" value={String(resolvedData.summary.totalCount)} />
                <SummaryStat label="고정 공지" value={String(resolvedData.summary.pinnedCount)} tone="success" />
                <SummaryStat label="일반 공지" value={String(resolvedData.summary.totalCount - resolvedData.summary.pinnedCount)} />
              </div>
            </div>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>제목</th>
                    <th>구분</th>
                    <th>작성자</th>
                    <th>등록일</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {resolvedData.items.length === 0 ? (
                    <tr>
                      <td colSpan={5}>
                        <div className="empty-state">
                          <div className="empty-icon">
                            <AppIcon name="bell" className="icon icon-40" />
                          </div>
                          <div className="empty-title">등록된 공지사항이 없습니다</div>
                          <div className="empty-desc">왼쪽 작성 폼에서 첫 공지사항을 등록해 보세요.</div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    resolvedData.items.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <div className="table-title-text">{item.title}</div>
                          <div className="table-subtext">{summarizeNoticeBody(item.body)}</div>
                        </td>
                        <td>
                          <span className={`label ${item.isPinned ? "label-yellow" : "label-blue"}`}>
                            <span className="label-dot" />
                            {item.isPinned ? "고정" : "일반"}
                          </span>
                        </td>
                        <td className="td-muted">{item.createdByEmail || "운영자"}</td>
                        <td className="td-muted text-small">{formatShortDateTime(item.createdAt)}</td>
                        <td>
                          <div className="table-inline-actions">
                            <button className="btn btn-default btn-sm" onClick={() => applyNoticeToForm(item)}>
                              수정
                            </button>
                            <button
                              className="btn btn-default btn-sm"
                              onClick={() => void handleArchive(item.id)}
                              disabled={archivingId === item.id}
                            >
                              보관
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}

function SummaryStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success";
}) {
  return (
    <div className="ops-summary-cell">
      <div className="ops-summary-label">{label}</div>
      <div className={`ops-summary-value${tone === "success" ? " success" : ""}`}>{value}</div>
    </div>
  );
}

function summarizeNoticeBody(value: string) {
  return value
    .replace(/[#>*`_\-\[\]\(\)!]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120) || "본문 없음";
}

function formatShortDateTime(value: string) {
  try {
    return new Intl.DateTimeFormat("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}
