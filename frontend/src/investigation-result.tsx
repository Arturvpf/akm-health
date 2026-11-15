import { nasaReferenceUrl } from './api';
import { ActionButton, ActionLink, Details, QualityBadge, SourceBadge, StatusBadge } from './design-system';
import { pageHref } from './navigation';
import type { AstronautRead, FollowupRead, InvestigationExplanation, InvestigationResult, Kind, MetricUnit } from './types';

export const metricNames: Record<Kind, string> = {
  sleep_hours: 'Duração do sono', heart_rate_bpm: 'Frequência cardíaca', mood_score: 'Humor',
  co2_ppm: 'CO₂ interno', cabin_temp_c: 'Temperatura interna',
};
const units: Record<MetricUnit, string> = { h: 'h', bpm: 'bpm', ppm: 'ppm', C: '°C', score_1_to_5: '/ 5' };
const numberFormat = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 8 });
const timeFormat = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'UTC', dateStyle: 'short', timeStyle: 'medium',
});

export function metricValue(value: number, unit: MetricUnit) {
  return `${numberFormat.format(value)} ${units[unit]}`;
}

export function formatTime(timestamp: string) {
  return `${timeFormat.format(new Date(timestamp))} UTC`;
}

export function UtcTime({ value }: { value: string }) {
  return <time dateTime={value}>{formatTime(value)}</time>;
}

export function targetName(astronautId: string | null, profiles: AstronautRead[]) {
  if (astronautId === null) return 'Habitat interno';
  const profile = profiles.find(({ id }) => id === astronautId);
  return profile ? `${profile.name} · ${profile.id}` : astronautId;
}

const checkStatuses = {
  selected: 'Checagem selecionada',
  unavailable: 'Checagem indisponível',
  no_check_needed: 'Sem checagem indicada',
  needs_context: 'Mais contexto necessário',
  protocol_referral: 'Encaminhamento para revisão humana',
} as const;
const effortLabels = { low: 'Baixo', medium: 'Médio', high: 'Alto' } as const;

type References = InvestigationExplanation['references'];

function isNasaReference(reference: References[number]) {
  return nasaReferenceUrl(reference.url) !== null;
}

function ReferenceList({ references }: { references: References }) {
  return <ul>{references.map(reference => (
    <li key={reference.source_id}>
      <a href={reference.url}>{reference.title}</a>
      <p>{reference.relevance}</p>
    </li>
  ))}</ul>;
}

export function ResultDetails({ result, profiles, check, openCheck }: {
  result: InvestigationResult; profiles: AstronautRead[]; check: FollowupRead | undefined;
  openCheck: (check: FollowupRead) => void;
}) {
  const { explanation, next_check: nextCheck } = result;
  const coverage = explanation?.coverage;
  const decision = explanation?.check_context;
  const review = explanation?.human_review;
  const scope = result.scope === 'crew' ? 'Tripulação · ODYSSEY-26' : targetName(result.astronaut_id, profiles);
  const nasa = explanation?.references.filter(isNasaReference) ?? [];
  const otherReferences = explanation?.references.filter(reference => !isNasaReference(reference)) ?? [];
  const displayedLimitations = new Set(explanation?.limitations.map(limitation => `Limitação: ${limitation}`));
  const findings = result.findings.filter(finding =>
    finding !== decision?.reason && !displayedLimitations.has(finding)
    && !(coverage && finding.startsWith('Janela observada: ')));

  return (
    <div className="investigation-details">
      <div className="badge-row">
        {result.status === 'critical'
          ? <span className="ds-badge tone-neutral">Consultar o protocolo da missão</span>
          : <StatusBadge status={result.status} />}
        <span className="ds-badge tone-info">Regra experimental · Demonstração</span>
      </div>
      <Details items={[
        { label: 'Investigação', value: `#${result.id}` },
        { label: 'Escopo', value: scope },
        { label: 'Análise', value: <UtcTime value={result.created_at} /> },
        { label: 'Versão das regras', value: result.rules_version },
      ]} />
      <section>
        <h3>Achados da tripulação fictícia</h3>
        {findings.length ? (
          <ul>{findings.map((finding, i) => <li key={i}>{finding}</li>)}</ul>
        ) : <p>O resultado salvo não inclui achados.</p>}
        {result.status === 'insufficient_data' ? <ActionLink href={pageHref('registrar')}>Adicionar medição</ActionLink> : null}
      </section>
      <section>
        <h3>Cobertura</h3>
        {coverage ? (
          <Details items={[
            { label: 'Período avaliado', value: <><UtcTime value={coverage.window_start} /> a <UtcTime value={coverage.window_end} /></> },
            { label: 'Perfis avaliados', value: coverage.evaluated_astronaut_ids.length ?
              coverage.evaluated_astronaut_ids.map(id => targetName(id, profiles)).join(', ') :
              'Cobertura insuficiente para classificar o escopo solicitado.' },
          ]} />
        ) : <p>O registro salvo não traz a janela ou os perfis avaliados.</p>}
      </section>
      <section>
        <h3>Evidências</h3>
        {result.evidence.length ? (
          <ul className="investigation-evidence">
            {result.evidence.map((item, i) => (
              <li key={i}>
                <strong>{metricNames[item.kind]}</strong>
                <span>{item.astronaut_ids.length
                  ? item.astronaut_ids.map(id => targetName(id, profiles)).join(', ')
                  : (item.kind === 'co2_ppm' || item.kind === 'cabin_temp_c') ? 'Habitat interno' : 'Sem perfis listados'}</span>
                <div><QualityBadge quality={item.quality} /></div>
              </li>
            ))}
          </ul>
        ) : <p>O resultado salvo não inclui evidências.</p>}
      </section>
      <section>
        <h3>Hipóteses não confirmadas</h3>
        {result.hypotheses.length ? (
          <ul>{result.hypotheses.map((hypothesis, i) => (
            <li key={i}><strong>{hypothesis.label}</strong><p>{hypothesis.explanation}</p></li>
          ))}</ul>
        ) : <p>Nenhuma hipótese foi incluída neste resultado.</p>}
      </section>
      <section>
        <h3>Incerteza e limitações</h3>
        <p>{explanation?.uncertainty ?? 'O registro salvo não traz uma explicação detalhada da incerteza.'}</p>
        {explanation?.limitations.length ? (
          <ul>{explanation.limitations.map((limitation, i) => <li key={i}>{limitation}</li>)}</ul>
        ) : null}
      </section>
      <section>
        <h3>Próxima checagem</h3>
        {decision ? <strong>{checkStatuses[decision.status]}</strong> : null}
        {nextCheck && (!decision || decision.status === 'selected') ? (
          <>
            <Details items={[
              { label: 'Indicador', value: metricNames[nextCheck.kind] },
              { label: 'Alvo', value: targetName(nextCheck.astronaut_id, profiles) },
              { label: 'Esforço', value: effortLabels[nextCheck.effort] },
            ]} />
            <p>{decision?.reason ?? nextCheck.reason}</p>
            {check ? <ActionButton onClick={() => openCheck(check)}>
              {check.status === 'pending' ? `Abrir checagem #${check.id} na agenda` : `Ver conclusão da checagem #${check.id}`}
            </ActionButton> : result.followup_id !== null ? (
              <p>Consulte a agenda para confirmar o estado da checagem #{result.followup_id}.</p>
            ) : null}
          </>
        ) : <p>{decision?.reason ?? 'O registro salvo não traz a decisão de próxima checagem.'}</p>}
      </section>
      <section>
        <h3>Revisão humana</h3>
        {review ? (
          <>
            <p><strong>{review.mode === 'per_protocol' ? 'Conforme o protocolo da missão' : 'Quando consultar o responsável'}</strong></p>
            <p>{review.instruction}</p>
            {review.protocol_reference ? <p>Protocolo informado · {review.protocol_reference}</p> : null}
            <p>O contato com o responsável e o envio do resumo são manuais.</p>
          </>
        ) : <p>O registro salvo não inclui instruções de revisão.</p>}
      </section>
      <section className="scientific-context">
        <h3>Referências científicas NASA HRP</h3>
        {nasa.length ? (
          <>
            <SourceBadge source="nasa_reference" />
            <ReferenceList references={nasa} />
          </>
        ) : <p>O resultado salvo não inclui referências científicas NASA.</p>}
      </section>
      {otherReferences.length ? (
        <section>
          <h3>Documentação da demonstração</h3>
          <ReferenceList references={otherReferences} />
        </section>
      ) : null}
    </div>
  );
}
