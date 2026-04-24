import { redirect } from 'next/navigation';

export default function AcademyPage() {
  // v1_8 merges academy into Unicorn Playbook (page-playbook). Preserve the
  // /academy route so middleware PROTECTED_PREFIXES is unchanged but send
  // visitors to the live module.
  redirect('/playbook');
}
