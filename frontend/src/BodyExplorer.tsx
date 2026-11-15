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
              <linearGradient id="body-fill" gradientUnits="userSpaceOnUse" x1="50" y1="30" x2="250" y2="440">
                <stop offset="0" stopColor="#c9d6ff" /><stop offset="0.45" stopColor="#8d9cf0" /><stop offset="1" stopColor="#4b52b8" />
              </linearGradient>
              <linearGradient id="body-shade" gradientUnits="userSpaceOnUse" x1="60" y1="0" x2="240" y2="0">
                <stop offset="0" stopColor="#1a1f5c" stopOpacity="0.38" /><stop offset="0.35" stopColor="#fff" stopOpacity="0" />
                <stop offset="0.65" stopColor="#fff" stopOpacity="0" /><stop offset="1" stopColor="#1a1f5c" stopOpacity="0.38" />
              </linearGradient>
              <radialGradient id="body-aura"><stop offset="0" stopColor="#8d9cf0" stopOpacity="0.32" /><stop offset="1" stopColor="#8d9cf0" stopOpacity="0" /></radialGradient>
              <radialGradient id="floor-glow"><stop offset="0" stopColor="#67e8f9" stopOpacity="0.3" /><stop offset="1" stopColor="#67e8f9" stopOpacity="0" /></radialGradient>
              <filter id="soft-glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3.5" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            </defs>
            <ellipse cx="150" cy="230" rx="140" ry="215" fill="url(#body-aura)" />
            <g fill="#e8efff" opacity="0.75">
              <circle cx="30" cy="110" r="1.2" /><circle cx="270" cy="70" r="1.5" /><circle cx="282" cy="250" r="1" />
              <circle cx="20" cy="290" r="1.4" /><circle cx="268" cy="360" r="1.1" /><circle cx="36" cy="400" r="1" />
            </g>
            <ellipse cx="150" cy="448" rx="80" ry="9" fill="url(#floor-glow)" />
            <g fill="none" strokeLinecap="round" strokeLinejoin="round">
              <g stroke="#6f7fe0" strokeOpacity="0.9">
                <path d="M100 132 Q82 164 78 210" strokeWidth="25" /><path d="M78 210 Q72 250 68 286" strokeWidth="20" />
                <path d="M200 132 Q218 164 222 210" strokeWidth="25" /><path d="M222 210 Q228 250 232 286" strokeWidth="20" />
                <path d="M134 304 Q132 340 133 374" strokeWidth="34" /><path d="M133 374 Q131 404 130 430" strokeWidth="25" />
                <path d="M166 304 Q168 340 167 374" strokeWidth="34" /><path d="M167 374 Q169 404 170 430" strokeWidth="25" />
              </g>
              <g stroke="url(#body-fill)">
                <path d="M100 132 Q82 164 78 210" strokeWidth="22" /><path d="M78 210 Q72 250 68 286" strokeWidth="17" />
                <path d="M200 132 Q218 164 222 210" strokeWidth="22" /><path d="M222 210 Q228 250 232 286" strokeWidth="17" />
                <path d="M134 304 Q132 340 133 374" strokeWidth="31" /><path d="M133 374 Q131 404 130 430" strokeWidth="22" />
                <path d="M166 304 Q168 340 167 374" strokeWidth="31" /><path d="M167 374 Q169 404 170 430" strokeWidth="22" />
              </g>
            </g>
            <g fill="url(#body-fill)" stroke="#6f7fe0" strokeWidth="2.2" strokeLinejoin="round">
              <ellipse cx="65" cy="300" rx="9" ry="15" transform="rotate(8 65 300)" /><ellipse cx="235" cy="300" rx="9" ry="15" transform="rotate(-8 235 300)" />
              <path d="M112 436 Q104 454 124 454 Q146 454 142 440 L142 430 L114 430 Z" /><path d="M188 436 Q196 454 176 454 Q154 454 158 440 L158 430 L186 430 Z" />
              <path d="M138 84 L138 110 L162 110 L162 84 Z" />
              <path d="M138 104 C120 108 104 112 100 124 C96 146 102 176 106 200 C109 218 112 232 110 246 C108 262 104 276 106 296 C110 312 126 320 150 320 C174 320 190 312 194 296 C196 276 192 262 190 246 C188 232 191 218 194 200 C198 176 204 146 200 124 C196 112 180 108 162 104 Z" />
              <path d="M150 24 C171 24 181 42 179 60 C177 79 167 94 150 94 C133 94 123 79 121 60 C119 42 129 24 150 24 Z" />
              <ellipse cx="121" cy="62" rx="4" ry="9" /><ellipse cx="179" cy="62" rx="4" ry="9" />
            </g>
            <path d="M138 104 C120 108 104 112 100 124 C96 146 102 176 106 200 C109 218 112 232 110 246 C108 262 104 276 106 296 C110 312 126 320 150 320 C174 320 190 312 194 296 C196 276 192 262 190 246 C188 232 191 218 194 200 C198 176 204 146 200 124 C196 112 180 108 162 104 Z" fill="url(#body-shade)" />
            <path d="M150 24 C171 24 181 42 179 60 C177 79 167 94 150 94 C133 94 123 79 121 60 C119 42 129 24 150 24 Z" fill="url(#body-shade)" />
            <path d="M123 52 C124 32 138 22 150 22 C164 22 177 32 177 52 C170 40 158 35 150 35 C140 35 130 40 123 52 Z" fill="#2a2f7a" opacity="0.85" />
            <g fill="none" stroke="#fff" strokeOpacity="0.38" strokeWidth="1.8" strokeLinecap="round">
              <path d="M140 110 Q128 118 114 122" /><path d="M160 110 Q172 118 186 122" />
              <path d="M150 112 L150 150" strokeOpacity="0.18" /><path d="M150 316 Q149 380 150 436" stroke="#4b52b8" strokeOpacity="0.8" strokeWidth="2" />
              <path d="M118 176 Q134 188 150 184 Q166 188 182 176" strokeOpacity="0.22" />
              <path d="M126 250 Q150 262 174 250" strokeOpacity="0.2" /><circle cx="150" cy="232" r="1.6" />
              <path d="M126 376 Q133 381 140 376" strokeOpacity="0.2" /><path d="M160 376 Q167 381 174 376" strokeOpacity="0.2" />
            </g>
            <path d="M104 132 Q108 170 112 214" fill="none" stroke="#fff" strokeOpacity="0.28" strokeWidth="4" strokeLinecap="round" />
            <g className="body-heart" transform="translate(163 170)">
              <path d="M0 -7 C-9 -18 -24 -4 0 15 C24 -4 9 -18 0 -7 Z" fill="#fb7185" stroke="#ffe4e6" strokeWidth="1.2" filter="url(#soft-glow)" />
            </g>
            <path d="M104 190 L130 190 L136 182 L142 198 L149 186 L156 190 L196 190" fill="none" stroke="#67e8f9" strokeOpacity="0.55" strokeWidth="1.4" strokeLinejoin="round" />
            <path d="M178 54 L231 46" stroke="#67e8f9" strokeOpacity="0.7" strokeWidth="1.6" strokeDasharray="3 3" fill="none" />
            <path d="M178 170 L231 172" stroke="#67e8f9" strokeOpacity="0.7" strokeWidth="1.6" strokeDasharray="3 3" fill="none" />
            {selected === 'head' && <ellipse className="body-pulse" cx="150" cy="59" rx="35" ry="42" fill="none" stroke="#67e8f9" strokeWidth="3.5" filter="url(#soft-glow)" />}
            {selected === 'chest' && <path className="body-pulse" d="M108 124 Q150 112 192 124 Q196 160 192 204 Q150 214 108 204 Q104 160 108 124 Z" fill="none" stroke="#67e8f9" strokeWidth="3.5" strokeLinejoin="round" filter="url(#soft-glow)" />}
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
