import type { PageId } from './navigation';
import type { MeasurementCreate, NextCheck } from './types';

const crew = [
  { id: 'A1', name: 'Aurora', role: 'Comando', sleep: '5,4 h' },
  { id: 'A2', name: 'Orion', role: 'Engenharia', sleep: '5,7 h' },
  { id: 'A3', name: 'Vega', role: 'Pesquisa', sleep: '5,6 h' },
  { id: 'A4', name: 'Lyra', role: 'Operações', sleep: '7,9 h' },
];

const example = {
  astronaut_id: 'A1', kind: 'sleep_hours', value: 5.4, unit: 'h',
  measured_at: '2026-11-14T07:00:00Z', source: 'synthetic', quality: 'ok',
} satisfies MeasurementCreate;

const history: MeasurementCreate[] = [
  example,
  { kind: 'co2_ppm', value: 2200, unit: 'ppm', measured_at: '2026-11-14T05:05:00Z', source: 'synthetic', quality: 'suspect' },
  { kind: 'co2_ppm', value: 980, unit: 'ppm', measured_at: '2026-11-14T05:00:00Z', source: 'synthetic', quality: 'ok' },
];

const nextCheck = {
  kind: 'co2_ppm', astronaut_id: null, reason: 'Conferir nova leitura de CO₂ interno', effort: 'low',
} satisfies NextCheck;

const valueInPt = new Intl.NumberFormat('pt-BR');
const labels = { sleep_hours: 'Sono', heart_rate_bpm: 'Frequência cardíaca', mood_score: 'Humor', co2_ppm: 'CO₂ interno', cabin_temp_c: 'Temperatura interna' };

export function MissionPreview({ page }: { page: PageId }) {
  switch (page) {
    case 'dashboard':
      return <>
        <h2>Tripulação</h2>
        <ul className="crew-list">
          {crew.map(person => <li key={person.id}><div><strong>{person.name}</strong><span>{person.role}</span></div><span>{person.sleep} de sono</span></li>)}
        </ul>
        <p>Habitat interno · 980 ppm de CO₂ · 22,2 °C</p>
        <a href="https://www.nasa.gov/hrp/hazards/">Contexto científico · NASA HRP</a>
      </>;
    case 'registrar':
      return <>
        <h2>Exemplo de registro</h2>
        <dl className="preview-details">
          <dt>Indicador</dt><dd>{labels[example.kind]}</dd>
          <dt>Tripulante</dt><dd>Aurora · {example.astronaut_id}</dd>
          <dt>Duração</dt><dd>{valueInPt.format(example.value)} {example.unit}</dd>
          <dt>Coleta</dt><dd><time dateTime={example.measured_at}>14/11/2026, 07:00 UTC</time></dd>
          <dt>Origem</dt><dd>Simulada</dd>
        </dl>
        <p>Use o wireframe para experimentar o preenchimento e o registro em memória.</p>
      </>;
    case 'historico':
      return <>
        <h2>Observações de exemplo</h2>
        <div className="table-scroll" role="region" aria-label="Histórico simulado" tabIndex={0}>
          <table><caption className="sr-only">Observações simuladas em 14 de novembro de 2026</caption>
            <thead><tr><th scope="col">Coleta (UTC)</th><th scope="col">Alvo</th><th scope="col">Indicador</th><th scope="col">Valor</th><th scope="col">Qualidade</th></tr></thead>
            <tbody>{history.map(row => <tr key={row.measured_at}>
              <td><time dateTime={row.measured_at}>{row.measured_at.slice(11, 16)}</time></td>
              <td>{row.astronaut_id ?? 'Habitat'}</td><td>{labels[row.kind]}</td>
              <td>{valueInPt.format(row.value)} {row.unit}</td><td>{row.quality === 'suspect' ? 'Suspeita' : 'Válida'}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </>;
    case 'investigacao':
      return <>
        <h2><span aria-hidden="true">△ </span>Atenção demonstrativa</h2>
        <dl className="preview-details">
          <dt>Achado</dt><dd>Três perfis com redução de sono nos períodos comparados.</dd>
          <dt>Evidência</dt><dd>Duas noites de Aurora, Orion e Vega.</dd>
          <dt>Hipótese</dt><dd>Coincidência com mudança no CO₂ interno. A hipótese permanece não confirmada.</dd>
          <dt>Próxima checagem</dt><dd>{nextCheck.reason} no habitat.</dd>
        </dl>
      </>;
  }
}
