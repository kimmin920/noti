import { redirect } from 'next/navigation';

export default function LegacySmsSendPage() {
  redirect('/send/sms/single');
}
