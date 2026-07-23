import MirrorControlPanel from '@/components/mirror/mirror-control-panel';

export default function MirrorControlPage({
  params,
}: {
  params: { code: string };
}) {
  return <MirrorControlPanel code={params.code} />;
}
