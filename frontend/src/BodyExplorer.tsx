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
              <linearGradient id="holo-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#7ff3ff" stopOpacity="0.62" /><stop offset="0.6" stopColor="#4cc9ee" stopOpacity="0.42" /><stop offset="1" stopColor="#3aa6e0" stopOpacity="0.34" />
              </linearGradient>
              <radialGradient id="holo-core" cx="0.5" cy="0.32" r="0.5"><stop offset="0" stopColor="#d9fbff" stopOpacity="0.42" /><stop offset="1" stopColor="#d9fbff" stopOpacity="0" /></radialGradient>
              <radialGradient id="heart-fill" cx="0.4" cy="0.35" r="0.75"><stop offset="0" stopColor="#ffb3c1" /><stop offset="0.55" stopColor="#e5446d" /><stop offset="1" stopColor="#8e1b3f" /></radialGradient>
              <radialGradient id="floor-glow"><stop offset="0" stopColor="#67e8f9" stopOpacity="0.32" /><stop offset="1" stopColor="#67e8f9" stopOpacity="0" /></radialGradient>
              <filter id="soft-glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3.5" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
              <filter id="rim-glow" x="-20%" y="-10%" width="140%" height="120%"><feGaussianBlur stdDeviation="5" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            </defs>
            <g fill="#e8efff" opacity="0.7">
              <circle cx="30" cy="110" r="1.2" /><circle cx="272" cy="40" r="1.5" /><circle cx="284" cy="250" r="1" />
              <circle cx="18" cy="290" r="1.4" /><circle cx="270" cy="362" r="1.1" /><circle cx="36" cy="404" r="1" />
            </g>
            <ellipse cx="150" cy="420" rx="62" ry="8" fill="url(#floor-glow)" />
            <g transform="translate(150 235) scale(0.86) translate(-150 -235)">
              <path d="M150 22 C166 22 176 36 176 54 C176 70 168 82 160 88 C160 92 160 96 159 100 C168 102 190 104 202 112 C212 116 215 128 214 140 C214 160 218 184 220 200 C222 220 226 244 230 262 C234 274 236 290 232 298 C228 303 222 297 220 288 C216 270 210 240 206 216 C204 196 200 170 196 150 C194 170 192 190 190 210 C188 224 188 240 194 256 C198 266 199 276 199 292 C199 320 196 340 192 362 C190 374 192 386 192 398 C192 412 190 424 189 432 C193 440 197 446 190 449 C184 450 172 450 166 449 C164 446 164 438 164 430 C164 410 161 388 159 368 C156 340 154 316 150 298 C146 316 144 340 141 368 C139 388 136 410 136 430 C136 438 136 446 134 449 C128 450 116 450 110 449 C103 446 107 440 111 432 C110 424 108 412 108 398 C108 386 110 374 108 362 C104 340 101 320 101 292 C101 276 102 266 106 256 C112 240 112 224 110 210 C108 190 106 170 104 150 C100 170 96 196 94 216 C90 240 84 270 80 288 C78 297 72 303 68 298 C64 290 66 274 70 262 C74 244 78 220 80 200 C82 184 86 160 86 140 C85 128 88 116 98 112 C110 104 132 102 141 100 C140 96 140 92 140 88 C132 82 124 70 124 54 C124 36 134 22 150 22 Z" fill="none" stroke="#7ff3ff" strokeWidth="3" strokeLinejoin="round" filter="url(#rim-glow)" opacity="0.85" />
              <path d="M150 22 C166 22 176 36 176 54 C176 70 168 82 160 88 C160 92 160 96 159 100 C168 102 190 104 202 112 C212 116 215 128 214 140 C214 160 218 184 220 200 C222 220 226 244 230 262 C234 274 236 290 232 298 C228 303 222 297 220 288 C216 270 210 240 206 216 C204 196 200 170 196 150 C194 170 192 190 190 210 C188 224 188 240 194 256 C198 266 199 276 199 292 C199 320 196 340 192 362 C190 374 192 386 192 398 C192 412 190 424 189 432 C193 440 197 446 190 449 C184 450 172 450 166 449 C164 446 164 438 164 430 C164 410 161 388 159 368 C156 340 154 316 150 298 C146 316 144 340 141 368 C139 388 136 410 136 430 C136 438 136 446 134 449 C128 450 116 450 110 449 C103 446 107 440 111 432 C110 424 108 412 108 398 C108 386 110 374 108 362 C104 340 101 320 101 292 C101 276 102 266 106 256 C112 240 112 224 110 210 C108 190 106 170 104 150 C100 170 96 196 94 216 C90 240 84 270 80 288 C78 297 72 303 68 298 C64 290 66 274 70 262 C74 244 78 220 80 200 C82 184 86 160 86 140 C85 128 88 116 98 112 C110 104 132 102 141 100 C140 96 140 92 140 88 C132 82 124 70 124 54 C124 36 134 22 150 22 Z" fill="url(#holo-fill)" stroke="#bff8ff" strokeWidth="1.4" strokeLinejoin="round" />
              <path d="M150 22 C166 22 176 36 176 54 C176 70 168 82 160 88 C160 92 160 96 159 100 C168 102 190 104 202 112 C212 116 215 128 214 140 C214 160 218 184 220 200 C222 220 226 244 230 262 C234 274 236 290 232 298 C228 303 222 297 220 288 C216 270 210 240 206 216 C204 196 200 170 196 150 C194 170 192 190 190 210 C188 224 188 240 194 256 C198 266 199 276 199 292 C199 320 196 340 192 362 C190 374 192 386 192 398 C192 412 190 424 189 432 C193 440 197 446 190 449 C184 450 172 450 166 449 C164 446 164 438 164 430 C164 410 161 388 159 368 C156 340 154 316 150 298 C146 316 144 340 141 368 C139 388 136 410 136 430 C136 438 136 446 134 449 C128 450 116 450 110 449 C103 446 107 440 111 432 C110 424 108 412 108 398 C108 386 110 374 108 362 C104 340 101 320 101 292 C101 276 102 266 106 256 C112 240 112 224 110 210 C108 190 106 170 104 150 C100 170 96 196 94 216 C90 240 84 270 80 288 C78 297 72 303 68 298 C64 290 66 274 70 262 C74 244 78 220 80 200 C82 184 86 160 86 140 C85 128 88 116 98 112 C110 104 132 102 141 100 C140 96 140 92 140 88 C132 82 124 70 124 54 C124 36 134 22 150 22 Z" fill="url(#holo-core)" />
              <g fill="none" stroke="#bff8ff" strokeOpacity="0.55" strokeWidth="1.3">
                <path d="M110 118 Q150 104 190 118 Q194 160 186 206 Q150 214 114 206 Q106 160 110 118 Z" />
                <path d="M118 232 Q150 240 182 232" />
                <path d="M150 298 L150 430" strokeOpacity="0.35" />
              </g>
              <g className="body-heart" transform="translate(160 156)">
                <g filter="url(#soft-glow)">
                  <path d="M3 -12 C2 -26 14 -32 20 -25 C24 -20 21 -13 17 -10" fill="none" stroke="#f08aa0" strokeWidth="6" strokeLinecap="round" />
                  <path d="M-6 -12 C-8 -24 -18 -26 -24 -20" fill="none" stroke="#e86a89" strokeWidth="5" strokeLinecap="round" />
                  <path d="M-12 -6 L-22 -22 M-14 0 L-26 -6" fill="none" stroke="#f3a3b5" strokeWidth="2.4" strokeLinecap="round" />
                  <path d="M-15 -5 C-24 6 -17 24 1 33 C18 24 25 7 15 -8 C9 -14 -3 -13 -15 -5 Z" fill="url(#heart-fill)" stroke="#ffd1da" strokeWidth="0.8" />
                  <path d="M-8 -4 C-11 8 -6 20 0 27 M2 -9 C6 2 8 14 4 24" fill="none" stroke="#7a1233" strokeOpacity="0.55" strokeWidth="1.3" strokeLinecap="round" />
                  <path d="M-10 -2 C-14 4 -12 10 -9 14" fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="2" strokeLinecap="round" />
                </g>
              </g>
              {selected === 'head' && <ellipse className="body-pulse" cx="150" cy="54" rx="31" ry="37" fill="none" stroke="#fff" strokeWidth="3" filter="url(#soft-glow)" />}
              {selected === 'chest' && <path className="body-pulse" d="M106 114 Q150 98 194 114 Q198 160 190 210 Q150 220 110 210 Q102 160 106 114 Z" fill="none" stroke="#fff" strokeWidth="3" strokeLinejoin="round" filter="url(#soft-glow)" />}
            </g>
            <path d="M176 82 L214 62" stroke="#7ff3ff" strokeOpacity="0.75" strokeWidth="1.4" strokeDasharray="4 3" fill="none" />
            <path d="M178 168 L214 168" stroke="#7ff3ff" strokeOpacity="0.75" strokeWidth="1.4" strokeDasharray="4 3" fill="none" />
          </svg>
          <button type="button" className="body-card body-card-head" aria-pressed={selected === 'head'}
            onClick={() => setSelected('head')}>
            <span className="body-card-number" data-n="1" aria-hidden="true" />
            <span className="body-card-text"><span>Mood</span><strong>{reading('mood_score') ? `${value.format(reading('mood_score')!.value)} / 5` : 'No data'}</strong></span>
          </button>
          <button type="button" className="body-card body-card-chest" aria-pressed={selected === 'chest'}
            onClick={() => setSelected('chest')}>
            <span className="body-card-number" data-n="2" aria-hidden="true" />
            <span className="body-card-text"><span>Heart rate</span><strong>{reading('heart_rate_bpm') ? `${value.format(reading('heart_rate_bpm')!.value)} bpm` : 'No data'}</strong></span>
            <svg className="body-card-trace" viewBox="0 0 80 18" aria-hidden="true" focusable="false"><path d="M0 9 H22 L28 2 L34 16 L40 9 H56 L61 4 L66 13 L70 9 H80" fill="none" stroke="#7ff3ff" strokeWidth="1.4" strokeLinejoin="round" /></svg>
          </button>
          <button type="button" className="body-tag body-tag-sleep" aria-pressed={selected === 'sleep'}
            onClick={() => setSelected('sleep')}>
            <span aria-hidden="true">☾</span>
            <span className="body-tag-text"><span>Sleep</span><strong>{reading('sleep_hours') ? `${value.format(reading('sleep_hours')!.value)} h` : 'No data'}</strong></span>
          </button>
          <button type="button" className="body-tag body-tag-habitat" aria-pressed={selected === 'habitat'}
            onClick={() => setSelected('habitat')}>
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
