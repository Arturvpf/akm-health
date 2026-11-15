import { useEffect, useState } from 'react';
import { ActionButton, ActionLink, Card, DataState, InformationNotice } from './design-system';
import { onDataChange } from './data-changes';
import { readAgenda } from './investigation-api';
import type { FollowupRead, Kind } from './types';
import { formatUtc, useDashboardSnapshot } from './use-dashboard';
import './experiments.css';

/**
 * AKM-37 — self-care journey (P2), ported from the Figma Make design and wired to the local API.
 * Points reward participation only: a stored reading or an acknowledged check-in.
 * Values never change points, nothing is deducted, and there is no ranking between crew members.
 */
const WINDOW_MS = 24 * 60 * 60 * 1000;
const CHECKIN_KEY = 'akm-selfcare-checkin-v1';

type ActivityId = 'checkin' | 'mood' | 'sleep' | 'follow';
type Activity = { id: ActivityId; label: string; detail: string; points: number; achievement: string };
const ACTIVITIES: readonly Activity[] = [
  { id: 'checkin', label: 'Daily check-in', detail: 'Acknowledge today’s routine', points: 20, achievement: 'First check-in' },
  { id: 'mood', label: 'Mood self-assessment', detail: 'A mood reading stored in the last 24 h', points: 15, achievement: 'Assessment completed' },
  { id: 'sleep', label: 'Log sleep hours', detail: 'A sleep reading stored in the last 24 h', points: 15, achievement: 'Routine followed' },
  { id: 'follow', label: 'Requested follow-up', detail: 'A follow-up check completed in the last 24 h', points: 25, achievement: 'Follow-up completed' },
];

function utcDay(now: number) { return new Date(now).toISOString().slice(0, 10); }
function readCheckins(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(CHECKIN_KEY) ?? '{}') as Record<string, string>; } catch { return {}; }
}
function writeCheckin(astronautId: string, day: string) {
  try { localStorage.setItem(CHECKIN_KEY, JSON.stringify({ ...readCheckins(), [astronautId]: day })); } catch { /* in-memory only */ }
}
function recent(iso: string | null | undefined, now: number) {
  if (!iso) return false;
  const time = Date.parse(iso);
  return Number.isFinite(time) && now - time >= 0 && now - time <= WINDOW_MS;
}

export function SelfCareJourney() {
  const dashboard = useDashboardSnapshot();
  const [astronautId, setAstronautId] = useState<string | null>(null);
  const [checkins, setCheckins] = useState(readCheckins);
  const [agenda, setAgenda] = useState<{ pending: FollowupRead[]; completed: FollowupRead[] } | null>(null);
  const [agendaError, setAgendaError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const now = Date.now();

  const [agendaRevision, setAgendaRevision] = useState(0);
  useEffect(() => onDataChange(() => setAgendaRevision(value => value + 1)), []);
  useEffect(() => {
    const controller = new AbortController();
    readAgenda(controller.signal).then(value => { setAgenda(value); setAgendaError(null); })
      .catch(() => { if (!controller.signal.aborted) setAgendaError('Follow-up checks are unavailable right now.'); });
    return () => controller.abort();
  }, [agendaRevision]);

  const crew = dashboard.data?.astronauts ?? [];
  const astronaut = crew.find(item => item.id === astronautId) ?? crew[0] ?? null;
  const latest = (kind: Kind) => astronaut?.latest_metrics[kind]?.measured_at;
  const mine = (item: FollowupRead) => item.astronaut_id === astronaut?.id || item.astronaut_id === null;
  const pendingFollowups = agenda?.pending.filter(mine) ?? [];
  const doneFollowup = agenda?.completed.filter(mine).find(item => recent(item.completed_at, now));

  const evidence: Record<ActivityId, string | null> = {
    checkin: astronaut && checkins[astronaut.id] === utcDay(now) ? `Acknowledged on ${utcDay(now)} (UTC)` : null,
    mood: recent(latest('mood_score'), now) ? `Mood reading at ${formatUtc(latest('mood_score')!)}` : null,
    sleep: recent(latest('sleep_hours'), now) ? `Sleep reading at ${formatUtc(latest('sleep_hours')!)}` : null,
    follow: doneFollowup?.completed_at ? `Follow-up #${doneFollowup.id} completed at ${formatUtc(doneFollowup.completed_at)}` : null,
  };
  const done = ACTIVITIES.filter(item => evidence[item.id]);
  const points = done.reduce((total, item) => total + item.points, 0);
  const progress = Math.round((done.length / ACTIVITIES.length) * 100);

  function acknowledge() {
    if (!astronaut) return;
    writeCheckin(astronaut.id, utcDay(Date.now()));
    setCheckins(readCheckins());
  }

  function action(item: Activity) {
    if (evidence[item.id]) return <span className="ds-badge tone-positive">+{item.points} pts</span>;
    if (item.id === 'checkin') return <ActionButton onClick={acknowledge} disabled={!astronaut}>Check in</ActionButton>;
    if (item.id === 'follow') return pendingFollowups.length
      ? <ActionLink href="#/investigation">Open {pendingFollowups.length} pending check(s)</ActionLink>
      : <span>No follow-up requested</span>;
    return <ActionLink href="#/register">Register</ActionLink>;
  }

  return <div className="experiment-stack">
    <InformationNotice label="AKM-37 · Participation, not health scoring">
      Points recognize completed routine activities, never health results. A reading counts the same whatever its value.
      Nothing is deducted for pending items, and crew members are not ranked against each other.
    </InformationNotice>
    <div role="status">
      {dashboard.phase === 'loading' && !dashboard.data && <DataState kind="loading">Loading crew activity from the local API.</DataState>}
      {dashboard.phase === 'error' && <DataState kind="error">{dashboard.error} <ActionButton onClick={dashboard.retry}>Retry</ActionButton></DataState>}
      {dashboard.data && !crew.length && <DataState kind="empty">No crew profiles are available. Seed the database to use the journey.</DataState>}
    </div>
    {astronaut && <>
      <Card heading="Self-care journey">
        <label className="ds-field" htmlFor="journey-astronaut">Crew member
          <select id="journey-astronaut" className="ds-control" value={astronaut.id} onChange={event => setAstronautId(event.target.value)}>
            {crew.map(item => <option key={item.id} value={item.id}>{item.name} · {item.id}</option>)}
          </select>
        </label>
        <div className="journey-score">
          <strong>{points}</strong><span>participation points · last 24 hours</span>
        </div>
        <div className="journey-progress">
          <span id="journey-progress-label">Planned activities completed: {done.length} of {ACTIVITIES.length}</span>
          <progress aria-labelledby="journey-progress-label" max={100} value={progress}>{progress}%</progress>
        </div>
        <ul className="journey-tasks">
          {ACTIVITIES.map(item => <li key={item.id} className={evidence[item.id] ? 'done' : undefined}>
            <span aria-hidden="true" className="journey-check">{evidence[item.id] ? '✓' : '○'}</span>
            <span><strong>{item.label}</strong><small>{evidence[item.id] ?? item.detail}</small></span>
            {action(item)}
          </li>)}
        </ul>
        {agendaError && <DataState kind="error">{agendaError}</DataState>}
      </Card>
      <Card heading="Achievements">
        <ul className="achievement-row">
          {ACTIVITIES.map(item => <li key={item.id} className={evidence[item.id] ? 'unlocked' : undefined}>
            <span aria-hidden="true">{evidence[item.id] ? '★' : '☆'}</span>
            {item.achievement}<span className="sr-only">{evidence[item.id] ? ' (unlocked)' : ' (locked)'}</span>
          </li>)}
        </ul>
        <button type="button" className="ds-action" aria-expanded={showHistory} onClick={() => setShowHistory(value => !value)}>
          {showHistory ? 'Hide activity evidence' : 'Show activity evidence'}
        </button>
        {showHistory && (done.length
          ? <ul>{done.map(item => <li key={item.id}><strong>{item.label}:</strong> {evidence[item.id]}</li>)}</ul>
          : <p>No activity recorded in the last 24 hours.</p>)}
        <p><strong>Safety rules:</strong> no points for normal readings, no penalties, no public ranking,
          no prompts to measure outside the schedule, and points are never a health score.</p>
      </Card>
    </>}
  </div>;
}
