'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

function resolvePrototypePage(pathname: string) {
  if (pathname === '/v2') {
    return 'dashboard';
  }

  if (pathname === '/v2/resources') {
    return 'resources';
  }

  if (pathname === '/v2/templates') {
    return 'templates';
  }

  if (pathname === '/v2/events') {
    return 'events';
  }

  if (pathname === '/v2/logs') {
    return 'logs';
  }

  if (pathname === '/v2/recipients') {
    return 'recipients';
  }

  if (pathname === '/v2/drafts') {
    return 'drafts';
  }

  if (pathname === '/v2/settings') {
    return 'settings';
  }

  if (pathname === '/v2/send/sms') {
    return 'sms-send';
  }

  if (pathname === '/v2/send/kakao') {
    return 'kakao-send';
  }

  if (pathname === '/v2/campaigns') {
    return 'campaign';
  }

  if (pathname === '/v2/campaigns/new') {
    return 'campaign-new';
  }

  if (pathname.startsWith('/v2/campaigns/')) {
    return 'campaign-detail';
  }

  return 'dashboard';
}

const selectorMap: Record<string, string> = {
  dashboard: '.sidebar-item[onclick*="dashboard"]',
  resources: '.sidebar-item[onclick*="resources"]',
  templates: '.sidebar-item[onclick*="templates"]',
  events: '.sidebar-item[onclick*="events"]',
  logs: '.sidebar-item[onclick*="logs"]',
  recipients: '.sidebar-item[onclick*="recipients"]',
  drafts: '#nav-drafts',
  settings: '.sidebar-item[onclick*="settings"]',
  'sms-send': '#nav-sms',
  'kakao-send': '#nav-kakao',
  campaign: '#nav-campaign',
  'campaign-detail': '#nav-campaign',
  'campaign-new': '#nav-campaign',
};

function syncPrototypeRoute(iframe: HTMLIFrameElement, pathname: string) {
  const frameWindow = iframe.contentWindow as
    | (Window & {
        setState?: (channel: 'sms' | 'kakao', value: 'none' | 'pending' | 'active') => void;
        showPage?: (id: string) => void;
      })
    | null;
  const frameDocument = iframe.contentDocument;

  if (!frameWindow || !frameDocument) {
    return;
  }

  if (frameWindow.setState) {
    frameWindow.setState('sms', 'active');
    frameWindow.setState('kakao', 'active');
  }

  const page = resolvePrototypePage(pathname);
  if (frameWindow.showPage) {
    frameWindow.showPage(page);
  }

  const targetSelector = selectorMap[page];
  if (!targetSelector) {
    return;
  }

  frameDocument
    .querySelectorAll('.sidebar-item, .inbox-widget-wrap')
    .forEach((el) => el.classList.remove('active'));

  frameDocument.querySelector(targetSelector)?.classList.add('active');
}

export function V2PrototypeConsole() {
  const pathname = usePathname();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const currentPathname = () => {
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/v2')) {
      return window.location.pathname;
    }
    return pathname;
  };

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) {
      return;
    }
    syncPrototypeRoute(iframe, currentPathname());
  }, [pathname]);

  return (
    <div className='min-h-screen bg-[#f6f8fa]'>
      <iframe
        ref={iframeRef}
        title='MessageOps V2 Prototype'
        src='/prototypes/messaging-console-v4.html'
        className='block h-screen w-full border-0'
        onLoad={(event) => {
          syncPrototypeRoute(event.currentTarget, currentPathname());
        }}
      />
    </div>
  );
}
