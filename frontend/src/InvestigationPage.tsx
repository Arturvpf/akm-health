import { useEffect, useRef, useState, type FormEvent } from 'react';
import { fetchDashboard } from './api';
import { InvestigationAgenda, type Agenda } from './investigation-agenda';
import {
  completeFollowup, InvestigationApiError, readAgenda, readAstronauts, readInvestigation, runInvestigation,
} from './investigation-api';
import { ResultDetails, targetName } from './investigation-result';
import { ActionButton, ActionLink, Card, DataState, ProtocolLegend, SelectField } from './design-system';
import { NasaReferences } from './NasaReferences';
import { pageHref } from './navigation';
import type { FollowupRead, InvestigationRequest, InvestigationResult } from './types';
import './investigation.css';

type Message = { text: string; error?: boolean };
type LinkMessage = Message & { attemptedMeasurementId?: number };
const savedIdKey = 'akm-investigation-id-v1';

function parseId(value: string) {
  const id = Number(value);
  return /^\d+$/.test(value) && Number.isSafeInteger(id) && id > 0 ? id : null;
}

function storedId() {
  try {
    return parseId(sessionStorage.getItem(savedIdKey) ?? '');
  } catch {
    return null;
  }
}

function remember(id: number) {
  try {
    sessionStorage.setItem(savedIdKey, String(id));
  } catch {
    // Recovery by ID and agenda remains available if browser storage is denied.
  }
}

function useRead<T>(read: (signal: AbortSignal) => Promise<T>) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const inFlight = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    inFlight.current = controller;
    read(controller.signal).then(value => {
      if (!controller.signal.aborted) {
        setData(value);
        setLoading(false);
      }
    }).catch(() => {
      if (!controller.signal.aborted) {
        setError(true);
        setLoading(false);
      }
    });
    return () => controller.abort();
  }, [read, revision]);

  function refresh() {
    inFlight.current?.abort();
    setLoading(true);
    setError(false);
    setRevision(current => current + 1);
  }

  return { data, setData, error, loading, refresh };
}

function investigationError(error: unknown, operation: 'run' | 'recover') {
  if (error instanceof InvestigationApiError) {
    if (error.status === 404) return operation === 'run'
      ? 'The selected crew member is unavailable. Refresh the list and select a profile.'
      : 'Investigation not found. Check the number.';
    if (error.status === 422) return operation === 'run'
      ? 'Check the scope and selected crew member before running the investigation.'
      : 'Check the investigation number.';
  }
  return operation === 'run'
    ? 'Could not confirm the investigation. Try again with the same scope.'
    : 'Could not load the investigation. Try again.';
}

function linkError(error: unknown) {
  if (error instanceof InvestigationApiError) {
    if (error.status === 409) return 'The check is already linked to a different measurement. Review the completed check.';
    if (error.status === 404) return 'The check or measurement was not found. Review the schedule and refresh the measurements.';
    if (error.status === 422) {
      switch (error.detail) {
        case 'Measurement does not match followup kind, zone and astronaut':
          return 'Choose a measurement with the same metric, zone, and target.';
        case 'Followup requires a usable measurement':
          return 'Choose a valid reading.';
        case 'Measurement must be recorded after followup creation':
          return 'The measurement must have been recorded after the check was requested.';
        case 'Future measurement cannot complete a followup':
          return 'Choose a reading whose observation and recording times have already passed.';
        default:
          return 'Check the selected measurement and try again.';
      }
    }
  }
  return 'Could not confirm the link. The schedule will be checked before another attempt.';
}

export function InvestigationPage() {
  const profiles = useRead(readAstronauts);
  const agenda = useRead(readAgenda);
  const dashboard = useRead(fetchDashboard);
  const [initialId] = useState(storedId);
  const [scope, setScope] = useState<InvestigationRequest['scope']>('crew');
  const [astronautId, setAstronautId] = useState('');
  const [recoveryId, setRecoveryId] = useState(() => initialId === null ? '' : String(initialId));
  const [invalidId, setInvalidId] = useState(false);
  const [result, setResult] = useState<InvestigationResult>();
  const [operation, setOperation] = useState<'run' | 'recover' | null>(initialId === null ? null : 'recover');
  const [resultMessage, setResultMessage] = useState<Message | null>(null);
  const [selectedCheck, setSelectedCheck] = useState<number>();
  const [completing, setCompleting] = useState(false);
  const [linkMessage, setLinkMessage] = useState<LinkMessage | null>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const checkHeading = useRef<HTMLHeadingElement>(null);
  const recoveryControl = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialId === null) return;
    const controller = new AbortController();
    readInvestigation(initialId, controller.signal).then(value => {
      if (controller.signal.aborted) return;
      setResult(value);
      setScope(value.scope);
      setAstronautId(value.astronaut_id ?? '');
    }).catch(error => {
      if (!controller.signal.aborted) setResultMessage({ text: investigationError(error, 'recover'), error: true });
    }).finally(() => {
      if (!controller.signal.aborted) setOperation(null);
    });
    return () => controller.abort();
  }, [initialId]);

  const people = profiles.data ?? [];
  const hasSelectedAstronaut = people.some(person => person.id === astronautId);
  const sameScope = result?.scope === scope && (scope === 'crew' || result?.astronaut_id === astronautId);
  const findCheck = (id: number | undefined | null) => agenda.data?.completed.find(check => check.id === id)
    ?? agenda.data?.pending.find(check => check.id === id);
  const activeCheck = findCheck(selectedCheck);
  const reconciled = linkMessage?.attemptedMeasurementId !== undefined && activeCheck?.status === 'completed'
    && !agenda.loading && !agenda.error;
  let agendaMessage: Message | null = linkMessage;
  if (reconciled) {
    const measurementId = activeCheck.measurement_id;
    agendaMessage = {
      text: measurementId === linkMessage.attemptedMeasurementId
        ? `The schedule confirmed check #${activeCheck.id} with measurement #${measurementId}.`
        : `The schedule confirmed check #${activeCheck.id} with a different measurement, #${measurementId}.`,
    };
  }

  useEffect(() => {
    if (reconciled) checkHeading.current?.focus();
  }, [reconciled]);

  async function run(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (operation !== null || (scope === 'individual' && !hasSelectedAstronaut)) return;
    setOperation('run');
    setResultMessage(null);
    try {
      const value = await runInvestigation(scope === 'crew' ? { scope } : { scope, astronaut_id: astronautId });
      setResult(value);
      remember(value.id);
      setResultMessage({
        text: value.reused ? `Investigation #${value.id} reused with its original timestamp.`
          : `Investigation #${value.id} complete.`,
      });
      agenda.refresh();
      dashboard.refresh();
    } catch (error) {
      setResultMessage({ text: investigationError(error, 'run'), error: true });
      if (error instanceof InvestigationApiError && error.status === 404) profiles.refresh();
    } finally {
      setOperation(null);
    }
  }

  async function recover(id: number, fromAgenda = false) {
    if (operation !== null) return;
    setOperation('recover');
    setResultMessage(null);
    if (fromAgenda) setRecoveryId(String(id));
    setInvalidId(false);
    if (fromAgenda) resultHeading.current?.focus();
    try {
      const value = await readInvestigation(id);
      setResult(value);
      setScope(value.scope);
      if (value.astronaut_id !== null) setAstronautId(value.astronaut_id);
      remember(value.id);
      setResultMessage({ text: `Investigation #${value.id} retrieved.` });
      agenda.refresh();
    } catch (error) {
      setResultMessage({ text: investigationError(error, 'recover'), error: true });
    } finally {
      setOperation(null);
    }
  }

  function submitRecovery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const id = parseId(recoveryId.trim());
    if (id === null) {
      setInvalidId(true);
      recoveryControl.current?.focus();
      return;
    }
    void recover(id);
  }

  function select(check: FollowupRead) {
    if (completing) return;
    setSelectedCheck(check.id);
    setLinkMessage(null);
    // The heading is stable even while the selected row is updated.
    checkHeading.current?.focus();
  }

  async function complete(measurementId: number) {
    const check = findCheck(selectedCheck);
    if (completing || agenda.loading || agenda.error || check?.status !== 'pending') return;
    setCompleting(true);
    setLinkMessage(null);
    try {
      const completed = await completeFollowup(check.id, measurementId);
      agenda.setData((current): Agenda => ({
        pending: (current?.pending ?? []).filter(item => item.id !== completed.id),
        completed: [...(current?.completed ?? []).filter(item => item.id !== completed.id), completed],
      }));
      setLinkMessage({ text: `Check #${completed.id} completed with measurement #${completed.measurement_id}.` });
      checkHeading.current?.focus();
    } catch (error) {
      setLinkMessage({ text: linkError(error), error: true, attemptedMeasurementId: measurementId });
    } finally {
      agenda.refresh();
      dashboard.refresh();
      setCompleting(false);
    }
  }

  return (
    <div className="investigation-page">
      <Card heading="Run an experimental investigation">
        <form className="investigation-fields" onSubmit={run}>
          <div className="investigation-field-grid">
            <SelectField label="Scope" value={scope} disabled={operation !== null}
              onChange={event => setScope(event.currentTarget.value === 'individual' ? 'individual' : 'crew')}>
              <option value="crew">Crew</option>
              <option value="individual">Individual</option>
            </SelectField>
            {scope === 'individual' ? (
              <SelectField label="Crew member" value={hasSelectedAstronaut ? astronautId : ''}
                disabled={profiles.loading || operation !== null}
                onChange={event => setAstronautId(event.currentTarget.value)}>
                <option value="">Select a crew member</option>
                {people.map(person => <option key={person.id} value={person.id}>{targetName(person.id, people)}</option>)}
              </SelectField>
            ) : null}
          </div>
          <div role="status">
            {profiles.loading ? <p>Loading crew profiles…</p> : null}
            {profiles.error ? <p>Could not refresh the crew list.</p> : null}
            {!profiles.loading && !profiles.error && !people.length ? <p>No crew profiles are available.</p> : null}
            {!dashboard.loading && !dashboard.error && dashboard.data?.has_unanalyzed_measurements ? (
              <p>New mission readings are waiting for investigation.</p>
            ) : null}
          </div>
          <div className="investigation-actions">
            <ActionButton type="submit" aria-disabled={operation !== null || (scope === 'individual' && !hasSelectedAstronaut)}>
              {operation === 'run' ? 'Running investigation…' : sameScope ? 'Reanalyze this scope' : 'Run investigation'}
            </ActionButton>
            {profiles.error ? <ActionButton onClick={profiles.refresh}>Retry loading crew</ActionButton> : null}
          </div>
        </form>
        <details className="investigation-disclosure">
          <summary>Retrieve an investigation by number</summary>
          <form className="investigation-fields" onSubmit={submitRecovery}>
            <label className="ds-field">
              <span>Investigation number</span>
              <input className="ds-control" inputMode="numeric" ref={recoveryControl}
                aria-invalid={invalidId} aria-describedby={invalidId ? 'investigation-invalid-id' : undefined}
                value={recoveryId} onChange={event => { setRecoveryId(event.currentTarget.value); setInvalidId(false); }} />
            </label>
            {invalidId ? <p id="investigation-invalid-id" role="alert">Enter a positive whole number.</p> : null}
            <div><ActionButton type="submit" disabled={operation !== null}>Retrieve result</ActionButton></div>
          </form>
        </details>
      </Card>
      <Card heading="Investigation result">
        <h3 tabIndex={-1} ref={resultHeading}>{result ? 'Last confirmed result' : 'Experimental result'}</h3>
        <div className="state-feedback" role="status">
          {operation !== null ? <DataState kind="loading">
            {operation === 'run' ? 'Waiting for the server to analyze the readings.' : 'Loading the saved investigation.'}
          </DataState> : null}
          {resultMessage ? <p className={`investigation-message ${resultMessage.error ? 'tone-caution' : 'tone-positive'}`}>
            {resultMessage.text}{resultMessage.error && result ? ' The last confirmed result remains below.' : ''}
          </p> : null}
        </div>
        {result ? (
          <ResultDetails result={result} profiles={people} check={findCheck(result.followup_id)} openCheck={select} />
        ) : operation === null ? (
          <>
            <p>Run an experimental investigation or retrieve a saved result.</p>
            <ActionLink href={pageHref('register')}>Add measurement</ActionLink>
          </>
        ) : null}
        <details className="investigation-disclosure">
          <summary>How to interpret the results</summary>
          <ProtocolLegend />
        </details>
      </Card>
      <InvestigationAgenda agenda={agenda.data} loading={agenda.loading} error={agenda.error} refresh={agenda.refresh}
        profiles={people} active={activeCheck} select={select} recover={id => void recover(id, true)}
        completing={completing} complete={id => void complete(id)} linkMessage={agendaMessage}
        recovering={operation !== null} heading={checkHeading} />
      <NasaReferences mission={dashboard.data?.mission} environment={dashboard.data?.environment} />
    </div>
  );
}
