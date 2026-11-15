import { useEffect, useRef, useState } from 'react';
import { METRIC_LABELS } from './api';
import { NasaReferences } from './NasaReferences';
import { createDashboardController, INITIAL_DASHBOARD_STATE, type DashboardState } from './dashboard-state';
import { ActionButton, ActionLink, Card, DataState, Details, InformationNotice, ProtocolLegend, SourceBadge, StatusBadge } from './design-system';
import { pageHref } from './navigation';
import type { AstronautDashboardRead, DataSource, InvestigationStatus, Kind, MetricSnapshot } from './types';

const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const date = new Intl.DateTimeFormat('en-US', { dateStyle: 'short', timeStyle: 'short', timeZone: 'UTC' });
const PERSONAL_METRICS: Kind[] = ['sleep_hours', 'heart_rate_bpm', 'mood_score'];

function Timestamp({ value, missing = 'No time provided' }: { value: string | null; missing?: string }) {
  return value ? <time dateTime={value}>{date.format(new Date(value))} UTC</time> : <span>{missing}</span>;
}

function Origin({ source }: { source?: DataSource | null }) {
  return source ? <SourceBadge source={source} />
    : <span className="ds-badge tone-neutral"><span aria-hidden="true">▤ </span>Source unavailable</span>;
}

function AssessmentStatus({ status, evaluated }: { status: InvestigationStatus; evaluated: boolean }) {
  if (!evaluated) return <span className="ds-badge tone-neutral"><span aria-hidden="true">i </span>Awaiting investigation</span>;
  if (status === 'critical') return <span className="ds-badge tone-neutral"><span aria-hidden="true">! </span>Reserved protocol status</span>;
  return <StatusBadge status={status} />;
}

function Reading({ kind, sample, legacyValue }: { kind: Kind; sample?: MetricSnapshot; legacyValue?: number | null }) {
  const value = sample?.value ?? legacyValue;
  if (value === null || value === undefined) return <span className="dashboard-missing">No reading</span>;
  const unit = { sleep_hours: 'h', heart_rate_bpm: 'bpm', mood_score: '/ 5', co2_ppm: 'ppm', cabin_temp_c: '°C' }[kind];
  return <div className="dashboard-reading">
    <strong>{number.format(value)} {unit}</strong>
    <Origin source={sample?.source} />
    <small><Timestamp value={sample?.measured_at ?? null} missing="Reading time unavailable" /></small>
  </div>;
}

/** One-glance answer to "is anything worth checking right now?", derived only from the API snapshot. */
function MissionPulse({ crew, evaluated, hasNewReadings }: { crew: AstronautDashboardRead[]; evaluated: boolean; hasNewReadings: boolean }) {
  const flagged = crew.filter(person => person.status === 'attention').length;
  const headline = !evaluated ? 'No investigation has been run yet.'
    : flagged > 0 ? `${flagged} of ${crew.length} crew members show an experimental pattern to check.`
    : 'No pattern under the demo rule.';
  const detail = !evaluated ? 'Investigations only run when you ask. Readings below are the latest recorded.'
    : hasNewReadings ? 'New readings arrived since the last run. Run an investigation to include them.'
    : 'Based on the most recent investigation. The cause is never assumed.';
  return <section className="mission-pulse" aria-label="Mission status at a glance">
    <div>
      <p className="pulse-label"><span aria-hidden="true">{flagged > 0 ? '▲ ' : '● '}</span>Right now</p>
      <p className="pulse-headline">{headline}</p>
      <p className="pulse-detail">{detail}</p>
    </div>
    <div className="pulse-actions">
      <ActionLink variant="primary" href={pageHref('investigation')}>Investigate<span aria-hidden="true">→</span></ActionLink>
      <ActionLink href={pageHref('register')}>Log a reading</ActionLink>
    </div>
  </section>;
}

export function DashboardView({ state, onRefresh }: { state: DashboardState; onRefresh: () => void }) {
  const { data, phase, error, receivedAt } = state;
  const cachedAt = state.cachedAt ?? null;
  const refreshing = phase === 'loading';
  const evaluated = data?.last_investigation_at !== null && data?.last_investigation_at !== undefined;
  return <div className="dashboard-page" aria-busy={refreshing}>
    <div className="dashboard-toolbar">
      <p>The dashboard shows the latest confirmed readings for the simulated mission.</p>
      <ActionButton onClick={onRefresh} disabled={refreshing}>
        {refreshing ? 'Loading mission data…' : phase === 'error' ? 'Try again' : 'Refresh data'}
      </ActionButton>
    </div>
    <div className="dashboard-feedback" role={phase === 'error' ? 'alert' : 'status'} aria-live={phase === 'error' ? 'assertive' : 'polite'}>
      {refreshing && <DataState kind="loading">{data
        ? 'Refreshing data. The last confirmed snapshot remains visible.' : 'Loading mission data.'}</DataState>}
      {phase === 'error' && <DataState kind="error">{error} {data
        ? 'Showing the last confirmed snapshot. Check its timestamp.'
        : 'Check that the local server is running and try again.'}</DataState>}
      {phase === 'ready' && cachedAt === null && <span className="sr-only">Dashboard updated.</span>}
      {phase === 'ready' && cachedAt !== null && <DataState kind="error">Could not get current data from the mission server. Showing a copy saved on this device at <Timestamp value={cachedAt} />. It may be out of date.</DataState>}
    </div>
    {data && <>
      <MissionPulse crew={data.astronauts} evaluated={evaluated} hasNewReadings={data.has_unanalyzed_measurements} />
      <section className="dashboard-summary" aria-label="Mission summary">
        <Card heading={data.mission.name}>
          <Details items={[
            { label: 'Context', value: 'Simulated mission · Mars surface habitat' },
            { label: 'Mission day', value: data.mission.day },
          ]} />
        </Card>
        <Card heading="Latest investigation">
          <p><Timestamp value={data.last_investigation_at} missing="No investigation has been run" /></p>
          <p>This timestamp applies to the most recent investigation. Its scope may cover a subset of the crew.</p>
          <small>{cachedAt === null ? 'Last confirmed refresh' : 'Saved on this device'}: <Timestamp value={receivedAt} /></small>
        </Card>
      </section>
      {data.has_unanalyzed_measurements && <div className="dashboard-update" role="status">
        <InformationNotice label="New measurements available — rerun investigation">Previously recorded assessments remain visible.</InformationNotice>
        <ActionLink href={pageHref('investigation')}>Go to Investigation</ActionLink>
      </div>}
      <section className="dashboard-grid" aria-label="Crew and habitat">
        <Card heading="Crew">
          {data.astronauts.length === 0 ? <DataState kind="empty">No crew profiles are available.</DataState>
            : <ul className="dashboard-crew">{data.astronauts.map((person, index) => <li key={person.id}>
              <article aria-labelledby={`crew-heading-${index}`}>
                <h3 id={`crew-heading-${index}`}>{person.name} <small>· {person.id}</small></h3>
                <AssessmentStatus status={person.status} evaluated={evaluated} />
                <Details items={PERSONAL_METRICS.map(kind => ({ label: METRIC_LABELS[kind], value: <Reading kind={kind} sample={person.latest_metrics[kind]} /> }))} />
              </article>
            </li>)}</ul>}
        </Card>
        <div className="dashboard-stack">
          <Card heading="Cabin environment">
            <Details items={[
              { label: METRIC_LABELS.co2_ppm, value: <Reading kind="co2_ppm" sample={data.environment.latest_metrics?.co2_ppm} legacyValue={data.environment.co2_ppm} /> },
              { label: METRIC_LABELS.cabin_temp_c, value: <Reading kind="cabin_temp_c" sample={data.environment.latest_metrics?.cabin_temp_c} legacyValue={data.environment.cabin_temp_c} /> },
            ]} />
            <p>Latest cabin reading: <Timestamp value={data.environment.measured_at} missing="No cabin reading" />. Each metric may have a different observation time.</p>
          </Card>
          <Card heading="Upcoming checks">
            {data.pending_followups.length === 0 ? <DataState kind="empty">No pending checks.</DataState>
              : <ol className="dashboard-followups">{data.pending_followups.map(check => <li key={check.id}>
                <h3>{METRIC_LABELS[check.kind]}</h3>
                <p><strong>{check.astronaut_id === null ? 'Habitat' : data.astronauts.find(person => person.id === check.astronaut_id)?.name ?? check.astronaut_id}</strong> · Check #{check.id}</p>
                <p>{check.reason}</p>
                <small>Due: <Timestamp value={check.due_at} missing="No due date" /></small>
              </li>)}</ol>}
          </Card>
        </div>
      </section>
      <section aria-label="Assessments">
        <Card heading="Recorded assessments">
          {!evaluated ? <DataState kind="empty">Run an investigation to see assessments.</DataState>
            : data.alerts.length === 0 ? <p>No alerts in the current snapshot.</p>
            : <ul className="dashboard-alerts">{data.alerts.map(alert => <li key={alert.id}>
              <AssessmentStatus status={alert.level} evaluated />
              <h3>{alert.label}</h3><p>{alert.explanation}</p>
            </li>)}</ul>}
          <ProtocolLegend />
        </Card>
      </section>
    </>}
    <NasaReferences mission={data?.mission} environment={data?.environment} />
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
