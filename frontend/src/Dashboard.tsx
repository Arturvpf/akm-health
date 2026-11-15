import { useEffect, useRef, useState } from 'react';
import { METRIC_LABELS } from './api';
import { NasaReferences } from './NasaReferences';
import { createDashboardController, INITIAL_DASHBOARD_STATE, type DashboardState } from './dashboard-state';
import { ActionButton, ActionLink, Card, DataState, Details, InformationNotice, ProtocolLegend, SourceBadge, StatusBadge } from './design-system';
import { pageHref } from './navigation';
import type { DataSource, InvestigationStatus, Kind, MetricSnapshot } from './types';

const number = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
const date = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'UTC' });
const PERSONAL_METRICS: Kind[] = ['sleep_hours', 'heart_rate_bpm', 'mood_score'];

function Timestamp({ value, missing = 'Sem horário informado' }: { value: string | null; missing?: string }) {
  return value ? <time dateTime={value}>{date.format(new Date(value))} UTC</time> : <span>{missing}</span>;
}

function Origin({ source }: { source?: DataSource | null }) {
  return source ? <SourceBadge source={source} />
    : <span className="ds-badge tone-neutral"><span aria-hidden="true">▤ </span>Origem não informada</span>;
}

function AssessmentStatus({ status, evaluated }: { status: InvestigationStatus; evaluated: boolean }) {
  if (!evaluated) return <span className="ds-badge tone-neutral"><span aria-hidden="true">i </span>Não avaliado pelo motor</span>;
  if (status === 'critical') return <span className="ds-badge tone-neutral"><span aria-hidden="true">! </span>Estado reservado de protocolo informado pela API</span>;
  return <StatusBadge status={status} />;
}

function Reading({ kind, sample, legacyValue }: { kind: Kind; sample?: MetricSnapshot; legacyValue?: number | null }) {
  const value = sample?.value ?? legacyValue;
  if (value === null || value === undefined) return <span className="dashboard-missing">Sem registro</span>;
  const unit = { sleep_hours: 'h', heart_rate_bpm: 'bpm', mood_score: '/ 5', co2_ppm: 'ppm', cabin_temp_c: '°C' }[kind];
  return <div className="dashboard-reading">
    <strong>{number.format(value)} {unit}</strong>
    <Origin source={sample?.source} />
    <small><Timestamp value={sample?.measured_at ?? null} missing="Horário individual não informado" /></small>
  </div>;
}

export function DashboardView({ state, onRefresh }: { state: DashboardState; onRefresh: () => void }) {
  const { data, phase, error, receivedAt } = state;
  const refreshing = phase === 'loading';
  const evaluated = data?.last_investigation_at !== null && data?.last_investigation_at !== undefined;
  return <div className="dashboard-page" aria-busy={refreshing}>
    <div className="dashboard-toolbar">
      <p>Consulta da missão fictícia. As outras áreas ainda apresentam exemplos locais.</p>
      <ActionButton onClick={onRefresh} disabled={refreshing}>
        {refreshing ? 'Consultando dados…' : phase === 'error' ? 'Tentar novamente' : 'Atualizar dados'}
      </ActionButton>
    </div>
    <div className="dashboard-feedback" role={phase === 'error' ? 'alert' : 'status'} aria-live={phase === 'error' ? 'assertive' : 'polite'}>
      {refreshing && <DataState kind="loading">{data
        ? 'Consultando a API. A última consulta confirmada permanece visível.' : 'Consultando os dados da missão.'}</DataState>}
      {phase === 'error' && <DataState kind="error">{error} {data
        ? 'Exibindo a última consulta confirmada; os dados podem estar desatualizados.'
        : 'Verifique se o servidor local está disponível e tente novamente.'}</DataState>}
      {phase === 'ready' && <span className="sr-only">Dados do dashboard atualizados.</span>}
    </div>
    {data && <>
      <section className="dashboard-summary" aria-label="Resumo da missão">
        <Card heading={data.mission.name}>
          <Details items={[
            { label: 'Contexto', value: 'Missão fictícia · habitat na superfície de Marte' },
            { label: 'Dia da missão', value: data.mission.day },
          ]} />
        </Card>
        <Card heading="Última investigação registrada">
          <p><Timestamp value={data.last_investigation_at} missing="Nenhuma investigação executada" /></p>
          <p>A data se refere à última investigação registrada no servidor; não indica que todos os perfis foram avaliados nesse horário.</p>
          <small>Última consulta confirmada: <Timestamp value={receivedAt} /></small>
        </Card>
      </section>
      {data.has_unanalyzed_measurements && <div className="dashboard-update" role="status">
        <InformationNotice label="Novas medições disponíveis — atualizar investigação">O resumo mantém as avaliações já registradas.</InformationNotice>
        <ActionLink href={pageHref('investigacao')}>Ir para investigação</ActionLink>
      </div>}
      <section className="dashboard-grid" aria-label="Tripulação e habitat">
        <Card heading="Tripulação">
          {data.astronauts.length === 0 ? <DataState kind="empty">Não há tripulantes cadastrados para exibir.</DataState>
            : <ul className="dashboard-crew">{data.astronauts.map((person, index) => <li key={person.id}>
              <article aria-labelledby={`crew-heading-${index}`}>
                <h3 id={`crew-heading-${index}`}>{person.name} <small>· {person.id}</small></h3>
                <AssessmentStatus status={person.status} evaluated={evaluated} />
                <Details items={PERSONAL_METRICS.map(kind => ({ label: METRIC_LABELS[kind], value: <Reading kind={kind} sample={person.latest_metrics[kind]} /> }))} />
              </article>
            </li>)}</ul>}
        </Card>
        <div className="dashboard-stack">
          <Card heading="Ambiente interno do habitat">
            <Details items={[
              { label: METRIC_LABELS.co2_ppm, value: <Reading kind="co2_ppm" sample={data.environment.latest_metrics?.co2_ppm} legacyValue={data.environment.co2_ppm} /> },
              { label: METRIC_LABELS.cabin_temp_c, value: <Reading kind="cabin_temp_c" sample={data.environment.latest_metrics?.cabin_temp_c} legacyValue={data.environment.cabin_temp_c} /> },
            ]} />
            <p>Leitura ambiental mais recente: <Timestamp value={data.environment.measured_at} missing="Sem leitura ambiental" />. Os indicadores podem ter horários diferentes.</p>
          </Card>
          <Card heading="Próximas medições">
            {data.pending_followups.length === 0 ? <DataState kind="empty">Nenhuma verificação pendente registrada.</DataState>
              : <ol className="dashboard-followups">{data.pending_followups.map(check => <li key={check.id}>
                <h3>{METRIC_LABELS[check.kind]}</h3>
                <p><strong>{check.astronaut_id === null ? 'Habitat' : data.astronauts.find(person => person.id === check.astronaut_id)?.name ?? check.astronaut_id}</strong> · Verificação #{check.id}</p>
                <p>{check.reason}</p>
                <small>Prazo: <Timestamp value={check.due_at} missing="Sem prazo informado" /></small>
              </li>)}</ol>}
          </Card>
        </div>
      </section>
      <section aria-label="Avaliações">
        <Card heading="Avaliações registradas">
          {!evaluated ? <DataState kind="empty">As avaliações do motor aparecerão após uma investigação explícita no servidor.</DataState>
            : data.alerts.length === 0 ? <p>Nenhum alerta registrado na resposta atual.</p>
            : <ul className="dashboard-alerts">{data.alerts.map(alert => <li key={alert.id}>
              <AssessmentStatus status={alert.level} evaluated />
              <h3>{alert.label}</h3><p>{alert.explanation}</p>
            </li>)}</ul>}
          <ProtocolLegend />
        </Card>
      </section>
    </>}
    <NasaReferences mission={data?.mission} />
  </div>;
}

export function Dashboard() {
  const [state, setState] = useState<DashboardState>(INITIAL_DASHBOARD_STATE);
  const controllerRef = useRef<ReturnType<typeof createDashboardController> | null>(null);
  useEffect(() => {
    const controller = createDashboardController();
    controllerRef.current = controller;
    const unsubscribe = controller.subscribe(setState);
    void controller.refresh();
    return () => { unsubscribe(); controller.dispose(); controllerRef.current = null; };
  }, []);
  return <DashboardView state={state} onRefresh={() => { void controllerRef.current?.refresh(); }} />;
}
