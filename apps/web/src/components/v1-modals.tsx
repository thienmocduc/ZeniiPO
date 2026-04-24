/**
 * V1Modals — renders the modal/overlay block from v1_8_FULL.html
 * (training overlay, training completion modal, agent modal, command palette,
 * flash message, ⌘K hint). Lives outside the app shell so it overlays
 * everything. Kept as raw HTML so inline onclick="exitDrill()" / "closeAgentModal()"
 * etc. attributes resolve against `window.X` functions exposed by V1Interactivity.
 */

import { getModalsHtml } from '@/lib/v1/extract';

export function V1Modals() {
  const html = getModalsHtml();
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
