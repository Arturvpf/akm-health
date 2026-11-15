import type { ComponentPropsWithRef, ComponentPropsWithoutRef, ReactNode } from 'react';
import type { DataSource, InvestigationStatus, Quality } from './types';

const ICONS = {
  info: 'i',
  check: '✓',
  warning: '⚠︎',
  protocol: '!',
  empty: '◇',
  error: '×',
  loading: '…',
  source: '▤',
} as const;

type IconName = keyof typeof ICONS;
type Tone = 'info' | 'neutral' | 'positive' | 'caution';
export type DemoStatus = Exclude<InvestigationStatus, 'critical'>;
type Source = DataSource | 'nasa_reference' | 'nasa_historical';
type StatusLabel = { label: string; icon: IconName; tone: Tone };

const STATUSES = {
  normal: { label: 'No pattern under the demo rule', icon: 'check', tone: 'positive' },
  attention: { label: 'Experimental pattern to check', icon: 'warning', tone: 'caution' },
  insufficient_data: { label: 'Insufficient data', icon: 'info', tone: 'neutral' },
} as const satisfies Record<DemoStatus, StatusLabel>;

const SOURCES: Record<Source, string> = {
  synthetic: 'Simulated data',
  manual: 'Manual entry',
  nasa_reference: 'NASA research reference',
  nasa_historical: 'NASA historical data',
};

const QUALITY: Record<Quality, StatusLabel> = {
  ok: { label: 'Valid', icon: 'check', tone: 'neutral' },
  suspect: { label: 'Suspect', icon: 'warning', tone: 'caution' },
};

const DATA_STATES = {
  empty: { label: 'No data', icon: 'empty', tone: 'neutral' },
  loading: { label: 'Loading', icon: 'loading', tone: 'info' },
  error: { label: 'Connection error', icon: 'error', tone: 'neutral' },
  success: { label: 'Update complete', icon: 'check', tone: 'positive' },
} as const satisfies Record<string, StatusLabel>;

export type DataStateKind = keyof typeof DATA_STATES;

function Icon({ name }: { name: IconName }) {
  return <span className="ds-icon" aria-hidden="true">{ICONS[name]}</span>;
}

function Badge({ label, icon, tone }: StatusLabel) {
  return <span className={`ds-badge tone-${tone}`}><Icon name={icon} />{label}</span>;
}

export function StatusBadge({ status }: { status: DemoStatus }) {
  return <Badge {...STATUSES[status]} />;
}

export function SourceBadge({ source }: { source: Source }) {
  return <Badge label={SOURCES[source]} icon="source" tone="neutral" />;
}

export function QualityBadge({ quality }: { quality: Quality }) {
  return <Badge {...QUALITY[quality]} />;
}

export function ProtocolLegend() {
  return (
    <section className="ds-legend">
      <h3>Investigation legend</h3>
      <ul>
        <li><StatusBadge status="normal" /> The experimental rule found no pattern in the available data.</li>
        <li><StatusBadge status="attention" /> Collect another reading to check the finding.</li>
        <li><StatusBadge status="insufficient_data" /> More observations are needed to apply the rule.</li>
        <li>
          <span className="ds-badge ds-badge-protocol">
            <Icon name="protocol" />Follow mission protocol
          </span>
          Reserved for the approved mission protocol.
        </li>
      </ul>
    </section>
  );
}

export function Card({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <article className="ds-card">
      <h2>{heading}</h2>
      {children}
    </article>
  );
}

type ActionVariant = 'primary' | 'secondary' | 'quiet';

type ActionLinkProps = ComponentPropsWithoutRef<'a'> & { variant?: ActionVariant };

export function ActionLink({ variant = 'secondary', ...linkProps }: ActionLinkProps) {
  return <a {...linkProps} className={`ds-action ds-action-${variant}`} />;
}

export function ActionButton(props: ComponentPropsWithoutRef<'button'>) {
  return <button type="button" {...props} className="ds-action ds-action-secondary" />;
}

export function SelectField({ label, ...selectProps }: ComponentPropsWithRef<'select'> & { label: string }) {
  return (
    <label className="ds-field">
      <span>{label}</span>
      <select {...selectProps} className="ds-control" />
    </label>
  );
}

function Notice({ label, icon, tone, children }: StatusLabel & { children: ReactNode }) {
  return (
    <div className={`ds-notice tone-${tone}`}>
      <Icon name={icon} />
      <div>
        <strong>{label}</strong>
        <p>{children}</p>
      </div>
    </div>
  );
}

export function SimulationNotice() {
  return (
    <aside className="simulation-notice" aria-label="Demonstration context">
      <Notice label="Simulated mission" icon="info" tone="info">
        Mission readings are simulated or entered locally.
      </Notice>
    </aside>
  );
}

export function DataState({ kind, children }: { kind: DataStateKind; children: ReactNode }) {
  return <Notice {...DATA_STATES[kind]}>{children}</Notice>;
}

export function InformationNotice({ label, children }: { label: string; children: ReactNode }) {
  return <Notice label={label} icon="info" tone="info">{children}</Notice>;
}

export function Details({ items }: { items: ReadonlyArray<{ label: string; value: ReactNode }> }) {
  return (
    <dl className="ds-details">
      {items.map(({ label, value }) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function DataTable({ label, caption, children }: { label: string; caption: string; children: ReactNode }) {
  return (
    <div className="ds-table-scroll" role="region" aria-label={label} tabIndex={0}>
      <table>
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}
