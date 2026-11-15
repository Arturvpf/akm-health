import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { NAVIGATION, EXPERIMENTAL_NAVIGATION, ALL_NAVIGATION, pageHref, parsePage, type PageId } from './navigation';
import { Dashboard } from './Dashboard';
import { MeasurementForm } from './MeasurementForm';
import { MissionPreview } from './MissionPreview';
import { ScenarioComparator } from './ScenarioComparator';
import { EnvironmentSelector } from './EnvironmentView';
import { BodyExplorer } from './BodyExplorer';
import { SelfCareJourney } from './SelfCareJourney';
import { OfflineStatus } from './OfflineStatus';
import { Landing } from './Landing';
import { SceneBackground } from './SceneBackground';
import { ActionLink, Card, SimulationNotice } from './design-system';

type Section = {
  eyebrow: string;
  heading: string;
  intro: string;
  next: PageId;
};

const EXPLORATORY: PageId[] = ['scenarios', 'environments', 'body', 'self-care'];
/** Short tab captions so every tab fits on one header row. The full label stays as the accessible name. */
const TAB_LABELS: Partial<Record<PageId, string>> = {
  scenarios: 'Scenarios', environments: 'Environments', body: 'Body map', 'self-care': 'Self-care',
};

const SECTIONS: Record<PageId, Section> = {
  home: {
    eyebrow: 'NASA Space Apps Challenge 2026',
    heading: 'AKM Health',
    intro: 'Catch crew health patterns early, then verify them.',
    next: 'dashboard',
  },
  dashboard: {
    eyebrow: 'Demo mission',
    heading: 'Mission dashboard',
    intro: 'Crew readings, cabin conditions, and pending checks.',
    next: 'register',
  },
  register: {
    eyebrow: 'Guided collection',
    heading: 'Register a measurement',
    intro: 'Record sleep, heart rate, emotional well-being, cabin CO₂, or cabin temperature.',
    next: 'history',
  },
  history: {
    eyebrow: 'Measurement records',
    heading: 'Measurement history',
    intro: 'View crew and cabin trends, including the source and quality of each reading.',
    next: 'investigation',
  },
  investigation: {
    eyebrow: 'Experimental analysis',
    heading: 'Investigation and follow-up',
    intro: 'Review evidence, unconfirmed hypotheses, and requested follow-up checks.',
    next: 'dashboard',
  },
  scenarios: {
    eyebrow: 'Assumption analysis', heading: 'Hypothetical scenario comparator',
    intro: 'Compare simulated values. This page does not predict health risks or clinical outcomes.', next: 'environments',
  },
  environments: {
    eyebrow: 'NASA physical context', heading: 'Mission environments',
    intro: 'Explore hypothetical conditions. The recorded mission and its rules stay unchanged.', next: 'body',
  },
  body: {
    eyebrow: 'Accessible exploration', heading: 'Interactive body map',
    intro: 'Explore educational links between the health metrics AKM Health tracks and NASA research.', next: 'self-care',
  },
  'self-care': {
    eyebrow: 'Participation', heading: 'Self-care journey',
    intro: 'Track completed routine activities. Points reward participation, never health results.', next: 'dashboard',
  },
};

export function App() {
  const [page, setPage] = useState<PageId>(() => parsePage(window.location.hash));
  const previousPage = useRef(page);

  useEffect(() => {
    const onHashChange = () => {
      setPage(parsePage(window.location.hash));
    };
    onHashChange();
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const view = SECTIONS[page];
  useEffect(() => {
    document.title = page === 'home' ? 'AKM Health — Space Health Monitoring' : `${view.heading} | AKM Health — Space Health Monitoring`;
    if (previousPage.current !== page) {
      previousPage.current = page;
      window.scrollTo({ top: 0 });
      document.getElementById('main-content')?.focus({ preventScroll: true });
    }
  }, [page, view.heading]);

  function skipToContent(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    document.getElementById('main-content')?.focus();
  }

  return (
    <>
    <SceneBackground page={page} />
    <div className="app-shell">
      <a className="skip-link" href="#main-content" onClick={skipToContent}>Skip to content</a>
      <header className="site-header">
        <div className="site-header-inner">
          <a className="brand" href={pageHref('home')}>
            <span aria-hidden="true" className="brand-mark"><img src="/akm-mark.svg" alt="" width="30" height="24" /></span>
            <span><strong>AKM Health</strong><small>Space Health Monitoring</small></span>
          </a>
          <nav className="tab-nav tab-nav-main" aria-label="Main navigation">
            {NAVIGATION.map(item => (
              <a key={item.id} href={pageHref(item.id)}
                aria-current={page === item.id ? 'page' : undefined} className="tab-link">
                {item.label}
              </a>
            ))}
          </nav>
          <nav className="tab-nav tab-nav-labs" aria-label="More tools">
            <span className="tab-group-label" aria-hidden="true">Labs</span>
            {EXPERIMENTAL_NAVIGATION.map(item => (
              <a key={item.id} href={pageHref(item.id)} aria-current={page === item.id ? 'page' : undefined}
                title={item.label} className="tab-link">{TAB_LABELS[item.id] ?? item.label}</a>
            ))}
          </nav>
          <span className="version-chip">Simulated mission</span>
        </div>
      </header>
      <div className="content-shell">
        <OfflineStatus />
        <main id="main-content" className={page === 'home' ? 'main-area main-home' : 'main-area'} tabIndex={-1}>
          <div aria-live="polite" className="sr-only">Current page: {view.heading}</div>

          {page === 'home' ? <Landing /> : <>
          <div className="eyebrow">{view.eyebrow}</div>
          <h1>{view.heading}</h1>
          <p className="lead">{view.intro}</p>

          {page === 'dashboard' ? <Dashboard /> : page === 'register' ? <MeasurementForm /> : page === 'scenarios' ? <ScenarioComparator /> : page === 'environments' ? <EnvironmentSelector /> : page === 'body' ? <BodyExplorer /> : page === 'self-care' ? <SelfCareJourney /> : <>
          <SimulationNotice />

          <section className="panels" aria-label={page === 'history' ? 'History and navigation' : 'Investigation and navigation'}>
            <MissionPreview page={page as 'register' | 'history' | 'investigation'} />
            <Card heading="Next step">
              <div className="journey-actions">
                <ActionLink variant="primary" href={pageHref(view.next)}>
                  Go to {ALL_NAVIGATION.find((item) => item.id === view.next)?.label}
                  <span aria-hidden="true">→</span>
                </ActionLink>
              </div>
              <nav className="links" aria-label="Other pages">
                {NAVIGATION.filter((item) => item.id !== page && item.id !== view.next).map((item) => (
                  <ActionLink variant="quiet" href={pageHref(item.id)} key={item.id}>{item.label}</ActionLink>
                ))}
              </nav>
            </Card>
          </section>
          </>}
          {EXPLORATORY.includes(page) && <section className="journey-actions" aria-label="Next area" style={{ marginTop: '1.5rem' }}>
            <ActionLink href={pageHref(view.next)}>Next area: {ALL_NAVIGATION.find(item => item.id === view.next)?.label}</ActionLink>
          </section>}
          <p className="disclaimer">The mission and crew are fictional. Investigation results are experimental. Clinical assessment and live sensor monitoring are outside the scope of this demo.</p>
          </>}
        </main>
        <footer className="footer">
          <span>AKM Health — Space Health Monitoring · NASA Space Apps Challenge 2026</span>
          <span className="footer-status">Simulated mission · not a medical device</span>
        </footer>
      </div>
    </div>
    </>
  );
}
