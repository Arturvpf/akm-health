import { useEffect, useMemo, useState } from 'react';
import { nasaReferenceUrl } from './api';
import { ActionButton, Card, DataTable, Details, SelectField, SourceBadge } from './design-system';
import type { DashboardResponse, NASAHistoricalObservation, NASAReferenceResponse } from './types';

const METRICS = {
  co2_ppm: 'Carbon dioxide',
  temperature_c: 'Air temperature',
  relative_humidity_pct: 'Relative humidity',
} as const;
type Metric = keyof typeof METRICS;
type Reading = NASAHistoricalObservation & { observed_at: string };

const numbers = new Intl.NumberFormat('en', { maximumFractionDigits: 2 });
const dateTime = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' });
const time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });

function historicalChannels(history: NASAHistoricalObservation[]) {
  const result = new Map<Metric, Reading[]>();
  for (const reading of history) {
    if (!Object.hasOwn(METRICS, reading.parameter) || !reading.observed_at ||
        !Number.isFinite(Date.parse(reading.observed_at)) || !Number.isFinite(reading.value)) continue;
    const metric = reading.parameter as Metric;
    const channel = result.get(metric) ?? [];
    channel.push({ ...reading, observed_at: reading.observed_at });
    result.set(metric, channel);
  }
  for (const channel of result.values()) {
    channel.sort((a, b) => Date.parse(a.observed_at) - Date.parse(b.observed_at));
  }
  return result;
}

function HistoricChart({ readings, metric }: { readings: Reading[]; metric: Metric }) {
  const [minimum, maximum] = readings.reduce(
    ([low, high], { value }) => [Math.min(low, value), Math.max(high, value)],
    [readings[0].value, readings[0].value],
  );
  const first = readings[0];
  const last = readings[readings.length - 1];
  const start = Date.parse(first.observed_at);
  const period = Date.parse(last.observed_at) - start;
  const left = 68;
  const right = 538;
  const top = 14;
  const bottom = 156;
  const points = readings.map(({ observed_at, value }) => ({
    x: period ? left + (right - left) * (Date.parse(observed_at) - start) / period : (left + right) / 2,
    y: maximum > minimum ? bottom - (bottom - top) * (value - minimum) / (maximum - minimum) : (top + bottom) / 2,
  }));
  const axis = maximum > minimum ? [maximum, (minimum + maximum) / 2, minimum] : [minimum];

  return <>
    <svg viewBox="0 0 560 186" className="nasa-chart" role="img"
      aria-label={`${METRICS[metric]}, ${first.unit}. ${readings.length} readings from ${numbers.format(minimum)} to ${numbers.format(maximum)} ${first.unit}. Values available in the table below.`}>
      {axis.map((value, index) => {
        const y = axis.length === 1 ? (top + bottom) / 2 : top + (bottom - top) * index / 2;
        return <g key={index}>
          <line className="nasa-chart-rule" x1={left} x2={right} y1={y} y2={y} />
          <text x={left - 9} y={y} dy=".32em" textAnchor="end">{numbers.format(value)}</text>
        </g>;
      })}
      {points.length > 1 ? <polyline className="nasa-chart-line"
        points={points.map(({ x, y }) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ')} />
        : <circle className="nasa-chart-dot" cx={points[0].x} cy={points[0].y} r={4} />}
      <text x={left} y={177}>{time.format(start)}</text>
      {period > 0 && <text x={right} y={177} textAnchor="end">{time.format(start + period)} UTC</text>}
    </svg>
    <details className="nasa-observations">
      <summary>View {readings.length} observations</summary>
      <DataTable label="Historical NASA readings" caption={`RR-1: ${METRICS[metric]}`}>
        <thead><tr><th scope="col">Observed (UTC)</th><th scope="col">Value ({first.unit})</th></tr></thead>
        <tbody>{readings.map(({ observed_at, value }) => <tr key={observed_at}>
          <td><time dateTime={observed_at}>{dateTime.format(new Date(observed_at))}</time></td>
          <td>{numbers.format(value)}</td>
        </tr>)}</tbody>
      </DataTable>
    </details>
  </>;
}

function HistoricalSeries({ history }: { history: NASAHistoricalObservation[] }) {
  const channels = useMemo(() => historicalChannels(history), [history]);
  const [metric, setMetric] = useState<Metric>('co2_ppm');
  const choices = (Object.keys(METRICS) as Metric[])
    .flatMap(key => {
      const readings = channels.get(key);
      return readings ? [{ key, readings }] : [];
    });
  const selected = choices.find(choice => choice.key === metric) ?? choices[0];
  if (!selected) return <p>No historical NASA telemetry is available.</p>;

  const { readings } = selected;
  const first = readings[0];
  const last = readings[readings.length - 1];
  const source = nasaReferenceUrl(first.source_url);
  return <div className="nasa-history">
    <h3>ISS historical telemetry · {first.mission_id}</h3>
    <SourceBadge source="nasa_historical" />
    <p>{first.context} This archive is separate from ODYSSEY-26 mission readings and investigation evidence.</p>
    <Details items={[
      { label: 'Source', value: source ? <a href={source}>{first.source}</a> : first.source },
      { label: 'Period (UTC)', value: <><time dateTime={first.observed_at}>{dateTime.format(new Date(first.observed_at))}</time>
        {' – '}<time dateTime={last.observed_at}>{dateTime.format(new Date(last.observed_at))}</time></> },
      { label: 'Instrument', value: first.instrument ?? 'Unspecified in the source' },
    ]} />
    <SelectField label="Historical indicator" value={selected.key} onChange={event => setMetric(event.currentTarget.value as Metric)}>
      {choices.map(({ key, readings }) => <option key={key} value={key}>{METRICS[key]} ({readings[0].unit})</option>)}
    </SelectField>
    <HistoricChart readings={readings} metric={selected.key} />
  </div>;
}

export function NasaReferences({ mission }: { mission?: DashboardResponse['mission'] }) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<NASAReferenceResponse | 'loading' | 'error'>('loading');
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch('/api/nasa/references', { signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data: NASAReferenceResponse = await response.json();
        if (!Array.isArray(data.scientific_references) || !Array.isArray(data.historical_series)) {
          throw new Error('Invalid NASA reference response');
        }
        if (!controller.signal.aborted) setState(data);
      } catch {
        if (!controller.signal.aborted) setState('error');
      }
    }
    void load();
    return () => controller.abort();
  }, [attempt]);

  const planetSource = mission && nasaReferenceUrl(mission.context_source_url);
  return <div className="nasa-references" lang="en">
    <Card heading="NASA references">
      {mission && <div className="nasa-planet">
        <h3>Mission destination · Mars surface</h3>
        <SourceBadge source="nasa_reference" />
        <p>Reference gravity: {mission.gravity_g_reference} g.
          {planetSource ? <> <a href={planetSource}>NASA planetary fact sheet</a>.</>
            : ' The planetary fact sheet link is unavailable.'}</p>
        <p>Mars has a thin, predominantly carbon-dioxide atmosphere. This describes the outdoor environment.
          {' '}<a href="https://science.nasa.gov/mars/facts/">NASA Mars facts</a>.</p>
      </div>}
      {state === 'loading' ? <p role="status">Loading NASA references…</p> : state === 'error' ? <>
        <p role="alert">NASA references could not be loaded.</p>
        <ActionButton onClick={() => { setState('loading'); setAttempt(value => value + 1); }}>Try again</ActionButton>
      </> : <>
        <h3>Human Research Program</h3>
        <SourceBadge source="nasa_reference" />
        <ul>{state.scientific_references.map(reference => {
          const url = nasaReferenceUrl(reference.url);
          return <li key={reference.url}>{url ? <a href={url}>{reference.title}</a> : reference.title}</li>;
        })}</ul>
        <HistoricalSeries history={state.historical_series} />
      </>}
    </Card>
  </div>;
}
