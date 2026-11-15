import { useState } from 'react';
import { ActionButton, Card } from './design-system';
import { buildDownlinkReport, reportFileName } from './downlink-report';
import type { DashboardResponse } from './types';

function save(content: string, type: string, name: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url; link.download = name;
  document.body.append(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function DownlinkReport({ data }: { data: DashboardResponse }) {
  const [message, setMessage] = useState('');
  const download = () => {
    const now = new Date();
    save(buildDownlinkReport(data, now), 'text/html;charset=utf-8', reportFileName(now, 'html'));
    setMessage('Report saved. Open the file to read or print it.');
  };
  const print = () => {
    const url = URL.createObjectURL(new Blob([buildDownlinkReport(data, new Date())], { type: 'text/html;charset=utf-8' }));
    const opened = window.open(url, '_blank');
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    setMessage(opened ? 'Report opened in a new tab. Use Print there to save it as a PDF.'
      : 'Your browser blocked the new tab. Use Download report instead.');
  };
  const downloadData = () => {
    const now = new Date();
    save(JSON.stringify({ generated_at: now.toISOString(), simulated: true, snapshot: data }, null, 2),
      'application/json', reportFileName(now, 'json'));
    setMessage('Data file saved.');
  };
  return <section aria-label="Downlink report">
    <Card heading="Downlink report">
      <p>Send ground control a one-page summary of crew status, findings and pending checks. It works offline and carries the simulated-data notice.</p>
      <div className="offline-actions">
        <ActionButton onClick={print}>Open printable report</ActionButton>
        <ActionButton onClick={download}>Download report</ActionButton>
        <ActionButton onClick={downloadData}>Download data (JSON)</ActionButton>
      </div>
      <p role="status" aria-live="polite">{message}</p>
    </Card>
  </section>;
}
