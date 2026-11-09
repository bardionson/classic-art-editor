import { redirect } from 'next/navigation';

export default async function ArtPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const searchParams = await props.searchParams;
  const version = Array.isArray(searchParams.version)
    ? searchParams.version[0]
    : searchParams.version;
  const id = Array.isArray(searchParams.id)
    ? searchParams.id[0]
    : searchParams.id;

  if (version && id) {
    redirect(`/${version}/${id}`);
  }

  return <div>Invalid version or ID</div>;
}
