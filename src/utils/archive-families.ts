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
    id: 'blueprints',
    title: 'Blueprints',
    description: 'Generative collections and the editions created from them.',
    status: 'Catalog recovery in progress',
  },
  {
    id: 'dynamic-blueprints',
    title: 'Dynamic Blueprints',
    description:
      'Evolving editions and expansion items, including Forever Supper.',
    status: 'Display restoration in progress',
  },
] as const;

export type ArchiveFamily = (typeof archiveFamilies)[number]['id'];
export function familyTitle(id: string) {
  return (
    archiveFamilies.find((f) => f.id === id)?.title ?? 'Collection under review'
  );
}
