export const archiveFamilies = [
  {
    id: 'classic',
    title: 'Async Classic',
    description:
      'Layered art, collector controls, and works that change with time.',
    status: 'Explore the archive',
  },
  {
    id: 'music',
    title: 'Async Music',
    description: 'Programmable compositions, musical masters, and their stems.',
    status: 'Listen to restored stems',
  },
  {
    id: 'music-blueprints',
    title: 'Music Blueprints',
    description:
      'Generative music and audio editions, grouped by their original projects. Each minted mix is fixed.',
    status: 'Explore recovered music projects',
  },
  {
    id: 'blueprints',
    title: 'Blueprints',
    description:
      'Generative collections with editions that are fixed once minted.',
    status: 'Browse recovered edition previews',
  },
  {
    id: 'dynamic-blueprints',
    title: 'Dynamic Blueprints',
    description:
      'Evolving editions and expansion items, including Forever Supper.',
    status: 'Browse expansion previews',
  },
] as const;

export type ArchiveFamily = (typeof archiveFamilies)[number]['id'];
export function familyTitle(id: string) {
  return (
    archiveFamilies.find((f) => f.id === id)?.title ?? 'Collection under review'
  );
}
