/** Position in the guided demo. Kept in sessionStorage so a reload keeps the place; null means no tour. */
const KEY = 'akm-tour-step-v1';
const listeners = new Set<() => void>();

function read(): number | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    const value = raw === null ? NaN : Number(raw);
    return Number.isInteger(value) && value >= 0 ? value : null;
  } catch { return null; }
}

let step: number | null = typeof window === 'undefined' ? null : read();

export function getTourStep(): number | null { return step; }

export function setTourStep(next: number | null) {
  step = next;
  try {
    if (next === null) sessionStorage.removeItem(KEY); else sessionStorage.setItem(KEY, String(next));
  } catch { /* The tour still works for this page view. */ }
  for (const listener of listeners) listener();
}

export function subscribeTour(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
