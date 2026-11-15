import { useState } from 'react';
import { Card, InformationNotice } from './design-system';
import { useSelectedEnvironment } from './EnvironmentView';
import './experiments.css';

type Region = 'head' | 'chest' | 'movement' | 'habitat';
const REGIONS: Record<Region, { label: string; indicator: string; explanation: string; limitation: string; source: string }> = {
  head: { label: 'Cabeça / comportamento', indicator: 'Sono e bem-estar emocional (autorrelato)',
    explanation: 'Sono e comportamento são temas de pesquisa da NASA para desempenho humano em missões prolongadas.',
    limitation: 'O MVP não mede atividade cerebral, saúde mental clínica, ou órgão específico.',
    source: 'https://www.nasa.gov/hrp/hazard-isolation-and-confinement/' },
  chest: { label: 'Sistema cardiovascular (referência)', indicator: 'Frequência cardíaca pontual',
    explanation: 'A frequência cardíaca é um dado fisiológico contextual. Em missões espaciais, adaptações cardiovasculares são estudadas pela NASA.',
    limitation: 'Uma leitura de BPM não permite diagnosticar condições cardiovasculares nem determinar o efeito da gravidade.',
    source: 'https://www.nasa.gov/hrp/risks/' },
  movement: { label: 'Músculos e ossos (contexto)', indicator: 'Nenhum indicador muscular/ósseo no MVP',
    explanation: 'A NASA inclui adaptação musculoesquelética no estudo de diferentes campos gravitacionais.',
    limitation: 'O MVP não mede massa óssea, força ou perda muscular. Esta área é apenas educativa.',
    source: 'https://www.nasa.gov/hrp/hazards/' },
  habitat: { label: 'Habitat / ambiente externo ao corpo', indicator: 'CO₂ e temperatura do ar interno',
    explanation: 'As medições do ambiente são do habitat fictício, não dos órgãos do astronauta.',
    limitation: 'Não inferir exposição pessoal, resposta pulmonar ou causalidade a partir de uma leitura de cabine.',
    source: 'https://www.nasa.gov/hrp/hazard-hostile-closed-environments/' },
};
export function BodyExplorer() {
  const [selected, setSelected] = useState<Region>('head');
  const environment = useSelectedEnvironment();
  const region = REGIONS[selected];
  return <div className="experiment-stack">
    <InformationNotice label="AKM-36 · Atlas ilustrativo, não exame anatômico">
      Diagrama vetorial original, sem imagens clínicas. A seleção destaca associações educativas; não mede sinais vitais nem mostra diagnósticos. Use Tab e Enter/Espaço para navegar pelos botões.
    </InformationNotice>
    <div className="body-layout">
      <Card heading="Mapa esquemático do corpo e do habitat">
        <div className="body-stage">
          <svg className="body-silhouette" viewBox="0 0 260 430" role="img" aria-label="Silhueta humana esquemática frontal, com pontos educativos selecionáveis por botões externos" focusable="false">
            <g fill="#d5e3eb" stroke="#587a91" strokeWidth="2.5" strokeLinejoin="round">
              <ellipse cx="130" cy="53" rx="34" ry="41" />
              <path d="M119 91 L141 91 L147 107 L178 116 Q189 120 190 146 L181 234 L158 248 L152 403 Q143 417 132 405 L122 270 L112 405 Q101 417 92 400 L99 248 L79 234 L70 146 Q71 121 84 116 L114 107 Z" />
              <path d="M76 123 Q58 123 51 147 L23 264 Q18 282 32 285 Q44 284 49 271 L91 161" />
              <path d="M184 123 Q202 123 209 147 L237 264 Q242 282 228 285 Q216 284 211 271 L169 161" />
            </g>
            <path d="M130 113 V244 M102 171 H158" stroke="#93aebd" strokeWidth="2" strokeDasharray="5 6" />
          </svg>
          {([['head','Cabeça e sono'],['chest','Frequência cardíaca'],['movement','Músculos e ossos'],['habitat','Ambiente do habitat']] as const).map(([id, label]) =>
            <button key={id} type="button" className={`body-point body-point-${id}${selected === id ? ' active' : ''}`}
              aria-pressed={selected === id} aria-label={`Explorar: ${label}`} onClick={() => setSelected(id)}>
              <span aria-hidden="true">{id === 'habitat' ? 'H' : id === 'head' ? '1' : id === 'chest' ? '2' : '3'}</span>
            </button>)}
        </div>
        <p className="body-legend">1 · Sono/humor · 2 · FC · 3 · Músculos/ossos (sem medição) · H · Habitat</p>
        <div className="body-button-row">{(Object.entries(REGIONS) as [Region, typeof REGIONS[Region]][]).map(([id, item]) =>
          <button type="button" key={id} className="body-nav-button" aria-pressed={selected === id} onClick={() => setSelected(id)}>{item.label}</button>)}</div>
      </Card>
      <Card heading="Indicadores e interpretação">
        <section aria-live="polite" aria-atomic="true">
          <h3>{region.label}</h3>
          <p><strong>Relação com os dados:</strong> {region.indicator}</p>
          <p>{region.explanation}</p>
          <p><strong>Limite de interpretação:</strong> {region.limitation}</p>
          <p><a target="_blank" rel="noopener noreferrer" href={region.source}>Fonte científica NASA</a></p>
        </section>
        <hr />
        <h3>Contexto selecionado: {environment.current.name}</h3>
        <p>{environment.current.implications}</p>
        <p>Gravidade de referência: {environment.current.gravity}.</p>
        <p><strong>Observação:</strong> o mapa corporal não recalcula o motor de investigação, pois isso exigiria validação científica.</p>
        <p><a href="#/ambientes">Selecionar outro ambiente hipotético</a></p>
      </Card>
    </div>
  </div>;
}
