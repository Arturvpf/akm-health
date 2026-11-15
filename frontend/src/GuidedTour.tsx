import { useEffect, useState, useSyncExternalStore, type KeyboardEvent } from 'react';
import { isLinkLost, LINK_CHANGED_EVENT, setLinkLost } from './link-state';
import { ALL_NAVIGATION, pageHref, parsePage, type PageId } from './navigation';
import { getTourStep, setTourStep, subscribeTour } from './tour-state';
import './tour.css';

type TourAction = 'run-investigation' | 'toggle-link';

interface TourStep {
  page: PageId;
  title: string;
  text: string;
  action?: TourAction;
}

const STEPS: TourStep[] = [
  {
    page: 'dashboard',
    title: 'Meet the crew',
    text: 'Four fictional crew members live on a simulated Mars habitat. Their latest readings are here, and nothing has been analysed yet. The engine only runs when you ask it to.',
  },
  {
    page: 'investigation',
    title: 'Ask the engine to investigate',
    text: 'Pick the whole crew and run the investigation. The rules are plain code, so the same readings always give the same answer.',
    action: 'run-investigation',
  },
  {
    page: 'investigation',
    title: 'Read what it found',
    text: 'It reports a pattern to check, lists possible explanations (none confirmed) and names the one reading that would confirm or rule the pattern out.',
  },
  {
    page: 'register',
    title: 'Take the suggested reading',
    text: 'Choose the metric it asked for, such as cabin CO₂, enter the value and the time you took it, then save. The follow-up schedule and the dashboard update by themselves once the reading is confirmed.',
  },
  {
    page: 'investigation',
    title: 'Close the loop',
    text: 'Open the follow-up schedule, choose the pending check and link your new reading to it. Then reanalyse to see whether the pattern holds.',
  },
  {
    page: 'register',
    title: 'Keep working when the link drops',
    text: 'On a long mission the link to the server can be lost. Simulate that, record a reading, then restore the link and watch the queued reading arrive.',
    action: 'toggle-link',
  },
];

export function startTour() {
  setTourStep(0);
  window.location.hash = pageHref(STEPS[0].page);
}

function runInvestigationFromTour() {
  const button = document.querySelector<HTMLButtonElement>('form.investigation-fields button[type="submit"]');
  button?.click();
}

export function GuidedTour() {
  const step = useSyncExternalStore(subscribeTour, getTourStep, () => null);
  const [current, setCurrent] = useState<PageId>(() => parsePage(window.location.hash));
  const [linkLost, setLinkLostState] = useState(isLinkLost);

  useEffect(() => {
    const onHash = () => setCurrent(parsePage(window.location.hash));
    const onLink = () => setLinkLostState(isLinkLost());
    window.addEventListener('hashchange', onHash);
    window.addEventListener(LINK_CHANGED_EVENT, onLink);
    return () => {
      window.removeEventListener('hashchange', onHash);
      window.removeEventListener(LINK_CHANGED_EVENT, onLink);
    };
  }, []);

  useEffect(() => {
    document.documentElement.toggleAttribute('data-tour', step !== null);
    return () => document.documentElement.removeAttribute('data-tour');
  }, [step]);

  if (step === null || step >= STEPS.length) return null;
  const item = STEPS[step];
  const last = step === STEPS.length - 1;
  const here = current === item.page;
  const target = ALL_NAVIGATION.find(entry => entry.id === item.page)?.label ?? item.page;

  function go(next: number) {
    setTourStep(next);
    window.location.hash = pageHref(STEPS[next].page);
  }
  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') setTourStep(null);
  }

  return (
    <aside className="tour" role="region" aria-label="Guided demo" onKeyDown={onKeyDown}>
      <p className="tour-progress">Guided demo · step {step + 1} of {STEPS.length}</p>
      <h2 className="tour-title">{item.title}</h2>
      <p className="tour-text" aria-live="polite">{item.text}</p>
      {!here && <p className="tour-where">This step happens on the {target} screen. <a href={pageHref(item.page)}>Open {target}</a></p>}
      <div className="tour-actions">
        {item.action === 'run-investigation' && here && (
          <button type="button" className="tour-primary" onClick={runInvestigationFromTour}>Run it for me</button>
        )}
        {item.action === 'toggle-link' && (
          <button type="button" className="tour-primary" aria-pressed={linkLost} onClick={() => setLinkLost(!linkLost)}>
            {linkLost ? 'Restore link' : 'Simulate link loss'}
          </button>
        )}
        {step > 0 && <button type="button" onClick={() => go(step - 1)}>Back</button>}
        {last
          ? <button type="button" onClick={() => setTourStep(null)}>Finish</button>
          : <button type="button" className={item.action ? undefined : 'tour-primary'} onClick={() => go(step + 1)}>Next</button>}
        <button type="button" className="tour-quiet" onClick={() => setTourStep(null)}>Exit tour</button>
      </div>
    </aside>
  );
}
