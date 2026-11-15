import { useEffect, useRef, useState, type FormEvent, type RefObject } from 'react';
import { ActionButton, ActionLink, Card, DataState, Details, SelectField, SourceBadge } from './design-system';
import { readCompatibleMeasurements } from './investigation-api';
import { formatTime, metricNames, metricValue, targetName, UtcTime } from './investigation-result';
import { pageHref } from './navigation';
import type { AstronautRead, FollowupRead, MeasurementRead } from './types';

export interface Agenda {
  pending: FollowupRead[];
  completed: FollowupRead[];
}

interface Message {
  text: string;
  error?: boolean;
}

function MeasurementLinkForm({ check, locked, saving, complete }: {
  check: FollowupRead; locked: boolean; saving: boolean; complete: (id: number) => void;
}) {
  const [loaded, setLoaded] = useState<{ check: FollowupRead; measurements: MeasurementRead[] }>();
  const [selectedId, setSelectedId] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [state, setState] = useState<'loading' | 'loaded' | 'error'>('loading');
  const formHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    formHeading.current?.focus();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    readCompatibleMeasurements(check, controller.signal).then(rows => {
      if (!controller.signal.aborted) {
        setLoaded({ check, measurements: rows });
        setState('loaded');
      }
    }).catch(() => {
      if (!controller.signal.aborted) setState('error');
    });
    return () => controller.abort();
  }, [check, refresh]);

  const measurements = loaded?.measurements ?? [];
  const selected = measurements.find(row => String(row.id) === selectedId);
  const ready = state === 'loaded' && loaded?.check === check;

  function reload() {
    setState('loading');
    setRefresh(value => value + 1);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selected && !locked && ready) complete(selected.id);
  }

  return (
    <form className="investigation-link-form" onSubmit={submit}>
      <h5 ref={formHeading} tabIndex={-1}>Link a measurement to check #{check.id}</h5>
      <div role="status">
        {!ready && state !== 'error' ? <DataState kind="loading">Loading eligible measurements for this check.</DataState> : null}
        {state === 'error' ? <DataState kind="error">Could not load measurements.</DataState> : null}
        {ready && !measurements.length ? (
          <DataState kind="empty">Record a valid reading for the metric and target above. It must be recorded after the check was requested.</DataState>
        ) : null}
      </div>
      <div className="investigation-actions">
        <ActionLink href={pageHref('register')}>Register measurement</ActionLink>
        <ActionButton onClick={reload} disabled={locked || state === 'loading'}>
          {state === 'error' ? 'Retry loading measurements' : 'Refresh measurements'}
        </ActionButton>
      </div>
      {measurements.length ? (
        <>
          <SelectField label="Measurement to link" value={selected ? selectedId : ''}
            onChange={event => setSelectedId(event.currentTarget.value)}
            disabled={locked || !ready}>
            <option value="">Select a measurement</option>
            {measurements.map(row => (
              <option key={row.id} value={row.id}>
                #{row.id} · {metricValue(row.value, row.unit)} · {formatTime(row.measured_at)}
              </option>
            ))}
          </SelectField>
          <p>The server checks the observation and recording times during confirmation.</p>
          {selected ? <Details items={[
            { label: 'Measurement recorded', value: <UtcTime value={selected.recorded_at} /> },
            { label: 'Source', value: <SourceBadge source={selected.source} /> },
          ]} /> : null}
          <div>
            <ActionButton type="submit" aria-disabled={!selected || locked || !ready}>
              {saving ? 'Linking measurement…' : 'Link measurement and complete'}
            </ActionButton>
          </div>
        </>
      ) : null}
    </form>
  );
}

export function InvestigationAgenda({ agenda, loading, error, refresh, profiles, active, select, recover, completing,
  complete, linkMessage, recovering, heading }: {
  agenda: Agenda | undefined; loading: boolean; error: boolean; refresh: () => void; profiles: AstronautRead[];
  active: FollowupRead | undefined; select: (check: FollowupRead) => void; recover: (id: number) => void;
  completing: boolean; complete: (measurementId: number) => void; linkMessage: Message | null; recovering: boolean;
  heading: RefObject<HTMLHeadingElement | null>;
}) {
  const pending = agenda?.pending ?? [];
  const completed = agenda?.completed ?? [];
  const selectedCompleted = active?.status === 'completed' ? active : undefined;

  return (
    <Card heading="Follow-up schedule">
      <p>Crew and habitat checks in priority order.</p>
      <ActionButton onClick={refresh} disabled={completing || loading}>
        {error ? 'Retry loading schedule' : 'Refresh schedule'}
      </ActionButton>
      <div className="state-feedback" role="status">
        {loading ? <DataState kind="loading">Loading saved checks.</DataState> : null}
        {error ? <DataState kind="error">
          {agenda ? 'Showing the last confirmed schedule. Refresh before linking a reading.' :
            'Could not load the schedule.'}
        </DataState> : null}
        {!loading && !error && agenda && !pending.length ? <DataState kind="empty">No pending checks.</DataState> : null}
      </div>
      <div className="state-feedback" role="status">
        {linkMessage ? <p className={`investigation-message ${linkMessage.error ? 'tone-caution' : 'tone-positive'}`}>{linkMessage.text}</p> : null}
      </div>
      <h3 tabIndex={-1} ref={heading} className="investigation-agenda-heading">
        {active ? `Follow-up for check #${active.id}` : 'Follow-up checks'}
      </h3>
      {selectedCompleted ? (
        <section className="investigation-check-box" aria-label="Selected completion">
          <strong>{metricNames[selectedCompleted.kind]} · {targetName(selectedCompleted.astronaut_id, profiles)}</strong>
          <Details items={[
            { label: 'Status', value: 'Completed' },
            { label: 'Linked measurement', value: `#${selectedCompleted.measurement_id}` },
            { label: 'Completed at', value: selectedCompleted.completed_at ? <UtcTime value={selectedCompleted.completed_at} /> : 'Time unavailable' },
          ]} />
          <p>Reanalyze the same scope to evaluate the new reading.</p>
          <ActionButton disabled={recovering} onClick={() => recover(selectedCompleted.investigation_id)}>
            Open investigation #{selectedCompleted.investigation_id}
          </ActionButton>
        </section>
      ) : null}
      {pending.length ? (
        <ol className="investigation-checks">
          {pending.map(check => (
            <li key={check.id} className="investigation-check-box">
              <h4>{metricNames[check.kind]} · {targetName(check.astronaut_id, profiles)}</h4>
              <div className="badge-row"><span className="ds-badge tone-caution">Pending · #{check.id}</span></div>
              <p>{check.reason}</p>
              <Details items={[
                { label: 'Requested at', value: <UtcTime value={check.created_at} /> },
                { label: 'Due', value: check.due_at ? <UtcTime value={check.due_at} /> : 'No due date' },
              ]} />
              <div className="investigation-actions">
                <ActionButton disabled={recovering} onClick={() => recover(check.investigation_id)}>
                  Open investigation #{check.investigation_id}
                </ActionButton>
                {active?.id !== check.id ? <ActionButton disabled={completing} onClick={() => select(check)}>
                  Select check #{check.id}
                </ActionButton> : null}
              </div>
              {active?.id === check.id ? (
                <MeasurementLinkForm check={check} locked={loading || error || completing} saving={completing} complete={complete} />
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}
      {completed.length ? (
        <details className="investigation-disclosure">
          <summary>Completed checks ({completed.length})</summary>
          <ul className="investigation-checks">
            {[...completed].reverse().map(check => (
              <li key={check.id} className="investigation-check-box">
                <h4>{metricNames[check.kind]} · {targetName(check.astronaut_id, profiles)}</h4>
                <p>Measurement #{check.measurement_id} linked {check.completed_at ? <>at <UtcTime value={check.completed_at} /></> : null}.</p>
                <ActionButton disabled={completing} onClick={() => select(check)}>View completion #{check.id}</ActionButton>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </Card>
  );
}
