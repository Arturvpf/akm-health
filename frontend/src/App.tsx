import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { NAVIGATION, pageHref, parsePage, type PageId } from './navigation';
import { MissionPreview } from './MissionPreview';
import { ActionLink, Card, SimulationNotice } from './design-system';

type Section = {
  eyebrow: string;
  heading: string;
  intro: string;
  next: PageId;
};

const SECTIONS: Record<PageId, Section> = {
  dashboard: {
    eyebrow: 'Missão fictícia · ODYSSEY-26',
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
        <div className="sidebar-note">
          Fluxo de demonstração fictício
          <small>Não representa monitoramento real ou validação clínica.</small>
        </div>
      </aside>
      <div className="content-shell">
        <header className="topbar">
          <div><small>AKM HEALTH / MVP P0</small><strong>{view.heading}</strong></div>
          <span className="version-chip">Estrutura navegável · AKM-12</span>
        </header>
        <main id="main-content" className="main-area" tabIndex={-1}>
          <div aria-live="polite" className="sr-only">Página atual: {view.heading}</div>
          <div className="eyebrow">{view.eyebrow}</div>
          <h1>{view.heading}</h1>
          <p className="lead">{view.intro}</p>

          <SimulationNotice />

          <section className="panels" aria-label={page === 'historico' ? 'Histórico e navegação' : 'Dados de exemplo e navegação'}>
            <MissionPreview page={page} />
            <Card heading="Próxima etapa da jornada">
              <div className="journey-actions">
                <ActionLink variant="primary" href={pageHref(view.next)}>
                  Ir para {NAVIGATION.find((item) => item.id === view.next)?.label}
                  <span aria-hidden="true">→</span>
                </ActionLink>
                <ActionLink href="akm-10-wireframe.html" target="_blank" rel="noopener noreferrer">
                  Abrir wireframe interativo <span aria-hidden="true">↗</span>
                  <span className="sr-only">(abre em nova aba)</span>
                </ActionLink>
              </div>
              <div className="links" aria-label="Outras áreas">
                {NAVIGATION.filter((item) => item.id !== page && item.id !== view.next).map((item) => (
                  <ActionLink variant="quiet" href={pageHref(item.id)} key={item.id}>{item.label}</ActionLink>
                ))}
              </div>
            </Card>
          </section>
          <p className="disclaimer">Prova de navegação com missão e tripulação fictícias. Este shell não executa análises médicas, não consulta sensores e não cria alertas clínicos.</p>
        </main>
        <footer className="footer">AKM Health · NASA Space Apps Challenge 2026 · Interface P0</footer>
      </div>
    </div>
  );
}
