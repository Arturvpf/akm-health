import { useEffect, useState } from 'react';
import { DataTable } from './design-system';
import { readInvestigationBasis } from './investigation-api';
import { formatTime, metricNames, metricValue, UtcTime } from './investigation-result';
import type { AstronautRead, InvestigationBasis } from './types';

type Load = { state: 'loading' } | { state: 'missing' } | { state: 'ready'; basis: InvestigationBasis };

export function useInvestigationBasis(id: number): Load {
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  useEffect(() => {
    const controller = new AbortController();
    setLoad({ state: 'loading' });
    readInvestigationBasis(id, controller.signal)
      .then(basis => setLoad({ state: 'ready', basis }))
      .catch(() => { if (!controller.signal.aborted) setLoad({ state: 'missing' }); });
    return () => controller.abort();
  }, [id]);
  return load;
}

const statusWords: Record<string, string> = {
  attention: 'Pattern found', normal: 'No pattern', insufficient_data: 'Not enough data', critical: 'Consult protocol',
};

export function WhyThisFinding({ id, profiles }: { id: number; profiles: AstronautRead[] }) {
  const load = useInvestigationBasis(id);
  if (load.state === 'loading') return <section className="why-finding" aria-busy="true"><h3>Why this finding</h3><p>Loading the rule and data behind this result…</p></section>;
  if (load.state === 'missing') {
    return <section className="why-finding"><h3>Why this finding</h3>
      <p>The basis for this result was not saved, or the connection is unavailable. Run the investigation again to record it.</p></section>;
  }
  const { basis } = load;
  const name = (astronautId: string) => profiles.find(({ id: pid }) => pid === astronautId)?.name ?? astronautId;
  return (
    <section className="why-finding" aria-labelledby={`why-${id}`}>
      <h3 id={`why-${id}`}>Why this finding</h3>
      <p>Everything below was saved when this investigation ran. Nothing is recalculated here.</p>
      <h4>Rules applied</h4>
      <ul>{basis.rules.map(rule => (
        <li key={rule.rule_id}><strong>{rule.rule_id} · {rule.title}</strong><p>{rule.description}</p></li>
      ))}</ul>
      <h4>Thresholds and settings</h4>
      <dl className="ds-details">{basis.parameters.map(item => (
        <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>
      ))}</dl>
      <p>Window: <UtcTime value={basis.window_start} /> to <UtcTime value={basis.window_end} />.</p>
      <h4>Sleep data used</h4>
      <DataTable label="Sleep readings used by the rule" caption="Each crew member's baseline, threshold and the readings compared">
        <thead><tr>
          <th scope="col">Crew member</th><th scope="col">Baseline</th><th scope="col">Threshold</th>
          <th scope="col">Readings compared</th><th scope="col">Outcome</th>
        </tr></thead>
        <tbody>{basis.members.map(member => (
          <tr key={member.astronaut_id}>
            <th scope="row">{name(member.astronaut_id)} · {member.astronaut_id}</th>
            <td>{member.baseline_sleep_hours === null ? 'None' : `${member.baseline_sleep_hours} h`}</td>
            <td>{member.threshold_sleep_hours === null ? 'None' : `${Number(member.threshold_sleep_hours.toFixed(2))} h`}</td>
            <td>{member.readings.length ? member.readings.map(reading => (
              <div key={reading.measurement_id}>
                {metricValue(reading.value, reading.unit)} · {formatTime(reading.measured_at)} · #{reading.measurement_id} · {reading.role}
              </div>
            )) : 'No usable readings'}
              {member.excluded_suspect_ids.length ? <div>Left out as suspect: #{member.excluded_suspect_ids.join(', #')}</div> : null}
            </td>
            <td>{statusWords[member.status] ?? member.status}</td>
          </tr>
        ))}</tbody>
      </DataTable>
      {basis.environment.length ? (
        <>
          <h4>Cabin context used</h4>
          <ul>{basis.environment.map(item => (
            <li key={item.kind}>
              <strong>{metricNames[item.kind]}</strong>
              <p>{item.explanation}</p>
              {item.readings.length ? <p>{item.readings.map(reading => (
                `${reading.role}: ${metricValue(reading.value, reading.unit)} at ${formatTime(reading.measured_at)} (#${reading.measurement_id})`
              )).join(' · ')}</p> : null}
            </li>
          ))}</ul>
        </>
      ) : null}
      <h4>Where the data comes from</h4>
      <ul>{basis.data_sources.map((source, i) => <li key={i}>{source}</li>)}</ul>
      <h4>What this cannot tell you</h4>
      <ul>{basis.limitations.map((limitation, i) => <li key={i}>{limitation}</li>)}</ul>
    </section>
  );
}
