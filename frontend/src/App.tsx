import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { NAVIGATION, EXPERIMENTAL_NAVIGATION, ALL_NAVIGATION, legacyRedirect, pageHref, parsePage, type PageId } from './navigation';
import { Dashboard } from './Dashboard';
import { MeasurementForm } from './MeasurementForm';
import { MissionPreview } from './MissionPreview';
import { ScenarioComparator } from './ScenarioComparator';
import { EnvironmentSelector } from './EnvironmentView';
import { BodyExplorer } from './BodyExplorer';
import { SelfCareJourney } from './SelfCareJourney';
import { OfflineStatus } from './OfflineStatus';
import { ActionLink, Card, SimulationNotice } from './design-system';

type Section = {
  eyebrow: string;
  heading: string;
  intro: string;
  next: PageId;
};

const EXPLORATORY: PageId[] = ['scenarios', 'environments', 'body', 'self-care'];

const SECTIONS: Record<PageId, Section> = {
  dashboard: {
    eyebrow: 'Demo mission · API summary',
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
    eyebrow: 'AKM-34 · Assumption analysis', heading: 'Hypothetical scenario comparator',
    intro: 'Compare simulated values. This page does not predict health risks or clinical outcomes.', next: 'environments',
  },
  environments: {
    eyebrow: 'AKM-35 · NASA physical context', heading: 'Mission environments',
    intro: 'Explore hypothetical conditions. The recorded mission and its rules stay unchanged.', next: 'body',
  },
  body: {
    eyebrow: 'AKM-36 · Accessible exploration', heading: 'Interactive body map',
    intro: 'Explore educational links between MVP metrics and NASA research.', next: 'self-care',
  },
  'self-care': {
    eyebrow: 'AKM-37 · Participation', heading: 'Self-care journey',
    intro: 'Track completed routine activities. Points reward participation, never health results.', next: 'dashboard',
  },
};

export function App() {
  const [page, setPage] = useState<PageId>(() => parsePage(window.location.hash));
  const previousPage = useRef(page);

  useEffect(() => {
    const onHashChange = () => {
      const redirect = legacyRedirect(window.location.hash);
      if (redirect) window.history.replaceState(null, '', redirect);
      setPage(parsePage(window.location.hash));
    };
    onHashChange();
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const view = SECTIONS[page];
  useEffect(() => {
    document.title = `${view.heading} | AKM Health`;
    if (previousPage.current !== page) {
      previousPage.current = page;
      document.getElementById('main-content')?.focus();
    }
  }, [page, view.heading]);

  function skipToContent(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    document.getElementById('main-content')?.focus();
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content" onClick={skipToContent}>Skip to content</a>
      <aside className="sidebar" aria-label="Application information">
        <div className="brand">
          <span aria-hidden="true" className="brand-mark"><img src="/akm-mark.svg" alt="" width="32" height="26" /></span>
          <div><strong>AKM Health</strong><small>Space Health Monitoring</small></div>
        </div>
        <p className="nav-heading">Mission pages</p>
        <nav className="side-nav" aria-label="Main navigation">
          {NAVIGATION.map(item => (
            <a key={item.id} href={pageHref(item.id)}
              aria-current={page === item.id ? 'page' : undefined} className="nav-link">
              <span>{item.label}</span>
            </a>
          ))}
        </nav>
        <p className="nav-heading" style={{ marginTop: '1.5rem' }}>Exploratory tools (P1/P2)</p>
        <nav className="side-nav" aria-label="Exploratory tools">
          {EXPERIMENTAL_NAVIGATION.map(item => (
            <a key={item.id} href={pageHref(item.id)} aria-current={page === item.id ? 'page' : undefined} className="nav-link">{item.label}</a>
          ))}
        </nav>
        <div className="sidebar-note">
          Simulated mission
          <small>For demonstration purposes.</small>
        </div>
      </aside>
      <div className="content-shell">
        <OfflineStatus />
        <header className="topbar">
          <div><small>AKM HEALTH / MVP P0</small><strong>{view.heading}</strong></div>
          <span className="version-chip">{EXPLORATORY.includes(page) ? 'Exploratory · P1/P2' : 'Local API'}</span>
        </header>
        <main id="main-content" className="main-area" tabIndex={-1}>
          <div aria-live="polite" className="sr-only">Current page: {view.heading}</div>
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
                  Go to {NAVIGATION.find((item) => item.id === view.next)?.label}
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
        </main>
        <footer className="footer">AKM Health · NASA Space Apps Challenge 2026 · P0 interface + exploratory P1/P2 tools</footer>
      </div>
    </div>
  );
}
