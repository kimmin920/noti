'use client';

import Link from 'next/link';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type ButtonVariant = 'default' | 'accent' | 'success' | 'danger' | 'kakao';
type LabelTone = 'green' | 'yellow' | 'red' | 'blue' | 'gray' | 'purple';

export function v2ButtonClass(variant: ButtonVariant = 'default', size: 'sm' | 'md' = 'md') {
  return cn(
    'btn',
    size === 'sm' && 'btn-sm',
    variant === 'default' && 'btn-default',
    variant === 'accent' && 'btn-accent',
    variant === 'success' && 'btn-primary',
    variant === 'danger' && 'btn-danger',
    variant === 'kakao' && 'btn-kakao'
  );
}

export function V2Button(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: 'sm' | 'md'; icon?: LucideIcon }) {
  const { className, variant = 'default', size = 'md', icon: Icon, children, ...rest } = props;
  return (
    <button className={cn(v2ButtonClass(variant, size), className)} {...rest}>
      {Icon ? <Icon className='icon icon-14' /> : null}
      {children}
    </button>
  );
}

export function V2LinkButton(props: { href: string; children: React.ReactNode; variant?: ButtonVariant; size?: 'sm' | 'md'; icon?: LucideIcon; className?: string }) {
  const { href, children, variant = 'default', size = 'md', icon: Icon, className } = props;
  return (
    <Link href={href} className={cn(v2ButtonClass(variant, size), className)}>
      {Icon ? <Icon className='icon icon-14' /> : null}
      {children}
    </Link>
  );
}

export function V2Label(props: { tone: LabelTone; children: React.ReactNode; className?: string }) {
  const { tone, children, className } = props;
  const toneClass = {
    green: 'label-green',
    yellow: 'label-yellow',
    red: 'label-red',
    blue: 'label-blue',
    gray: 'label-gray',
    purple: 'label-purple'
  }[tone];

  return (
    <span className={cn('label', toneClass, className)}>
      <span className='label-dot' />
      {children}
    </span>
  );
}

export function V2Chip(props: { tone: 'sms' | 'kakao' | 'event'; children: React.ReactNode; className?: string }) {
  const toneClass = {
    sms: 'chip-sms',
    kakao: 'chip-kakao',
    event: 'chip-event'
  }[props.tone];

  return <span className={cn('chip', toneClass, props.className)}>{props.children}</span>;
}

export function V2PageHeader(props: { title: string; description: string; actions?: React.ReactNode }) {
  return (
    <div className='page-header'>
      <div className='page-header-row flex-col md:flex-row'>
        <div>
          <h1 className='page-title'>{props.title}</h1>
          <p className='page-desc'>{props.description}</p>
        </div>
        {props.actions ? <div className='flex flex-wrap gap-2'>{props.actions}</div> : null}
      </div>
    </div>
  );
}

export function V2Box(props: { title?: string; subtitle?: string; actions?: React.ReactNode; footer?: React.ReactNode; className?: string; bodyClassName?: string; children: React.ReactNode }) {
  return (
    <section className={cn('box overflow-hidden', props.className)}>
      {props.title || props.actions || props.subtitle ? (
        <header className='box-header gap-4'>
          <div>
            {props.title ? <div className='box-title'>{props.title}</div> : null}
            {props.subtitle ? <div className='box-subtitle'>{props.subtitle}</div> : null}
          </div>
          {props.actions ? <div className='flex flex-wrap gap-2'>{props.actions}</div> : null}
        </header>
      ) : null}
      <div className={cn('box-body', props.bodyClassName)}>{props.children}</div>
      {props.footer ? <footer className='box-footer gap-4'>{props.footer}</footer> : null}
    </section>
  );
}

export function V2Flash(props: { tone: 'attention' | 'info' | 'success' | 'danger'; title?: string; icon?: LucideIcon; actions?: React.ReactNode; children: React.ReactNode; className?: string }) {
  const toneClass = {
    attention: 'flash-attention',
    info: 'flash-info',
    success: 'flash-success',
    danger: 'flash-danger'
  }[props.tone];
  const Icon = props.icon;

  return (
    <div className={cn('flash', toneClass, props.className)}>
      {Icon ? <Icon className='flash-icon icon icon-16' /> : null}
      <div className='flash-body'>
        {props.title ? <strong className='font-semibold'>{props.title} </strong> : null}
        {props.children}
      </div>
      {props.actions ? <div className='flash-actions flex-wrap'>{props.actions}</div> : null}
    </div>
  );
}

export function V2StatGrid(props: { items: Array<{ label: string; value: string; sublabel?: string; accent?: string }>; className?: string }) {
  return (
    <div className={cn('box overflow-hidden', props.className)}>
      <div className='stats-grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4'>
      {props.items.map((item) => (
        <div key={item.label} className='stat-cell border-b border-[var(--border-muted)] sm:border-b-0'>
          <div className='stat-label-t'>{item.label}</div>
          <div className='stat-value-t' style={item.accent ? { color: item.accent } : undefined}>
            {item.value}
          </div>
          {item.sublabel ? <div className='stat-sub-t'>{item.sublabel}</div> : null}
        </div>
      ))}
      </div>
    </div>
  );
}

export function V2Progress(props: { value: number; tone?: 'blue' | 'green' | 'kakao'; className?: string }) {
  const toneClass = {
    blue: '',
    green: 'green',
    kakao: 'kakao-bar'
  }[props.tone ?? 'blue'];

  return (
    <div className={cn('progress', props.className)}>
      <div className={cn('progress-bar', toneClass)} style={{ width: `${Math.max(0, Math.min(100, props.value))}%` }} />
    </div>
  );
}

export function V2EmptyState(props: { icon?: LucideIcon; title: string; description: string; actions?: React.ReactNode }) {
  const Icon = props.icon;
  return (
    <div className='empty-state'>
      {Icon ? <Icon className='empty-icon icon icon-40 mx-auto' /> : null}
      <div className='empty-title'>{props.title}</div>
      <p className='empty-desc mt-2'>{props.description}</p>
      {props.actions ? <div className='empty-actions flex-wrap'>{props.actions}</div> : null}
    </div>
  );
}

export function V2Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn('form-control', props.className)} />;
}

export function V2Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn('form-control', props.className)} />;
}

export function V2Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn('form-control', props.className)} />;
}

export function V2Tabs(props: { tabs: Array<{ key: string; label: string; count?: string; icon?: LucideIcon }>; active: string; onChange: (key: string) => void; className?: string }) {
  return (
    <div className={cn('tab-nav overflow-x-auto', props.className)}>
      {props.tabs.map((tab) => (
        <button
          key={tab.key}
          type='button'
          onClick={() => props.onChange(tab.key)}
          className={cn(
            'tab-item whitespace-nowrap',
            props.active === tab.key && 'active'
          )}
        >
          {tab.icon ? <tab.icon className='icon icon-16' /> : null}
          {tab.label}
          {tab.count ? <span className='tab-counter'>{tab.count}</span> : null}
        </button>
      ))}
    </div>
  );
}
