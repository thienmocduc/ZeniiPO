import { V1Page } from '@/lib/v1/Page';
import { V1DataBind } from '@/components/v1-data-bind';

export default function Page() {
  return (
    <V1DataBind pageId="page-compliance">
      <V1Page pageId="compliance" />
    </V1DataBind>
  );
}
