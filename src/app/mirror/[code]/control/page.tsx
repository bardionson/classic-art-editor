import MirrorControlPanel from '@/components/mirror/mirror-control-panel';

export default async function MirrorControlPage(props: {
  params: Promise<{ code: string }>;
}) {
  const params = await props.params;
  return <MirrorControlPanel code={params.code} />;
}
