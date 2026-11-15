import { useMemo, useState } from 'react';
import { Card, InformationNotice } from './design-system';
import { EnvironmentSelector } from './EnvironmentView';
import { SAMPLE_PROFILES, SAMPLE_HABITAT, DISPLAY_METRICS, compareMetric } from './scenario-data';
import type { Kind } from './types';
import './experiments.css';

const print = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2, signDisplay: 'exceptZero' });
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
    <InformationNotice label="AKM-34 · Simulação hipotética">
      Referência: seed fictício da ODYSSEY-26 (segunda noite), não dados de saúde reais. Valores alternativos são hipóteses digitadas. Diferenças numéricas não indicam risco, benefício, diagnóstico ou previsão.
    </InformationNotice>
    <Card heading="Premissas do comparador">
      <label className="ds-field" htmlFor="compare-profile">Perfil sintético da referência
        <select id="compare-profile" className="ds-control" value={person} onChange={event => { setPerson(event.target.value); setOverrides({}); }}>
          {SAMPLE_PROFILES.map(item => <option key={item.id} value={item.id}>{item.name} · {item.id}</option>)}
        </select>
      </label>
      <p>O indicador de sono representa horas estimadas de um período; a FC é pontual; humor é ordinal. CO₂ e temperatura referem-se à cabine, não ao corpo. Dados ausentes permanecem ausentes, não viram zero.</p>
      <p><strong>Origem:</strong> `backend/app/seed.py` — registros `source=synthetic`, não medidos pela NASA.</p>
    </Card>
    <Card heading="Comparação de observações">
      <div className="table-scroll"><table className="scenario-table">
        <caption>Referência simulada versus hipótese manual, sem escore clínico</caption>
        <thead><tr><th scope="col">Indicador</th><th scope="col">Referência</th><th scope="col">Hipótese editável</th><th scope="col">Diferença</th></tr></thead>
        <tbody>{comparisons.map(({ metric, result }) => <tr key={metric.id}>
          <th scope="row">{metric.label}<small> {metric.unit}</small></th>
          <td>{result.baseline === null ? 'Não medido' : `${result.baseline.toLocaleString('pt-BR')} ${metric.unit}`}</td>
          <td><label className="sr-only" htmlFor={`hypo-${metric.id}`}>Valor hipotético de {metric.label}</label>
            <input id={`hypo-${metric.id}`} className="ds-control" inputMode="decimal" type="number"
              min={metric.min} max={metric.max} step={metric.step} value={overrides[metric.id] ?? result.baseline ?? ''}
              onChange={event => setOverrides(previous => ({ ...previous, [metric.id]: event.target.value }))} />
          </td>
          <td>{result.difference === null ? 'Indisponível' : `${print.format(result.difference)} ${metric.unit}`}</td>
        </tr>)}</tbody>
      </table></div>
      <div className="experiment-actions"><button type="button" className="ds-action" onClick={() => setOverrides({})}>Restaurar referência</button></div>
      <p><strong>Limite:</strong> esses valores não são parâmetros para recomendar condutas ou emitir alertas. O motor médico do projeto não é chamado por esta página.</p>
    </Card>
    <EnvironmentSelector />
  </div>;
}
