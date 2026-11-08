import { describe, expect, it } from 'vitest';
import {
  browseBlueprintProjects,
  getBlueprintProject,
  groupBlueprintProjects,
} from '@/utils/blueprint-projects';
import { getBlueprintRecords, searchArchive } from '@/utils/archive-search';

describe('Blueprint project discovery', () => {
  it('accounts for every indexed edition once, using project identity', () => {
    const result = browseBlueprintProjects();
    expect(result.allProjects).toBe(234);
    expect(result.editions).toBe(getBlueprintRecords().length);
    expect(result.projects[0].count).toBe(3000);
  });
  it('keeps identical display titles from different projects separate', () => {
    const base = getBlueprintRecords()[0];
    const groups = groupBlueprintProjects([
      {
        ...base,
        id: 'a',
        blueprintId: 'one',
        collection: undefined,
        name: 'Same #1',
      },
      {
        ...base,
        id: 'b',
        blueprintId: 'two',
        collection: undefined,
        name: 'Same #2',
      },
      {
        ...base,
        id: 'c',
        blueprintId: 'one',
        collection: undefined,
        name: 'Variant #3',
      },
    ]);
    expect(groups).toHaveLength(2);
    expect(groups.find((g) => g.id === 'one')?.count).toBe(2);
  });
  it('uses recovered collection names for projects with different edition titles', () => {
    const project = getBlueprintProject('63c6a6dcf62b887926f9359c');
    expect(project?.name).toBe('Metamorphic');
    expect(
      browseBlueprintProjects('Autonomy').projects.some(
        (p) => p.id === project?.id,
      ),
    ).toBe(true);
  });
  it('finds artists without accent sensitivity and paginates projects without overlap', () => {
    expect(
      browseBlueprintProjects('Des Lucrece').projects.some(
        (p) => p.name === 'Defy',
      ),
    ).toBe(true);
    const first = browseBlueprintProjects('', 'name', 1);
    const second = browseBlueprintProjects('', 'name', 2);
    expect(first.projects).toHaveLength(24);
    expect(
      second.projects.every((p) => !first.projects.some((a) => a.id === p.id)),
    ).toBe(true);
    expect(browseBlueprintProjects('', 'name', -1).page).toBe(1);
  });
  it('constrains edition search and pagination to the exact project', () => {
    const id = '61b6c374bd2df4be86ef7aa5';
    const first = searchArchive('', 'blueprints', 1, 'all', id);
    const second = searchArchive('', 'blueprints', 2, 'all', id);
    expect(first.total).toBe(625);
    expect(first.results.every((r) => r.blueprintId === id)).toBe(true);
    expect(
      second.results.every((r) => !first.results.some((a) => a.id === r.id)),
    ).toBe(true);
    expect(searchArchive('Autonomy', 'blueprints', 1, 'all', id).total).toBe(0);
    expect(getBlueprintProject('unknown')).toBeUndefined();
  });
});
