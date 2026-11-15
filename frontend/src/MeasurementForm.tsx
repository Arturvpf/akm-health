import { useEffect, useRef, useState, type FormEvent } from 'react';
import { METRIC_LABELS } from './api';
import { createDashboardController, INITIAL_DASHBOARD_STATE } from './dashboard-state';
import { ActionButton, ActionLink, Card, DataState, Details, InformationNotice, SourceBadge } from './design-system';
import { createRegistrationController, INITIAL_REGISTRATION, type RegistrationState } from './measurement-api';
import { EMPTY_DRAFT, FORM_METRICS, measurementTime, validateDraft, type FieldErrors, type MeasurementDraft } from './measurement-form';
import type { DashboardState } from './dashboard-state';
import type { Kind } from './types';

export function MeasurementForm() {
  const [context, setContext] = useState(INITIAL_DASHBOARD_STATE);
  const [registration, setRegistration] = useState(INITIAL_REGISTRATION);
  const [draft, setDraft] = useState<MeasurementDraft>(() => {
    try { return { ...EMPTY_DRAFT, ...JSON.parse(localStorage.getItem('akm-measurement-draft-v1') ?? '{}') }; }
    catch { return { ...EMPTY_DRAFT }; }
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  useEffect(() => {
    try { localStorage.setItem('akm-measurement-draft-v1', JSON.stringify(draft)); } catch { /* storage may be denied */ }
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
    onNew={() => { setDraft({ ...EMPTY_DRAFT, kind: draft.kind }); setErrors({}); registrationController.current?.reset(); }} />;
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
    <InformationNotice label="Registro experimental">
      Missão e tripulação fictícias, sem sensores conectados. Registre somente dados da demonstração. Ausência de informação não é zero.
    </InformationNotice>
    <div className="dashboard-toolbar">
      <p>{context.data ? `${context.data.mission.name} · Destino: Marte · Habitat interno` : 'Consultando o contexto da missão na API local.'}</p>
      <ActionButton onClick={onRefresh} disabled={context.phase === 'loading' || busy}>Atualizar missão e tripulação</ActionButton>
    </div>
    <div role="status">
      {context.phase === 'loading' && <DataState kind="loading">Carregando missão e tripulação. O formulário permanece preservado.</DataState>}
      {context.phase === 'error' && <DataState kind="error">{context.error} {context.data ? 'O contexto exibido pode estar desatualizado.' : 'O envio estará disponível após carregar a missão.'} Atualize para tentar novamente. Um registro já confirmado permanece salvo.</DataState>}
      {ready && !context.data?.astronauts.length && <DataState kind="empty">Nenhum tripulante cadastrado. As medições do habitat continuam disponíveis; as pessoais exigem um perfil retornado pela API.</DataState>}
    </div>
    <div ref={feedback} tabIndex={-1} className="registration-feedback" role={registration.error ? 'alert' : 'status'}>
      {busy && <DataState kind="loading">Salvando uma medição. Aguarde a confirmação antes de sair desta tela.</DataState>}
      {registration.error && (registration.phase === 'queued' ? <DataState kind="loading">{registration.error}</DataState> : <DataState kind="error">{registration.error}</DataState>)}
      {registration.phase === 'queued' && <div className="status-actions">
        <p>O registro está no dispositivo, não confirmado no servidor. A barra de sincronização mostrará pendências e conflitos. Não registre novamente a mesma leitura.</p>
        <ActionButton onClick={onNew}>Registrar outra medição</ActionButton>
      </div>}
      {registration.phase === 'uncertain' && <div className="status-actions">
        <ActionLink href="#/historico" target="_blank" rel="noopener noreferrer">Conferir histórico em nova aba</ActionLink>
        <ActionButton onClick={onUnlock}>Conferi o histórico: a medição não consta; liberar envio</ActionButton>
        <p>O envio anterior pode ter sido salvo. Reenviar sem conferir pode criar uma duplicata. Os campos estão preservados.</p>
      </div>}
      {receipt && <Card heading={`Medição #${receipt.id} confirmada`}>
        <div className="badge-row"><SourceBadge source={receipt.source} /></div>
        <Details items={[
          { label: 'Indicador', value: `${METRIC_LABELS[receipt.kind]} · ${receipt.value.toLocaleString('pt-BR')} ${FORM_METRICS[receipt.kind].displayUnit}` },
          { label: 'Alvo', value: receipt.astronaut_id ? `${context.data?.astronauts.find(person => person.id === receipt.astronaut_id)?.name ?? receipt.astronaut_id} · ${receipt.astronaut_id}` : 'Habitat · ar interno' },
          { label: 'Momento medido (UTC)', value: <time dateTime={receipt.measured_at}>{receipt.measured_at}</time> },
          { label: 'Cadastro no servidor (UTC)', value: <time dateTime={receipt.recorded_at}>{receipt.recorded_at}</time> },
          { label: 'Qualidade técnica', value: receipt.quality === 'suspect' ? 'Suspeita — confira instrumento, unidade e horário antes de uma nova leitura.' : 'Aproveitável tecnicamente — não significa saúde normal.' },
        ]} />
        <p>A medição foi salva. A investigação e as verificações pendentes não foram executadas ou concluídas automaticamente. Novas medições disponíveis — atualizar investigação.</p>
        <p>Registros salvos não podem ser editados nesta versão. Confira o histórico antes de registrar uma nova observação.</p>
        <div className="badge-row"><ActionLink href="#/dashboard">Ver dashboard atualizado</ActionLink><ActionLink href="#/historico">Consultar histórico</ActionLink><ActionLink href="#/investigacao">Ir para investigação</ActionLink><ActionButton onClick={onNew}>Registrar outra medição</ActionButton></div>
      </Card>}
    </div>
    {!receipt && <div className="measurement-grid">
      <Card heading="Dados da medição">
        <form ref={form} noValidate onSubmit={onSubmit} aria-busy={busy}>
          <fieldset disabled={locked || !ready} className="measurement-fields">
            <legend>Preencha os campos obrigatórios</legend>
            <label className="ds-field" htmlFor="measurement-kind">Indicador
              <select className="ds-control" {...fields('kind')} value={draft.kind} onChange={event => onChange('kind', event.target.value as Kind)}>
                {(Object.keys(FORM_METRICS) as Kind[]).map(kind => <option value={kind} key={kind}>{METRIC_LABELS[kind]}</option>)}
              </select>{error('kind')}
            </label>
            <p className="measurement-zone">Zona automática: <strong>{metric.zone === 'habitat' ? 'Habitat · ar interno da cabine' : 'Astronauta · medição individual'}</strong></p>
            {metric.zone === 'astronaut' && <label className="ds-field" htmlFor="measurement-astronaut">Tripulante
              <select className="ds-control" {...fields('astronaut')} required value={draft.astronaut} onChange={event => onChange('astronaut', event.target.value)}>
                <option value="">Selecione um tripulante</option>
                {context.data?.astronauts.map(person => <option key={person.id} value={person.id}>{person.name} · {person.id}</option>)}
              </select>{error('astronaut')}
            </label>}
            <label className="ds-field" htmlFor="measurement-value">{draft.kind === 'mood_score' ? 'Bem-estar emocional' : 'Valor'} ({metric.displayUnit})
              {draft.kind === 'mood_score' ? <select className="ds-control" {...fields('value', 'measurement-instructions')} required value={draft.value} onChange={event => onChange('value', event.target.value)}>
                <option value="">Selecione uma opção</option>{['Muito ruim', 'Ruim', 'Neutro', 'Bom', 'Muito bom'].map((label, index) => <option value={index + 1} key={label}>{index + 1} — {label}</option>)}
              </select> : <input className="ds-control" {...fields('value', 'measurement-instructions')} required type="text" inputMode="decimal" autoComplete="off" value={draft.value} onChange={event => onChange('value', event.target.value)} />}
              {error('value')}
            </label>
            <div className="measurement-time-grid">
              <label className="ds-field" htmlFor="measurement-localTime">Data e hora {draft.kind === 'sleep_hours' ? 'ao acordar' : 'da leitura'}
                <input className="ds-control" {...fields('localTime', 'measurement-time-help')} required type="datetime-local" step="1" value={draft.localTime} onChange={event => onChange('localTime', event.target.value)} />{error('localTime')}
              </label>
              <label className="ds-field" htmlFor="measurement-offset">Fuso em relação a UTC
                <input className="ds-control" {...fields('offset', 'measurement-time-help')} required type="text" placeholder="-03:00" value={draft.offset} onChange={event => onChange('offset', event.target.value)} />{error('offset')}
              </label>
            </div>
            <p id="measurement-time-help">Informe o fuso da leitura: +00:00 é UTC; -03:00 é UTC−3. O horário será convertido para UTC.{stamp && <> Envio: <time dateTime={stamp}>{stamp}</time>.</>}</p>
            <label className="ds-field" htmlFor="measurement-source">Origem
              <select className="ds-control" {...fields('source')} value={draft.source} onChange={event => onChange('source', event.target.value as MeasurementDraft['source'])}>
                <option value="manual">Registro manual da demonstração</option><option value="synthetic">Dado simulado</option>
              </select>{error('source')}
            </label>
            <label className="ds-field" htmlFor="measurement-quality">Qualidade técnica
              <select className="ds-control" {...fields('quality', 'measurement-quality-help')} value={draft.quality} onChange={event => onChange('quality', event.target.value as MeasurementDraft['quality'])}>
                <option value="ok">Aproveitável tecnicamente</option><option value="suspect">Suspeita / leitura instável</option>
              </select>{error('quality')}
            </label>
            <p id="measurement-quality-help">Qualidade descreve a leitura, sem avaliar saúde. Leituras suspeitas ficam registradas, com limitação de uso na investigação.</p>
          </fieldset>
          <button className="ds-action ds-action-primary" type="submit" disabled={locked || !ready || registration.missingAstronaut || (metric.zone === 'astronaut' && !context.data?.astronauts.length)}>Salvar medição</button>
        </form>
      </Card>
      <Card heading="Como registrar">
        <section id="measurement-instructions" aria-live="polite"><h3>{METRIC_LABELS[draft.kind]} · {metric.displayUnit}</h3><p>{metric.instruction}</p><p>{metric.limit}</p></section>
        <ol className="measurement-steps"><li>Confira o indicador e o alvo.</li><li>Informe a leitura, o momento medido e o fuso.</li><li>Identifique origem e qualidade; revise antes de salvar.</li><li>Aguarde o número do registro confirmado.</li></ol>
        <p>O rascunho é preservado neste navegador. O envio usa uma fila local com ID estável, segura contra repetição de rede. A API não permite editar medições salvas.</p>
        <p>Referências NASA são contexto educativo. Dados históricos NASA pertencem à área de referências e não devem ser cadastrados como leitura desta missão.</p>
        <p><a href={metric.url}>Fonte contextual NASA · {metric.id}</a></p>
      </Card>
    </div>}
  </div>;
}
