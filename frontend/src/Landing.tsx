import { useRef, useState, type ReactNode } from 'react';
import { ENVIRONMENTS } from './environment-data';
import { useSelectedEnvironment } from './EnvironmentView';
import { PlanetScene } from './PlanetScene';
import { SAMPLE_HABITAT, SAMPLE_PROFILES } from './scenario-data';
import { pageHref } from './navigation';
import { startTour } from './GuidedTour';

const WHAT_IT_DOES = [
  {
    title: 'Records readings',
    text: 'Sleep, heart rate, mood, cabin CO₂ and cabin temperature. Each one is saved with its source, its quality and a UTC timestamp. A missing reading stays missing and is never stored as zero.',
  },
  {
    title: 'Investigates when you ask',
    text: 'Nothing runs in the background. You pick the whole crew or one person and press run. The rules are plain Python, so the same readings always give the same answer.',
  },
  {
    title: 'Sits next to NASA data',
    text: 'A day of real ISS cabin telemetry and three NASA research references are shown beside the simulated crew. They give context only and never feed the rules.',
  },
];

const HAZARDS = [
  {
    title: 'Radiation',
    text: 'Daily ISS cabin radiation from NASA experiment RR-1 sits next to the simulated mission as historical context. It never feeds the rules.',
    href: pageHref('dashboard'), link: 'See the NASA references',
  },
  {
    title: 'Isolation and confinement',
    text: 'Sleep and well-being are recorded for every crew member. When the same drop shows up across the crew, the investigation reports it as a shared pattern.',
    href: pageHref('register'), link: 'Record a reading',
  },
  {
    title: 'Altered gravity',
    text: 'Mars (0.38 g), the Moon (0.165 g) and low Earth orbit are available as mission settings, with NASA reference values. They change the context shown, not any reading.',
    href: pageHref('environments'), link: 'Compare mission settings',
  },
  {
    title: 'Hostile and closed environments',
    text: 'Cabin CO₂ and temperature are tracked as readings of their own, and the ISS CO₂ range from RR-1 shows what a real closed cabin looked like.',
    href: pageHref('history'), link: 'Review recorded readings',
  },
];

const STEPS = [
  'Record a reading: sleep, heart rate, mood, cabin CO₂ or temperature.',
  'Run an investigation for the crew or for one person.',
  'Read the evidence and the possible explanations. None of them is confirmed.',
  'Take one more reading, run again, and see whether the pattern holds.',
];

const LIMITS = [
  'The thresholds are demo parameters. They are not clinical limits.',
  'Readings marked suspect are left out of the evidence.',
  'It raises no automatic critical alarm and never states a cause.',
  'A person on the mission team decides what to do.',
];

function Cta({ href, children, variant = 'secondary' }: { href: string; children: ReactNode; variant?: 'primary' | 'secondary' }) {
  return <a className={`ds-action ds-action-${variant} lp-cta`} href={href}>{children}</a>;
}

const ATTENTION_IDS = ['A1', 'A2', 'A3'];

function DemoCase() {
  const [selected, setSelected] = useState(SAMPLE_PROFILES[0].id);
  const person = SAMPLE_PROFILES.find(item => item.id === selected) ?? SAMPLE_PROFILES[0];
  const flagged = ATTENTION_IDS.includes(person.id);
  const sleep = person.metrics.sleep_hours ?? null;
  return (
    <div className="lp-demo">
      <div className="lp-demo-pane">
        <h3>Crew member</h3>
        <div role="group" aria-label="Demo crew member" className="lp-chip-row">
          {SAMPLE_PROFILES.map(item => (
            <button key={item.id} type="button" className="lp-chip" aria-pressed={item.id === selected}
              onClick={() => setSelected(item.id)}>{item.name}</button>
          ))}
        </div>
        <dl className="lp-facts" aria-live="polite">
          <div><dt>Latest sleep</dt><dd>{sleep === null ? 'No reading' : `${sleep.toFixed(1)} h`}</dd></div>
          <div><dt>Heart rate</dt><dd>{person.metrics.heart_rate_bpm ? `${person.metrics.heart_rate_bpm} bpm` : 'No reading'}</dd></div>
          <div><dt>Well-being</dt><dd>{person.metrics.mood_score ? `${person.metrics.mood_score} of 5` : 'No reading'}</dd></div>
        </dl>
        {sleep !== null && (
          <div className="lp-bar" role="img" aria-label={`Sleep ${sleep.toFixed(1)} hours on a scale of 0 to 9`}>
            <span style={{ width: `${Math.min(100, (sleep / 9) * 100)}%` }} className={flagged ? 'is-flagged' : ''} />
          </div>
        )}
      </div>
      <div className="lp-demo-pane">
        <h3>What the engine reports</h3>
        <p className={`lp-verdict ${flagged ? 'is-flagged' : 'is-ok'}`}>
          <span aria-hidden="true">{flagged ? '▲' : '●'}</span>
          {flagged ? 'Experimental pattern to check' : 'No pattern under the demo rule'}
        </p>
        <ul className="lp-list">
          {flagged ? <>
            <li>Sleep is low for {ATTENTION_IDS.length} of {SAMPLE_PROFILES.length} crew members over the same two periods.</li>
            <li>The timing overlaps a change in cabin CO₂, now {SAMPLE_HABITAT.co2_ppm} ppm.</li>
            <li>The cause is not known. One new CO₂ reading is the suggested next check.</li>
          </> : <>
            <li>Sleep is steady across the observation window.</li>
            <li>No heart rate has been recorded yet. That is not counted as zero.</li>
            <li>Routine checks continue as scheduled.</li>
          </>}
        </ul>
        <p className="lp-demo-link"><a href={pageHref('investigation')}>Run this investigation yourself →</a></p>
      </div>
    </div>
  );
}

export function Landing() {
  const { current, id, select } = useSelectedEnvironment();
  const method = useRef<HTMLElement>(null);
  return (
    <div className="lp">
      <section className="lp-hero" aria-labelledby="lp-title">
        <div className="lp-hero-copy">
          <p className="lp-eyebrow">NASA Space Apps Challenge 2026 · simulated mission</p>
          <h1 id="lp-title">Spot changes in crew health early, then check them.</h1>
          <p className="lp-lead">AKM Health records crew readings and cabin conditions, looks for patterns when you ask it to, and tells you which reading to take next to confirm or rule them out.</p>
          <div className="lp-cta-row">
            <Cta href={pageHref('dashboard')} variant="primary">Open the dashboard</Cta>
            <button type="button" className="ds-action ds-action-secondary lp-cta" onClick={startTour}>Take the 2-minute tour</button>
            <button type="button" className="lp-link-button"
              onClick={() => method.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>How it works</button>
          </div>
        </div>

        <div className="lp-hero-visual">
          <PlanetScene environment={id} />
          <div className="lp-env">
            <p className="lp-env-label" id="lp-env-label">Where is the crew?</p>
            <div role="group" aria-labelledby="lp-env-label" className="lp-chip-row">
              {ENVIRONMENTS.map(item => (
                <button key={item.id} type="button" className="lp-chip" aria-pressed={item.id === id}
                  onClick={() => select(item.id)}>{item.name}</button>
              ))}
            </div>
            <p className="lp-env-line" aria-live="polite"><strong>{current.name}</strong>, gravity {current.gravity}</p>
            <p className="lp-env-note">Context only. Changing the setting does not alter any reading or rule.</p>
          </div>
        </div>
      </section>

      <section className="lp-section" aria-labelledby="lp-features">
        <h2 id="lp-features" className="lp-h2">What it does</h2>
        <div className="lp-columns">
          {WHAT_IT_DOES.map(item => (
            <article key={item.title} className="lp-column">
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="lp-section" aria-labelledby="lp-hazards">
        <h2 id="lp-hazards" className="lp-h2">Built around the hazards of long missions</h2>
        <p className="lp-sub">The challenge describes four hazards that make long missions hard on health. This is where each one shows up in the app. NASA's Human Research Program lists <a href="https://www.nasa.gov/hrp/hazards/">the full set of spaceflight hazards</a>.</p>
        <div className="lp-columns lp-columns-four">
          {HAZARDS.map(item => (
            <article key={item.title} className="lp-column">
              <h3>{item.title}</h3>
              <p>{item.text}</p>
              <p className="lp-column-link"><a href={item.href}>{item.link}</a></p>
            </article>
          ))}
        </div>
      </section>

      <section className="lp-section" aria-labelledby="lp-method" ref={method} id="method">
        <h2 id="lp-method" className="lp-h2">How an investigation works</h2>
        <div className="lp-split">
          <ol className="lp-steps">{STEPS.map(step => <li key={step}>{step}</li>)}</ol>
          <div>
            <h3 className="lp-h3">What it will not do</h3>
            <ul className="lp-list">{LIMITS.map(item => <li key={item}>{item}</li>)}</ul>
          </div>
        </div>
      </section>

      <section className="lp-section" aria-labelledby="lp-demo">
        <h2 id="lp-demo" className="lp-h2">Try it with the demo crew</h2>
        <p className="lp-sub">Four fictional crew members on a simulated Mars habitat. Pick one to see what the engine reports for them.</p>
        <DemoCase />
      </section>

      <section className="lp-section lp-final" aria-labelledby="lp-final">
        <h2 id="lp-final" className="lp-h2">Open the demo</h2>
        <div className="lp-cta-row">
          <Cta href={pageHref('dashboard')} variant="primary">Open the dashboard</Cta>
          <Cta href={pageHref('register')}>Register a measurement</Cta>
        </div>
        <p className="lp-fine">ODYSSEY-26, its crew and its readings are fictional. This is an experimental prototype and not a medical device. It gives no diagnosis or prescription and does not monitor real astronauts.</p>
      </section>
    </div>
  );
}
