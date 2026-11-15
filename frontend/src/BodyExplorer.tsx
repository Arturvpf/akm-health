import { useState } from 'react';
import { ActionButton, ActionLink, Card, DataState, Details, InformationNotice, SourceBadge } from './design-system';
import { useSelectedEnvironment } from './EnvironmentView';
import { METRICS } from './history-data';
import type { Kind, MetricSnapshot } from './types';
import { formatUtc, useDashboardSnapshot } from './use-dashboard';
import './experiments.css';

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
    <InformationNotice label="AKM-36 · Illustrative map, not an anatomical exam">
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
          <svg className="body-silhouette" viewBox="0 0 260 430" role="img" focusable="false"
            aria-label="Schematic front-facing human silhouette. Use the buttons to select a region.">
            <g fill="#1b2347" stroke="#8da2d6" strokeWidth="2.5" strokeLinejoin="round">
              <ellipse cx="130" cy="53" rx="34" ry="41" />
              <path d="M119 91 L141 91 L147 107 L178 116 Q189 120 190 146 L181 234 L158 248 L152 403 Q143 417 132 405 L122 270 L112 405 Q101 417 92 400 L99 248 L79 234 L70 146 Q71 121 84 116 L114 107 Z" />
              <path d="M76 123 Q58 123 51 147 L23 264 Q18 282 32 285 Q44 284 49 271 L91 161" />
              <path d="M184 123 Q202 123 209 147 L237 264 Q242 282 228 285 Q216 284 211 271 L169 161" />
            </g>
            {selected === 'head' && <ellipse cx="130" cy="53" rx="38" ry="45" fill="none" stroke="#67e8f9" strokeWidth="4" />}
            {selected === 'chest' && <path d="M84 120 L176 120 L172 200 L88 200 Z" fill="none" stroke="#67e8f9" strokeWidth="4" strokeLinejoin="round" />}
          </svg>
          {(['head', 'chest'] as const).map((id, index) =>
            <button key={id} type="button" className={`body-point body-point-${id}`} aria-pressed={selected === id}
              aria-label={`${index + 1}. Select ${REGIONS[id].label}`} onClick={() => setSelected(id)}>
              <span aria-hidden="true">{index + 1}</span>
            </button>)}
        </div>
        <p className="body-legend">1 · Head (mood) · 2 · Chest (heart rate). Sleep and cabin readings are not body regions.</p>
        <div className="body-button-row" role="group" aria-label="All regions and indicators">
          {ORDER.map(id => <button type="button" key={id} className="body-nav-button" aria-pressed={selected === id}
            onClick={() => setSelected(id)}>{REGIONS[id].label}</button>)}
        </div>
      </Card>
      <Card heading="Selected region">
        <section aria-live="polite" aria-atomic="true">
          <h3>{region.label}{region.kinds[0] !== 'co2_ppm' && astronaut ? ` · ${astronaut.name}` : ''}</h3>
          <div role="status">
            {dashboard.phase === 'loading' && !dashboard.data && <DataState kind="loading">Loading the latest readings from the local API.</DataState>}
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
