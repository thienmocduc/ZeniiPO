/**
 * V1Page — thin wrapper that renders a v1_8_FULL page section byte-for-byte
 * and auto-wires data binding via V1DataBind.
 */

import { V1DataBind } from '@/components/v1-data-bind';
import { getPageInner } from './extract';

export function V1Page({ pageId }: { pageId: string }) {
  const html = getPageInner(pageId);
  return (
    <V1DataBind pageId={`page-${pageId}`}>
      <div
        className="page act"
        id={`page-${pageId}`}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </V1DataBind>
  );
}
