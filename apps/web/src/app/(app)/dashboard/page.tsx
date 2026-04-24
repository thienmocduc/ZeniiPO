import { V1Page } from '@/lib/v1/Page';
import { CascadeButton } from '@/components/cascade/cascade-button';
import { V1DataBind } from '@/components/v1-data-bind';

export default function Page() {
  return (
    <V1DataBind pageId="page-dash">
      <V1Page pageId="dash" />
      <CascadeButton />
    </V1DataBind>
  );
}
