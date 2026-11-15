import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { NAVIGATION, EXPERIMENTAL_NAVIGATION, ALL_NAVIGATION, pageHref, parsePage, type PageId } from './navigation';
import { Dashboard } from './Dashboard';
import { MeasurementForm } from './MeasurementForm';
import { MeasurementHistory } from './MeasurementHistory';
import { InvestigationPage } from './InvestigationPage';
import { ScenarioComparator } from './ScenarioComparator';
import { EnvironmentSelector } from './EnvironmentView';
import { BodyExplorer } from './BodyExplorer';
import { OfflineStatus } from './OfflineStatus';
import { ActionLink, SimulationNotice } from './design-system';

type Section = {
  eyebrow: string;
  heading: string;
  intro: string;
  next: PageId;
};

const SECTIONS: Record<PageId, Section> = {
  dashboard: {
    eyebrow: 'Missão fictícia · resumo da API',
    heading: 'Dashboard da missão',
    intro: 'Visão consolidada da tripulação, leituras do habitat e verificações pendentes.',
    next: 'registrar',
  },
  registrar: {
    eyebrow: 'Coleta guiada',
    heading: 'Registrar medição',
    intro: 'Ponto de entrada para sono, frequência cardíaca, humor, CO₂ e temperatura da cabine.',
    next: 'historico',
  },
  historico: {
    eyebrow: 'Registro verificável',
    heading: 'Histórico de medições',
    intro: 'Consulte tendências da tripulação e do habitat por indicador e período, com origem e qualidade de cada leitura.',
    next: 'investigacao',
  },
  investigacao: {
    eyebrow: 'Análise com incerteza explícita',
    heading: 'Investigação e acompanhamento',
    intro: 'Fluxo de evidências, hipóteses não confirmadas e solicitações de nova verificação.',
    next: 'dashboard',
  },
  comparador: {
    eyebrow: 'AKM-34 · análise de premissas', heading: 'Comparador de cenários hipotéticos',
    intro: 'Compare valores simulados sem prever riscos de saúde ou resultados clínicos.', next: 'ambientes',
  },
  ambientes: {
    eyebrow: 'AKM-35 · contexto físico NASA', heading: 'Ambientes de missão',
    intro: 'Explore condições hipotéticas mantendo a missão registrada e suas regras intactas.', next: 'corpo',
  },
  corpo: {
    eyebrow: 'AKM-36 · exploração acessível', heading: 'Corpo humano interativo',
    intro: 'Navegue por associações educativas entre indicadores do MVP e pesquisas da NASA.', next: 'dashboard',
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
      <a className="skip-link" href="#main-content" onClick={skipToContent}>Pular para o conteúdo</a>
      <aside className="sidebar" aria-label="Informações da aplicação">
        <div className="brand">
          <span aria-hidden="true" className="brand-mark">A</span>
          <div><strong>AKM Health</strong><small>Space Health Monitoring</small></div>
        </div>
        <p className="nav-heading">Explorar o MVP</p>
        <nav className="side-nav" aria-label="Navegação principal">
          {NAVIGATION.map(item => (
            <a key={item.id} href={pageHref(item.id)}
              aria-current={page === item.id ? 'page' : undefined} className="nav-link">
              <span>{item.label}</span>
            </a>
          ))}
        </nav>
        <p className="nav-heading" style={{ marginTop: '1.5rem' }}>Recursos exploratórios P1/P2</p>
        <nav className="side-nav" aria-label="Ferramentas exploratórias">
          {EXPERIMENTAL_NAVIGATION.map(item => (
            <a key={item.id} href={pageHref(item.id)} aria-current={page === item.id ? 'page' : undefined} className="nav-link">{item.label}</a>
          ))}
        </nav>
        <div className="sidebar-note">
          Fluxo de demonstração fictício
          <small>Não representa monitoramento real ou validação clínica.</small>
        </div>
      </aside>
      <div className="content-shell">
        <OfflineStatus />
        <header className="topbar">
          <div><small>AKM HEALTH / MVP P0</small><strong>{view.heading}</strong></div>
          <span className="version-chip">{['comparador', 'ambientes', 'corpo'].includes(page) ? 'Exploração P2' : 'API local · demo'}</span>
        </header>
        <main id="main-content" className="main-area" tabIndex={-1}>
          <div aria-live="polite" className="sr-only">Página atual: {view.heading}</div>
          <div className="eyebrow">{view.eyebrow}</div>
          <h1>{view.heading}</h1>
          <p className="lead">{view.intro}</p>

          {page === 'dashboard' && <Dashboard />}
          {page === 'registrar' && <MeasurementForm />}
          {page === 'historico' && <><SimulationNotice /><MeasurementHistory /></>}
          {page === 'investigacao' && <><SimulationNotice /><InvestigationPage /></>}
          {page === 'comparador' && <ScenarioComparator />}
          {page === 'ambientes' && <EnvironmentSelector />}
          {page === 'corpo' && <BodyExplorer />}
          <section className="journey-actions" aria-label="Próximas áreas" style={{ marginTop: '1.5rem' }}>
            <ActionLink href={pageHref(view.next)}>Próxima área: {ALL_NAVIGATION.find(item => item.id === view.next)?.label}</ActionLink>
          </section>
          <p className="disclaimer">Missão e tripulação fictícias. Os estados são experimentais; esta demonstração não realiza avaliações médicas nem consulta sensores reais.</p>
        </main>
        <footer className="footer">AKM Health · NASA Space Apps Challenge 2026 · P0 + recursos experimentais P1/P2</footer>
      </div>
    </div>
  );
}
