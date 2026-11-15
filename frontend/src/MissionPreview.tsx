import { Card, Details, SourceBadge } from './design-system';
import { InvestigationPage } from './InvestigationPage';
import { MeasurementHistory } from './MeasurementHistory';
import type { PageId } from './navigation';
import type { MeasurementCreate } from './types';

const example = {
  astronaut_id: 'A1', kind: 'sleep_hours', value: 5.4, unit: 'h',
  measured_at: '2026-11-14T07:00:00Z', source: 'synthetic', quality: 'ok',
} satisfies MeasurementCreate;

const valueInPt = new Intl.NumberFormat('pt-BR');
const labels = { sleep_hours: 'Sono', heart_rate_bpm: 'Frequência cardíaca', mood_score: 'Humor', co2_ppm: 'CO₂ interno', cabin_temp_c: 'Temperatura interna' };

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
      return <InvestigationPage />;
  }
}
