/**
 * V1Page — thin wrapper that renders a v1_8_FULL page section byte-for-byte.
 * Pulls the inner HTML of `<div class="page ..." id="page-{pageId}">` and
 * injects via dangerouslySetInnerHTML into an identically-classed wrapper.
 */

import { getPageInner } from './extract';

export function V1Page({ pageId }: { pageId: string }) {
  const html = getPageInner(pageId);
  return (
    <div
      className="page act"
      id={`page-${pageId}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
