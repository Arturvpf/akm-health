import { useRef, useState } from 'react';
import {
  ActionButton, ActionLink, Card, DataState, DataTable, Details, ProtocolLegend,
  QualityBadge, SelectField, SourceBadge, StatusBadge, type DataStateKind,
} from './design-system';
import { pageHref, type PageId } from './navigation';
import type { MeasurementCreate, NextCheck, Quality } from './types';

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

const history: ReadonlyArray<MeasurementCreate & { quality: Quality }> = [
  example,
  { kind: 'co2_ppm', value: 2200, unit: 'ppm', measured_at: '2026-11-14T05:05:00Z', source: 'synthetic', quality: 'suspect' },
  { kind: 'co2_ppm', value: 980, unit: 'ppm', measured_at: '2026-11-14T05:00:00Z', source: 'synthetic', quality: 'ok' },
];

const nextCheck = {
  kind: 'co2_ppm', astronaut_id: null, reason: 'Conferir nova leitura de CO₂ interno', effort: 'low',
} satisfies NextCheck;

const valueInPt = new Intl.NumberFormat('pt-BR');
const labels = { sleep_hours: 'Sono', heart_rate_bpm: 'Frequência cardíaca', mood_score: 'Humor', co2_ppm: 'CO₂ interno', cabin_temp_c: 'Temperatura interna' };

type InvestigationScenario = 'available' | DataStateKind;

const SCENARIOS = [
  { value: 'available', label: 'Resultado de exemplo' },
  { value: 'empty', label: 'Sem observações' },
  { value: 'loading', label: 'Carregamento' },
  { value: 'error', label: 'Falha de conexão' },
] as const;

function InvestigationPreview() {
  const [scenario, setScenario] = useState<InvestigationScenario>('available');
  const scenarioControl = useRef<HTMLSelectElement>(null);

  function completeUpdate() {
    scenarioControl.current?.focus();
    setScenario('success');
  }

  return (
    <Card heading="Resultado da investigação">
      <SelectField label="Cenário da demonstração" ref={scenarioControl}
        value={scenario === 'success' ? 'available' : scenario}
        onChange={(event) => {
          const selected = SCENARIOS.find(({ value }) => value === event.currentTarget.value);
          if (selected) setScenario(selected.value);
        }}>
        {SCENARIOS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
      </SelectField>
      <div className="state-feedback" role="status">
        {scenario === 'empty' && (
          <DataState kind="empty">Adicione observações de sono para avaliar a tripulação.</DataState>
        )}
        {scenario === 'loading' && (
          <DataState kind="loading">O último resultado disponível permanece abaixo durante a atualização simulada.</DataState>
        )}
        {scenario === 'error' && (
          <DataState kind="error">A atualização simulada falhou. O último resultado disponível permanece abaixo.</DataState>
        )}
        {scenario === 'success' && (
          <DataState kind="success">A conexão simulada foi restabelecida. O resultado de exemplo está disponível.</DataState>
        )}
      </div>
      {scenario === 'empty' ? (
        <div className="status-actions">
          <ActionLink href={pageHref('registrar')}>Adicionar medição</ActionLink>
        </div>
      ) : (
        <>
          <div className="status-actions">
            {scenario === 'error' && (
              <ActionButton onClick={completeUpdate}>Tentar novamente</ActionButton>
            )}
            {scenario === 'loading' && (
              <ActionButton onClick={completeUpdate}>Concluir carregamento simulado</ActionButton>
            )}
          </div>
          <section className="investigation-result">
            <h3>Último resultado disponível</h3>
            <div className="badge-row">
              <StatusBadge status="attention" />
              <SourceBadge source="synthetic" />
            </div>
            <Details items={[
              { label: 'Escopo', value: 'Tripulação · ODYSSEY-26' },
              { label: 'Análise', value: <time dateTime="2026-11-14T08:00:00Z">14/11/2026, 08:00 UTC</time> },
              { label: 'Janela de evidência', value: '13 a 14/11/2026 (UTC) · 4 perfis avaliados' },
              { label: 'Achado', value: 'Três perfis com redução de sono nos períodos comparados.' },
              { label: 'Evidência', value: 'Duas noites de Aurora, Orion e Vega.' },
              { label: 'Hipótese não confirmada', value: 'Coincidência com mudança no CO₂ interno. A coincidência não confirma uma causa.' },
              { label: 'Próxima checagem', value: `${nextCheck.reason} no habitat.` },
            ]} />
          </section>
          <section className="scientific-context">
            <h3>Base científica</h3>
            <SourceBadge source="nasa_reference" />
            <p><a href="https://humanresearchroadmap.nasa.gov/Risks/risk.aspx?i=100">NASA HRR-100 · Sono e desempenho</a></p>
          </section>
        </>
      )}
      <ProtocolLegend />
    </Card>
  );
}

export function MissionPreview({ page }: { page: PageId }) {
  switch (page) {
    case 'dashboard':
      return <Card heading="Tripulação">
        <SourceBadge source="synthetic" />
        <ul className="crew-list">
          {crew.map(person => <li key={person.id}><div><strong>{person.name}</strong><span>{person.role}</span></div><span>{person.sleep} de sono</span></li>)}
        </ul>
        <section className="data-group">
          <h3>Habitat interno</h3>
          <SourceBadge source="synthetic" />
          <p>980 ppm de CO₂ · 22,2 °C</p>
        </section>
        <section className="scientific-context">
          <h3>Referência pública NASA</h3>
          <SourceBadge source="nasa_reference" />
          <p><a href="https://www.nasa.gov/hrp/hazards/">Contexto científico · NASA HRP</a></p>
          <p>Dataset NASA pendente de seleção.</p>
        </section>
      </Card>;
    case 'registrar':
      return <Card heading="Exemplo de registro">
        <Details items={[
          { label: 'Indicador', value: labels[example.kind] },
          { label: 'Zona de medição', value: 'Astronauta' },
          { label: 'Tripulante', value: `Aurora · ${example.astronaut_id}` },
          { label: 'Duração', value: `${valueInPt.format(example.value)} ${example.unit}` },
          { label: 'Coleta', value: <time dateTime={example.measured_at}>14/11/2026, 07:00 UTC</time> },
          { label: 'Origem', value: <SourceBadge source={example.source} /> },
        ]} />
        <p>Use o wireframe para experimentar o preenchimento e o registro em memória.</p>
      </Card>;
    case 'historico':
      return <Card heading="Observações de exemplo">
        <DataTable label="Histórico simulado" caption="Observações simuladas em 14 de novembro de 2026">
          <thead>
            <tr>
              <th scope="col">Coleta (UTC)</th>
              <th scope="col">Alvo</th>
              <th scope="col">Indicador</th>
              <th scope="col">Valor</th>
              <th scope="col">Origem</th>
              <th scope="col">Qualidade</th>
            </tr>
          </thead>
          <tbody>{history.map(row => (
            <tr key={row.measured_at}>
              <td><time dateTime={row.measured_at}>{row.measured_at.slice(11, 16)}</time></td>
              <td>{row.astronaut_id ?? 'Habitat'}</td>
              <td>{labels[row.kind]}</td>
              <td>{valueInPt.format(row.value)} {row.unit}</td>
              <td><SourceBadge source={row.source} /></td>
              <td><QualityBadge quality={row.quality} /></td>
            </tr>
          ))}</tbody>
        </DataTable>
      </Card>;
    case 'investigacao':
      return <InvestigationPreview />;
  }
}
