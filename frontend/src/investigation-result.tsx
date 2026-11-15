import { nasaReferenceUrl } from './api';
import { englishMissionCopy } from './mission-copy';
import { ActionButton, ActionLink, Details, QualityBadge, SourceBadge, StatusBadge } from './design-system';
import { pageHref } from './navigation';
import type { AstronautRead, FollowupRead, InvestigationExplanation, InvestigationResult, Kind, MetricUnit } from './types';

export const metricNames: Record<Kind, string> = {
  sleep_hours: 'Sleep duration', heart_rate_bpm: 'Heart rate', mood_score: 'Mood',
  co2_ppm: 'Cabin CO₂', cabin_temp_c: 'Cabin temperature',
};
const units: Record<MetricUnit, string> = { h: 'h', bpm: 'bpm', ppm: 'ppm', C: '°C', score_1_to_5: '/ 5' };
const numberFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 8 });
const timeFormat = new Intl.DateTimeFormat('en-US', {
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
  if (astronautId === null) return 'Cabin';
  const profile = profiles.find(({ id }) => id === astronautId);
  return profile ? `${profile.name} · ${profile.id}` : astronautId;
}

const checkStatuses = {
  selected: 'Selected check',
  unavailable: 'Check unavailable',
  no_check_needed: 'No check required',
  needs_context: 'More context needed',
  protocol_referral: 'Referred for human review',
} as const;
const effortLabels = { low: 'Low', medium: 'Medium', high: 'High' } as const;

type References = InvestigationExplanation['references'];

function isNasaReference(reference: References[number]) {
  return nasaReferenceUrl(reference.url) !== null;
}

function ReferenceList({ references }: { references: References }) {
  return <ul>{references.map(reference => (
    <li key={reference.source_id}>
      <a href={reference.url}>{englishMissionCopy(reference.title)}</a>
      <p>{englishMissionCopy(reference.relevance)}</p>
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
  const scope = result.scope === 'crew' ? 'Crew · ODYSSEY-26' : targetName(result.astronaut_id, profiles);
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
          ? <span className="ds-badge tone-neutral">Consult the mission protocol</span>
          : <StatusBadge status={result.status} />}
        <span className="ds-badge tone-info">Experimental rule · Demo</span>
      </div>
      <Details items={[
        { label: 'Investigation', value: `#${result.id}` },
        { label: 'Scope', value: scope },
        { label: 'Analyzed at', value: <UtcTime value={result.created_at} /> },
        { label: 'Rule version', value: result.rules_version },
      ]} />
      <section>
        <h3>Findings for the simulated crew</h3>
        {findings.length ? (
          <ul>{findings.map((finding, i) => <li key={i}>{englishMissionCopy(finding)}</li>)}</ul>
        ) : <p>This saved result has no findings.</p>}
        {result.status === 'insufficient_data' ? <ActionLink href={pageHref('register')}>Add measurement</ActionLink> : null}
      </section>
      <section>
        <h3>Coverage</h3>
        {coverage ? (
          <Details items={[
            { label: 'Evaluation window', value: <><UtcTime value={coverage.window_start} /> to <UtcTime value={coverage.window_end} /></> },
            { label: 'Profiles evaluated', value: coverage.evaluated_astronaut_ids.length ?
              coverage.evaluated_astronaut_ids.map(id => targetName(id, profiles)).join(', ') :
              'Coverage is insufficient for this scope.' },
          ]} />
        ) : <p>The saved result does not include the window or evaluated profiles.</p>}
      </section>
      <section>
        <h3>Evidence</h3>
        {result.evidence.length ? (
          <ul className="investigation-evidence">
            {result.evidence.map((item, i) => (
              <li key={i}>
                <strong>{metricNames[item.kind]}</strong>
                <span>{item.astronaut_ids.length
                  ? item.astronaut_ids.map(id => targetName(id, profiles)).join(', ')
                  : (item.kind === 'co2_ppm' || item.kind === 'cabin_temp_c') ? 'Cabin' : 'No profiles listed'}</span>
                <div><QualityBadge quality={item.quality} /></div>
              </li>
            ))}
          </ul>
        ) : <p>This saved result has no evidence.</p>}
      </section>
      <section>
        <h3>Unconfirmed hypotheses</h3>
        {result.hypotheses.length ? (
          <ul>{result.hypotheses.map((hypothesis, i) => (
            <li key={i}><strong>{englishMissionCopy(hypothesis.label)}</strong><p>{englishMissionCopy(hypothesis.explanation)}</p></li>
          ))}</ul>
        ) : <p>This result has no hypotheses.</p>}
      </section>
      <section>
        <h3>Uncertainty and limitations</h3>
        <p>{explanation ? englishMissionCopy(explanation.uncertainty) : 'This saved result has no detailed uncertainty statement.'}</p>
        {explanation?.limitations.length ? (
          <ul>{explanation.limitations.map((limitation, i) => <li key={i}>{englishMissionCopy(limitation)}</li>)}</ul>
        ) : null}
      </section>
      <section>
        <h3>Next check</h3>
        {decision ? <strong>{checkStatuses[decision.status]}</strong> : null}
        {nextCheck && (!decision || decision.status === 'selected') ? (
          <>
            <Details items={[
              { label: 'Metric', value: metricNames[nextCheck.kind] },
              { label: 'Target', value: targetName(nextCheck.astronaut_id, profiles) },
              { label: 'Effort', value: effortLabels[nextCheck.effort] },
            ]} />
            <p>{englishMissionCopy(decision?.reason ?? nextCheck.reason)}</p>
            {check ? <ActionButton onClick={() => openCheck(check)}>
              {check.status === 'pending' ? `Open check #${check.id} in the schedule` : `View completion for check #${check.id}`}
            </ActionButton> : result.followup_id !== null ? (
              <p>Check the schedule for the status of check #{result.followup_id}.</p>
            ) : null}
          </>
        ) : <p>{decision ? englishMissionCopy(decision.reason) : 'This saved result has no decision about a next check.'}</p>}
      </section>
      <section>
        <h3>Human review</h3>
        {review ? (
          <>
            <p><strong>{review.mode === 'per_protocol' ? 'Under the mission protocol' : 'When to contact mission staff'}</strong></p>
            <p>{englishMissionCopy(review.instruction)}</p>
            {review.protocol_reference ? <p>Protocol reference · {review.protocol_reference}</p> : null}
            <p>Contact mission staff and share the summary directly.</p>
          </>
        ) : <p>This saved result has no review instructions.</p>}
      </section>
      <section className="scientific-context">
        <h3>NASA HRP research references</h3>
        {nasa.length ? (
          <>
            <SourceBadge source="nasa_reference" />
            <ReferenceList references={nasa} />
          </>
        ) : <p>This saved result has no NASA research references.</p>}
      </section>
      {otherReferences.length ? (
        <section>
          <h3>Demo documentation</h3>
          <ReferenceList references={otherReferences} />
        </section>
      ) : null}
    </div>
  );
}
