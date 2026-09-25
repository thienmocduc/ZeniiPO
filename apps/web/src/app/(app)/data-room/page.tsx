import { V1Page } from '@/lib/v1/Page';
import { V1DataBind } from '@/components/v1-data-bind';

// TODO(zeniipo): wire to /api/data-room once a list endpoint exists.
// For now we render the v1_8 static markup unchanged. The dataroom page
// already shows curated investor folder structure which is meaningful
// even without per-document live data.

export default function Page() {
  return (
    <V1DataBind pageId="page-dataroom">
      <V1Page pageId="dataroom" />
    </V1DataBind>
  );
}
