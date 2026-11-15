import { useRef, useState } from 'react';
import {
  ActionButton, ActionLink, Card, DataState, Details, ProtocolLegend,
  SelectField, SourceBadge, StatusBadge, type DataStateKind, type DemoStatus,
} from './design-system';
import { MeasurementHistory } from './MeasurementHistory';
import { pageHref, type PageId } from './navigation';
import type { MeasurementCreate, NextCheck } from './types';

const example = {
  astronaut_id: 'A1', kind: 'sleep_hours', value: 5.4, unit: 'h',
  measured_at: '2026-11-14T07:00:00Z', source: 'synthetic', quality: 'ok',
} satisfies MeasurementCreate;

const nextCheck = {
  kind: 'co2_ppm', astronaut_id: null, reason: 'Conferir nova leitura de CO₂ interno', effort: 'low',
} satisfies NextCheck;

const valueInPt = new Intl.NumberFormat('pt-BR');
const labels = { sleep_hours: 'Sono', heart_rate_bpm: 'Frequência cardíaca', mood_score: 'Humor', co2_ppm: 'CO₂ interno', cabin_temp_c: 'Temperatura interna' };

const RESULT_EXAMPLES = {
  attention: [
    { label: 'Janela de evidência', value: '13 a 14/11/2026 (UTC) · 4 perfis avaliados' },
    { label: 'Achado', value: 'Três perfis com redução de sono nos períodos comparados.' },
    { label: 'Evidência', value: 'Duas noites de Aurora, Orion e Vega.' },
    { label: 'Hipótese não confirmada', value: 'Coincidência com mudança no CO₂ interno. A coincidência não confirma uma causa.' },
    { label: 'Próxima checagem', value: `${nextCheck.reason} no habitat.` },
  ],
  normal: [
    { label: 'Janela de evidência', value: '13 a 14/11/2026 (UTC) · 4 perfis avaliados' },
    { label: 'Achado', value: 'A regra experimental não identificou padrão coletivo de redução de sono.' },
    { label: 'Evidência', value: 'Quatro perfis têm duas noites comparáveis. Apenas Aurora atingiu o critério individual.' },
    { label: 'Próxima checagem', value: 'Nenhuma verificação coletiva sugerida neste resultado.' },
  ],
  insufficient_data: [
    { label: 'Janela de evidência', value: '13 a 14/11/2026 (UTC) · 1 perfil com dados suficientes' },
    { label: 'Achado', value: 'Pelo menos mais um perfil precisa ter duas noites comparáveis para aplicar a regra coletiva.' },
    { label: 'Evidência', value: 'Somente Aurora tem duas noites utilizáveis. Orion, Vega e Lyra têm uma noite cada.' },
    { label: 'Próxima checagem', value: 'Completar os dados de sono de Orion.' },
  ],
} as const satisfies Record<DemoStatus, ReadonlyArray<{ label: string; value: string }>>;

const SCENARIOS = [
  { type: 'result', value: 'attention', label: 'Resultado · Padrão a verificar' },
  { type: 'result', value: 'normal', label: 'Resultado · Sem padrão coletivo' },
  { type: 'result', value: 'insufficient_data', label: 'Resultado · Dados insuficientes' },
  { type: 'interface', value: 'empty', label: 'Sem observações' },
  { type: 'interface', value: 'loading', label: 'Carregamento' },
  { type: 'interface', value: 'error', label: 'Falha de conexão' },
] as const;

function InvestigationPreview() {
  const [resultStatus, setResultStatus] = useState<DemoStatus>('attention');
  const [dataState, setDataState] = useState<DataStateKind | null>(null);
  const scenarioControl = useRef<HTMLSelectElement>(null);

  function completeUpdate() {
    scenarioControl.current?.focus();
    setDataState('success');
  }

  return (
    <Card heading="Resultado da investigação">
      <SelectField label="Cenário da demonstração" ref={scenarioControl}
        value={dataState === null || dataState === 'success' ? resultStatus : dataState}
        onChange={(event) => {
          const selected = SCENARIOS.find(({ value }) => value === event.currentTarget.value);
          if (!selected) return;
          if (selected.type === 'result') {
            setResultStatus(selected.value);
            setDataState(null);
          } else {
            setDataState(selected.value);
          }
        }}>
        {SCENARIOS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
      </SelectField>
      <div className="state-feedback" role="status">
        {dataState === 'empty' && (
          <DataState kind="empty">Adicione observações de sono para avaliar a tripulação.</DataState>
        )}
        {dataState === 'loading' && (
          <DataState kind="loading">O último resultado disponível permanece abaixo durante a atualização simulada.</DataState>
        )}
        {dataState === 'error' && (
          <DataState kind="error">A atualização simulada falhou. O último resultado disponível permanece abaixo.</DataState>
        )}
        {dataState === 'success' && (
          <DataState kind="success">O resultado de exemplo está disponível.</DataState>
        )}
      </div>
      {dataState === 'empty' ? (
        <div className="status-actions">
          <ActionLink href={pageHref('registrar')}>Adicionar medição</ActionLink>
        </div>
      ) : (
        <>
          <div className="status-actions">
            {dataState === 'error' && (
              <ActionButton onClick={completeUpdate}>Tentar novamente</ActionButton>
            )}
            {dataState === 'loading' && (
              <ActionButton onClick={completeUpdate}>Concluir carregamento simulado</ActionButton>
            )}
          </div>
          <section className="investigation-result">
            <h3>Último resultado disponível</h3>
            <div className="badge-row">
              <StatusBadge status={resultStatus} />
              <SourceBadge source="synthetic" />
            </div>
            <Details items={[
              { label: 'Escopo', value: 'Tripulação · ODYSSEY-26' },
              { label: 'Análise', value: <time dateTime="2026-11-14T08:00:00Z">14/11/2026, 08:00 UTC</time> },
              ...RESULT_EXAMPLES[resultStatus],
            ]} />
            {resultStatus === 'insufficient_data' && (
              <ActionLink href={pageHref('registrar')}>Adicionar medição</ActionLink>
            )}
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

export function MissionPreview({ page }: { page: Exclude<PageId, 'dashboard'> }) {
  switch (page) {
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
      return <MeasurementHistory />;
    case 'investigacao':
      return <InvestigationPreview />;
  }
}
