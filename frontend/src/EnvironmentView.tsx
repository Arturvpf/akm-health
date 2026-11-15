import { useEffect, useState } from 'react';
import { Card, InformationNotice } from './design-system';
import { ENVIRONMENTS, environmentById, readEnvironment, writeEnvironment, type EnvironmentId } from './environment-data';

export function useSelectedEnvironment() {
  const [id, setId] = useState<EnvironmentId>(readEnvironment);
  useEffect(() => {
    const changed = () => setId(readEnvironment());
    window.addEventListener('akm-environment-change', changed);
    return () => window.removeEventListener('akm-environment-change', changed);
  }, []);
  return { current: environmentById(id), id, select: (next: EnvironmentId) => { setId(next); writeEnvironment(next); } };
}
export function EnvironmentSelector() {
  const { current, id, select } = useSelectedEnvironment();
  return <div className="experiment-stack">
    <InformationNotice label="AKM-35 · Comparação de contexto, não mudança real de missão">
      A missão persistida continua ODYSSEY-26 (Marte). Alterar o ambiente muda apenas os textos e o contexto demonstrativo, nunca as medições ou regras clínicas.
    </InformationNotice>
    <Card heading="Contexto de missão selecionado">
      <label className="ds-field" htmlFor="environment-choice">Ambiente hipotético
        <select className="ds-control" id="environment-choice" value={id} onChange={event => select(event.target.value as EnvironmentId)}>
          {ENVIRONMENTS.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <dl className="experiment-details"><dt>Cenário</dt><dd>{current.setting}</dd><dt>Referência gravitacional</dt><dd>{current.gravity}</dd></dl>
      <h3>Fatores contextuais documentados</h3>
      <ul>{current.factors.map(factor => <li key={factor}>{factor}</li>)}</ul>
      <p><strong>Interpretação:</strong> {current.implications}</p>
      <p><strong>Limitação:</strong> {current.limitations}</p>
      <p><strong>Fontes NASA:</strong> {current.sources.map((source, i) => <span key={source.url}>{i > 0 ? ' · ' : ''}<a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a></span>)}</p>
    </Card>
  </div>;
}
