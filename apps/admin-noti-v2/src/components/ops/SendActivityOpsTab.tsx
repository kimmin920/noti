"use client";

import { useState, useEffectEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AppIcon } from "@/components/icons/AppIcon";
import { SkeletonStatGrid, SkeletonTableBox } from "@/components/loading/PageSkeleton";
import { useMountEffect } from "@/lib/hooks/use-mount-effect";
import { useAppStore } from "@/lib/store/app-store";
import {
  fetchV2OpsSendActivity,
  fetchV2OpsSendActivityDetail,
  type V2OpsSendActivityDetailResponse,
  type V2OpsSendActivityRangeKey,
  type V2OpsSendActivityResponse,
} from "@/lib/api/v2";

const RANGE_OPTIONS: Array<{ key: Exclude<V2OpsSendActivityRangeKey, "custom">; label: string }> = [
  { key: "1d", label: "오늘" },
  { key: "7d", label: "7일" },
  { key: "30d", label: "30일" },
  { key: "all", label: "전체" },
];

type SendActivityItem = V2OpsSendActivityResponse["items"][number];
type SendActivityFilterParams = {
  range?: Exclude<V2OpsSendActivityRangeKey, "custom">;
  startDate?: string;
  endDate?: string;
};

function parseSendActivityRange(value: string | null): Exclude<V2OpsSendActivityRangeKey, "custom"> | null {
  if (value === "1d" || value === "7d" || value === "30d" || value === "all") {
    return value;
  }

  return null;
}

export function SendActivityOpsTab() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const showDraftToast = useAppStore((state) => state.showDraftToast);
  const appliedFilter = resolveSendActivityFilter(searchParams);
  const [data, setData] = useState<V2OpsSendActivityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [detail, setDetail] = useState<V2OpsSendActivityDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [draftStartDate, setDraftStartDate] = useState(appliedFilter.startDate ?? "");
  const [draftEndDate, setDraftEndDate] = useState(appliedFilter.endDate ?? "");

  const loadActivity = async (background = false) => {
    if (background) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError(null);

    try {
      const next = await fetchV2OpsSendActivity(appliedFilter.request);
      setData(next);

      if (selectedAccountId && !next.items.some((item) => item.adminUserId === selectedAccountId)) {
        closeDrawer();
      } else if (selectedAccountId && drawerOpen) {
        void loadDetail(selectedAccountId);
      }
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "발송 활동 현황을 불러오지 못했습니다.";
      setError(message);
      if (background) {
        showDraftToast(message);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadDetail = async (adminUserId: string) => {
    setDetailLoading(true);
    setDetailError(null);

    try {
      const next = await fetchV2OpsSendActivityDetail(adminUserId, appliedFilter.request);
      setDetail(next);
    } catch (fetchError) {
      setDetailError(fetchError instanceof Error ? fetchError.message : "운영 계정별 발송 상세를 불러오지 못했습니다.");
    } finally {
      setDetailLoading(false);
    }
  };

  useMountEffect(() => {
    void loadActivity();
  });

  const selectedItem = data?.items.find((item) => item.adminUserId === selectedAccountId) ?? null;

  const switchRange = (nextRange: Exclude<V2OpsSendActivityRangeKey, "custom">) => {
    if (appliedFilter.mode === "preset" && nextRange === appliedFilter.range) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("range", nextRange);
    nextParams.set("tab", "send-activity");
    nextParams.delete("startDate");
    nextParams.delete("endDate");
    router.replace(`${pathname}?${nextParams.toString()}`, { scroll: false });
  };

  const applyDateRange = () => {
    const startDate = draftStartDate.trim();
    const endDate = draftEndDate.trim();

    if (!startDate || !endDate) {
      showDraftToast("시작일과 종료일을 모두 입력해주세요.");
      return;
    }

    if (startDate > endDate) {
      showDraftToast("시작일은 종료일보다 늦을 수 없습니다.");
      return;
    }

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("tab", "send-activity");
    nextParams.delete("range");
    nextParams.set("startDate", startDate);
    nextParams.set("endDate", endDate);
    router.replace(`${pathname}?${nextParams.toString()}`, { scroll: false });
  };

  const openDrawer = async (item: SendActivityItem) => {
    setSelectedAccountId(item.adminUserId);
    setDrawerOpen(true);
    setDetail(null);
    await loadDetail(item.adminUserId);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelectedAccountId(null);
    setDetail(null);
    setDetailLoading(false);
    setDetailError(null);
  };

  const hasData = Boolean(data);

  return (
    <>
      {loading && !hasData ? (
        <>
          <SkeletonStatGrid columns={6} />
          <SkeletonTableBox titleWidth={150} rows={6} columns={["1.1fr", "1fr", "0.9fr", "0.9fr", "0.9fr", "0.9fr", "120px", "90px"]} />
        </>
      ) : null}

      {!loading && error && !hasData ? (
        <div className="flash flash-attention">
          <AppIcon name="warn" className="icon icon-16 flash-icon" />
          <div className="flash-body">{error}</div>
          <div className="flash-actions">
            <button className="btn btn-default btn-sm" onClick={() => void loadActivity()}>
              <AppIcon name="refresh" className="icon icon-14" />
              다시 불러오기
            </button>
          </div>
        </div>
      ) : null}

      {data ? (
        <>
          <div className="box">
            <div className="box-header">
              <div>
                <div className="box-title">운영 계정별 발송 활동</div>
                <div className="box-subtitle">직접 발송한 문자와 알림톡 수를 운영 계정 기준으로 집계하고, 발신 자원별 분포를 확인합니다.</div>
              </div>
              <div className="ops-filter-bar">
                {RANGE_OPTIONS.map((option) => (
                  <button
                    key={option.key}
                    className={`btn ${appliedFilter.mode === "preset" && option.key === appliedFilter.range ? "btn-accent" : "btn-default"} btn-sm`}
                    onClick={() => switchRange(option.key)}
                  >
                    {option.label}
                  </button>
                ))}
                <div className="ops-date-range">
                  <input
                    type="date"
                    className="form-control field-width-sm"
                    value={draftStartDate}
                    onChange={(event) => setDraftStartDate(event.target.value)}
                    aria-label="발송 활동 시작일"
                  />
                  <span className="table-subtext">~</span>
                  <input
                    type="date"
                    className="form-control field-width-sm"
                    value={draftEndDate}
                    onChange={(event) => setDraftEndDate(event.target.value)}
                    aria-label="발송 활동 종료일"
                  />
                  <button className="btn btn-default btn-sm" onClick={applyDateRange}>
                    조회
                  </button>
                </div>
                <button className="btn btn-default btn-sm" onClick={() => void loadActivity(true)}>
                  <AppIcon name="refresh" className={`icon icon-14${refreshing ? " spin" : ""}`} />
                  새로고침
                </button>
              </div>
            </div>
            <div className="box-body" style={{ padding: 0 }}>
              <div className="ops-summary-grid">
                <SummaryStat label="전체 사용자" value={String(data.summary.userCount)} />
                <SummaryStat label="발송한 사용자" value={String(data.summary.activeUserCount)} />
                <SummaryStat label="문자 건수" value={String(data.summary.smsMessageCount)} />
                <SummaryStat label="발신번호 수" value={String(data.summary.senderNumberCount)} />
                <SummaryStat label="알림톡 건수" value={String(data.summary.kakaoMessageCount)} />
                <SummaryStat label="채널 수" value={String(data.summary.channelCount)} />
              </div>
            </div>
          </div>

          {error ? (
            <div className="flash flash-attention">
              <AppIcon name="warn" className="icon icon-16 flash-icon" />
              <div className="flash-body">{error}</div>
            </div>
          ) : null}

          <div className="box">
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>운영 계정</th>
                    <th>소속 계정</th>
                    <th>문자 건수</th>
                    <th>발신번호 수</th>
                    <th>알림톡 건수</th>
                    <th>채널 수</th>
                    <th>최근 발송</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.items.length === 0 ? (
                    <tr>
                      <td colSpan={8}>
                        <div className="empty-state">
                          <div className="empty-icon">
                            <AppIcon name="activity" className="icon icon-40" />
                          </div>
                          <div className="empty-title">집계된 발송 활동이 없습니다</div>
                          <div className="empty-desc">선택한 기간에 운영 계정이 직접 보낸 문자와 알림톡 이력이 없습니다.</div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    data.items.map((item) => (
                      <tr key={item.adminUserId}>
                        <td>
                          <div className="table-title-text">{adminUserLabel(item)}</div>
                          <div className="table-subtext">{roleText(item.role)}</div>
                        </td>
                        <td>
                          <div className="table-title-text">{item.userLabel}</div>
                          <div className="table-subtext">로그인 사용자</div>
                        </td>
                        <td className="td-mono">{formatCount(item.smsMessageCount)}</td>
                        <td className="td-mono td-muted">{formatCount(item.smsSenderNumberCount)}</td>
                        <td className="td-mono">{formatCount(item.kakaoMessageCount)}</td>
                        <td className="td-mono td-muted">{formatCount(item.kakaoChannelCount)}</td>
                        <td className="td-muted text-small">{formatDateTime(item.lastSentAt)}</td>
                        <td>
                          <button className="btn btn-default btn-sm" onClick={() => void openDrawer(item)}>
                            보기
                          </button>
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

      <SendActivityOpsDrawer
        open={drawerOpen}
        item={selectedItem}
        detail={detail}
        loading={detailLoading}
        error={detailError}
        onClose={closeDrawer}
      />
    </>
  );
}

function SendActivityOpsDrawer({
  open,
  item,
  detail,
  loading,
  error,
  onClose,
}: {
  open: boolean;
  item: SendActivityItem | null;
  detail: V2OpsSendActivityDetailResponse | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}) {
  const handleEscape = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === "Escape") {
      onClose();
    }
  });

  useMountEffect(() => {
    const onKeydown = (event: KeyboardEvent) => handleEscape(event);
    window.addEventListener("keydown", onKeydown);
    return () => window.removeEventListener("keydown", onKeydown);
  });

  if (!open || !item) {
    return null;
  }

  const resolvedDetail = detail;

  return (
    <div className="template-detail-backdrop" onClick={onClose}>
      <aside className="template-detail-drawer" onClick={(event) => event.stopPropagation()} role="dialog" aria-label="운영 계정 발송 활동 보기">
        <div className="template-detail-header">
          <div>
            <div className="template-detail-eyebrow">발송 관리</div>
            <div className="template-detail-title">{adminUserLabel(item)}</div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="운영 계정 발송 활동 닫기">
            <AppIcon name="x" className="icon icon-18" />
          </button>
        </div>

        <div className="template-detail-body">
          <div className="template-detail-stack">
            {loading ? (
              <div className="box">
                <div className="box-body">
                  <div className="template-detail-loading-line wide" />
                  <div className="template-detail-loading-grid">
                    <div className="template-detail-loading-line" />
                    <div className="template-detail-loading-line" />
                    <div className="template-detail-loading-line" />
                    <div className="template-detail-loading-line" />
                  </div>
                  <div className="template-detail-loading-block" style={{ marginTop: 16 }} />
                </div>
              </div>
            ) : null}

            {!loading && error ? (
              <div className="flash flash-attention">
                <AppIcon name="warn" className="icon icon-16 flash-icon" />
                <div className="flash-body">{error}</div>
              </div>
            ) : null}

            {!loading && !error && resolvedDetail ? (
              <>
                <div className="box">
                  <div className="box-header">
                    <div>
                      <div className="box-title">{resolvedDetail.user.userLabel}</div>
                      <div className="box-subtitle">{roleText(resolvedDetail.user.role)}</div>
                    </div>
                    <div className="ops-drawer-status">
                      <span className="label label-blue">
                        <span className="label-dot" />
                        {resolvedDetail.range.label}
                      </span>
                    </div>
                  </div>
                  <div className="box-body">
                    <div className="template-detail-meta-grid">
                      <MetaField label="운영 계정" value={adminUserLabel(item)} />
                      <MetaField label="이메일" value={resolvedDetail.user.email || "—"} />
                      <MetaField label="문자 건수" value={formatCount(resolvedDetail.summary.smsMessageCount)} mono />
                      <MetaField label="알림톡 건수" value={formatCount(resolvedDetail.summary.kakaoMessageCount)} mono />
                    </div>
                    <div className="template-detail-meta-grid template-detail-meta-grid-tight">
                      <MetaField label="발신번호 수" value={formatCount(resolvedDetail.summary.smsSenderNumberCount)} mono />
                      <MetaField label="채널 수" value={formatCount(resolvedDetail.summary.kakaoChannelCount)} mono />
                      <MetaField label="최근 발송" value={formatDateTime(resolvedDetail.summary.lastSentAt)} />
                      <MetaField label="내부 사용자 ID" value={resolvedDetail.user.userId} mono />
                    </div>
                  </div>
                </div>

                <div className="box">
                  <div className="box-header">
                    <div>
                      <div className="box-title">발신번호별 문자 건수</div>
                      <div className="box-subtitle">직접 발송과 대량 발송을 합산한 문자 건수입니다.</div>
                    </div>
                  </div>
                  <div className="box-body" style={{ padding: 0 }}>
                    {resolvedDetail.smsSenderNumbers.length === 0 ? (
                      <div className="empty-state">
                        <div className="empty-icon">
                          <AppIcon name="phone" className="icon icon-40" />
                        </div>
                        <div className="empty-title">문자 발송 이력이 없습니다</div>
                        <div className="empty-desc">선택한 기간에 이 운영 계정이 직접 발송한 문자 이력이 없습니다.</div>
                      </div>
                    ) : (
                      <div className="table-scroll">
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>발신번호</th>
                              <th>전체</th>
                              <th>단건</th>
                              <th>대량</th>
                              <th>최근 발송</th>
                            </tr>
                          </thead>
                          <tbody>
                            {resolvedDetail.smsSenderNumbers.map((entry) => (
                              <tr key={entry.senderNumberId || entry.label}>
                                <td className="td-mono">{formatPhone(entry.label)}</td>
                                <td className="td-mono">{formatCount(entry.count)}</td>
                                <td className="td-mono td-muted">{formatCount(entry.manualCount)}</td>
                                <td className="td-mono td-muted">{formatCount(entry.bulkCount)}</td>
                                <td className="td-muted text-small">{formatDateTime(entry.lastSentAt)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>

                <div className="box">
                  <div className="box-header">
                    <div>
                      <div className="box-title">채널별 알림톡 건수</div>
                      <div className="box-subtitle">직접 발송과 대량 발송을 합산한 알림톡 건수입니다.</div>
                    </div>
                  </div>
                  <div className="box-body" style={{ padding: 0 }}>
                    {resolvedDetail.kakaoChannels.length === 0 ? (
                      <div className="empty-state">
                        <div className="empty-icon">
                          <AppIcon name="kakao" className="icon icon-40" />
                        </div>
                        <div className="empty-title">알림톡 발송 이력이 없습니다</div>
                        <div className="empty-desc">선택한 기간에 이 운영 계정이 직접 발송한 알림톡 이력이 없습니다.</div>
                      </div>
                    ) : (
                      <div className="table-scroll">
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>채널</th>
                              <th>전체</th>
                              <th>단건</th>
                              <th>대량</th>
                              <th>최근 발송</th>
                            </tr>
                          </thead>
                          <tbody>
                            {resolvedDetail.kakaoChannels.map((entry) => (
                              <tr key={entry.senderProfileId || entry.senderKey || entry.label}>
                                <td>
                                  <div className="table-title-text">{entry.label}</div>
                                  <div className="table-subtext td-mono">{entry.senderKey || "—"}</div>
                                </td>
                                <td className="td-mono">{formatCount(entry.count)}</td>
                                <td className="td-mono td-muted">{formatCount(entry.manualCount)}</td>
                                <td className="td-mono td-muted">{formatCount(entry.bulkCount)}</td>
                                <td className="td-muted text-small">{formatDateTime(entry.lastSentAt)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>

                <div className="box">
                  <div className="box-header">
                    <div>
                      <div className="box-title">최근 발송</div>
                      <div className="box-subtitle">최근 직접 발송 활동 10건을 시간순으로 확인합니다.</div>
                    </div>
                  </div>
                  <div className="box-body" style={{ padding: 0 }}>
                    {resolvedDetail.recentActivities.length === 0 ? (
                      <div className="empty-state">
                        <div className="empty-icon">
                          <AppIcon name="clock" className="icon icon-40" />
                        </div>
                        <div className="empty-title">최근 발송 기록이 없습니다</div>
                        <div className="empty-desc">선택한 기간 안에 집계할 최근 발송 활동이 없습니다.</div>
                      </div>
                    ) : (
                      <div className="table-scroll">
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>채널</th>
                              <th>구분</th>
                              <th>자원</th>
                              <th>건수</th>
                              <th>시각</th>
                            </tr>
                          </thead>
                          <tbody>
                            {resolvedDetail.recentActivities.map((activity) => (
                              <tr key={`${activity.mode}:${activity.id}`}>
                                <td>
                                  <span className={`label ${activity.channel === "sms" ? "label-gray" : "label-blue"}`}>
                                    <span className="label-dot" />
                                    {activity.channel === "sms" ? "문자" : "알림톡"}
                                  </span>
                                </td>
                                <td className="td-muted">{activity.mode === "MANUAL" ? "단건" : "대량"}</td>
                                <td className="td-muted">{activity.resourceLabel}</td>
                                <td className="td-mono">{formatCount(activity.count)}</td>
                                <td className="td-muted text-small">{formatDateTime(activity.createdAt)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </aside>
    </div>
  );
}

function SummaryStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="ops-summary-cell">
      <div className="stat-label-t">{label}</div>
      <div className="ops-summary-value">{value}</div>
    </div>
  );
}

function MetaField({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="template-detail-meta-field">
      <div className="template-detail-meta-label">{label}</div>
      <div className={`template-detail-meta-value${mono ? " mono" : ""}`}>{value}</div>
    </div>
  );
}

function adminUserLabel(item: {
  loginId: string | null;
  email: string | null;
}) {
  return item.loginId || item.email || "알 수 없는 계정";
}

function roleText(role: "USER" | "PARTNER_ADMIN" | "SUPER_ADMIN" | null) {
  if (role === "SUPER_ADMIN") {
    return "최상위 운영자";
  }

  if (role === "PARTNER_ADMIN") {
    return "협업 운영자";
  }

  if (role === "USER") {
    return "일반 사업자";
  }

  return "삭제되었거나 확인되지 않은 계정";
}

function formatCount(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "");

  if (digits.length === 8) {
    return digits.replace(/(\d{4})(\d{4})/, "$1-$2");
  }

  if (digits.length === 9) {
    return digits.replace(/(\d{2})(\d{3})(\d{4})/, "$1-$2-$3");
  }

  if (digits.length === 10) {
    if (digits.startsWith("02")) {
      return digits.replace(/(\d{2})(\d{4})(\d{4})/, "$1-$2-$3");
    }

    return digits.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3");
  }

  if (digits.length === 11) {
    return digits.replace(/(\d{3})(\d{4})(\d{4})/, "$1-$2-$3");
  }

  return value;
}

function resolveSendActivityFilter(searchParams: ReturnType<typeof useSearchParams>): {
  mode: "preset" | "custom";
  range: Exclude<V2OpsSendActivityRangeKey, "custom">;
  startDate: string | null;
  endDate: string | null;
  request: SendActivityFilterParams;
} {
  const startDate = normalizeDateInput(searchParams.get("startDate"));
  const endDate = normalizeDateInput(searchParams.get("endDate"));

  if (startDate && endDate) {
    return {
      mode: "custom",
      range: "30d",
      startDate,
      endDate,
      request: {
        startDate,
        endDate,
      },
    };
  }

  const range = parseSendActivityRange(searchParams.get("range")) || "30d";

  return {
    mode: "preset",
    range,
    startDate: null,
    endDate: null,
    request: {
      range,
    },
  };
}

function normalizeDateInput(value: string | null) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}
