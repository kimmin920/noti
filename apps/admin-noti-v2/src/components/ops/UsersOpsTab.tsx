"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AppIcon } from "@/components/icons/AppIcon";
import { SkeletonStatGrid, SkeletonTableBox } from "@/components/loading/PageSkeleton";
import { useMountEffect } from "@/lib/hooks/use-mount-effect";
import { useAppStore } from "@/lib/store/app-store";
import {
  fetchV2OpsAdminUsers,
  fetchV2OpsManagedUsers,
  updateV2OpsAdminUserAccessOrigin,
  updateV2OpsAdminUserRole,
  type V2OpsAdminUsersResponse,
  type V2OpsManagedUsersResponse,
} from "@/lib/api/v2";

type UserOpsView = "admin-users" | "managed-users";

function parseUserOpsView(value: string | null): UserOpsView | null {
  if (value === "admin-users") {
    return "admin-users";
  }

  if (value === "managed-users") {
    return "managed-users";
  }

  return null;
}

export function UsersOpsTab() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const showDraftToast = useAppStore((state) => state.showDraftToast);
  const activeView = parseUserOpsView(searchParams.get("view")) || "admin-users";
  const [adminData, setAdminData] = useState<V2OpsAdminUsersResponse | null>(null);
  const [managedData, setManagedData] = useState<V2OpsManagedUsersResponse | null>(null);
  const [adminLoading, setAdminLoading] = useState(true);
  const [managedLoading, setManagedLoading] = useState(false);
  const [adminRefreshing, setAdminRefreshing] = useState(false);
  const [managedRefreshing, setManagedRefreshing] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [managedError, setManagedError] = useState<string | null>(null);

  const loadAdminUsers = async (background = false) => {
    if (background) {
      setAdminRefreshing(true);
    } else {
      setAdminLoading(true);
    }

    setAdminError(null);

    try {
      const next = await fetchV2OpsAdminUsers();
      setAdminData(next);
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "사용자 계정 현황을 불러오지 못했습니다.";
      setAdminError(message);
      if (background) {
        showDraftToast(message);
      }
    } finally {
      setAdminLoading(false);
      setAdminRefreshing(false);
    }
  };

  const loadManagedUsers = async (background = false) => {
    if (background) {
      setManagedRefreshing(true);
    } else {
      setManagedLoading(true);
    }

    setManagedError(null);

    try {
      const next = await fetchV2OpsManagedUsers();
      setManagedData(next);
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "관리 대상 유저 현황을 불러오지 못했습니다.";
      setManagedError(message);
      if (background) {
        showDraftToast(message);
      }
    } finally {
      setManagedLoading(false);
      setManagedRefreshing(false);
    }
  };

  useMountEffect(() => {
    if (activeView === "managed-users") {
      void loadManagedUsers();
      return;
    }

    void loadAdminUsers();
  });

  const switchView = (view: UserOpsView) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("view", view);
    router.replace(`${pathname}?${nextParams.toString()}`, { scroll: false });

    if (view === "managed-users" && !managedData && !managedLoading) {
      void loadManagedUsers();
    }

    if (view === "admin-users" && !adminData && !adminLoading) {
      void loadAdminUsers();
    }
  };

  return (
    <>
      <div className="tab-nav" style={{ marginTop: -4 }}>
        <button className={`tab-item${activeView === "admin-users" ? " active" : ""}`} onClick={() => switchView("admin-users")}>
          <AppIcon name="shield" className="icon icon-14" />
          사용자 계정
        </button>
        <button className={`tab-item${activeView === "managed-users" ? " active" : ""}`} onClick={() => switchView("managed-users")}>
          <AppIcon name="users" className="icon icon-14" />
          관리 대상 유저
        </button>
      </div>

      {activeView === "admin-users" ? (
        <AdminUsersPanel
          data={adminData}
          loading={adminLoading}
          refreshing={adminRefreshing}
          error={adminError}
          onRefresh={() => void loadAdminUsers(true)}
        />
      ) : null}

      {activeView === "managed-users" ? (
        <ManagedUsersPanel
          data={managedData}
          loading={managedLoading}
          refreshing={managedRefreshing}
          error={managedError}
          onRefresh={() => void loadManagedUsers(true)}
        />
      ) : null}
    </>
  );
}

function AdminUsersPanel({
  data,
  loading,
  refreshing,
  error,
  onRefresh,
}: {
  data: V2OpsAdminUsersResponse | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  onRefresh: () => void;
}) {
  const showDraftToast = useAppStore((state) => state.showDraftToast);
  const [draftRoles, setDraftRoles] = useState<Record<string, "USER" | "PARTNER_ADMIN">>({});
  const [draftOrigins, setDraftOrigins] = useState<Record<string, "DIRECT" | "PUBL">>({});
  const [savingUserId, setSavingUserId] = useState<string | null>(null);

  if (loading && !data) {
    return (
      <>
        <SkeletonStatGrid columns={4} />
        <SkeletonTableBox titleWidth={132} rows={6} columns={["1.3fr", "1fr", "1fr", "1fr", "1fr", "110px"]} />
      </>
    );
  }

  if (!loading && error && !data) {
    return (
      <div className="flash flash-attention">
        <AppIcon name="warn" className="icon icon-16 flash-icon" />
        <div className="flash-body">{error}</div>
        <div className="flash-actions">
          <button className="btn btn-default btn-sm" onClick={onRefresh}>
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

  const handleSave = async (item: V2OpsAdminUsersResponse["items"][number]) => {
    if (item.role === "SUPER_ADMIN") {
      return;
    }

    const nextRole = draftRoles[item.id] ?? item.role;
    const nextOrigin = draftOrigins[item.id] ?? item.accessOrigin;
    const needsRoleUpdate = nextRole !== item.role;
    const needsOriginUpdate = nextOrigin !== item.accessOrigin;

    if (!needsRoleUpdate && !needsOriginUpdate) {
      showDraftToast("변경된 항목이 없습니다.");
      return;
    }

    setSavingUserId(item.id);

    try {
      if (needsRoleUpdate) {
        await updateV2OpsAdminUserRole(item.id, { role: nextRole as "USER" | "PARTNER_ADMIN" });
      }

      if (needsOriginUpdate) {
        await updateV2OpsAdminUserAccessOrigin(item.id, { accessOrigin: nextOrigin });
      }

      showDraftToast("사용자 설정을 저장했습니다.");
      onRefresh();
    } catch (fetchError) {
      showDraftToast(fetchError instanceof Error ? fetchError.message : "사용자 설정을 저장하지 못했습니다.");
    } finally {
      setSavingUserId(null);
    }
  };

  return (
    <>
      <div className="box">
        <div className="box-header">
          <div>
            <div className="box-title">사용자 계정 현황</div>
            <div className="box-subtitle">로그인 방식, 유입 채널, 권한 구성을 확인하고 필요한 경우 바로 변경합니다.</div>
          </div>
          <button className="btn btn-default btn-sm" onClick={onRefresh}>
            <AppIcon name="refresh" className={`icon icon-14${refreshing ? " spin" : ""}`} />
            새로고침
          </button>
        </div>
        <div className="box-body" style={{ padding: 0 }}>
          <div className="ops-summary-grid" style={{ gridTemplateColumns: "repeat(5, minmax(0, 1fr))" }}>
            <SummaryStat label="전체 계정" value={String(data.summary.totalCount)} />
            <SummaryStat label="일반 사용자" value={String(data.summary.userCount)} />
            <SummaryStat label="협업 운영자" value={String(data.summary.partnerAdminCount)} />
            <SummaryStat label="최상위 운영자" value={String(data.summary.superAdminCount)} />
            <SummaryStat label="PUBL 유입" value={String(data.summary.publOriginCount)} />
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
                <th>계정</th>
                <th>로그인 방식</th>
                <th>권한</th>
                <th>유입 채널</th>
                <th>사용자 ID</th>
                <th>생성일</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.items.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="empty-state">
                      <div className="empty-icon">
                        <AppIcon name="shield" className="icon icon-40" />
                      </div>
                      <div className="empty-title">사용자 계정이 없습니다</div>
                      <div className="empty-desc">조회된 사용자 계정이 없어 테이블이 비어 있습니다.</div>
                    </div>
                  </td>
                </tr>
              ) : (
                data.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="table-title-text">{item.email || item.loginId || item.providerUserId}</div>
                      <div className="table-subtext">
                        {item.loginId || item.providerUserId}
                      </div>
                    </td>
                    <td className="td-muted">{loginProviderText(item.loginProvider)}</td>
                    <td>
                      {item.role === "SUPER_ADMIN" ? (
                        <span className="label label-blue">
                          <span className="label-dot" />
                          최상위 운영자
                        </span>
                      ) : (
                        <select
                          className="form-control field-width-sm"
                          value={draftRoles[item.id] ?? item.role}
                          onChange={(event) =>
                            setDraftRoles((current) => ({
                              ...current,
                              [item.id]: event.target.value as "USER" | "PARTNER_ADMIN",
                            }))
                          }
                        >
                          <option value="USER">일반 사용자</option>
                          <option value="PARTNER_ADMIN">협업 운영자</option>
                        </select>
                      )}
                    </td>
                    <td>
                      {item.role === "SUPER_ADMIN" ? (
                        <span className="td-muted">{item.accessOrigin === "PUBL" ? "PUBL" : "직접"}</span>
                      ) : (
                        <select
                          className="form-control field-width-sm"
                          value={draftOrigins[item.id] ?? item.accessOrigin}
                          onChange={(event) =>
                            setDraftOrigins((current) => ({
                              ...current,
                              [item.id]: event.target.value as "DIRECT" | "PUBL",
                            }))
                          }
                        >
                          <option value="DIRECT">직접</option>
                          <option value="PUBL">PUBL</option>
                        </select>
                      )}
                    </td>
                    <td className="td-mono td-muted">{item.providerUserId}</td>
                    <td className="td-muted text-small">{formatShortDate(item.createdAt)}</td>
                    <td>
                      {item.role === "SUPER_ADMIN" ? (
                        <span className="table-subtext">env 관리</span>
                      ) : (
                        <button
                          className="btn btn-default btn-sm"
                          onClick={() => void handleSave(item)}
                          disabled={savingUserId === item.id}
                        >
                          저장
                        </button>
                      )}
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

function loginProviderText(value: "GOOGLE_OAUTH" | "PUBL_SSO" | "LOCAL_PASSWORD") {
  if (value === "GOOGLE_OAUTH") {
    return "Google";
  }
  if (value === "LOCAL_PASSWORD") {
    return "ID/비밀번호";
  }
  return "PUBL";
}

function ManagedUsersPanel({
  data,
  loading,
  refreshing,
  error,
  onRefresh,
}: {
  data: V2OpsManagedUsersResponse | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  onRefresh: () => void;
}) {
  if (loading && !data) {
    return (
      <>
        <SkeletonStatGrid columns={6} />
        <SkeletonTableBox titleWidth={144} rows={6} columns={["1fr", "1fr", "0.9fr", "1fr", "0.9fr", "0.9fr", "0.9fr"]} />
      </>
    );
  }

  if (!loading && error && !data) {
    return (
      <div className="flash flash-attention">
        <AppIcon name="warn" className="icon icon-16 flash-icon" />
        <div className="flash-body">{error}</div>
        <div className="flash-actions">
          <button className="btn btn-default btn-sm" onClick={onRefresh}>
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
            <div className="box-title">관리 대상 유저 현황</div>
            <div className="box-subtitle">메시지를 받는 고객·회원·수신자 데이터를 소속 계정 기준으로 확인합니다.</div>
          </div>
          <button className="btn btn-default btn-sm" onClick={onRefresh}>
            <AppIcon name="refresh" className={`icon icon-14${refreshing ? " spin" : ""}`} />
            새로고침
          </button>
        </div>
        <div className="box-body" style={{ padding: 0 }}>
          <div className="ops-summary-grid">
            <SummaryStat label="전체 유저" value={String(data.summary.totalCount)} />
            <SummaryStat label="활성" value={String(data.summary.activeCount)} tone="success" />
            <SummaryStat label="비활성" value={String(data.summary.inactiveCount)} />
            <SummaryStat label="휴면" value={String(data.summary.dormantCount)} />
            <SummaryStat label="차단" value={String(data.summary.blockedCount)} tone="danger" />
            <SummaryStat label="소스 수" value={String(data.summary.sourceCount)} />
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
                <th>이름</th>
                <th>소속 계정</th>
                <th>연락처</th>
                <th>상태</th>
                <th>소스</th>
                <th>세그먼트</th>
                <th>최근 변경일</th>
              </tr>
            </thead>
            <tbody>
              {data.items.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="empty-state">
                      <div className="empty-icon">
                        <AppIcon name="users" className="icon icon-40" />
                      </div>
                      <div className="empty-title">관리 대상 유저가 없습니다</div>
                      <div className="empty-desc">조회된 관리 대상 유저가 없어 테이블이 비어 있습니다.</div>
                    </div>
                  </td>
                </tr>
              ) : (
                data.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="table-title-text">{item.name}</div>
                      <div className="table-subtext">{item.userType || item.gradeOrLevel || "—"}</div>
                    </td>
                    <td>
                      <div className="table-title-text">{item.userLabel}</div>
                      <div className="table-subtext">소속 계정</div>
                    </td>
                    <td className="td-muted">
                      <div>{item.phone ? formatPhone(item.phone) : "전화번호 없음"}</div>
                      <div className="table-subtext">{item.email || "이메일 없음"}</div>
                    </td>
                    <td>
                      <span className={`label ${managedUserStatusClass(item.status)}`}>
                        <span className="label-dot" />
                        {managedUserStatusText(item.status)}
                      </span>
                    </td>
                    <td className="td-muted">{item.source}</td>
                    <td className="td-muted">{item.segment || "—"}</td>
                    <td className="td-muted text-small">{formatShortDate(item.updatedAt)}</td>
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

function SummaryStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "danger";
}) {
  return (
    <div className="ops-summary-cell">
      <div className="stat-label-t">{label}</div>
      <div className={`ops-summary-value${tone ? ` ${tone}` : ""}`}>{value}</div>
    </div>
  );
}

function managedUserStatusText(value: "ACTIVE" | "INACTIVE" | "DORMANT" | "BLOCKED") {
  if (value === "ACTIVE") {
    return "활성";
  }
  if (value === "INACTIVE") {
    return "비활성";
  }
  if (value === "DORMANT") {
    return "휴면";
  }
  return "차단";
}

function managedUserStatusClass(value: "ACTIVE" | "INACTIVE" | "DORMANT" | "BLOCKED") {
  if (value === "ACTIVE") {
    return "label-green";
  }
  if (value === "BLOCKED") {
    return "label-red";
  }
  if (value === "DORMANT") {
    return "label-yellow";
  }
  return "label-gray";
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
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
