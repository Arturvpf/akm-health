import { useEffect, useState } from 'react';
import { InformationNotice } from './design-system';
import { isLinkLost, LINK_CHANGED_EVENT } from './link-state';

/** Explains why a server-backed page shows gaps while the simulated link to the mission server is down. */
export function LinkLostNotice({ page }: { page: string }) {
  const [lost, setLost] = useState(isLinkLost);
  useEffect(() => {
    const update = () => setLost(isLinkLost());
    window.addEventListener(LINK_CHANGED_EVENT, update);
    return () => window.removeEventListener(LINK_CHANGED_EVENT, update);
  }, []);
  if (!lost || page === 'home' || page === 'dashboard' || page === 'register') return null;
  return <InformationNotice label="Link to the mission server is down (simulated)">
    This page reads live data from the mission server, so some parts may be empty or show a retry message until the link returns.
    The Dashboard keeps its saved copy, and readings you record on the Register page are stored on this device and sent when the link is restored.
  </InformationNotice>;
}
