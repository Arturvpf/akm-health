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
      <h5 ref={formHeading} tabIndex={-1}>Vínculo de medição para a checagem #{check.id}</h5>
      <div role="status">
        {!ready && state !== 'error' ? <DataState kind="loading">Buscando medições registradas para esta checagem.</DataState> : null}
        {state === 'error' ? <DataState kind="error">Não foi possível consultar as medições.</DataState> : null}
        {ready && !measurements.length ? (
          <DataState kind="empty">Registre uma medição válida do indicador e alvo acima. O registro precisa ser posterior à solicitação.</DataState>
        ) : null}
      </div>
      <div className="investigation-actions">
        <ActionLink href={pageHref('registrar')}>Registrar medição</ActionLink>
        <ActionButton onClick={reload} disabled={locked || state === 'loading'}>
          {state === 'error' ? 'Tentar carregar medições novamente' : 'Atualizar medições'}
        </ActionButton>
      </div>
      {measurements.length ? (
        <>
          <SelectField label="Medição para vincular" value={selected ? selectedId : ''}
            onChange={event => setSelectedId(event.currentTarget.value)}
            disabled={locked || !ready}>
            <option value="">Selecione uma medição</option>
            {measurements.map(row => (
              <option key={row.id} value={row.id}>
                #{row.id} · {metricValue(row.value, row.unit)} · {formatTime(row.measured_at)}
              </option>
            ))}
          </SelectField>
          <p>Os horários da leitura e do cadastro são validados pelo servidor ao confirmar.</p>
          {selected ? <Details items={[
            { label: 'Cadastro da medição', value: <UtcTime value={selected.recorded_at} /> },
            { label: 'Origem', value: <SourceBadge source={selected.source} /> },
          ]} /> : null}
          <div>
            <ActionButton type="submit" aria-disabled={!selected || locked || !ready}>
              {saving ? 'Vinculando medição…' : 'Vincular medição e concluir'}
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
    <Card heading="Agenda de checagens">
      <p>Solicitações da tripulação e do habitat em ordem de prioridade da rotina.</p>
      <ActionButton onClick={refresh} disabled={completing || loading}>
        {error ? 'Tentar recarregar agenda' : 'Atualizar agenda'}
      </ActionButton>
      <div className="state-feedback" role="status">
        {loading ? <DataState kind="loading">Consultando as checagens salvas.</DataState> : null}
        {error ? <DataState kind="error">
          {agenda ? 'A última agenda confirmada permanece visível. Atualize para confirmar a situação antes de vincular.' :
            'Não foi possível consultar a agenda.'}
        </DataState> : null}
        {!loading && !error && agenda && !pending.length ? <DataState kind="empty">Nenhuma checagem pendente.</DataState> : null}
      </div>
      <div className="state-feedback" role="status">
        {linkMessage ? <p className={`investigation-message ${linkMessage.error ? 'tone-caution' : 'tone-positive'}`}>{linkMessage.text}</p> : null}
      </div>
      <h3 tabIndex={-1} ref={heading} className="investigation-agenda-heading">
        {active ? `Acompanhamento da checagem #${active.id}` : 'Acompanhamento das checagens'}
      </h3>
      {selectedCompleted ? (
        <section className="investigation-check-box" aria-label="Conclusão selecionada">
          <strong>{metricNames[selectedCompleted.kind]} · {targetName(selectedCompleted.astronaut_id, profiles)}</strong>
          <Details items={[
            { label: 'Situação', value: 'Concluída' },
            { label: 'Medição vinculada', value: `#${selectedCompleted.measurement_id}` },
            { label: 'Conclusão', value: selectedCompleted.completed_at ? <UtcTime value={selectedCompleted.completed_at} /> : 'Horário indisponível' },
          ]} />
          <p>Para avaliar a nova leitura, execute uma reanálise do escopo correspondente.</p>
          <ActionButton disabled={recovering} onClick={() => recover(selectedCompleted.investigation_id)}>
            Abrir investigação #{selectedCompleted.investigation_id}
          </ActionButton>
        </section>
      ) : null}
      {pending.length ? (
        <ol className="investigation-checks">
          {pending.map(check => (
            <li key={check.id} className="investigation-check-box">
              <h4>{metricNames[check.kind]} · {targetName(check.astronaut_id, profiles)}</h4>
              <div className="badge-row"><span className="ds-badge tone-caution">Pendente · #{check.id}</span></div>
              <p>{check.reason}</p>
              <Details items={[
                { label: 'Solicitada em', value: <UtcTime value={check.created_at} /> },
                { label: 'Prazo', value: check.due_at ? <UtcTime value={check.due_at} /> : 'Sem prazo informado' },
              ]} />
              <div className="investigation-actions">
                <ActionButton disabled={recovering} onClick={() => recover(check.investigation_id)}>
                  Abrir investigação #{check.investigation_id}
                </ActionButton>
                {active?.id !== check.id ? <ActionButton disabled={completing} onClick={() => select(check)}>
                  Selecionar checagem #{check.id}
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
          <summary>Checagens concluídas ({completed.length})</summary>
          <ul className="investigation-checks">
            {[...completed].reverse().map(check => (
              <li key={check.id} className="investigation-check-box">
                <h4>{metricNames[check.kind]} · {targetName(check.astronaut_id, profiles)}</h4>
                <p>Medição #{check.measurement_id} vinculada {check.completed_at ? <>em <UtcTime value={check.completed_at} /></> : null}.</p>
                <ActionButton disabled={completing} onClick={() => select(check)}>Ver conclusão #{check.id}</ActionButton>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </Card>
  );
}
