import { useEffect, useRef, useState, type FormEvent } from 'react';
import { METRIC_LABELS } from './api';
import { createDashboardController, INITIAL_DASHBOARD_STATE } from './dashboard-state';
import { ActionButton, ActionLink, Card, DataState, Details, InformationNotice, SourceBadge } from './design-system';
import { createRegistrationController, INITIAL_REGISTRATION, type RegistrationState } from './measurement-api';
import { DRAFT_STORAGE_KEY, EMPTY_DRAFT, draftAfterSubmission, FORM_METRICS, measurementTime, validateDraft, type FieldErrors, type MeasurementDraft } from './measurement-form';
import type { DashboardState } from './dashboard-state';
import type { Kind } from './types';

export function MeasurementForm() {
  const [context, setContext] = useState(INITIAL_DASHBOARD_STATE);
  const [registration, setRegistration] = useState(INITIAL_REGISTRATION);
  const [draft, setDraft] = useState<MeasurementDraft>(() => {
    try { return { ...EMPTY_DRAFT, ...JSON.parse(localStorage.getItem(DRAFT_STORAGE_KEY) ?? '{}') }; }
    catch { return { ...EMPTY_DRAFT }; }
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  useEffect(() => {
    try { localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft)); } catch { /* storage may be denied */ }
  }, [draft]);
  const contextController = useRef<ReturnType<typeof createDashboardController> | null>(null);
  const registrationController = useRef<ReturnType<typeof createRegistrationController> | null>(null);
  useEffect(() => {
    const context = createDashboardController();
    const registration = createRegistrationController();
    contextController.current = context; registrationController.current = registration;
    const stopContext = context.subscribe(setContext);
    const stopRegistration = registration.subscribe(setRegistration);
    void context.refresh();
    return () => { stopContext(); stopRegistration(); context.dispose(); registration.dispose(); };
  }, []);
  useEffect(() => {
    if (registration.phase === 'saved') void contextController.current?.refresh();
    if (registration.phase === 'saved' || registration.phase === 'queued') setDraft(draftAfterSubmission);
  }, [registration.phase]);
  function change<K extends keyof MeasurementDraft>(field: K, value: MeasurementDraft[K]) {
    setDraft(previous => ({ ...previous, [field]: value, ...(field === 'kind' ? { value: '' } : {}) }));
    setErrors({});
    if (registration.phase === 'error' && !registration.missingAstronaut) registrationController.current?.reset();
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!context.data || context.phase !== 'ready' || registration.missingAstronaut) return;
    const result = validateDraft(draft, context.data.astronauts.map(person => person.id));
    setErrors(result.errors);
    if (!result.payload) return;
    void registrationController.current?.submit(result.payload);
  }
  function refresh() {
    if (registration.missingAstronaut) {
      setDraft(previous => ({ ...previous, astronaut: '' }));
      registrationController.current?.reset();
    }
    void contextController.current?.refresh();
  }
  return <MeasurementFormView context={context} registration={registration} draft={draft}
    errors={{ ...registration.fields, ...errors }} onChange={change} onSubmit={submit} onRefresh={refresh}
    onUnlock={() => registrationController.current?.reset()}
    onNew={() => { setDraft(draftAfterSubmission(draft)); setErrors({}); registrationController.current?.reset(); }} />;
}

interface Props {
  context: DashboardState; registration: RegistrationState; draft: MeasurementDraft; errors: FieldErrors;
  onChange: <K extends keyof MeasurementDraft>(field: K, value: MeasurementDraft[K]) => void;
  onSubmit: (event: FormEvent) => void; onRefresh: () => void; onUnlock: () => void; onNew: () => void;
}

export function MeasurementFormView({ context, registration, draft, errors, onChange, onSubmit, onRefresh, onUnlock, onNew }: Props) {
  const feedback = useRef<HTMLDivElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const previousPhase = useRef(registration.phase);
  useEffect(() => {
    if (Object.keys(errors).length) form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    else if (registration.phase !== previousPhase.current && ['saved', 'error', 'uncertain', 'queued'].includes(registration.phase)) feedback.current?.focus();
    previousPhase.current = registration.phase;
  }, [errors, registration.phase]);
  const metric = FORM_METRICS[draft.kind];
  const busy = registration.phase === 'saving';
  const locked = busy || registration.phase === 'uncertain' || registration.phase === 'queued';
  const ready = context.phase === 'ready' && context.data !== null;
  const fields = (field: keyof MeasurementDraft, description?: string) => ({
    id: `measurement-${field}`, 'aria-invalid': errors[field] ? true as const : undefined,
    'aria-describedby': [description, errors[field] ? `error-${field}` : null].filter(Boolean).join(' ') || undefined,
  });
  const error = (field: keyof MeasurementDraft) => errors[field] ? <span className="form-error" id={`error-${field}`}>{errors[field]}</span> : null;
  const receipt = registration.receipt;
  const stamp = measurementTime(draft.localTime, draft.offset);
  return <div className="measurement-page">
    <InformationNotice label="Experimental registration">
      Enter readings for the simulated mission only. Leave missing readings blank.
    </InformationNotice>
    <div className="dashboard-toolbar">
      <p>{context.data ? `${context.data.mission.name} · Destination: Mars · Cabin` : 'Loading mission information.'}</p>
      <ActionButton onClick={onRefresh} disabled={context.phase === 'loading' || busy}>Refresh mission and crew</ActionButton>
    </div>
    <div role="status">
      {context.phase === 'loading' && <DataState kind="loading">Loading mission and crew. Your draft remains available.</DataState>}
      {context.phase === 'error' && <DataState kind="error">{context.error} {context.data ? 'Mission information may be out of date.' : 'You can submit once mission data loads.'} Refresh to try again. Confirmed readings remain saved.</DataState>}
      {ready && !context.data?.astronauts.length && <DataState kind="empty">No crew profiles are available. You can still register cabin readings.</DataState>}
    </div>
    <div ref={feedback} tabIndex={-1} className="registration-feedback" role={registration.error ? 'alert' : 'status'}>
      {busy && <DataState kind="loading">Saving measurement. Wait for confirmation before leaving this page.</DataState>}
      {registration.error && (registration.phase === 'queued' ? <DataState kind="loading">{registration.error}</DataState> : <DataState kind="error">{registration.error}</DataState>)}
      {registration.phase === 'queued' && <div className="status-actions">
        <p>The reading is stored on this device but not yet confirmed by the server. The sync bar shows pending items and conflicts. Do not register the same reading again.</p>
        <ActionButton onClick={onNew}>Register another measurement</ActionButton>
      </div>}
      {registration.phase === 'uncertain' && <div className="status-actions">
        <ActionLink href="#/history" target="_blank" rel="noopener noreferrer">Check History in a new tab</ActionLink>
        <ActionButton onClick={onUnlock}>I checked History and the reading is missing. Enable resubmission.</ActionButton>
        <p>The previous attempt may have saved the reading. Check History before resubmitting to avoid a duplicate. Your draft remains available.</p>
      </div>}
      {receipt && <Card heading={`Measurement #${receipt.id} confirmed`}>
        <div className="badge-row"><SourceBadge source={receipt.source} /></div>
        <Details items={[
          { label: 'Metric', value: `${METRIC_LABELS[receipt.kind]} · ${receipt.value.toLocaleString('en-US')} ${FORM_METRICS[receipt.kind].displayUnit}` },
          { label: 'Target', value: receipt.astronaut_id ? `${context.data?.astronauts.find(person => person.id === receipt.astronaut_id)?.name ?? receipt.astronaut_id} · ${receipt.astronaut_id}` : 'Habitat · cabin air' },
          { label: 'Observed (UTC)', value: <time dateTime={receipt.measured_at}>{receipt.measured_at}</time> },
          { label: 'Recorded by server (UTC)', value: <time dateTime={receipt.recorded_at}>{receipt.recorded_at}</time> },
          { label: 'Technical quality', value: receipt.quality === 'suspect' ? 'Suspect — check the instrument, unit, and timestamp before collecting another reading.' : 'Valid for analysis. Quality describes the reading only.' },
        ]} />
        <p>Measurement saved. Run an investigation to analyze it. Pending checks require a separate confirmation.</p>
        <p>Review saved readings in History before registering another observation.</p>
        <div className="badge-row"><ActionLink href="#/dashboard">View updated Dashboard</ActionLink><ActionLink href="#/history">View History</ActionLink><ActionLink href="#/investigation">Go to Investigation</ActionLink><ActionButton onClick={onNew}>Register another measurement</ActionButton></div>
      </Card>}
    </div>
    {!receipt && <div className="measurement-grid">
      <Card heading="Measurement details">
        <form ref={form} noValidate onSubmit={onSubmit} aria-busy={busy}>
          <fieldset disabled={locked || !ready} className="measurement-fields">
            <legend>Complete the required fields</legend>
            <label className="ds-field" htmlFor="measurement-kind">Metric
              <select className="ds-control" {...fields('kind')} value={draft.kind} onChange={event => onChange('kind', event.target.value as Kind)}>
                {(Object.keys(FORM_METRICS) as Kind[]).map(kind => <option value={kind} key={kind}>{METRIC_LABELS[kind]}</option>)}
              </select>{error('kind')}
            </label>
            <p className="measurement-zone">Measurement zone: <strong>{metric.zone === 'habitat' ? 'Habitat · cabin air' : 'Astronaut · individual reading'}</strong></p>
            {metric.zone === 'astronaut' && <label className="ds-field" htmlFor="measurement-astronaut">Crew member
              <select className="ds-control" {...fields('astronaut')} required value={draft.astronaut} onChange={event => onChange('astronaut', event.target.value)}>
                <option value="">Select a crew member</option>
                {context.data?.astronauts.map(person => <option key={person.id} value={person.id}>{person.name} · {person.id}</option>)}
              </select>{error('astronaut')}
            </label>}
            <label className="ds-field" htmlFor="measurement-value">{draft.kind === 'mood_score' ? 'Emotional well-being' : 'Value'} ({metric.displayUnit})
              {draft.kind === 'mood_score' ? <select className="ds-control" {...fields('value', 'measurement-instructions')} required value={draft.value} onChange={event => onChange('value', event.target.value)}>
                <option value="">Select an option</option>{['Very poor', 'Poor', 'Neutral', 'Good', 'Very good'].map((label, index) => <option value={index + 1} key={label}>{index + 1} — {label}</option>)}
              </select> : <input className="ds-control" {...fields('value', 'measurement-instructions')} required type="text" inputMode="decimal" autoComplete="off" value={draft.value} onChange={event => onChange('value', event.target.value)} />}
              {error('value')}
            </label>
            <div className="measurement-time-grid">
              <label className="ds-field" htmlFor="measurement-localTime">{draft.kind === 'sleep_hours' ? 'Wake-up date and time' : 'Observation date and time'}
                <input className="ds-control" {...fields('localTime', 'measurement-time-help')} required type="datetime-local" step="1" value={draft.localTime} onChange={event => onChange('localTime', event.target.value)} />{error('localTime')}
              </label>
              <label className="ds-field" htmlFor="measurement-offset">UTC offset
                <input className="ds-control" {...fields('offset', 'measurement-time-help')} required type="text" placeholder="-03:00" value={draft.offset} onChange={event => onChange('offset', event.target.value)} />{error('offset')}
              </label>
            </div>
            <p id="measurement-time-help">Enter the UTC offset, such as +00:00 or -03:00. The app converts the timestamp to UTC.{stamp && <> UTC timestamp: <time dateTime={stamp}>{stamp}</time>.</>}</p>
            <label className="ds-field" htmlFor="measurement-source">Source
              <select className="ds-control" {...fields('source')} value={draft.source} onChange={event => onChange('source', event.target.value as MeasurementDraft['source'])}>
                <option value="manual">Manual demo entry</option><option value="synthetic">Simulated data</option>
              </select>{error('source')}
            </label>
            <label className="ds-field" htmlFor="measurement-quality">Technical quality
              <select className="ds-control" {...fields('quality', 'measurement-quality-help')} value={draft.quality} onChange={event => onChange('quality', event.target.value as MeasurementDraft['quality'])}>
                <option value="ok">Valid for analysis</option><option value="suspect">Suspect / unstable reading</option>
              </select>{error('quality')}
            </label>
            <p id="measurement-quality-help">Quality describes the reading. Suspect readings stay in History and are excluded from investigation evidence.</p>
          </fieldset>
          <button className="ds-action ds-action-primary" type="submit" disabled={locked || !ready || registration.missingAstronaut || (metric.zone === 'astronaut' && !context.data?.astronauts.length)}>Save measurement</button>
        </form>
      </Card>
      <Card heading="How to record">
        <section id="measurement-instructions" aria-live="polite"><h3>{METRIC_LABELS[draft.kind]} · {metric.displayUnit}</h3><p>{metric.instruction}</p><p>{metric.limit}</p></section>
        <ol className="measurement-steps"><li>Check the metric and target.</li><li>Enter the reading, observation time, and UTC offset.</li><li>Select the source and quality. Review the details before saving.</li><li>Wait for the measurement confirmation number.</li></ol>
        <p>Your draft is kept in this browser. Submissions use a local queue with a stable ID, so network retries do not create duplicates. Saved measurements are read-only.</p>
        <p>Find historical NASA data in the NASA references section.</p>
        <p><a href={metric.url}>NASA reference · {metric.id}</a></p>
      </Card>
    </div>}
  </div>;
}
