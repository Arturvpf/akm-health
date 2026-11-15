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
    <InformationNotice label="Context comparison, not a real mission change">
      The stored mission remains ODYSSEY-26 (Mars). Changing the environment only changes the explanatory context, never measurements or rules.
    </InformationNotice>
    <Card heading="Selected mission context">
      <label className="ds-field" htmlFor="environment-choice">Hypothetical environment
        <select className="ds-control" id="environment-choice" value={id} onChange={event => select(event.target.value as EnvironmentId)}>
          {ENVIRONMENTS.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <dl className="experiment-details"><dt>Setting</dt><dd>{current.setting}</dd><dt>Reference gravity</dt><dd>{current.gravity}</dd></dl>
      <h3>Documented context factors</h3>
      <ul>{current.factors.map(factor => <li key={factor}>{factor}</li>)}</ul>
      <p><strong>Interpretation:</strong> {current.implications}</p>
      <p><strong>Limitation:</strong> {current.limitations}</p>
      <p><strong>NASA sources:</strong> {current.sources.map((source, i) => <span key={source.url}>{i > 0 ? ' · ' : ''}<a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a></span>)}</p>
    </Card>
  </div>;
}
