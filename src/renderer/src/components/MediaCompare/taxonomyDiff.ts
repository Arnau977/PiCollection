import type { MediaModel } from '@shared/models'

/** The names on one compared file, per category. */
export interface ComparedTaxonomy {
  characters: string[]
  series: string[]
  tags: string[]
}

export type TaxonomyCategory = keyof ComparedTaxonomy

export const TAXONOMY_CATEGORIES: TaxonomyCategory[] = ['characters', 'series', 'tags']

export function taxonomyOf(
  media: Partial<Pick<MediaModel, 'characters' | 'series' | 'tags'>>
): ComparedTaxonomy {
  return {
    characters: (media.characters ?? []).map(({ name }) => name),
    series: (media.series ?? []).map(({ name }) => name),
    tags: (media.tags ?? []).map(({ name }) => name)
  }
}

/** The names of the picked ids, in pick order; ids missing from `options` are skipped. */
export function namesByIds(
  ids: string[] | undefined,
  options: { id: string; name: string }[]
): string[] {
  const nameById = new Map(options.map(({ id, name }) => [id, name]))
  return (ids ?? []).flatMap((id) => nameById.get(id) ?? [])
}

export interface TaxonomyDiff {
  onlyLeft: ComparedTaxonomy
  onlyRight: ComparedTaxonomy
  both: ComparedTaxonomy
}

/** Splits two files' names into what only one side has and what both share. */
export function diffTaxonomy(left: ComparedTaxonomy, right: ComparedTaxonomy): TaxonomyDiff {
  const diff: TaxonomyDiff = {
    onlyLeft: { characters: [], series: [], tags: [] },
    onlyRight: { characters: [], series: [], tags: [] },
    both: { characters: [], series: [], tags: [] }
  }
  for (const category of TAXONOMY_CATEGORIES) {
    const rightNames = new Set(right[category])
    const leftNames = new Set(left[category])
    for (const name of left[category]) {
      diff[rightNames.has(name) ? 'both' : 'onlyLeft'][category].push(name)
    }
    diff.onlyRight[category] = right[category].filter((name) => !leftNames.has(name))
  }
  return diff
}

export function countNames(taxonomy: ComparedTaxonomy): number {
  return TAXONOMY_CATEGORIES.reduce((total, category) => total + taxonomy[category].length, 0)
}
