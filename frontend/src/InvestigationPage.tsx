import { useEffect, useRef, useState, type FormEvent } from 'react';
import { fetchDashboard } from './api';
import { InvestigationAgenda, type Agenda } from './investigation-agenda';
import {
  completeFollowup, InvestigationApiError, readAgenda, readAstronauts, readInvestigation, runInvestigation,
} from './investigation-api';
import { ResultDetails, targetName } from './investigation-result';
import { ActionButton, ActionLink, Card, DataState, ProtocolLegend, SelectField } from './design-system';
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
      ? 'O tripulante selecionado não está disponível. Atualize a lista e escolha um perfil.'
      : 'Investigação não encontrada. Confira o número informado.';
    if (error.status === 422) return operation === 'run'
      ? 'Confira o escopo e o tripulante antes de executar.'
      : 'Confira o número da investigação.';
  }
  return operation === 'run'
    ? 'Não foi possível confirmar a execução. Tente novamente com o mesmo escopo.'
    : 'Não foi possível carregar a investigação. Tente recuperar novamente.';
}

function linkError(error: unknown) {
  if (error instanceof InvestigationApiError) {
    if (error.status === 409) return 'A checagem já tem outro vínculo. Consulte a conclusão atual na agenda.';
    if (error.status === 404) return 'A checagem ou a medição não foi encontrada. Confira a agenda e atualize as medições.';
    if (error.status === 422) {
      switch (error.detail) {
        case 'Measurement does not match followup kind, zone and astronaut':
          return 'Escolha uma medição do mesmo indicador, zona e alvo da checagem.';
        case 'Followup requires a usable measurement':
          return 'Escolha uma medição com qualidade válida.';
        case 'Measurement must be recorded after followup creation':
          return 'O cadastro da medição precisa ser posterior à solicitação.';
        case 'Future measurement cannot complete a followup':
          return 'A coleta e o cadastro precisam estar no passado ou no horário atual.';
        default:
          return 'Confira a medição selecionada e tente novamente.';
      }
    }
  }
  return 'Não foi possível confirmar o vínculo. A agenda será consultada antes de outra tentativa.';
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
        ? `A agenda confirmou a conclusão da checagem #${activeCheck.id} com a medição #${measurementId}.`
        : `A agenda confirmou a conclusão da checagem #${activeCheck.id} com outra medição, #${measurementId}.`,
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
        text: value.reused ? `Investigação #${value.id} reutilizada. O horário original foi preservado.`
          : `Investigação #${value.id} concluída.`,
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
      setResultMessage({ text: `Investigação #${value.id} recuperada.` });
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
      setLinkMessage({ text: `Checagem #${completed.id} concluída com a medição #${completed.measurement_id}.` });
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
      <Card heading="Executar investigação experimental">
        <form className="investigation-fields" onSubmit={run}>
          <div className="investigation-field-grid">
            <SelectField label="Escopo" value={scope} disabled={operation !== null}
              onChange={event => setScope(event.currentTarget.value === 'individual' ? 'individual' : 'crew')}>
              <option value="crew">Tripulação (coletivo)</option>
              <option value="individual">Individual</option>
            </SelectField>
            {scope === 'individual' ? (
              <SelectField label="Tripulante" value={hasSelectedAstronaut ? astronautId : ''}
                disabled={profiles.loading || operation !== null}
                onChange={event => setAstronautId(event.currentTarget.value)}>
                <option value="">Selecione um tripulante</option>
                {people.map(person => <option key={person.id} value={person.id}>{targetName(person.id, people)}</option>)}
              </SelectField>
            ) : null}
          </div>
          <div role="status">
            {profiles.loading ? <p>Carregando os perfis da missão…</p> : null}
            {profiles.error ? <p>Não foi possível atualizar a lista de tripulantes.</p> : null}
            {!profiles.loading && !profiles.error && !people.length ? <p>Nenhum perfil cadastrado na missão.</p> : null}
            {!dashboard.loading && !dashboard.error && dashboard.data?.has_unanalyzed_measurements ? (
              <p>Há medições novas na missão aguardando investigação.</p>
            ) : null}
          </div>
          <div className="investigation-actions">
            <ActionButton type="submit" aria-disabled={operation !== null || (scope === 'individual' && !hasSelectedAstronaut)}>
              {operation === 'run' ? 'Investigando…' : sameScope ? 'Reanalisar este escopo' : 'Executar investigação'}
            </ActionButton>
            {profiles.error ? <ActionButton onClick={profiles.refresh}>Tentar carregar tripulantes novamente</ActionButton> : null}
          </div>
        </form>
        <details className="investigation-disclosure">
          <summary>Recuperar investigação por número</summary>
          <form className="investigation-fields" onSubmit={submitRecovery}>
            <label className="ds-field">
              <span>Número da investigação</span>
              <input className="ds-control" inputMode="numeric" ref={recoveryControl}
                aria-invalid={invalidId} aria-describedby={invalidId ? 'investigation-invalid-id' : undefined}
                value={recoveryId} onChange={event => { setRecoveryId(event.currentTarget.value); setInvalidId(false); }} />
            </label>
            {invalidId ? <p id="investigation-invalid-id" role="alert">Informe um número inteiro positivo válido.</p> : null}
            <div><ActionButton type="submit" disabled={operation !== null}>Recuperar resultado</ActionButton></div>
          </form>
        </details>
      </Card>
      <Card heading="Resultado da investigação">
        <h3 tabIndex={-1} ref={resultHeading}>{result ? 'Último resultado confirmado exibido' : 'Resultado experimental'}</h3>
        <div className="state-feedback" role="status">
          {operation !== null ? <DataState kind="loading">
            {operation === 'run' ? 'Aguardando a análise do servidor.' : 'Consultando a investigação salva.'}
          </DataState> : null}
          {resultMessage ? <p className={`investigation-message ${resultMessage.error ? 'tone-caution' : 'tone-positive'}`}>
            {resultMessage.text}{resultMessage.error && result ? ' O resultado confirmado permanece abaixo.' : ''}
          </p> : null}
        </div>
        {result ? (
          <ResultDetails result={result} profiles={people} check={findCheck(result.followup_id)} openCheck={select} />
        ) : operation === null ? (
          <>
            <p>Execute uma investigação experimental ou recupere um resultado salvo.</p>
            <ActionLink href={pageHref('registrar')}>Adicionar medição</ActionLink>
          </>
        ) : null}
        <details className="investigation-disclosure">
          <summary>Como interpretar os estados</summary>
          <ProtocolLegend />
        </details>
      </Card>
      <InvestigationAgenda agenda={agenda.data} loading={agenda.loading} error={agenda.error} refresh={agenda.refresh}
        profiles={people} active={activeCheck} select={select} recover={id => void recover(id, true)}
        completing={completing} complete={id => void complete(id)} linkMessage={agendaMessage}
        recovering={operation !== null} heading={checkHeading} />
    </div>
  );
}
