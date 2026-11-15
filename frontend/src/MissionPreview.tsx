import { Card, Details, SourceBadge } from './design-system';
import { InvestigationPage } from './InvestigationPage';
import { MeasurementHistory } from './MeasurementHistory';
import type { PageId } from './navigation';
import type { MeasurementCreate } from './types';

const example = {
  astronaut_id: 'A1', kind: 'sleep_hours', value: 5.4, unit: 'h',
  measured_at: '2026-11-14T07:00:00Z', source: 'synthetic', quality: 'ok',
} satisfies MeasurementCreate;

const valueFormat = new Intl.NumberFormat('en-US');
const labels = { sleep_hours: 'Sleep', heart_rate_bpm: 'Heart rate', mood_score: 'Mood', co2_ppm: 'Cabin CO₂', cabin_temp_c: 'Cabin temperature' };

export function MissionPreview({ page }: { page: Exclude<PageId, 'dashboard'> }) {
  switch (page) {
    case 'register':
      return <Card heading="Registration example">
        <Details items={[
          { label: 'Metric', value: labels[example.kind] },
          { label: 'Measurement zone', value: 'Astronaut' },
          { label: 'Crew member', value: `Aurora · ${example.astronaut_id}` },
          { label: 'Duration', value: `${valueFormat.format(example.value)} ${example.unit}` },
          { label: 'Observed', value: <time dateTime={example.measured_at}>Nov 14, 2026, 07:00 UTC</time> },
          { label: 'Source', value: <SourceBadge source={example.source} /> },
        ]} />
      </Card>;
    case 'history':
      return <MeasurementHistory />;
    case 'investigation':
      return <InvestigationPage />;
  }
}
