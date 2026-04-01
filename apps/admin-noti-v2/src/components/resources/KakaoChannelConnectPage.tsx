"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppIcon } from "@/components/icons/AppIcon";
import { useMountEffect } from "@/lib/hooks/use-mount-effect";
import {
  fetchV2KakaoConnectBootstrap,
  requestV2KakaoConnect,
  type V2KakaoConnectCategoryNode,
  verifyV2KakaoConnect,
  type V2KakaoConnectBootstrapResponse,
  type V2KakaoConnectVerifyResponse,
} from "@/lib/api/v2";
import { buildResourcesTabPath } from "@/lib/routes";

type ConnectFormState = {
  plusFriendId: string;
  phoneNo: string;
  largeCategoryCode: string;
  middleCategoryCode: string;
  smallCategoryCode: string;
  token: string;
};

type RequestedState = {
  plusFriendId: string;
  phoneNo: string;
  categoryCode: string;
  message: string;
};

const connectPageCache: {
  bootstrap: V2KakaoConnectBootstrapResponse | null;
} = {
  bootstrap: null,
};

function normalizePhone(value: string) {
  return value.replace(/[^\d]/g, "");
}

function normalizeChannelId(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("@") ? trimmed : `@${trimmed.replace(/^@+/, "")}`;
}

function mapStatusMeta(status: string) {
  if (status === "ACTIVE") return { text: "활성", className: "label-green" };
  if (status === "BLOCKED") return { text: "제한", className: "label-red" };
  if (status === "DORMANT") return { text: "휴면", className: "label-yellow" };
  return { text: "확인 필요", className: "label-blue" };
}

function buildResolvedCategoryCode(codes: string[]) {
  return codes
    .map((code) => code.trim())
    .filter(Boolean)
    .reduce((accumulator, code) => {
      if (!accumulator) {
        return code;
      }

      if (code.startsWith(accumulator)) {
        return code;
      }

      return `${accumulator}${code}`;
    }, "");
}

function findCategoryByCode(
  categories: V2KakaoConnectCategoryNode[],
  code: string
): V2KakaoConnectCategoryNode | null {
  if (!code) return null;

  for (const category of categories) {
    if (category.code === code) {
      return category;
    }

    const nested = findCategoryByCode(category.children, code);
    if (nested) {
      return nested;
    }
  }

  return null;
}

export function KakaoChannelConnectPage({
  initialData,
}: {
  initialData?: V2KakaoConnectBootstrapResponse | null;
}) {
  const router = useRouter();
  const [bootstrap, setBootstrap] = useState<V2KakaoConnectBootstrapResponse | null>(
    () => initialData ?? connectPageCache.bootstrap
  );
  const [loading, setLoading] = useState(() => !(initialData ?? connectPageCache.bootstrap));
  const [error, setError] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [requestState, setRequestState] = useState<RequestedState | null>(null);
  const [verifyResult, setVerifyResult] = useState<V2KakaoConnectVerifyResponse | null>(null);
  const [form, setForm] = useState<ConnectFormState>({
    plusFriendId: "",
    phoneNo: "",
    largeCategoryCode: "",
    middleCategoryCode: "",
    smallCategoryCode: "",
    token: "",
  });

  useMountEffect(() => {
    if (initialData) {
      connectPageCache.bootstrap = initialData;
      setBootstrap(initialData);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(!connectPageCache.bootstrap);
      setError(null);

      try {
        const next = await fetchV2KakaoConnectBootstrap();
        if (cancelled) return;
        connectPageCache.bootstrap = next;
        setBootstrap(next);
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : "카카오 채널 연결 정보를 불러오지 못했습니다.");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  });

  const categoryTree = bootstrap?.categories ?? [];
  const existingChannels = bootstrap?.existingChannels ?? [];
  const readiness = bootstrap?.readiness ?? null;

  const largeCategoryOptions = categoryTree;
  const selectedLargeCategory = useMemo(
    () => largeCategoryOptions.find((item) => item.code === form.largeCategoryCode) ?? null,
    [form.largeCategoryCode, largeCategoryOptions]
  );
  const middleCategoryOptions = selectedLargeCategory?.children ?? [];
  const selectedMiddleCategory = useMemo(
    () => middleCategoryOptions.find((item) => item.code === form.middleCategoryCode) ?? null,
    [form.middleCategoryCode, middleCategoryOptions]
  );
  const smallCategoryOptions = selectedMiddleCategory?.children ?? [];
  const resolvedCategoryCode = useMemo(
    () => buildResolvedCategoryCode([form.largeCategoryCode, form.middleCategoryCode, form.smallCategoryCode]),
    [form.largeCategoryCode, form.middleCategoryCode, form.smallCategoryCode]
  );

  const selectedCategoryLabel = useMemo(() => {
    const large = selectedLargeCategory?.label;
    const middle = selectedMiddleCategory?.label;
    const small = findCategoryByCode(smallCategoryOptions, resolvedCategoryCode)?.label;
    return [large, middle, small].filter(Boolean).join(" / ") || null;
  }, [resolvedCategoryCode, selectedLargeCategory, selectedMiddleCategory, smallCategoryOptions]);

  const resetRequestState = () => {
    if (requestState) {
      setRequestState(null);
    }
    if (verifyResult) {
      setVerifyResult(null);
    }
  };

  const updateIdentityField = (key: "plusFriendId" | "phoneNo", value: string) => {
    setForm((current) => ({ ...current, [key]: value, token: "" }));
    resetRequestState();
  };

  const updateLargeCategory = (value: string) => {
    setForm((current) => ({
      ...current,
      largeCategoryCode: value,
      middleCategoryCode: "",
      smallCategoryCode: "",
      token: "",
    }));
    resetRequestState();
  };

  const updateMiddleCategory = (value: string) => {
    setForm((current) => ({
      ...current,
      middleCategoryCode: value,
      smallCategoryCode: "",
      token: "",
    }));
    resetRequestState();
  };

  const updateSmallCategory = (value: string) => {
    setForm((current) => ({
      ...current,
      smallCategoryCode: value,
      token: "",
    }));
    resetRequestState();
  };

  const reloadBootstrap = async () => {
    const next = await fetchV2KakaoConnectBootstrap();
    connectPageCache.bootstrap = next;
    setBootstrap(next);
  };

  const handleRequest = async () => {
    const plusFriendId = normalizeChannelId(form.plusFriendId);
    const phoneNo = normalizePhone(form.phoneNo);
    const categoryCode = resolvedCategoryCode;

    if (!plusFriendId) {
      setError("채널 ID를 입력해 주세요.");
      return;
    }

    if (!phoneNo) {
      setError("관리자 휴대폰 번호를 입력해 주세요.");
      return;
    }

    if (!categoryCode) {
      setError("비즈니스 카테고리를 선택해 주세요.");
      return;
    }

    if (categoryCode.length !== 11) {
      setError("소분류까지 선택해 주세요. 최종 카테고리 코드는 11자리여야 합니다.");
      return;
    }

    setRequesting(true);
    setError(null);
    setVerifyResult(null);

    try {
      const response = await requestV2KakaoConnect({
        plusFriendId,
        phoneNo,
        categoryCode,
      });

      setForm((current) => ({
        ...current,
        plusFriendId,
        phoneNo,
      }));
      setRequestState({
        plusFriendId: response.plusFriendId,
        phoneNo: response.phoneNo,
        categoryCode: response.categoryCode,
        message: response.message,
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "인증 토큰 요청에 실패했습니다.");
    } finally {
      setRequesting(false);
    }
  };

  const handleVerify = async () => {
    if (!requestState) {
      setError("먼저 인증 토큰을 요청해 주세요.");
      return;
    }

    const token = Number(form.token.trim());
    if (!Number.isInteger(token) || token <= 0) {
      setError("숫자 형태의 인증 토큰을 입력해 주세요.");
      return;
    }

    setVerifying(true);
    setError(null);

    try {
      const response = await verifyV2KakaoConnect({
        plusFriendId: requestState.plusFriendId,
        token,
      });

      setVerifyResult(response);
      await reloadBootstrap();
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : "인증 토큰 확인에 실패했습니다.");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <div className="page-title">카카오 채널 연결</div>
            <div className="page-desc">채널 정보를 입력하고 인증 토큰을 확인해 연결을 완료합니다</div>
          </div>
          <div className="flex items-center gap-8">
            <a className="btn btn-default btn-sm" href={buildResourcesTabPath("tab-kakao")}>
              <AppIcon name="chevron-right" className="icon icon-14" style={{ transform: "rotate(180deg)" }} />
              연결된 채널 보기
            </a>
          </div>
        </div>
      </div>

      {error ? (
        <div className="flash flash-attention">
          <AppIcon name="warn" className="icon icon-16 flash-icon" />
          <div className="flash-body">{error}</div>
        </div>
      ) : null}

      <div className="kakao-connect-layout">
        <div className="kakao-connect-main">
          <div className="box">
            <div className="box-header">
              <div>
                <div className="box-title">1. 채널 정보 입력</div>
                <div className="box-subtitle">채널 ID, 관리자 휴대폰, 비즈니스 카테고리를 입력합니다.</div>
              </div>
            </div>
            <div className="box-body">
              <div className="kakao-connect-form-grid">
                <div className="form-group">
                  <label className="form-label">카카오 채널 ID</label>
                  <input
                    className="form-control"
                    placeholder="@내채널ID"
                    value={form.plusFriendId}
                    onChange={(event) => updateIdentityField("plusFriendId", event.target.value)}
                  />
                  <div className="form-hint">@로 시작하는 채널 검색용 ID를 입력해 주세요.</div>
                </div>
                <div className="form-group">
                  <label className="form-label">관리자 휴대폰</label>
                  <input
                    className="form-control"
                    placeholder="01012345678"
                    value={form.phoneNo}
                    onChange={(event) => updateIdentityField("phoneNo", normalizePhone(event.target.value))}
                  />
                  <div className="form-hint">인증 토큰이 이 번호로 발송됩니다.</div>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">비즈니스 카테고리</label>
                <div className="kakao-connect-form-grid">
                  <div className="form-group">
                    <label className="form-label">대분류</label>
                    <select className="form-control" value={form.largeCategoryCode} onChange={(event) => updateLargeCategory(event.target.value)}>
                      <option value="">대분류를 선택해 주세요</option>
                      {largeCategoryOptions.map((item) => (
                        <option key={item.code} value={item.code}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">중분류</label>
                    <select
                      className="form-control"
                      value={form.middleCategoryCode}
                      disabled={!selectedLargeCategory}
                      onChange={(event) => updateMiddleCategory(event.target.value)}
                    >
                      <option value="">{selectedLargeCategory ? "중분류를 선택해 주세요" : "먼저 대분류를 선택해 주세요"}</option>
                      {middleCategoryOptions.map((item) => (
                        <option key={item.code} value={item.code}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">소분류</label>
                    <select
                      className="form-control"
                      value={form.smallCategoryCode}
                      disabled={!selectedMiddleCategory}
                      onChange={(event) => updateSmallCategory(event.target.value)}
                    >
                      <option value="">{selectedMiddleCategory ? "소분류를 선택해 주세요" : "먼저 중분류를 선택해 주세요"}</option>
                      {smallCategoryOptions.map((item) => (
                        <option key={item.code} value={item.code}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="form-hint">
                  {selectedCategoryLabel
                    ? `선택된 카테고리: ${selectedCategoryLabel}`
                    : "대분류, 중분류, 소분류를 차례대로 선택해 주세요."}
                </div>
              </div>
            </div>
            <div className="box-footer">
              <span className="text-small">입력한 정보는 인증 토큰 요청에만 사용됩니다.</span>
              <button type="button" className="btn btn-kakao" onClick={handleRequest} disabled={requesting || loading}>
                <AppIcon name={requesting ? "refresh" : "send"} className={`icon icon-14${requesting ? " spin" : ""}`} />
                {requesting ? "요청 중..." : "인증 토큰 요청"}
              </button>
            </div>
          </div>

          <div className="box">
            <div className="box-header">
              <div>
                <div className="box-title">2. 인증 토큰 확인</div>
                <div className="box-subtitle">휴대폰으로 받은 숫자 토큰을 입력하면 이 워크스페이스에 연결됩니다.</div>
              </div>
            </div>
            <div className="box-body">
              {requestState ? (
                <div className="flash flash-success" style={{ marginBottom: 12 }}>
                  <AppIcon name="check-circle" className="icon icon-16 flash-icon" />
                  <div className="flash-body">
                    <strong>{requestState.plusFriendId}</strong> 채널로 인증을 요청했습니다. 받은 토큰을 아래에 입력해 주세요.
                  </div>
                </div>
              ) : (
                <div className="flash flash-info" style={{ marginBottom: 12 }}>
                  <AppIcon name="info" className="icon icon-16 flash-icon" />
                  <div className="flash-body">먼저 채널 정보 입력을 마친 뒤 인증 토큰을 요청해 주세요.</div>
                </div>
              )}

              <div className="form-row-inline align-start">
                <div className="form-group field-width-md" style={{ flex: 1 }}>
                  <label className="form-label">인증 토큰</label>
                  <input
                    className="form-control"
                    placeholder="숫자 토큰 입력"
                    value={form.token}
                    disabled={!requestState}
                    onChange={(event) => setForm((current) => ({ ...current, token: event.target.value.replace(/[^\d]/g, "") }))}
                  />
                  <div className="form-hint">토큰 요청 직후 발송된 숫자 코드를 입력해 주세요.</div>
                </div>
                <div className="form-group" style={{ marginTop: 29 }}>
                  <button type="button" className="btn btn-default" onClick={handleVerify} disabled={!requestState || verifying}>
                    <AppIcon name={verifying ? "refresh" : "check"} className={`icon icon-14${verifying ? " spin" : ""}`} />
                    {verifying ? "확인 중..." : "연결 완료"}
                  </button>
                </div>
              </div>

              {verifyResult?.sender ? (
                <div className="kakao-connect-result">
                  <div className="kakao-connect-result-head">
                    <div>
                      <div className="kakao-connect-result-title">연결이 완료되었습니다</div>
                      <div className="kakao-connect-result-desc">{verifyResult.message}</div>
                    </div>
                    <span className="label label-green">
                      <span className="label-dot" />
                      연결 완료
                    </span>
                  </div>
                  <div className="dash-row dash-row-3" style={{ marginBottom: 0 }}>
                    <div style={{ fontSize: 12 }}>
                      <div className="text-muted" style={{ marginBottom: 2 }}>채널 ID</div>
                      <div className="td-mono">{verifyResult.sender.plusFriendId}</div>
                    </div>
                    <div style={{ fontSize: 12 }}>
                      <div className="text-muted" style={{ marginBottom: 2 }}>발신프로필 키</div>
                      <div className="td-mono">{verifyResult.sender.senderKey}</div>
                    </div>
                    <div style={{ fontSize: 12 }}>
                      <div className="text-muted" style={{ marginBottom: 2 }}>상태</div>
                      <div style={{ fontWeight: 600 }}>{mapStatusMeta(verifyResult.sender.status).text}</div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
            <div className="box-footer">
              <span className="text-small">연결이 완료되면 알림톡 발송과 템플릿 관리에서 바로 사용할 수 있습니다.</span>
              <button type="button" className="btn btn-default btn-sm" onClick={() => router.push(buildResourcesTabPath("tab-kakao"))}>
                자원 관리로 돌아가기
              </button>
            </div>
          </div>

          <div className="box">
            <div className="box-header">
              <div>
                <div className="box-title">현재 연결된 채널</div>
                <div className="box-subtitle">이 워크스페이스에서 사용 중인 채널만 표시합니다.</div>
              </div>
            </div>
            <div className="box-body">
              {loading && !bootstrap ? (
                <div className="text-small text-muted">채널 목록을 확인하는 중입니다...</div>
              ) : existingChannels.length === 0 ? (
                <div className="empty-state" style={{ padding: "28px 16px" }}>
                  <div className="empty-icon" style={{ color: "#c9a700" }}>
                    <AppIcon name="kakao" className="icon icon-32" />
                  </div>
                  <div className="empty-title">아직 연결된 채널이 없습니다</div>
                  <div className="empty-desc">첫 채널을 연결하면 이곳에서 상태와 발신프로필 키를 바로 확인할 수 있습니다.</div>
                </div>
              ) : (
                <div className="kakao-connect-channel-list">
                  {existingChannels.map((item) => {
                    const status = mapStatusMeta(item.status);

                    return (
                      <div className="kakao-connect-channel-item" key={item.id}>
                        <div className="kakao-connect-channel-meta">
                          <div className="kakao-connect-channel-title">{item.plusFriendId}</div>
                          <div className="kakao-connect-channel-desc">
                            {item.senderProfileType ?? "브랜드 채널"} · 연결일 {item.createdAt.slice(0, 10)}
                          </div>
                        </div>
                        <div className="kakao-connect-channel-side">
                          <span className={`label ${status.className}`}>
                            <span className="label-dot" />
                            {status.text}
                          </span>
                          <div className="td-mono kakao-connect-channel-key">{item.senderKey}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="kakao-connect-side">
          <div className="box">
            <div className="box-header">
              <div className="box-title">진행 상태</div>
            </div>
            <div className="box-body">
              <div className="steps">
                <div className="step">
                  <div className={`step-circle ${requestState || verifyResult ? "done" : "active"}`}>
                    {requestState || verifyResult ? <AppIcon name="check" className="icon icon-14" /> : "1"}
                  </div>
                  <div className={`step-label ${requestState || verifyResult ? "done" : "active"}`}>채널 정보 입력</div>
                </div>
                <div className="step">
                  <div className={`step-circle ${verifyResult ? "done" : requestState ? "active" : ""}`}>
                    {verifyResult ? <AppIcon name="check" className="icon icon-14" /> : "2"}
                  </div>
                  <div className={`step-label ${verifyResult ? "done" : requestState ? "active" : ""}`}>인증 토큰 요청</div>
                </div>
                <div className="step">
                  <div className={`step-circle ${verifyResult ? "done" : ""}`}>
                    {verifyResult ? <AppIcon name="check" className="icon icon-14" /> : "3"}
                  </div>
                  <div className={`step-label ${verifyResult ? "done" : ""}`}>연결 완료</div>
                </div>
              </div>
            </div>
          </div>

          <div className="box">
            <div className="box-header">
              <div className="box-title">연결 전 확인사항</div>
            </div>
            <div className="box-row">
              <div className="box-row-content">
                <div className="box-row-title">관리자 휴대폰 필요</div>
                <div className="box-row-desc">채널 관리자에게 도착한 인증 토큰이 있어야 연결을 마칠 수 있습니다.</div>
              </div>
            </div>
            <div className="box-row">
              <div className="box-row-content">
                <div className="box-row-title">채널 검색용 ID 준비</div>
                <div className="box-row-desc">@로 시작하는 채널 ID와 운영 목적에 맞는 카테고리를 미리 확인해 주세요.</div>
              </div>
            </div>
          </div>

          <div className="box">
            <div className="box-header">
              <div className="box-title">워크스페이스 상태</div>
            </div>
            <div className="box-body">
              <div className="kakao-connect-stat-grid">
                <div className="kakao-connect-stat">
                  <div className="kakao-connect-stat-label">연결 채널</div>
                  <div className="kakao-connect-stat-value">{readiness?.totalCount ?? 0}</div>
                </div>
                <div className="kakao-connect-stat">
                  <div className="kakao-connect-stat-label">활성 채널</div>
                  <div className="kakao-connect-stat-value">{readiness?.activeCount ?? 0}</div>
                </div>
                <div className="kakao-connect-stat">
                  <div className="kakao-connect-stat-label">제한/휴면</div>
                  <div className="kakao-connect-stat-value">{(readiness?.blockedCount ?? 0) + (readiness?.dormantCount ?? 0)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
