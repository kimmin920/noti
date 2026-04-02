"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppIcon } from "@/components/icons/AppIcon";
import {
  fetchV2KakaoConnectBootstrap,
  requestV2KakaoConnect,
  type V2KakaoConnectBootstrapResponse,
  verifyV2KakaoConnect,
} from "@/lib/api/v2";

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
};

const modalCache: {
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

function formatPhoneForDisplay(value: string) {
  const phone = normalizePhone(value);
  if (phone.length === 11) {
    return `${phone.slice(0, 3)}-${phone.slice(3, 7)}-${phone.slice(7)}`;
  }
  if (phone.length === 10) {
    return `${phone.slice(0, 3)}-${phone.slice(3, 6)}-${phone.slice(6)}`;
  }
  return phone;
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

export function KakaoChannelConnectModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const otpInputRef = useRef<HTMLInputElement | null>(null);
  const [bootstrap, setBootstrap] = useState<V2KakaoConnectBootstrapResponse | null>(() => modalCache.bootstrap);
  const [loading, setLoading] = useState(() => !modalCache.bootstrap);
  const [error, setError] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [otpFocused, setOtpFocused] = useState(false);
  const [requestState, setRequestState] = useState<RequestedState | null>(null);
  const [form, setForm] = useState<ConnectFormState>({
    plusFriendId: "",
    phoneNo: "",
    largeCategoryCode: "",
    middleCategoryCode: "",
    smallCategoryCode: "",
    token: "",
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(!modalCache.bootstrap);
      setError(null);

      try {
        const next = await fetchV2KakaoConnectBootstrap();
        if (cancelled) return;
        modalCache.bootstrap = next;
        setBootstrap(next);
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : "채널 연결 정보를 불러오지 못했습니다.");
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
  }, [open]);

  const categoryTree = bootstrap?.categories ?? [];
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
  const otpDigits = useMemo(() => {
    const digits = form.token.slice(0, 6).split("");
    while (digits.length < 6) {
      digits.push("");
    }
    return digits;
  }, [form.token]);
  const resolvedCategoryCode = useMemo(
    () => buildResolvedCategoryCode([form.largeCategoryCode, form.middleCategoryCode, form.smallCategoryCode]),
    [form.largeCategoryCode, form.middleCategoryCode, form.smallCategoryCode]
  );

  const resetProgress = () => {
    setRequestState(null);
    setError(null);
  };

  const handleClose = () => {
    setError(null);
    setRequestState(null);
    setRequesting(false);
    setVerifying(false);
    setForm({
      plusFriendId: "",
      phoneNo: "",
      largeCategoryCode: "",
      middleCategoryCode: "",
      smallCategoryCode: "",
      token: "",
    });
    onClose();
  };

  const updateIdentityField = (key: "plusFriendId" | "phoneNo", value: string) => {
    setForm((current) => ({ ...current, [key]: value, token: "" }));
    resetProgress();
  };

  const updateLargeCategory = (value: string) => {
    setForm((current) => ({
      ...current,
      largeCategoryCode: value,
      middleCategoryCode: "",
      smallCategoryCode: "",
      token: "",
    }));
    resetProgress();
  };

  const updateMiddleCategory = (value: string) => {
    setForm((current) => ({
      ...current,
      middleCategoryCode: value,
      smallCategoryCode: "",
      token: "",
    }));
    resetProgress();
  };

  const updateSmallCategory = (value: string) => {
    setForm((current) => ({
      ...current,
      smallCategoryCode: value,
      token: "",
    }));
    resetProgress();
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
      setError("비즈니스 카테고리를 끝까지 선택해 주세요.");
      return;
    }

    if (categoryCode.length !== 11) {
      setError("소분류까지 선택해 주세요. 최종 카테고리 코드는 11자리여야 합니다.");
      return;
    }

    setRequesting(true);
    setError(null);

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
        token: "",
      }));
      setRequestState({
        plusFriendId: response.plusFriendId,
        phoneNo: response.phoneNo,
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
      await verifyV2KakaoConnect({
        plusFriendId: requestState.plusFriendId,
        token,
      });

      modalCache.bootstrap = await fetchV2KakaoConnectBootstrap();
      setBootstrap(modalCache.bootstrap);
      handleClose();
      router.refresh();
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : "인증 토큰 확인에 실패했습니다.");
    } finally {
      setVerifying(false);
    }
  };

  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop open" onClick={handleClose}>
      <div className={`modal kakao-connect-modal${requestState ? " kakao-connect-modal-otp" : ""}`} onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <AppIcon name="kakao" className="icon icon-18" />
            카카오 채널 연결
          </div>
          <button className="modal-close" onClick={handleClose}>
            <AppIcon name="x" className="icon icon-18" />
          </button>
        </div>

        <div className="modal-body">
          {error ? (
            <div className="flash flash-attention" style={{ marginBottom: 16 }}>
              <AppIcon name="warn" className="icon icon-16 flash-icon" />
              <div className="flash-body">{error}</div>
            </div>
          ) : null}

          {loading && !bootstrap ? (
            <div className="text-small text-muted">연결 정보를 불러오는 중입니다...</div>
          ) : !requestState ? (
            <div className="kakao-connect-modal-form">
              <div className="form-group">
                <label className="form-label">채널 ID</label>
                <input
                  className="form-control"
                  placeholder="@내채널ID"
                  value={form.plusFriendId}
                  onChange={(event) => updateIdentityField("plusFriendId", event.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">관리자 휴대폰</label>
                <input
                  className="form-control"
                  placeholder="01012345678"
                  value={form.phoneNo}
                  onChange={(event) => updateIdentityField("phoneNo", normalizePhone(event.target.value))}
                />
              </div>

              <div className="kakao-connect-category-group">
                <div className="form-group">
                  <label className="form-label">카테고리</label>
                  <select className="form-control" value={form.largeCategoryCode} onChange={(event) => updateLargeCategory(event.target.value)}>
                    <option value="">대분류 선택</option>
                    {largeCategoryOptions.map((item) => (
                      <option key={item.code} value={item.code}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="kakao-connect-category-row">
                  <div className="form-group">
                    <label className="form-label">중분류</label>
                    <select
                      className="form-control"
                      value={form.middleCategoryCode}
                      disabled={!selectedLargeCategory}
                      onChange={(event) => updateMiddleCategory(event.target.value)}
                    >
                      <option value="">{selectedLargeCategory ? "중분류 선택" : "먼저 대분류 선택"}</option>
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
                      <option value="">{selectedMiddleCategory ? "소분류 선택" : "먼저 중분류 선택"}</option>
                      {smallCategoryOptions.map((item) => (
                        <option key={item.code} value={item.code}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="kakao-connect-modal-actions">
                <button type="button" className="btn btn-accent" onClick={handleRequest} disabled={loading || requesting}>
                  {requesting ? "요청 중..." : "토큰 요청하기"}
                </button>
              </div>
            </div>
          ) : (
            <div className="kakao-connect-modal-form">
              <div className="kakao-connect-otp-stage">
                <div className="kakao-connect-otp-badge" aria-hidden="true">
                  <AppIcon name="kakao" className="icon icon-24" />
                </div>
                <div className="kakao-connect-otp-title">인증번호 확인</div>
                <p className="kakao-connect-otp-copy">
                  <strong>{requestState.plusFriendId}</strong> 채널 카카오톡 비즈메시지로 전달된 OTP번호를 입력해 주세요.
                </p>
                <div className="kakao-connect-otp-phone">관리자 휴대폰 {formatPhoneForDisplay(requestState.phoneNo)}</div>

                <div
                  className="kakao-connect-otp-field"
                  onClick={() => {
                    otpInputRef.current?.focus();
                  }}
                >
                  <input
                    ref={otpInputRef}
                    className="kakao-connect-otp-input"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoFocus
                    maxLength={6}
                    value={form.token}
                    onFocus={() => setOtpFocused(true)}
                    onBlur={() => setOtpFocused(false)}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        token: event.target.value.replace(/[^\d]/g, "").slice(0, 6),
                      }))
                    }
                  />
                  <div className="kakao-connect-otp-boxes" aria-hidden="true">
                    {otpDigits.map((digit, index) => {
                      const activeIndex = Math.min(form.token.length, otpDigits.length - 1);
                      const isActive = otpFocused && (index === activeIndex || (form.token.length === otpDigits.length && index === otpDigits.length - 1));
                      return (
                        <div
                          key={`otp-${index}`}
                          className={`kakao-connect-otp-box${digit ? " filled" : ""}${isActive ? " active" : ""}`}
                        >
                          {digit ? <span>{digit}</span> : <span className="kakao-connect-otp-dot" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="kakao-connect-modal-actions kakao-connect-otp-actions">
                <button
                  type="button"
                  className="btn btn-accent"
                  onClick={handleVerify}
                  disabled={verifying || form.token.length !== 6}
                >
                  {verifying ? "연결 중..." : "연결하기"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
