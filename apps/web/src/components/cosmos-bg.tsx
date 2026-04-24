/**
 * CosmosBg — renders the exact v1_8_FULL <div class="cosmic"> background
 * (orbs + starfield) + the SVG gradient defs block via dangerouslySetInnerHTML.
 */

import { getCosmicHtml } from '@/lib/v1/extract';

export function CosmosBg() {
  const html = getCosmicHtml();
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
