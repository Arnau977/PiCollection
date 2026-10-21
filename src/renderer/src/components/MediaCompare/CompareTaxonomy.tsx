import { useTranslation } from 'react-i18next'
import {
  TAXONOMY_CATEGORIES,
  countNames,
  diffTaxonomy,
  type ComparedTaxonomy
} from './taxonomyDiff'

/** One group's chips, colored per category (characters, series, tags). */
function NameChips({ names }: { names: ComparedTaxonomy }): JSX.Element {
  return (
    <ul className="chip-list media-compare-chips">
      {TAXONOMY_CATEGORIES.flatMap((category) =>
        names[category].map((name) => (
          <li key={`${category}:${name}`} className={`chip-category-${category}`}>
            {name}
          </li>
        ))
      )}
    </ul>
  )
}

function OnlyHere({ names }: { names: ComparedTaxonomy }): JSX.Element {
  const { t } = useTranslation()
  const count = countNames(names)
  return (
    <section className="media-compare-taxonomy-group">
      <h3>{t('mediaCompare.onlyHere', { count })}</h3>
      {count > 0 ? (
        <NameChips names={names} />
      ) : (
        <p className="media-compare-taxonomy-empty">{t('mediaCompare.nothingExtra')}</p>
      )}
    </section>
  )
}

/**
 * Side by side, under the two pictures: what only each file has (under its
 * picture), then what both share once, full width - the shared names would
 * otherwise be listed twice.
 */
export function CompareTaxonomy({
  left,
  right
}: {
  left: ComparedTaxonomy
  right: ComparedTaxonomy
}): JSX.Element {
  const { t } = useTranslation()
  const diff = diffTaxonomy(left, right)
  const shared = countNames(diff.both)
  return (
    <div className="media-compare-taxonomy">
      <OnlyHere names={diff.onlyLeft} />
      <OnlyHere names={diff.onlyRight} />
      {shared > 0 && (
        <section className="media-compare-taxonomy-group media-compare-taxonomy-both">
          <h3>{t('mediaCompare.onBoth', { count: shared })}</h3>
          <NameChips names={diff.both} />
        </section>
      )}
    </div>
  )
}
