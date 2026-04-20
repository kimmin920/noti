"use client";

import { useState } from "react";
import { AppIcon } from "@/components/icons/AppIcon";
import { SkeletonStatGrid, SkeletonTableBox } from "@/components/loading/PageSkeleton";
import { useMountEffect } from "@/lib/hooks/use-mount-effect";
import { useAppStore } from "@/lib/store/app-store";
import {
  fetchV2OpsSmsQuotas,
  updateV2OpsSmsQuota,
  type V2OpsSmsQuotasResponse,
} from "@/lib/api/v2";

export function SmsQuotaOpsTab() {
  const showDraftToast = useAppStore((state) => state.showDraftToast);
  const [data, setData] = useState<V2OpsSmsQuotasResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [draftLimits, setDraftLimits] = useState<Record<string, string>>({});

  const loadQuotas = async (background = false) => {
    if (background) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError(null);

    try {
      const next = await fetchV2OpsSmsQuotas();
      setData(next);
      setDraftLimits(
        Object.fromEntries(next.items.map((item) => [item.userId, String(item.monthlySmsLimit)]))
      );
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "SMS 쿼터 목록을 불러오지 못했습니다.";
      setError(message);
      if (background) {
        showDraftToast(message, { tone: "error" });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useMountEffect(() => {
    void loadQuotas();
  });

  const handleSave = async (userId: string) => {
    const rawValue = (draftLimits[userId] || "").trim();
    if (!rawValue) {
      showDraftToast("월간 SMS 한도를 입력해 주세요.", { tone: "error" });
      return;
    }

    const nextLimit = Number(rawValue);
    if (!Number.isFinite(nextLimit) || nextLimit < 0) {
      showDraftToast("월간 SMS 한도는 0 이상의 숫자로 입력해 주세요.", { tone: "error" });
      return;
    }

    setSavingUserId(userId);

    try {
      const updated = await updateV2OpsSmsQuota(userId, { monthlySmsLimit: nextLimit });
      setData((current) =>
        current
          ? {
              ...current,
              items: current.items.map((item) =>
                item.userId === userId
                  ? {
                      ...item,
                      monthlySmsLimit: updated.monthlySmsLimit,
                      monthlySmsRemaining: Math.max(updated.monthlySmsLimit - item.monthlySmsUsed, 0),
                    }
                  : item
              ),
              summary: {
                ...current.summary,
                totalMonthlyLimit:
                  current.summary.totalMonthlyLimit -
                  (current.items.find((item) => item.userId === userId)?.monthlySmsLimit ?? 0) +
                  updated.monthlySmsLimit,
              },
            }
          : current
      );
      setDraftLimits((current) => ({ ...current, [userId]: String(updated.monthlySmsLimit) }));
      showDraftToast("SMS 월간 한도를 저장했습니다.", { tone: "success" });
    } catch (saveError) {
      showDraftToast(saveError instanceof Error ? saveError.message : "SMS 월간 한도를 저장하지 못했습니다.", {
        tone: "error",
      });
    } finally {
      setSavingUserId(null);
    }
  };

  if (loading && !data) {
    return (
      <>
        <SkeletonStatGrid columns={4} />
        <SkeletonTableBox titleWidth={116} rows={6} columns={["1.2fr", "1fr", "0.8fr", "0.8fr", "0.8fr", "160px", "110px"]} />
      </>
    );
  }

  if (!loading && error && !data) {
    return (
      <div className="flash flash-attention">
        <AppIcon name="warn" className="icon icon-16 flash-icon" />
        <div className="flash-body">{error}</div>
        <div className="flash-actions">
          <button className="btn btn-default btn-sm" onClick={() => void loadQuotas()}>
            <AppIcon name="refresh" className="icon icon-14" />
            다시 불러오기
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <>
      <div className="box">
        <div className="box-header">
          <div>
            <div className="box-title">사업자 계정별 SMS 월간 쿼터</div>
            <div className="box-subtitle">기본 1,000건을 기준으로 운영하고, 필요한 사용자 계정만 월간 SMS 한도를 상향합니다.</div>
          </div>
          <button className="btn btn-default btn-sm" onClick={() => void loadQuotas(true)}>
            <AppIcon name="refresh" className={`icon icon-14${refreshing ? " spin" : ""}`} />
            새로고침
          </button>
        </div>
        <div className="box-body" style={{ padding: 0 }}>
          <div className="ops-summary-grid" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
            <SummaryStat label="사용자 계정" value={String(data.summary.userCount)} />
            <SummaryStat label="기본 한도" value={`${data.summary.defaultLimit.toLocaleString()}건`} />
            <SummaryStat label="전체 월 한도" value={`${data.summary.totalMonthlyLimit.toLocaleString()}건`} />
            <SummaryStat label="이번 달 사용" value={`${data.summary.totalMonthlyUsed.toLocaleString()}건`} />
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
                <th>사용자 계정</th>
                <th>계정 속성</th>
                <th>승인 발신번호</th>
                <th>이번 달 사용</th>
                <th>남은 한도</th>
                <th>월간 한도</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.items.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="empty-state">
                      <div className="empty-icon">
                        <AppIcon name="sms-bulk" className="icon icon-40" />
                      </div>
                      <div className="empty-title">설정할 사용자 계정이 없습니다</div>
                      <div className="empty-desc">조회된 사용자 계정이 없어 SMS 쿼터를 조정할 대상이 없습니다.</div>
                    </div>
                  </td>
                </tr>
              ) : (
                data.items.map((item) => (
                  <tr key={item.userId}>
                    <td>
                      <div className="table-title-text">{item.userLabel}</div>
                      <div className="table-subtext td-mono">{item.email || item.loginId || item.providerUserId || item.userId}</div>
                    </td>
                    <td>
                      <div className="table-title-text">{item.role === "PARTNER_ADMIN" ? "협업 운영자" : "일반 사용자"}</div>
                      <div className="table-subtext">{item.accessOrigin === "PUBL" ? "PUBL 유입" : "직접 가입"}</div>
                    </td>
                    <td className="td-mono">{item.approvedSenderNumberCount.toLocaleString()}</td>
                    <td className="td-mono">{item.monthlySmsUsed.toLocaleString()}건</td>
                    <td className="td-mono">{item.monthlySmsRemaining.toLocaleString()}건</td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        step={100}
                        className="form-control field-width-sm"
                        value={draftLimits[item.userId] ?? String(item.monthlySmsLimit)}
                        onChange={(event) =>
                          setDraftLimits((current) => ({ ...current, [item.userId]: event.target.value }))
                        }
                        aria-label={`${item.userLabel} 월간 SMS 한도`}
                      />
                    </td>
                    <td>
                      <button
                        className="btn btn-default btn-sm"
                        onClick={() => void handleSave(item.userId)}
                        disabled={savingUserId === item.userId}
                      >
                        저장
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
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="summary-stat">
      <div className="summary-stat-label">{label}</div>
      <div className="summary-stat-value">{value}</div>
    </div>
  );
}
