import type { DanbooruCharacterInfo, SauceNaoName, SeriesModel } from '@shared/models'
import { cleanEntityName, parseCharacterTag, toBooruTag } from '@shared/utils'
import { normalizeForMatch } from '../utils/fuzzyMatch'
import { qualifierNamesSeries } from '../utils/matchEntityNames'

export interface ResolvedCharacterCandidates {
  /** Each suggested character; a form/costume carries its base character in `parent`. */
  characters: SauceNaoName[]
  /** Series qualifiers worth offering (as a chip to confirm, never applied silently). */
  seriesHints: SauceNaoName[]
  /** Series Danbooru confirmed for these characters - trusted like a source's own series. */
  series: SauceNaoName[]
}

/** "pro swimmer" -> "Pro Swimmer"; leaves the rest of each word alone ("McDonald" stays). */
function titleCaseWords(value: string): string {
  return value.replace(
    /(^|\s)(\S)/g,
    (_, space: string, letter: string) => space + letter.toUpperCase()
  )
}

/**
 * Booru character tags pack the series and any form/costume into trailing
 * parentheses: "pyra_(pro_swimmer)_(xenoblade)", "inugami_korone_(1st_costume)",
 * "sylphiette_(mushoku_tensei)". Offering every one of them as a series (as
 * this app used to) suggested nonsense like a "Pro Swimmer" series and lost
 * the costume. The rule, following Danbooru's own naming convention:
 * - two or more qualifiers: the last is the series, the rest are the form.
 *   The series is only offered if it names one already in the library;
 * - a single qualifier is the series if it names a library series or one the
 *   source reported itself; otherwise, if the source did report a (different)
 *   series, it's a form ("1st costume" next to "hololive"); with no series
 *   info at all it's offered as a series to confirm, as before.
 * A form becomes "Base (Form)" with the base character as its `parent`.
 *
 * When Danbooru knows the tag (`danbooru`, see danbooruCharacters.service.ts)
 * its answer wins: the base character comes from its implications, whatever
 * qualifiers the base doesn't share are the form, and its series are trusted.
 */
export function resolveCharacterCandidates(
  characters: SauceNaoName[],
  sourceSeries: SauceNaoName[],
  librarySeries: SeriesModel[],
  danbooru: DanbooruCharacterInfo[] = []
): ResolvedCharacterCandidates {
  const infoByTag = new Map(danbooru.map((info) => [info.tag, info]))
  const confirmedSeries = new Map<string, SauceNaoName>()
  const libraryNames = librarySeries.flatMap((series) => [series.name, ...(series.aliases ?? [])])
  const findLibrarySeries = (qualifier: string): SeriesModel | undefined =>
    librarySeries.find((series) =>
      [series.name, ...(series.aliases ?? [])].some((name) => qualifierNamesSeries(qualifier, name))
    )
  const namesKnownSeries = (qualifier: string): boolean =>
    [...libraryNames, ...sourceSeries.map((series) => series.name)].some((name) =>
      qualifierNamesSeries(qualifier, name)
    )

  const resolved: SauceNaoName[] = []
  const hints = new Map<string, SauceNaoName>()
  const addHint = (name: string): void => {
    const key = normalizeForMatch(name)
    if (!hints.has(key)) hints.set(key, { name })
  }

  for (const character of characters) {
    // Sources strip qualifiers into `name` and keep the full tag as the first altName.
    const full = character.altNames?.find((alt) => alt.includes('(')) ?? character.name
    const { base, qualifiers } = parseCharacterTag(full)

    const info = infoByTag.get(toBooruTag(full))
    if (info && (info.parentTag || info.series.length > 0)) {
      const series: string[] = []
      for (const tag of info.series) {
        const name = titleCaseWords(cleanEntityName(tag))
        confirmedSeries.set(normalizeForMatch(name), { name })
        series.push(name)
      }
      if (!info.parentTag) {
        resolved.push({ ...character, name: base, altNames: [full], series })
        continue
      }
      const parentParts = parseCharacterTag(info.parentTag)
      const parentQualifiers = new Set(parentParts.qualifiers.map(normalizeForMatch))
      const forms = qualifiers.filter((q) => !parentQualifiers.has(normalizeForMatch(q)))
      const parent = {
        name: titleCaseWords(parentParts.base),
        altNames: [cleanEntityName(info.parentTag)],
        series
      }
      resolved.push(
        forms.length > 0
          ? {
              name: `${parent.name} ${forms.map((q) => `(${titleCaseWords(q)})`).join(' ')}`,
              altNames: [full],
              parent,
              series
            }
          : { ...parent, altNames: [full, ...parent.altNames] }
      )
      continue
    }

    let seriesQualifier: string | null = null
    let formQualifiers: string[] = []
    if (qualifiers.length >= 2) {
      seriesQualifier = qualifiers[qualifiers.length - 1]
      formQualifiers = qualifiers.slice(0, -1)
    } else if (qualifiers.length === 1) {
      if (namesKnownSeries(qualifiers[0]) || sourceSeries.length === 0) {
        seriesQualifier = qualifiers[0]
      } else {
        formQualifiers = qualifiers
      }
    }

    const repeatsSourceSeries =
      seriesQualifier !== null &&
      sourceSeries.some((series) => qualifierNamesSeries(seriesQualifier!, series.name))
    // A qualifier that only repeats a series the source already reported adds nothing.
    if (seriesQualifier && !repeatsSourceSeries) {
      const librarySeriesMatch = findLibrarySeries(seriesQualifier)
      if (librarySeriesMatch) addHint(librarySeriesMatch.name)
      // Nothing known to anchor it: keep the old behaviour of offering it to confirm.
      else if (qualifiers.length === 1 && sourceSeries.length === 0) addHint(seriesQualifier)
    }

    const baseAltNames = seriesQualifier ? [`${base} (${seriesQualifier})`] : []
    const series = seriesQualifier ? [seriesQualifier] : undefined
    if (formQualifiers.length === 0) {
      resolved.push({
        ...character,
        name: base,
        altNames: Array.from(new Set([full, ...baseAltNames])),
        series
      })
      continue
    }

    const parentName = titleCaseWords(base)
    const formName = `${parentName} ${formQualifiers.map((q) => `(${titleCaseWords(q)})`).join(' ')}`
    resolved.push({
      name: formName,
      altNames: [full],
      parent: { name: parentName, altNames: baseAltNames, series },
      series
    })
  }

  return {
    characters: resolved,
    seriesHints: [...hints.values()],
    series: [...confirmedSeries.values()]
  }
}
