import { V1Page } from '@/lib/v1/Page';
import { V1DataBind } from '@/components/v1-data-bind';

export default function Page() {
  return (
    <V1DataBind pageId="page-settings">
      <V1Page pageId="settings" />
    </V1DataBind>
  );
}
