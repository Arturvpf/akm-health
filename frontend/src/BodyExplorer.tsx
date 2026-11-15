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
            aria-label="Schematic front view of a human body. Use the buttons to select a region.">
            <defs>
              <linearGradient id="body-fill" gradientUnits="userSpaceOnUse" x1="80" y1="20" x2="220" y2="440">
                <stop offset="0" stopColor="#c3cffc" /><stop offset="1" stopColor="#7f8fe8" />
              </linearGradient>
              <radialGradient id="floor-glow"><stop offset="0" stopColor="#67e8f9" stopOpacity="0.26" /><stop offset="1" stopColor="#67e8f9" stopOpacity="0" /></radialGradient>
              <filter id="soft-glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3.5" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            </defs>
            <g fill="#e8efff" opacity="0.7">
              <circle cx="30" cy="110" r="1.2" /><circle cx="270" cy="70" r="1.5" /><circle cx="282" cy="250" r="1" />
              <circle cx="20" cy="290" r="1.4" /><circle cx="268" cy="360" r="1.1" /><circle cx="36" cy="400" r="1" />
            </g>
            <ellipse cx="150" cy="446" rx="70" ry="8" fill="url(#floor-glow)" />
            <g fill="none" strokeLinecap="round" strokeLinejoin="round">
              <g stroke="#5b66c9">
                <path d="M112 114 Q96 150 92 190" strokeWidth="19" /><path d="M92 190 Q88 228 84 262" strokeWidth="15" />
                <path d="M188 114 Q204 150 208 190" strokeWidth="19" /><path d="M208 190 Q212 228 216 262" strokeWidth="15" />
                <path d="M134 276 L133 360" strokeWidth="29" /><path d="M133 360 L132 424" strokeWidth="21" />
                <path d="M166 276 L167 360" strokeWidth="29" /><path d="M167 360 L168 424" strokeWidth="21" />
              </g>
              <g stroke="url(#body-fill)">
                <path d="M112 114 Q96 150 92 190" strokeWidth="16" /><path d="M92 190 Q88 228 84 262" strokeWidth="12" />
                <path d="M188 114 Q204 150 208 190" strokeWidth="16" /><path d="M208 190 Q212 228 216 262" strokeWidth="12" />
                <path d="M134 276 L133 360" strokeWidth="26" /><path d="M133 360 L132 424" strokeWidth="18" />
                <path d="M166 276 L167 360" strokeWidth="26" /><path d="M167 360 L168 424" strokeWidth="18" />
              </g>
            </g>
            <g fill="url(#body-fill)" stroke="#5b66c9" strokeWidth="1.8" strokeLinejoin="round">
              <ellipse cx="82" cy="274" rx="7" ry="12" transform="rotate(6 82 274)" /><ellipse cx="218" cy="274" rx="7" ry="12" transform="rotate(-6 218 274)" />
              <path d="M121 426 Q116 446 130 446 L145 446 Q147 432 143 426 Z" /><path d="M179 426 Q184 446 170 446 L155 446 Q153 432 157 426 Z" />
              <rect x="142" y="76" width="16" height="26" rx="5" />
              <path d="M142 98 C128 100 113 102 109 114 C105 132 109 162 114 190 C118 206 122 222 122 236 C121 250 116 262 116 278 C116 291 130 297 150 297 C170 297 184 291 184 278 C184 262 179 250 178 236 C178 222 182 206 186 190 C191 162 195 132 191 114 C187 102 172 100 158 98 Z" />
              <ellipse cx="150" cy="52" rx="24" ry="29" />
            </g>
            <path d="M150 297 L150 424" fill="none" stroke="#5b66c9" strokeOpacity="0.7" strokeWidth="1.6" />
            <g className="body-heart" transform="translate(162 150)">
              <path d="M0 -6 C-8 -15 -20 -3 0 13 C20 -3 8 -15 0 -6 Z" fill="#fb7185" stroke="#ffe4e6" strokeWidth="1" />
            </g>
            <path d="M174 48 L231 44" stroke="#67e8f9" strokeOpacity="0.7" strokeWidth="1.6" strokeDasharray="3 3" fill="none" />
            <path d="M186 152 L231 152" stroke="#67e8f9" strokeOpacity="0.7" strokeWidth="1.6" strokeDasharray="3 3" fill="none" />
            {selected === 'head' && <ellipse className="body-pulse" cx="150" cy="52" rx="31" ry="36" fill="none" stroke="#67e8f9" strokeWidth="3.5" filter="url(#soft-glow)" />}
            {selected === 'chest' && <path className="body-pulse" d="M112 112 Q150 100 188 112 Q192 150 184 198 Q150 208 116 198 Q108 150 112 112 Z" fill="none" stroke="#67e8f9" strokeWidth="3.5" strokeLinejoin="round" filter="url(#soft-glow)" />}
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
