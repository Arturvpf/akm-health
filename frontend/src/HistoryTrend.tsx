import { DataTable, Details, QualityBadge, SourceBadge } from './design-system';
import { dayStart, type HistoryFilters, METRICS, summarizeSeries } from './history-data';
import type { MeasurementRead } from './types';

const dateFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'UTC' });
const timestampFormat = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short', timeStyle: 'medium', timeZone: 'UTC',
});
const valueFormat = new Intl.NumberFormat('pt-BR', { maximumSignificantDigits: 15 });
const axisFormat = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumSignificantDigits: 4 });

function Time({ value }: { value: string }) {
  const fraction = value.match(/\.(\d+)(?:Z|[+-]\d\d:\d\d)$/)?.[1];
  const timestamp = timestampFormat.format(new Date(value));
  return <time dateTime={value}>{fraction ? `${timestamp},${fraction}` : timestamp}</time>;
}

function formatGap(firstDay: number, lastDay: number) {
  const start = dateFormat.format(dayStart(firstDay));
  return firstDay === lastDay ? start : `${start} a ${dateFormat.format(dayStart(lastDay))}`;
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
      <figcaption>{label} em {unit} por data de coleta (UTC)</figcaption>
      <p className="history-chart-hint">Consulte os valores e horários exatos na tabela de medições.</p>
      <div className="history-chart-scroll" role="region" aria-label="Área rolável do gráfico" tabIndex={0}>
        <svg viewBox="0 0 600 225" role="img" aria-label={`Gráfico de ${label} em ${unit}`}
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
      <ul className="history-legend" aria-label="Legenda do gráfico">
        <li><span className="history-legend-valid" aria-hidden="true">●</span> Medição válida</li>
        <li><span className="history-legend-suspect" aria-hidden="true">×</span> Medição suspeita</li>
        <li><span className="history-legend-gap" aria-hidden="true" /> Dia sem amostra</li>
        {baseline !== null && <li><span className="history-legend-baseline" aria-hidden="true" /> Base individual</li>}
      </ul>
      <p id="history-chart-description">
        A linha é interrompida em dias UTC sem amostras e em medições suspeitas.
        A qualidade indica a condição técnica da leitura.
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
    <section className="history-results" aria-label="Tendência e dados de medição">
      <h3>{label} · {target}</h3>
      <Details items={[
        { label: 'Período exibido', value: `${dateFormat.format(series.start)} a ${dateFormat.format(series.end)} (UTC)` },
        { label: 'Intervalo das coletas', value: <><Time value={series.first.measured_at} /> a <Time value={series.last.measured_at} /> (UTC)</> },
        { label: 'Cobertura', value: `${validCount} válidas · ${series.suspect.length} suspeitas · ${series.missingDays} dias sem amostra` },
        ...(baseline === null ? [] : [{ label: 'Base individual de sono', value: `${valueFormat.format(baseline)} h (perfil simulado)` }]),
      ]} />
      {validCount === 0 && <p>As medições encontradas são suspeitas. Faltam amostras válidas para traçar uma tendência.</p>}
      <TrendPlot series={series} label={label} unit={unit} baseline={baseline} />
      {series.gaps.length > 0 && (
        <p><strong>Datas sem amostras (UTC)</strong> {series.gaps.map(gap => formatGap(gap.firstDay, gap.lastDay)).join(' · ')}</p>
      )}
      <DataTable label="Tabela de medições" caption={`Medições de ${label} para ${target}, em ordem de coleta`}>
        <thead>
          <tr>
            <th scope="col">Coleta (UTC)</th>
            <th scope="col">Registro (UTC)</th>
            <th scope="col">Valor</th>
            <th scope="col">Origem</th>
            <th scope="col">Qualidade</th>
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
