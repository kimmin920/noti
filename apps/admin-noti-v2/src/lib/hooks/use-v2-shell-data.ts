"use client";

import { useCallback, useRef, useState } from "react";
import {
  fetchV2Bootstrap,
  fetchV2Campaigns,
  fetchV2Dashboard,
  fetchV2Events,
  fetchV2Logs,
  fetchV2OpsHealth,
  fetchV2ResourcesBundle,
  fetchV2TemplatesBundle,
  type V2BootstrapResponse,
  type V2CampaignsResponse,
  type V2DashboardResponse,
  type V2EventsResponse,
  type V2LogsResponse,
  type V2OpsHealthResponse,
  type V2KakaoResourcesResponse,
  type V2ResourcesSummaryResponse,
  type V2SmsResourcesResponse,
  type V2KakaoTemplatesResponse,
  type V2SmsTemplatesResponse,
  type V2TemplatesSummaryResponse,
} from "@/lib/api/v2";
import { useAppStore } from "@/lib/store/app-store";
import type { PageId } from "@/lib/store/types";
import { useMountEffect } from "@/lib/hooks/use-mount-effect";

type ResourcesBundle = {
  summary: V2ResourcesSummaryResponse | null;
  sms: V2SmsResourcesResponse | null;
  kakao: V2KakaoResourcesResponse | null;
};

type TemplatesBundle = {
  summary: V2TemplatesSummaryResponse | null;
  sms: V2SmsTemplatesResponse | null;
  kakao: V2KakaoTemplatesResponse | null;
};

type ShellDataState = {
  bootstrap: V2BootstrapResponse | null;
  dashboard: V2DashboardResponse | null;
  resources: ResourcesBundle;
  templates: TemplatesBundle;
  events: V2EventsResponse | null;
  logs: V2LogsResponse | null;
  opsHealth: V2OpsHealthResponse | null;
  campaigns: V2CampaignsResponse | null;
};

export type V2InitialShellData = {
  bootstrap?: V2BootstrapResponse | null;
  dashboard?: V2DashboardResponse | null;
  resources?: ResourcesBundle;
  templates?: TemplatesBundle;
  events?: V2EventsResponse | null;
  logs?: V2LogsResponse | null;
  opsHealth?: V2OpsHealthResponse | null;
  campaigns?: V2CampaignsResponse | null;
};

type LoadState = {
  bootstrap: boolean;
  dashboard: boolean;
  resources: boolean;
  templates: boolean;
  events: boolean;
  logs: boolean;
  opsHealth: boolean;
  campaigns: boolean;
};

type ErrorState = {
  bootstrap: string | null;
  dashboard: string | null;
  resources: string | null;
  templates: string | null;
  events: string | null;
  logs: string | null;
  opsHealth: string | null;
  campaigns: string | null;
};

const initialDataState: ShellDataState = {
  bootstrap: null,
  dashboard: null,
  resources: {
    summary: null,
    sms: null,
    kakao: null,
  },
  templates: {
    summary: null,
    sms: null,
    kakao: null,
  },
  events: null,
  logs: null,
  opsHealth: null,
  campaigns: null,
};

const initialLoadState: LoadState = {
  bootstrap: false,
  dashboard: false,
  resources: false,
  templates: false,
  events: false,
  logs: false,
  opsHealth: false,
  campaigns: false,
};

const initialErrorState: ErrorState = {
  bootstrap: null,
  dashboard: null,
  resources: null,
  templates: null,
  events: null,
  logs: null,
  opsHealth: null,
  campaigns: null,
};

const shellDataCache: ShellDataState = {
  ...initialDataState,
  resources: { ...initialDataState.resources },
  templates: { ...initialDataState.templates },
};

const shellErrorCache: ErrorState = { ...initialErrorState };

const shellFetchedCache = {
  bootstrap: false,
  dashboard: false,
  resources: false,
  templates: false,
  events: false,
  logs: false,
  opsHealth: false,
  campaigns: false,
};

export function useV2ShellData(currentPage: PageId, initialData?: V2InitialShellData) {
  if (initialData?.bootstrap) {
    shellDataCache.bootstrap = initialData.bootstrap;
    shellFetchedCache.bootstrap = true;
  }

  if (initialData?.dashboard) {
    shellDataCache.dashboard = initialData.dashboard;
    shellFetchedCache.dashboard = true;
  }

  if (initialData?.resources) {
    shellDataCache.resources = initialData.resources;
    shellFetchedCache.resources = true;
  }

  if (initialData?.templates) {
    shellDataCache.templates = initialData.templates;
    shellFetchedCache.templates = true;
  }

  if (initialData?.events) {
    shellDataCache.events = initialData.events;
    shellFetchedCache.events = true;
  }

  if (initialData?.logs) {
    shellDataCache.logs = initialData.logs;
    shellFetchedCache.logs = true;
  }

  if (initialData?.opsHealth) {
    shellDataCache.opsHealth = initialData.opsHealth;
    shellFetchedCache.opsHealth = true;
  }

  if (initialData?.campaigns) {
    shellDataCache.campaigns = initialData.campaigns;
    shellFetchedCache.campaigns = true;
  }

  const initialPageRef = useRef(currentPage);
  const [data, setData] = useState<ShellDataState>(() => ({
    ...shellDataCache,
    resources: { ...shellDataCache.resources },
    templates: { ...shellDataCache.templates },
  }));
  const [loading, setLoading] = useState<LoadState>(initialLoadState);
  const [errors, setErrors] = useState<ErrorState>({ ...shellErrorCache });
  const fetchedRef = useRef({
    resources: shellFetchedCache.resources,
    templates: shellFetchedCache.templates,
    events: shellFetchedCache.events,
    logs: shellFetchedCache.logs,
    opsHealth: shellFetchedCache.opsHealth,
    campaigns: shellFetchedCache.campaigns,
  });

  const loadBootstrap = useCallback(async (options?: { force?: boolean }) => {
    const force = options?.force ?? false;

    if (!force && shellFetchedCache.bootstrap) {
      return;
    }

    setLoading((state) => ({ ...state, bootstrap: !shellFetchedCache.bootstrap || force }));
    setErrors((state) => ({ ...state, bootstrap: null }));
    shellErrorCache.bootstrap = null;

    try {
      const bootstrap = await fetchV2Bootstrap();
      shellFetchedCache.bootstrap = true;
      shellDataCache.bootstrap = bootstrap;
      useAppStore.setState((state) => ({
        resources: {
          ...state.resources,
          sms: bootstrap.readiness.resourceState.sms,
          kakao: bootstrap.readiness.resourceState.kakao,
          scheduled: bootstrap.counts.enabledEventRuleCount > 0 ? "active" : "none",
        },
      }));
      setData((state) => ({
        ...state,
        bootstrap,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "V2 bootstrap loading failed";
      shellErrorCache.bootstrap = message;
      setErrors((state) => ({
        ...state,
        bootstrap: message,
      }));
    } finally {
      setLoading((state) => ({ ...state, bootstrap: false }));
    }
  }, []);

  const loadDashboard = useCallback(async (options?: { force?: boolean }) => {
    const force = options?.force ?? false;
    if (!force && shellFetchedCache.dashboard) {
      return;
    }

    setLoading((state) => ({ ...state, dashboard: true }));
    setErrors((state) => ({ ...state, dashboard: null }));
    shellErrorCache.dashboard = null;

    try {
      const dashboard = await fetchV2Dashboard();
      shellFetchedCache.dashboard = true;
      shellDataCache.dashboard = dashboard;
      setData((state) => ({
        ...state,
        dashboard,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "V2 dashboard loading failed";
      shellErrorCache.dashboard = message;
      setErrors((state) => ({
        ...state,
        dashboard: message,
      }));
    } finally {
      setLoading((state) => ({ ...state, dashboard: false }));
    }
  }, []);

  const loadResources = useCallback(async (options?: { force?: boolean }) => {
    const force = options?.force ?? false;
    if (!force && shellFetchedCache.resources) {
      fetchedRef.current.resources = true;
      return;
    }

    fetchedRef.current.resources = true;
    shellFetchedCache.resources = true;
    setLoading((state) => ({ ...state, resources: true }));
    setErrors((state) => ({ ...state, resources: null }));
    shellErrorCache.resources = null;

    try {
      const resources = await fetchV2ResourcesBundle();
      shellDataCache.resources = resources;
      setData((state) => ({ ...state, resources }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "V2 resources loading failed";
      shellErrorCache.resources = message;
      setErrors((state) => ({
        ...state,
        resources: message,
      }));
    } finally {
      setLoading((state) => ({ ...state, resources: false }));
    }
  }, []);

  const loadTemplates = useCallback(async (options?: { force?: boolean }) => {
    const force = options?.force ?? false;
    if (!force && shellFetchedCache.templates) {
      fetchedRef.current.templates = true;
      return;
    }

    fetchedRef.current.templates = true;
    shellFetchedCache.templates = true;
    setLoading((state) => ({ ...state, templates: true }));
    setErrors((state) => ({ ...state, templates: null }));
    shellErrorCache.templates = null;

    try {
      const templates = await fetchV2TemplatesBundle();
      shellDataCache.templates = templates;
      setData((state) => ({ ...state, templates }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "V2 templates loading failed";
      shellErrorCache.templates = message;
      setErrors((state) => ({
        ...state,
        templates: message,
      }));
    } finally {
      setLoading((state) => ({ ...state, templates: false }));
    }
  }, []);

  const loadEvents = useCallback(async (options?: { force?: boolean }) => {
    const force = options?.force ?? false;
    if (!force && shellFetchedCache.events) {
      fetchedRef.current.events = true;
      return;
    }

    fetchedRef.current.events = true;
    shellFetchedCache.events = true;
    setLoading((state) => ({ ...state, events: true }));
    setErrors((state) => ({ ...state, events: null }));
    shellErrorCache.events = null;

    try {
      const events = await fetchV2Events();
      shellDataCache.events = events;
      setData((state) => ({ ...state, events }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "V2 events loading failed";
      shellErrorCache.events = message;
      setErrors((state) => ({
        ...state,
        events: message,
      }));
    } finally {
      setLoading((state) => ({ ...state, events: false }));
    }
  }, []);

  const loadLogs = useCallback(async (options?: { force?: boolean }) => {
    const force = options?.force ?? false;
    if (!force && shellFetchedCache.logs) {
      fetchedRef.current.logs = true;
      return;
    }

    fetchedRef.current.logs = true;
    shellFetchedCache.logs = true;
    setLoading((state) => ({ ...state, logs: true }));
    setErrors((state) => ({ ...state, logs: null }));
    shellErrorCache.logs = null;

    try {
      const logs = await fetchV2Logs();
      shellDataCache.logs = logs;
      setData((state) => ({ ...state, logs }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "V2 logs loading failed";
      shellErrorCache.logs = message;
      setErrors((state) => ({
        ...state,
        logs: message,
      }));
    } finally {
      setLoading((state) => ({ ...state, logs: false }));
    }
  }, []);

  const loadOpsHealth = useCallback(async (options?: { force?: boolean }) => {
    const force = options?.force ?? false;
    if (!force && shellFetchedCache.opsHealth) {
      fetchedRef.current.opsHealth = true;
      return;
    }

    fetchedRef.current.opsHealth = true;
    shellFetchedCache.opsHealth = true;
    setLoading((state) => ({ ...state, opsHealth: true }));
    setErrors((state) => ({ ...state, opsHealth: null }));
    shellErrorCache.opsHealth = null;

    try {
      const opsHealth = await fetchV2OpsHealth();
      shellDataCache.opsHealth = opsHealth;
      setData((state) => ({ ...state, opsHealth }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "V2 ops health loading failed";
      shellErrorCache.opsHealth = message;
      setErrors((state) => ({
        ...state,
        opsHealth: message,
      }));
    } finally {
      setLoading((state) => ({ ...state, opsHealth: false }));
    }
  }, []);

  const loadCampaigns = useCallback(async (options?: { force?: boolean }) => {
    const force = options?.force ?? false;
    if (!force && shellFetchedCache.campaigns) {
      fetchedRef.current.campaigns = true;
      return;
    }

    fetchedRef.current.campaigns = true;
    shellFetchedCache.campaigns = true;
    setLoading((state) => ({ ...state, campaigns: true }));
    setErrors((state) => ({ ...state, campaigns: null }));
    shellErrorCache.campaigns = null;

    try {
      const campaigns = await fetchV2Campaigns();
      shellDataCache.campaigns = campaigns;
      setData((state) => ({ ...state, campaigns }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "V2 campaigns loading failed";
      shellErrorCache.campaigns = message;
      setErrors((state) => ({
        ...state,
        campaigns: message,
      }));
    } finally {
      setLoading((state) => ({ ...state, campaigns: false }));
    }
  }, []);

  const loadInitialPage = useCallback(
    async (page: PageId) => {
      switch (page) {
        case "resources":
          await loadResources();
          break;
        case "dashboard":
          await loadDashboard();
          break;
        case "templates":
          await loadTemplates();
          break;
        case "events":
          await loadEvents();
          break;
        case "logs":
          await loadLogs();
          break;
        case "settings":
          await loadOpsHealth();
          break;
        case "campaign":
          await loadCampaigns();
          break;
        default:
          break;
      }
    },
    [loadCampaigns, loadDashboard, loadEvents, loadLogs, loadOpsHealth, loadResources, loadTemplates],
  );

  useMountEffect(() => {
    void loadBootstrap();
    void loadInitialPage(initialPageRef.current);
  });

  const refreshCurrentPage = useCallback(() => {
    switch (currentPage) {
      case "dashboard":
        void Promise.all([loadBootstrap({ force: true }), loadDashboard({ force: true })]);
        break;
      case "resources":
        void loadResources({ force: true });
        break;
      case "templates":
        void loadTemplates({ force: true });
        break;
      case "events":
        void loadEvents({ force: true });
        break;
      case "logs":
        void loadLogs({ force: true });
        break;
      case "settings":
        void loadOpsHealth({ force: true });
        break;
      case "campaign":
        void loadCampaigns({ force: true });
        break;
      default:
        break;
    }
  }, [currentPage, loadBootstrap, loadCampaigns, loadDashboard, loadEvents, loadLogs, loadOpsHealth, loadResources, loadTemplates]);

  return {
    data,
    loading,
    errors,
    refreshCurrentPage,
  };
}
