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
      Original vector diagram with no clinical images. Each region opens the latest stored reading for the selected crew member.
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
          <svg className="body-silhouette" viewBox="0 0 300 460" role="img" focusable="false"
            aria-label="Schematic front view of an astronaut in a spacesuit. Use the buttons to select a region.">
            <defs>
              <linearGradient id="suit-fill" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#4a5ba3" /><stop offset="0.55" stopColor="#2a3566" /><stop offset="1" stopColor="#1b2347" />
              </linearGradient>
              <linearGradient id="suit-dark" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#3b4a86" /><stop offset="1" stopColor="#1f2852" />
              </linearGradient>
              <linearGradient id="visor-fill" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#67e8f9" stopOpacity="0.9" /><stop offset="0.5" stopColor="#5b6fd6" /><stop offset="1" stopColor="#1a1442" />
              </linearGradient>
              <radialGradient id="floor-glow"><stop offset="0" stopColor="#67e8f9" stopOpacity="0.28" /><stop offset="1" stopColor="#67e8f9" stopOpacity="0" /></radialGradient>
              <filter id="soft-glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3.5" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            </defs>
            <g fill="#e8efff" opacity="0.8">
              <circle cx="38" cy="96" r="1.2" /><circle cx="262" cy="52" r="1.5" /><circle cx="274" cy="190" r="1" />
              <circle cx="24" cy="250" r="1.4" /><circle cx="258" cy="318" r="1.1" /><circle cx="46" cy="372" r="1" />
            </g>
            <ellipse cx="150" cy="432" rx="86" ry="12" fill="url(#floor-glow)" />
            <g stroke="#9db0e6" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round">
              <rect x="108" y="112" width="84" height="132" rx="20" fill="#232c58" />
              <rect x="118" y="260" width="29" height="132" rx="14" fill="url(#suit-fill)" />
              <rect x="153" y="260" width="29" height="132" rx="14" fill="url(#suit-fill)" />
              <rect x="118" y="320" width="29" height="8" rx="4" fill="url(#suit-dark)" />
              <rect x="153" y="320" width="29" height="8" rx="4" fill="url(#suit-dark)" />
              <path d="M110 394 h36 q6 0 6 6 v14 q0 10 -10 10 h-30 q-12 0 -12 -12 v-6 q0 -12 10 -12 z" fill="url(#suit-dark)" />
              <path d="M190 394 h-36 q-6 0 -6 6 v14 q0 10 10 10 h30 q12 0 12 -12 v-6 q0 -12 -10 -12 z" fill="url(#suit-dark)" />
              <path d="M108 124 Q72 136 64 206 L60 262" fill="none" strokeWidth="30" />
              <path d="M192 124 Q228 136 236 206 L240 262" fill="none" strokeWidth="30" />
            </g>
            <g fill="none" strokeLinecap="round">
              <path d="M108 124 Q72 136 64 206 L60 262" stroke="url(#suit-fill)" strokeWidth="25" />
              <path d="M192 124 Q228 136 236 206 L240 262" stroke="url(#suit-fill)" strokeWidth="25" />
              <path d="M64 200 L61 232" stroke="#3b4a86" strokeWidth="25" strokeDasharray="7 100" />
              <path d="M236 200 L239 232" stroke="#3b4a86" strokeWidth="25" strokeDasharray="7 100" />
            </g>
            <g stroke="#9db0e6" strokeWidth="2.2" fill="url(#suit-dark)">
              <circle cx="59" cy="272" r="15" /><circle cx="241" cy="272" r="15" />
            </g>
            <path d="M100 124 Q100 98 126 96 L174 96 Q200 98 200 124 L196 238 Q196 270 168 272 L132 272 Q104 270 104 238 Z"
              fill="url(#suit-fill)" stroke="#9db0e6" strokeWidth="2.2" strokeLinejoin="round" />
            <path d="M112 112 Q106 170 112 236" fill="none" stroke="#fff" strokeOpacity="0.14" strokeWidth="5" strokeLinecap="round" />
            <rect x="104" y="238" width="92" height="9" rx="4.5" fill="url(#suit-dark)" stroke="#9db0e6" strokeWidth="1.6" />
            <rect x="128" y="90" width="44" height="15" rx="7.5" fill="url(#suit-dark)" stroke="#9db0e6" strokeWidth="2" />
            <rect x="126" y="134" width="48" height="38" rx="8" fill="#0b1230" stroke="#67e8f9" strokeOpacity="0.75" strokeWidth="1.6" />
            <circle cx="138" cy="144" r="2.4" fill="#6ee7b7" /><circle cx="150" cy="144" r="2.4" fill="#fbbf24" /><circle cx="162" cy="144" r="2.4" fill="#a78bfa" />
            <path d="M132 161 L141 161 L145 151 L151 168 L156 161 L168 161" fill="none" stroke="#67e8f9" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="150" cy="56" r="43" fill="url(#suit-fill)" stroke="#9db0e6" strokeWidth="2.2" />
            <ellipse cx="150" cy="58" rx="31" ry="25" fill="url(#visor-fill)" stroke="#0b1230" strokeWidth="3" />
            <path d="M129 52 Q137 42 156 43" fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="3" strokeLinecap="round" />
            <path d="M191 46 L214 36" stroke="#67e8f9" strokeOpacity="0.7" strokeWidth="1.6" strokeDasharray="3 3" fill="none" />
            <path d="M150 172 L150 192" stroke="#67e8f9" strokeOpacity="0.7" strokeWidth="1.6" strokeDasharray="3 3" fill="none" />
            {selected === 'head' && <circle className="body-pulse" cx="150" cy="56" r="50" fill="none" stroke="#67e8f9" strokeWidth="3.5" filter="url(#soft-glow)" />}
            {selected === 'chest' && <rect className="body-pulse" x="118" y="126" width="64" height="52" rx="13" fill="none" stroke="#67e8f9" strokeWidth="3.5" filter="url(#soft-glow)" />}
          </svg>
          {(['head', 'chest'] as const).map((id, index) =>
            <button key={id} type="button" className={`body-point body-point-${id}`} aria-pressed={selected === id}
              aria-label={`${index + 1}. Select ${REGIONS[id].label}`} onClick={() => setSelected(id)}>
              <span aria-hidden="true">{index + 1}</span>
            </button>)}
          <button type="button" className="body-tag body-tag-sleep" aria-pressed={selected === 'sleep'}
            aria-label={`Select ${REGIONS.sleep.label}`} onClick={() => setSelected('sleep')}>
            <span aria-hidden="true">☾</span> Sleep
          </button>
          <button type="button" className="body-tag body-tag-habitat" aria-pressed={selected === 'habitat'}
            aria-label={`Select ${REGIONS.habitat.label}`} onClick={() => setSelected('habitat')}>
            <span aria-hidden="true">◌</span> Cabin
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
