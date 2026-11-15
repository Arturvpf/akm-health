import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { NAVIGATION, pageHref, parsePage, type PageId } from './navigation';
import { MissionPreview } from './MissionPreview';
import { Dashboard } from './Dashboard';
import { MeasurementForm } from './MeasurementForm';
import { ActionLink, Card, SimulationNotice } from './design-system';

type Section = {
  eyebrow: string;
  heading: string;
  intro: string;
  next: PageId;
};

const SECTIONS: Record<PageId, Section> = {
  dashboard: {
    eyebrow: 'Demo mission · API summary',
    heading: 'Mission dashboard',
    intro: 'Crew readings, cabin conditions, and pending checks.',
    next: 'registrar',
  },
  registrar: {
    eyebrow: 'Guided collection',
    heading: 'Register a measurement',
    intro: 'Record sleep, heart rate, emotional well-being, cabin CO₂, or cabin temperature.',
    next: 'historico',
  },
  historico: {
    eyebrow: 'Measurement records',
    heading: 'Measurement history',
    intro: 'View crew and cabin trends, including the source and quality of each reading.',
    next: 'investigacao',
  },
  investigacao: {
    eyebrow: 'Experimental analysis',
    heading: 'Investigation and follow-up',
    intro: 'Review evidence, unconfirmed hypotheses, and requested follow-up checks.',
    next: 'dashboard',
  },
};

export function App() {
  const [page, setPage] = useState<PageId>(() => parsePage(window.location.hash));
  const previousPage = useRef(page);

  useEffect(() => {
    const onHashChange = () => setPage(parsePage(window.location.hash));
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
          <span aria-hidden="true" className="brand-mark">A</span>
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
        <div className="sidebar-note">
          Simulated mission
          <small>For demonstration purposes.</small>
        </div>
      </aside>
      <div className="content-shell">
        <header className="topbar">
          <div><small>AKM HEALTH / MVP P0</small><strong>{view.heading}</strong></div>
          <span className="version-chip">Local API</span>
        </header>
        <main id="main-content" className="main-area" tabIndex={-1}>
          <div aria-live="polite" className="sr-only">Current page: {view.heading}</div>
          <div className="eyebrow">{view.eyebrow}</div>
          <h1>{view.heading}</h1>
          <p className="lead">{view.intro}</p>

          {page === 'dashboard' ? <Dashboard /> : page === 'registrar' ? <MeasurementForm /> : <>
          <SimulationNotice />

          <section className="panels" aria-label={page === 'historico' ? 'History and navigation' : 'Investigation and navigation'}>
            <MissionPreview page={page} />
            <Card heading="Next step">
              <div className="journey-actions">
                <ActionLink variant="primary" href={pageHref(view.next)}>
                  Go to {NAVIGATION.find((item) => item.id === view.next)?.label}
                  <span aria-hidden="true">→</span>
                </ActionLink>
                <ActionLink href="akm-10-wireframe.html" target="_blank" rel="noopener noreferrer">
                  Open the interactive wireframe (Portuguese) <span aria-hidden="true">↗</span>
                  <span className="sr-only">(opens in a new tab)</span>
                </ActionLink>
              </div>
              <div className="links" aria-label="Other pages">
                {NAVIGATION.filter((item) => item.id !== page && item.id !== view.next).map((item) => (
                  <ActionLink variant="quiet" href={pageHref(item.id)} key={item.id}>{item.label}</ActionLink>
                ))}
              </div>
            </Card>
          </section>
          </>}
          <p className="disclaimer">The mission and crew are fictional. Investigation results are experimental. Clinical assessment and live sensor monitoring are outside the scope of this demo.</p>
        </main>
        <footer className="footer">AKM Health · NASA Space Apps Challenge 2026 · P0 interface</footer>
      </div>
    </div>
  );
}
