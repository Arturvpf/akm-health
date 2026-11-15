import { useMemo, useState } from 'react';
import { Card, InformationNotice } from './design-system';
import { EnvironmentSelector } from './EnvironmentView';
import { SAMPLE_PROFILES, SAMPLE_HABITAT, DISPLAY_METRICS, compareMetric } from './scenario-data';
import type { Kind } from './types';
import './experiments.css';

const print = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2, signDisplay: 'exceptZero' });
export function ScenarioComparator() {
  const [person, setPerson] = useState('A1');
  const [overrides, setOverrides] = useState<Partial<Record<Kind, string>>>({});
  const profile = SAMPLE_PROFILES.find(item => item.id === person)!;
  const comparisons = useMemo(() => DISPLAY_METRICS.map(metric => {
    const baseline = metric.id === 'co2_ppm' || metric.id === 'cabin_temp_c'
      ? SAMPLE_HABITAT[metric.id] : profile.metrics[metric.id];
    const raw = overrides[metric.id];
    const value = raw === undefined ? baseline : raw === '' ? null : Number(raw);
    return { metric, result: compareMetric(metric.id, baseline, value) };
  }), [profile, overrides]);
  return <div className="experiment-stack">
    <InformationNotice label="AKM-34 · Hypothetical simulation">
      Baseline: fictional ODYSSEY-26 seed (second night), not real health data. Alternative values are typed hypotheses. Numeric differences do not indicate risk, benefit, diagnosis or prediction.
    </InformationNotice>
    <Card heading="Comparator assumptions">
      <label className="ds-field" htmlFor="compare-profile">Synthetic baseline profile
        <select id="compare-profile" className="ds-control" value={person} onChange={event => { setPerson(event.target.value); setOverrides({}); }}>
          {SAMPLE_PROFILES.map(item => <option key={item.id} value={item.id}>{item.name} · {item.id}</option>)}
        </select>
      </label>
      <p>Sleep is estimated hours for one period; heart rate is a spot reading; mood is ordinal. CO₂ and temperature describe the cabin, not the body. Missing data stay missing; they are never treated as zero.</p>
      <p><strong>Source:</strong> <code>backend/app/seed.py</code> — <code>source=synthetic</code> records, not measured by NASA.</p>
    </Card>
    <Card heading="Observation comparison">
      <div className="table-scroll"><table className="scenario-table">
        <caption>Simulated baseline versus manual hypothesis, with no clinical score</caption>
        <thead><tr><th scope="col">Metric</th><th scope="col">Baseline</th><th scope="col">Editable hypothesis</th><th scope="col">Difference</th></tr></thead>
        <tbody>{comparisons.map(({ metric, result }) => <tr key={metric.id}>
          <th scope="row">{metric.label}<small> {metric.unit}</small></th>
          <td>{result.baseline === null ? 'Not measured' : `${result.baseline.toLocaleString('en-US')} ${metric.unit}`}</td>
          <td><label className="sr-only" htmlFor={`hypo-${metric.id}`}>Hypothetical value for {metric.label}</label>
            <input id={`hypo-${metric.id}`} className="ds-control" inputMode="decimal" type="number"
              min={metric.min} max={metric.max} step={metric.step} value={overrides[metric.id] ?? result.baseline ?? ''}
              onChange={event => setOverrides(previous => ({ ...previous, [metric.id]: event.target.value }))} />
          </td>
          <td>{result.difference === null ? 'Unavailable' : `${print.format(result.difference)} ${metric.unit}`}</td>
        </tr>)}</tbody>
      </table></div>
      <div className="experiment-actions"><button type="button" className="ds-action" onClick={() => setOverrides({})}>Reset to baseline</button></div>
      <p><strong>Limit:</strong> these values are not used to recommend actions or raise alerts. This page does not call the investigation engine.</p>
    </Card>
    <EnvironmentSelector />
  </div>;
}
