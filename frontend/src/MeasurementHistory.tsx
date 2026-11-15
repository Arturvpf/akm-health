import { type FormEvent, memo, useCallback, useEffect, useRef, useState } from 'react';
import { ActionButton, ActionLink, Card, DataState, SelectField } from './design-system';
import { CREW_KINDS, HABITAT_KINDS, type HistoryFilters, METRICS, readHistory, readProfiles } from './history-data';
import { HistoryTrend } from './HistoryTrend';
import { pageHref } from './navigation';
import type { AstronautRead, Kind, MeasurementRead } from './types';
import './history.css';

type LoadResult<T> = { status: 'loading' | 'error' } | { status: 'ready'; data: T[] };

function useHistoryRequest<T>(load: (signal: AbortSignal) => Promise<T[]>) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<LoadResult<T>>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal).then(
      data => { if (!controller.signal.aborted) setResult({ status: 'ready', data }); },
      () => { if (!controller.signal.aborted) setResult({ status: 'error' }); },
    );
    return () => controller.abort();
  }, [attempt, load]);

  function retry() {
    setResult({ status: 'loading' });
    setAttempt(previous => previous + 1);
  }

  return { result, retry };
}

const HistoryResults = memo(function HistoryResults({ filters, profile, onRetry }: {
  filters: HistoryFilters;
  profile: AstronautRead | undefined;
  onRetry: () => void;
}) {
  const load = useCallback((signal: AbortSignal) => readHistory(filters, signal), [filters]);
  const { result, retry } = useHistoryRequest(load);
  const target = profile ? `${profile.name} · ${profile.id}` : 'Habitat';
  const metric = METRICS[filters.kind].label;
  const baseline = filters.kind === 'sleep_hours' ? profile?.baseline_sleep_hours ?? null : null;
  const rows = result.status === 'ready' ? result.data : [];

  return (
    <>
      <div className="state-feedback" role="status">
        {result.status === 'loading' && <DataState kind="loading">Loading measurements for {metric} · {target}.</DataState>}
        {result.status === 'error' && <DataState kind="error">Could not load measurements for {metric} · {target}.</DataState>}
        {result.status === 'ready' && rows.length === 0 && (
          <DataState kind="empty">No {metric} readings for {target} in this period.</DataState>
        )}
        {rows.length > 0 && <p className="sr-only">{rows.length} measurements loaded for {metric} · {target}.</p>}
      </div>
      {result.status === 'error' && (
        <div className="status-actions">
          <ActionButton onClick={() => { onRetry(); retry(); }}>Try again</ActionButton>
        </div>
      )}
      {result.status === 'ready' && rows.length === 0 && (
        <div className="status-actions"><ActionLink href={pageHref('register')}>Go to Register</ActionLink></div>
      )}
      {rows[0] && (
        <HistoryTrend rows={rows as [MeasurementRead, ...MeasurementRead[]]} filters={filters} target={target} baseline={baseline} />
      )}
    </>
  );
});

function HistoryQuery({ profiles }: { profiles: AstronautRead[] }) {
  const [filters, setFilters] = useState<HistoryFilters>(() => ({
    astronautId: profiles[0]?.id ?? null,
    kind: profiles.length ? 'sleep_hours' : 'co2_ppm',
    start: '',
    end: '',
  }));
  const [draft, setDraft] = useState(filters);
  const [periodError, setPeriodError] = useState(false);
  const [revision, setRevision] = useState(0);
  const submitButton = useRef<HTMLButtonElement>(null);
  const endDate = useRef<HTMLInputElement>(null);
  const focusSubmit = useCallback(() => submitButton.current?.focus(), []);
  const kinds: readonly Kind[] = draft.astronautId === null ? HABITAT_KINDS : CREW_KINDS;
  const hasPendingChanges = draft.astronautId !== filters.astronautId || draft.kind !== filters.kind
    || draft.start !== filters.start || draft.end !== filters.end;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (draft.start && draft.end && draft.start > draft.end) {
      setPeriodError(true);
      endDate.current?.focus();
      return;
    }
    setFilters(draft);
    setRevision(previous => previous + 1);
  }

  return (
    <>
      <form onSubmit={submit} className="history-filters" aria-label="History filters">
        <SelectField label="Measurement target" value={draft.astronautId === null ? 'habitat' : `crew:${draft.astronautId}`}
          onChange={event => {
            const value = event.currentTarget.value;
            const astronautId = value === 'habitat' ? null : value.slice('crew:'.length);
            const changesZone = (draft.astronautId === null) !== (astronautId === null);
            setDraft({ ...draft, astronautId, kind: changesZone ? (astronautId === null ? 'co2_ppm' : 'sleep_hours') : draft.kind });
          }}>
          {profiles.map(profile => (
            <option key={profile.id} value={`crew:${profile.id}`}>{profile.name} · {profile.id}</option>
          ))}
          <option value="habitat">Habitat</option>
        </SelectField>
        <SelectField label="Metric" value={draft.kind}
          onChange={event => {
            const kind = kinds.find(value => value === event.currentTarget.value);
            if (kind) setDraft({ ...draft, kind });
          }}>
          {kinds.map(kind => <option key={kind} value={kind}>{METRICS[kind].label} ({METRICS[kind].unit})</option>)}
        </SelectField>
        <label className="ds-field">
          Start (UTC)
          <input className="ds-control" type="date" min="0001-01-01" max="9999-12-31" value={draft.start}
            aria-describedby="history-period-help"
            onChange={event => { setDraft({ ...draft, start: event.currentTarget.value }); setPeriodError(false); }} />
        </label>
        <label className="ds-field">
          End (UTC)
          <input className="ds-control" ref={endDate} type="date" min="0001-01-01" max="9999-12-31" value={draft.end}
            aria-invalid={periodError || undefined} aria-describedby={periodError ? 'history-period-error' : 'history-period-help'}
            onChange={event => { setDraft({ ...draft, end: event.currentTarget.value }); setPeriodError(false); }} />
        </label>
        <p id="history-period-help">Dates are optional. The full start and end dates are included in UTC.</p>
        {periodError && <p role="alert" id="history-period-error">The end date must be on or after the start date.</p>}
        <button ref={submitButton} type="submit" className="ds-action ds-action-primary">Apply filters</button>
        {hasPendingChanges && <p>Results reflect the last applied filters.</p>}
      </form>
      <HistoryResults key={revision} filters={filters} profile={profiles.find(profile => profile.id === filters.astronautId)}
        onRetry={focusSubmit} />
    </>
  );
}

export function MeasurementHistory() {
  const { result, retry } = useHistoryRequest(readProfiles);
  const retryFocus = useRef<HTMLDivElement>(null);

  return (
    <Card heading="Find measurements">
      <div className="history-route">
        <div className="state-feedback" tabIndex={-1} ref={retryFocus}>
          <div role="status">
            {result.status === 'loading' && <DataState kind="loading">Loading crew profiles.</DataState>}
            {result.status === 'error' && <DataState kind="error">Could not load crew profiles.</DataState>}
          </div>
        </div>
        {result.status === 'error' && (
          <div className="status-actions">
            <ActionButton onClick={() => { retryFocus.current?.focus(); retry(); }}>Try again</ActionButton>
          </div>
        )}
        {result.status === 'ready' && <HistoryQuery profiles={result.data} />}
      </div>
    </Card>
  );
}
