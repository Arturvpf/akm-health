import type { DashboardResponse, InvestigationStatus, Kind, MetricSnapshot } from './types';

const UNITS: Record<Kind, string> = { sleep_hours: 'h', heart_rate_bpm: 'bpm', mood_score: '/ 5', co2_ppm: 'ppm', cabin_temp_c: '°C' };
const LABELS: Record<Kind, string> = {
  sleep_hours: 'Sleep', heart_rate_bpm: 'Heart rate', mood_score: 'Mood', co2_ppm: 'Cabin CO₂', cabin_temp_c: 'Cabin temperature',
};
const STATUS: Record<InvestigationStatus, string> = {
  normal: 'No pattern', attention: 'Check suggested', critical: 'Consult mission protocol', insufficient_data: 'Not enough data',
};
const stamp = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' });

export function escapeHtml(value: unknown): string {
  return String(value).replace(/[&<>"']/g, char => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] as string));
}

function when(value: string | null | undefined) {
  return value ? `${stamp.format(new Date(value))} UTC` : 'No time recorded';
}

/** Alert text can carry the observation window and limitations; the report keeps the finding only. */
function shortExplanation(text: string) {
  const cut = text.search(/ (Observation window:|Limitation:)/);
  return cut === -1 ? text : text.slice(0, cut);
}

function reading(kind: Kind, sample?: MetricSnapshot) {
  return sample ? `${Number(sample.value.toFixed(2))} ${UNITS[kind]}<br><small>${escapeHtml(when(sample.measured_at))}</small>` : 'No reading';
}

export function reportFileName(now: Date, extension: 'html' | 'json') {
  return `akm-downlink-report-${now.toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-')}Z.${extension}`;
}

/** One self-contained page for ground control. It prints to a single sheet and uses no external files. */
export function buildDownlinkReport(data: DashboardResponse, now: Date): string {
  const crew = data.astronauts.map(person => `<tr>
    <th scope="row">${escapeHtml(person.name)} · ${escapeHtml(person.id)}</th>
    <td>${escapeHtml(data.last_investigation_at ? STATUS[person.status] : 'Awaiting investigation')}</td>
    <td>${reading('sleep_hours', person.latest_metrics.sleep_hours)}</td>
    <td>${reading('heart_rate_bpm', person.latest_metrics.heart_rate_bpm)}</td>
    <td>${reading('mood_score', person.latest_metrics.mood_score)}</td></tr>`).join('');
  const cabin = (['co2_ppm', 'cabin_temp_c'] as const).map(kind => {
    const sample = data.environment.latest_metrics?.[kind];
    const value = sample?.value ?? data.environment[kind];
    return `<li><strong>${LABELS[kind]}:</strong> ${value === null || value === undefined ? 'No reading'
      : `${Number(value.toFixed(2))} ${UNITS[kind]}`}${sample ? ` (${escapeHtml(when(sample.measured_at))})` : ''}</li>`;
  }).join('');
  const findings = data.last_investigation_at
    ? (data.alerts.length ? data.alerts.map(alert => `<li><strong>${escapeHtml(STATUS[alert.level])}</strong><br>${escapeHtml(shortExplanation(alert.explanation))}</li>`).join('')
      : '<li>No alerts in the latest investigation.</li>')
    : '<li>No investigation has been run yet.</li>';
  const checks = data.pending_followups.length
    ? data.pending_followups.map(check => {
      const who = check.astronaut_id === null ? 'Habitat' : data.astronauts.find(p => p.id === check.astronaut_id)?.name ?? check.astronaut_id;
      return `<li><strong>${escapeHtml(LABELS[check.kind])}</strong> · ${escapeHtml(who)} · check #${check.id}<br>${escapeHtml(check.reason)}</li>`;
    }).join('')
    : '<li>No pending checks.</li>';
  const unanalyzed = data.has_unanalyzed_measurements
    ? '<p class="warn">New readings arrived after the latest investigation. The findings below may not include them.</p>' : '';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AKM Health downlink report</title>
<style>
  :root { color-scheme: light; }
  body { font: 14px/1.45 system-ui, sans-serif; color: #14202b; margin: 0 auto; max-width: 52rem; padding: 1.5rem; }
  h1 { font-size: 1.4rem; margin: 0 0 .25rem; } h2 { font-size: 1.05rem; margin: 1.2rem 0 .4rem; border-bottom: 1px solid #9aa7b4; padding-bottom: .2rem; }
  table { border-collapse: collapse; width: 100%; } th, td { text-align: left; vertical-align: top; padding: .35rem .5rem; border-bottom: 1px solid #d3dae1; }
  thead th { border-bottom: 2px solid #14202b; } ul { margin: .3rem 0; padding-left: 1.2rem; } li + li { margin-top: .4rem; }
  .meta, small, footer { color: #44525f; } .warn { border: 1px solid #8a5a00; background: #fff4d6; padding: .4rem .6rem; }
  .notice { border: 1px solid #44525f; padding: .5rem .7rem; margin: .8rem 0; }
  @media print { body { padding: 0; font-size: 11px; max-width: none; } @page { margin: 12mm; } h2 { break-after: avoid; } tr, li { break-inside: avoid; } }
</style></head><body>
<header>
  <h1>AKM Health · Downlink report for ground control</h1>
  <p class="meta">${escapeHtml(data.mission.name)} · Simulated mission, day ${escapeHtml(data.mission.day)} · Prepared ${escapeHtml(when(now.toISOString()))}<br>
  Latest investigation: ${escapeHtml(when(data.last_investigation_at))}</p>
</header>
<p class="notice"><strong>Simulated data.</strong> This report comes from a software demo with simulated crew readings. It is not a medical record,
a diagnosis or a clinical assessment, and every suggested check needs human review by mission staff.</p>
${unanalyzed}
<h2>Crew status</h2>
<table><thead><tr><th scope="col">Crew member</th><th scope="col">Assessment</th><th scope="col">Sleep</th><th scope="col">Heart rate</th><th scope="col">Mood</th></tr></thead>
<tbody>${crew || '<tr><td colspan="5">No crew profiles.</td></tr>'}</tbody></table>
<h2>Cabin environment</h2><ul>${cabin}</ul>
<h2>Findings</h2><ul>${findings}</ul>
<h2>Pending checks</h2><ul>${checks}</ul>
<h2>How to read this</h2>
<p>Findings come from fixed, documented rules (version demo-v1): two sleep observations on distinct days at or below 80% of the simulated baseline within 48 hours.
Cabin readings are shown as context only. A shared timing never proves a cause. Open the investigation in AKM Health for the rule, threshold and readings behind each finding.</p>
<footer><p>Background research: NASA Human Research Program and NASA Open Science Data Repository (OSDR). This project is not endorsed by or affiliated with NASA.
Built for the NASA Space Apps Challenge 2026.</p></footer>
</body></html>`;
}
