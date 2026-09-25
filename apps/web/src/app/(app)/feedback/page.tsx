import { V1Page } from '@/lib/v1/Page';
import { V1DataBind } from '@/components/v1-data-bind';

export default function Page() {
  return (
    <V1DataBind pageId="page-fclb">
      <V1Page pageId="fclb" />
    </V1DataBind>
  );
}
