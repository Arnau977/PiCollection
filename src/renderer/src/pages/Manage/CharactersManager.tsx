import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pencil, Trash2 } from 'lucide-react'
import { useCharacters, useSeries } from '../../hooks/useEntityLists'
import { EntityThumbnail } from '../../components/EntityThumbnail'
import { MultiSelectAutocomplete } from '../../components/Autocomplete/MultiSelectAutocomplete'
import { filterByQuery } from '../../utils/filterByQuery'
import type { CharacterModel } from '@shared/models'

interface CharacterFormValues {
  name: string
  seriesIds: string[]
  aliases: string
}

const EMPTY_FORM: CharacterFormValues = { name: '', seriesIds: [], aliases: '' }

function toCsv(values: string[]): string {
  return values.join(', ')
}

function fromCsv(value: string): string[] {
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
}

export function CharactersManager(): JSX.Element {
  const { t } = useTranslation()
  const { data: characters, loading, refetch } = useCharacters()
  const series = useSeries()
  const [form, setForm] = useState<CharacterFormValues>(EMPTY_FORM)
  const [editing, setEditing] = useState<CharacterModel | null>(null)
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)

  const visibleCharacters = filterByQuery(characters, search, (character) => character.name)

  async function handleCreateSeries(name: string): Promise<void> {
    const result = await window.api.series.create({ name })
    if (result.success) {
      series.refetch()
      setForm((prev) => ({ ...prev, seriesIds: [...prev.seriesIds, result.data.id] }))
    } else {
      setError(result.error.message)
    }
  }

  function startEdit(character: CharacterModel): void {
    setEditing(character)
    setForm({
      name: character.name,
      seriesIds: character.series.map((s) => s.id),
      aliases: toCsv(character.aliases ?? [])
    })
  }

  function resetForm(): void {
    setEditing(null)
    setForm(EMPTY_FORM)
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    const trimmed = form.name.trim()
    if (!trimmed) return
    const input = {
      name: trimmed,
      seriesIds: form.seriesIds,
      aliases: fromCsv(form.aliases)
    }
    const result = editing
      ? await window.api.character.update(editing.id, input)
      : await window.api.character.create(input)
    if (result.success) {
      resetForm()
      setError(null)
      refetch()
    } else {
      setError(result.error.message)
    }
  }

  async function handleDelete(id: string, name: string): Promise<void> {
    if (!window.confirm(t('manage.confirmDelete', { name }))) return
    const result = await window.api.character.delete(id)
    if (result.success) {
      if (editing?.id === id) resetForm()
      refetch()
    } else {
      setError(result.error.message)
    }
  }

  return (
    <div className="manage-panel manage-panel-split">
      <div className="manage-form-panel">
        <h2>{editing ? t('manage.editingItem', { name: editing.name }) : t('manage.addNew')}</h2>
        <form className="manage-add-form-stacked" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="character-name">{t('manage.name')}</label>
            <input
              id="character-name"
              type="text"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            />
          </div>

          <MultiSelectAutocomplete
            name="character-series"
            label={t('manage.series')}
            options={series.data}
            getOptionLabel={(s) => s.name}
            getOptionValue={(s) => s.id}
            selectedValues={form.seriesIds}
            onChange={(seriesIds) => setForm((prev) => ({ ...prev, seriesIds }))}
            onCreate={handleCreateSeries}
          />

          <div className="field">
            <label htmlFor="character-aliases">{t('manage.aliases')}</label>
            <input
              id="character-aliases"
              type="text"
              value={form.aliases}
              onChange={(e) => setForm((prev) => ({ ...prev, aliases: e.target.value }))}
              placeholder={t('manage.aliasesPlaceholder')}
            />
            <span className="field-hint">{t('manage.aliasesHint')}</span>
          </div>

          <div className="manage-edit-actions">
            <button type="submit" className="btn btn-primary" disabled={!form.name.trim()}>
              {editing ? t('manage.save') : t('manage.add')}
            </button>
            {editing && (
              <button type="button" className="btn" onClick={resetForm}>
                {t('manage.cancel')}
              </button>
            )}
          </div>
        </form>

        {error && <p role="alert">{error}</p>}
      </div>

      <div className="manage-list-panel">
        <input
          type="search"
          className="manage-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('manage.searchPlaceholder')}
          aria-label={t('manage.searchLabel')}
        />

        {loading ? (
          <p className="loading-state">{t('gallery.loading')}</p>
        ) : characters.length === 0 ? (
          <p className="manage-empty">{t('manage.empty')}</p>
        ) : visibleCharacters.length === 0 ? (
          <p className="manage-empty">{t('manage.noResults')}</p>
        ) : (
          <ul className="manage-list">
            {visibleCharacters.map((character) => (
              <li
                key={character.id}
                className={
                  editing?.id === character.id
                    ? 'manage-list-item manage-list-item-editing'
                    : 'manage-list-item'
                }
              >
                <EntityThumbnail kind="character" id={character.id} />
                <div className="manage-item-info">
                  <span className="manage-item-name">{character.name}</span>
                  {character.series.length > 0 && (
                    <span className="manage-item-meta">
                      {character.series.map((s) => s.name).join(', ')}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`${t('manage.edit')} ${character.name}`}
                  onClick={() => startEdit(character)}
                >
                  <Pencil size={16} />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`${t('manage.delete')} ${character.name}`}
                  onClick={() => handleDelete(character.id, character.name)}
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
