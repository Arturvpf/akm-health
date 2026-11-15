import { useState } from 'react';
import { ActionButton, ActionLink, Card, DataState, Details, InformationNotice, SourceBadge } from './design-system';
import { useSelectedEnvironment } from './EnvironmentView';
import { METRICS } from './history-data';
import type { Kind, MetricSnapshot } from './types';
import { formatUtc, useDashboardSnapshot } from './use-dashboard';
import './experiments.css';
import './body-map.css';

/**
 * AKM-36 — accessible body map.
 * Structure from the team ZIP (native buttons, list alternative, NASA sources, explicit limits);
 * data panel and region model from the Figma Make design and the design-system document:
 * only head (mood) and chest (heart rate) are anatomical; sleep and cabin readings sit outside the body.
 */
type Region = 'head' | 'chest' | 'sleep' | 'habitat';

const REGIONS: Record<Region, {
  label: string; kinds: readonly Kind[]; anatomical: boolean;
  explanation: string; limitation: string; source: string;
}> = {
  head: {
    label: 'Head · Self-reported mood', kinds: ['mood_score'], anatomical: true,
    explanation: 'Mood is a 1–5 self-assessment. Behavioral health in isolation and confinement is a NASA research topic.',
    limitation: 'This is not a brain reading or a psychological diagnosis.',
    source: 'https://www.nasa.gov/hrp/hazard-isolation-and-confinement/',
  },
  chest: {
    label: 'Chest · Heart rate', kinds: ['heart_rate_bpm'], anatomical: true,
    explanation: 'Heart rate is a spot physiological reading. NASA studies cardiovascular adaptation in spaceflight.',
    limitation: 'One bpm reading cannot diagnose a cardiovascular condition or measure the effect of gravity.',
    source: 'https://www.nasa.gov/hrp/risks/',
  },
  sleep: {
    label: 'Sleep and recovery', kinds: ['sleep_hours'], anatomical: false,
    explanation: 'Sleep is a routine metric, not a body region. NASA lists sleep loss and circadian desynchronization as a spaceflight risk.',
    limitation: 'Estimated hours for one period; this is not a sleep-quality assessment.',
    source: 'https://www.nasa.gov/hrp/risks/',
  },
  habitat: {
    label: 'Cabin environment (outside the body)', kinds: ['co2_ppm', 'cabin_temp_c'], anatomical: false,
    explanation: 'Cabin readings describe the fictional habitat air, not the astronaut’s organs.',
    limitation: 'Do not infer personal exposure, lung response or causality from a cabin reading.',
    source: 'https://www.nasa.gov/hrp/hazard-hostile-closed-environments/',
  },
};
const ORDER: readonly Region[] = ['head', 'chest', 'sleep', 'habitat'];
const value = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

export function BodyExplorer() {
  const [selected, setSelected] = useState<Region>('chest');
  const [astronautId, setAstronautId] = useState<string | null>(null);
  const environment = useSelectedEnvironment();
  const dashboard = useDashboardSnapshot();
  const region = REGIONS[selected];
  const crew = dashboard.data?.astronauts ?? [];
  const astronaut = crew.find(item => item.id === astronautId) ?? crew[0] ?? null;

  function reading(kind: Kind): MetricSnapshot | undefined {
    if (kind === 'co2_ppm' || kind === 'cabin_temp_c') return dashboard.data?.environment.latest_metrics?.[kind];
    return astronaut?.latest_metrics[kind];
  }

  return <div className="experiment-stack">
    <InformationNotice label="Illustrative map, not an anatomical exam">
      Schematic hologram image, not a clinical image. Each region opens the latest stored reading for the selected crew member.
      It does not diagnose. Use Tab and Enter or Space to move between regions.
    </InformationNotice>
    <div className="body-layout">
      <Card heading="Body and cabin map">
        <label className="ds-field" htmlFor="body-astronaut">Crew member
          <select id="body-astronaut" className="ds-control" value={astronaut?.id ?? ''} disabled={!crew.length}
            onChange={event => setAstronautId(event.target.value)}>
            {!crew.length && <option value="">No crew loaded</option>}
            {crew.map(item => <option key={item.id} value={item.id}>{item.name} · {item.id}</option>)}
          </select>
        </label>
        <div className="body-stage">
          <img className="body-photo" src="/body-hologram.webp" width="667" height="1024" alt="" />
          <svg className="body-silhouette" viewBox="0 0 667 1024" role="img" focusable="false"
            aria-label="Schematic front view of a human body with a highlighted heart. Use the buttons to select a region.">
            <defs>
              <radialGradient id="heart-glow"><stop offset="0" stopColor="#ff8fb0" stopOpacity="0.55" /><stop offset="1" stopColor="#ff8fb0" stopOpacity="0" /></radialGradient>
              <filter id="soft-glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="6" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            </defs>
            <ellipse className="body-heart" cx="343" cy="330" rx="62" ry="66" fill="url(#heart-glow)" />
            {selected === 'head' && <ellipse className="body-pulse" cx="334" cy="121" rx="56" ry="70" fill="none" stroke="#fff" strokeWidth="5" filter="url(#soft-glow)" />}
            {selected === 'chest' && <rect className="body-pulse" x="246" y="238" width="180" height="214" rx="34" fill="none" stroke="#fff" strokeWidth="5" filter="url(#soft-glow)" />}
          </svg>
          <button type="button" className="body-card body-card-head" aria-pressed={selected === 'head'} onClick={() => setSelected('head')}>
            <span className="body-card-number" data-n="1" aria-hidden="true" />
            <span className="body-card-text"><span>Mood</span><strong>{reading('mood_score') ? `${value.format(reading('mood_score')!.value)} / 5` : 'No data'}</strong></span>
          </button>
          <button type="button" className="body-card body-card-chest" aria-pressed={selected === 'chest'} onClick={() => setSelected('chest')}>
            <span className="body-card-number" data-n="2" aria-hidden="true" />
            <span className="body-card-text"><span>Heart rate</span><strong>{reading('heart_rate_bpm') ? `${value.format(reading('heart_rate_bpm')!.value)} bpm` : 'No data'}</strong></span>
            <svg className="body-card-trace" viewBox="0 0 80 18" aria-hidden="true" focusable="false"><path d="M0 9 H22 L28 2 L34 16 L40 9 H56 L61 4 L66 13 L70 9 H80" fill="none" stroke="#7ff3ff" strokeWidth="1.4" strokeLinejoin="round" /></svg>
          </button>
          <button type="button" className="body-tag body-tag-sleep" aria-pressed={selected === 'sleep'} onClick={() => setSelected('sleep')}>
            <span aria-hidden="true">☾</span>
            <span className="body-tag-text"><span>Sleep</span><strong>{reading('sleep_hours') ? `${value.format(reading('sleep_hours')!.value)} h` : 'No data'}</strong></span>
          </button>
          <button type="button" className="body-tag body-tag-habitat" aria-pressed={selected === 'habitat'} onClick={() => setSelected('habitat')}>
            <span aria-hidden="true">◌</span>
            <span className="body-tag-text"><span>Cabin</span><strong>{reading('co2_ppm') ? `${value.format(reading('co2_ppm')!.value)} ppm` : 'No data'}</strong></span>
          </button>
        </div>
        <p className="body-legend">1 · Head (mood) · 2 · Chest (heart rate). Sleep and cabin readings sit outside the body.</p>
        <div className="body-button-row" role="group" aria-label="All regions and indicators">
          {ORDER.map(id => <button type="button" key={id} className="body-nav-button" aria-pressed={selected === id}
            onClick={() => setSelected(id)}>{REGIONS[id].label}</button>)}
        </div>
      </Card>
      <Card heading="Selected region">
        <section aria-live="polite" aria-atomic="true">
          <h3>{region.label}{region.kinds[0] !== 'co2_ppm' && astronaut ? ` · ${astronaut.name}` : ''}</h3>
          <div role="status">
            {dashboard.phase === 'loading' && !dashboard.data && <DataState kind="loading">Loading the latest readings.</DataState>}
            {dashboard.phase === 'error' && <DataState kind="error">{dashboard.error} <ActionButton onClick={dashboard.retry}>Retry</ActionButton></DataState>}
          </div>
          {dashboard.data && region.kinds.map(kind => {
            const snapshot = reading(kind);
            return snapshot
              ? <Details key={kind} items={[
                { label: METRICS[kind].label, value: `${value.format(snapshot.value)} ${METRICS[kind].unit}` },
                { label: 'Observed', value: <time dateTime={snapshot.measured_at}>{formatUtc(snapshot.measured_at)}</time> },
                { label: 'Source', value: snapshot.source ? <SourceBadge source={snapshot.source} /> : 'Not reported' },
              ]} />
              : <DataState key={kind} kind="empty">Insufficient data: no {METRICS[kind].label.toLowerCase()} reading is stored. Missing data is not a normal result.</DataState>;
          })}
          <p>{region.explanation}</p>
          <p><strong>Limit:</strong> {region.limitation}</p>
          <div className="badge-row">
            <ActionLink href="#/history">View History</ActionLink>
            <ActionLink href="#/register">Register a measurement</ActionLink>
            <ActionLink href={region.source} target="_blank" rel="noopener noreferrer">NASA source<span className="sr-only"> (opens in a new tab)</span></ActionLink>
          </div>
        </section>
        <hr />
        <h3>Selected context: {environment.current.name}</h3>
        <p>{environment.current.implications}</p>
        <p>Reference gravity: {environment.current.gravity}.</p>
        <p>The body map does not run the investigation engine. <a href="#/environments">Choose another hypothetical environment</a>.</p>
      </Card>
    </div>
  </div>;
}
