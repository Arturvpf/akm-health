import { DataTable, Details, QualityBadge, SourceBadge } from './design-system';
import { dayStart, type HistoryFilters, METRICS, summarizeSeries } from './history-data';
import type { MeasurementRead } from './types';

const dateFormat = new Intl.DateTimeFormat('en-US', { dateStyle: 'short', timeZone: 'UTC' });
const timestampFormat = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'short', timeStyle: 'medium', timeZone: 'UTC',
});
const valueFormat = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 15 });
const axisFormat = new Intl.NumberFormat('en-US', { notation: 'compact', maximumSignificantDigits: 4 });

function Time({ value }: { value: string }) {
  const fraction = value.match(/\.(\d+)(?:Z|[+-]\d\d:\d\d)$/)?.[1];
  const timestamp = timestampFormat.format(new Date(value));
  return <time dateTime={value}>{fraction ? `${timestamp},${fraction}` : timestamp}</time>;
}

function formatGap(firstDay: number, lastDay: number) {
  const start = dateFormat.format(dayStart(firstDay));
  return firstDay === lastDay ? start : `${start} to ${dateFormat.format(dayStart(lastDay))}`;
}

function TrendPlot({ series, label, unit, baseline }: {
  series: ReturnType<typeof summarizeSeries>;
  label: string;
  unit: string;
  baseline: number | null;
}) {
  const left = 82;
  const right = 544;
  const top = 32;
  const bottom = 181;
  const minimum = Math.min(series.minimum, baseline ?? series.minimum);
  const maximum = Math.max(series.maximum, baseline ?? series.maximum);
  // Normalize before subtracting so even finite extremes cannot overflow the scale.
  const scale = Math.max(Math.abs(minimum), Math.abs(maximum)) || 1;
  const span = maximum / scale - minimum / scale;
  const x = (time: number) => series.start === series.end ? (left + right) / 2
    : left + (right - left) * (time - series.start) / (series.end - series.start);
  const y = (value: number) => bottom - 14 - (bottom - top - 28)
    * (span === 0 ? 0.5 : (value / scale - minimum / scale) / span);
  const ticks = minimum === maximum ? [minimum] : [minimum, minimum / 2 + maximum / 2, maximum];
  const startDate = dateFormat.format(series.start);
  const endDate = dateFormat.format(series.end);

  return (
    <figure className="history-figure">
      <figcaption>{label} in {unit} by observation date (UTC)</figcaption>
      <p className="history-chart-hint">See the measurements table for exact values and timestamps.</p>
      <div className="history-chart-scroll" role="region" aria-label="Scrollable chart" tabIndex={0}>
        <svg viewBox="0 0 600 225" role="img" aria-label={`Chart of ${label} in ${unit}`}
          aria-describedby="history-chart-description">
          <line className="history-axis" x1={left} y1={top} x2={left} y2={bottom} />
          <line className="history-axis" x1={left} y1={bottom} x2={right} y2={bottom} />
          {ticks.map((value, index) => (
            <g key={index}>
              <line className="history-gridline" x1={left} y1={y(value)} x2={right} y2={y(value)} />
              <text x={left - 8} y={y(value)} dominantBaseline="middle" textAnchor="end">{axisFormat.format(value)}</text>
            </g>
          ))}
          {series.gaps.map(({ firstDay, lastDay }) => {
            const gapStart = Math.max(series.start, dayStart(firstDay));
            const gapEnd = Math.min(series.end, dayStart(lastDay + 1));
            return <rect key={firstDay} className="history-gap-band" x={x(gapStart)} y={top}
              width={x(gapEnd) - x(gapStart)} height={bottom - top} />;
          })}
          {baseline !== null && (
            <line className="history-baseline-line" x1={left} y1={y(baseline)} x2={right} y2={y(baseline)} />
          )}
          {series.segments.map((segment) => (
            <g key={segment[0].id}>
              {segment.length > 1 && (
                <polyline className="history-valid-line" points={segment.map(point => `${x(point.time)},${y(point.value)}`).join(' ')} />
              )}
              {segment.map(point => (
                <circle className="history-valid-point" key={point.id} cx={x(point.time)} cy={y(point.value)} r="4" />
              ))}
            </g>
          ))}
          {series.suspect.map(point => (
            <g key={point.id} className="history-suspect-point" transform={`translate(${x(point.time)} ${y(point.value)})`}>
              <path d="M -5 -5 L 5 5 M -5 5 L 5 -5" />
            </g>
          ))}
          {startDate === endDate ? (
            <text x={(left + right) / 2} y={207} textAnchor="middle">{startDate}</text>
          ) : (
            <>
              <text x={left} y={207}>{startDate}</text>
              <text x={right} y={207} textAnchor="end">{endDate}</text>
            </>
          )}
        </svg>
      </div>
      <ul className="history-legend" aria-label="Chart legend">
        <li><span className="history-legend-valid" aria-hidden="true">●</span> Valid reading</li>
        <li><span className="history-legend-suspect" aria-hidden="true">×</span> Suspect reading</li>
        <li><span className="history-legend-gap" aria-hidden="true" /> Day without a reading</li>
        {baseline !== null && <li><span className="history-legend-baseline" aria-hidden="true" /> Individual baseline</li>}
      </ul>
      <p id="history-chart-description">
        The line breaks on UTC days without readings and at suspect readings.
        Quality reflects the technical condition of the reading.
      </p>
    </figure>
  );
}

export function HistoryTrend({ rows, filters, target, baseline }: {
  rows: [MeasurementRead, ...MeasurementRead[]];
  filters: HistoryFilters;
  target: string;
  baseline: number | null;
}) {
  const { label, unit } = METRICS[filters.kind];
  const series = summarizeSeries(rows, filters);
  const validCount = rows.length - series.suspect.length;

  return (
    <section className="history-results" aria-label="Measurement trend and data">
      <h3>{label} · {target}</h3>
      <Details items={[
        { label: 'Displayed period', value: `${dateFormat.format(series.start)} to ${dateFormat.format(series.end)} (UTC)` },
        { label: 'Observation range', value: <><Time value={series.first.measured_at} /> to <Time value={series.last.measured_at} /> (UTC)</> },
        { label: 'Coverage', value: `${validCount} valid · ${series.suspect.length} suspect · ${series.missingDays} days without readings` },
        ...(baseline === null ? [] : [{ label: 'Individual sleep baseline', value: `${valueFormat.format(baseline)} h (simulated profile)` }]),
      ]} />
      {validCount === 0 && <p>The available readings are suspect. A trend requires valid readings.</p>}
      <TrendPlot series={series} label={label} unit={unit} baseline={baseline} />
      {series.gaps.length > 0 && (
        <p><strong>Dates without readings (UTC)</strong> {series.gaps.map(gap => formatGap(gap.firstDay, gap.lastDay)).join(' · ')}</p>
      )}
      <DataTable label="Measurements table" caption={`${label} readings for ${target}, in observation order`}>
        <thead>
          <tr>
            <th scope="col">Observed (UTC)</th>
            <th scope="col">Recorded (UTC)</th>
            <th scope="col">Value</th>
            <th scope="col">Source</th>
            <th scope="col">Quality</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.id}>
              <td><Time value={row.measured_at} /></td>
              <td><Time value={row.recorded_at} /></td>
              <td>{valueFormat.format(row.value)} {unit}</td>
              <td><SourceBadge source={row.source} /></td>
              <td><QualityBadge quality={row.quality} /></td>
            </tr>
          ))}
        </tbody>
      </DataTable>
    </section>
  );
}
