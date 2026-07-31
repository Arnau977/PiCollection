import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useArtists } from '../../hooks/useEntityLists'
import { EntityThumbnail } from '../../components/EntityThumbnail'
import { filterByQuery } from '../../utils/filterByQuery'
import type { ArtistModel } from '@shared/models'

export function ArtistsManager(): JSX.Element {
  const { t } = useTranslation()
  const { data: artists, loading, refetch } = useArtists()
  const [name, setName] = useState('')
  const [editing, setEditing] = useState<ArtistModel | null>(null)
  const [socialName, setSocialName] = useState('')
  const [socialUrl, setSocialUrl] = useState('')
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)

  const visibleArtists = filterByQuery(artists, search, (artist) => artist.name)
  // Editing the same artist by id keeps the panel in sync as `refetch()` swaps
  // in fresh data (e.g. right after adding a social link).
  const editingArtist = editing ? (artists.find((a) => a.id === editing.id) ?? editing) : null

  function startEdit(artist: ArtistModel): void {
    setEditing(artist)
    setName(artist.name)
    setSocialName('')
    setSocialUrl('')
  }

  function resetForm(): void {
    setEditing(null)
    setName('')
    setSocialName('')
    setSocialUrl('')
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    const result = editing
      ? await window.api.artist.update(editing.id, { name: trimmed })
      : await window.api.artist.create({ name: trimmed })
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
    const result = await window.api.artist.delete(id)
    if (result.success) {
      if (editing?.id === id) resetForm()
      refetch()
    } else {
      setError(result.error.message)
    }
  }

  async function handleAddSocial(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!editingArtist) return
    const trimmedName = socialName.trim()
    const trimmedUrl = socialUrl.trim()
    if (!trimmedName || !trimmedUrl) return
    const result = await window.api.artist.addSocialLink(editingArtist.id, {
      name: trimmedName,
      url: trimmedUrl
    })
    if (result.success) {
      setSocialName('')
      setSocialUrl('')
      refetch()
    } else {
      setError(result.error.message)
    }
  }

  async function handleRemoveSocial(artistId: string, socialId: string): Promise<void> {
    const result = await window.api.artist.removeSocialLink(artistId, socialId)
    if (result.success) {
      refetch()
    } else {
      setError(result.error.message)
    }
  }

  return (
    <div className="manage-panel manage-panel-split">
      <div className="manage-form-panel">
        <h2>
          {editingArtist
            ? t('manage.editingItem', { name: editingArtist.name })
            : t('manage.addNew')}
        </h2>
        <form className="manage-add-form-stacked" onSubmit={handleSubmit}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('manage.name')}
            aria-label={t('manage.name')}
          />
          <div className="manage-edit-actions">
            <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
              {editingArtist ? t('manage.save') : t('manage.add')}
            </button>
            {editingArtist && (
              <button type="button" className="btn" onClick={resetForm}>
                {t('manage.cancel')}
              </button>
            )}
          </div>
        </form>

        {editingArtist && (
          <div className="manage-socials">
            <h3>{t('manage.socials')}</h3>
            {editingArtist.socials && editingArtist.socials.length > 0 && (
              <ul className="manage-social-list">
                {editingArtist.socials.map((social) => (
                  <li key={social.id}>
                    <a href={social.url} target="_blank" rel="noreferrer">
                      {social.name}
                    </a>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`${t('manage.delete')} ${social.name}`}
                      onClick={() => handleRemoveSocial(editingArtist.id, social.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <form className="manage-add-form" onSubmit={handleAddSocial}>
              <input
                type="text"
                value={socialName}
                onChange={(e) => setSocialName(e.target.value)}
                placeholder={t('manage.socialName')}
                aria-label={t('manage.socialName')}
              />
              <input
                type="text"
                value={socialUrl}
                onChange={(e) => setSocialUrl(e.target.value)}
                placeholder={t('manage.socialUrl')}
                aria-label={t('manage.socialUrl')}
              />
              <button type="submit" className="btn">
                <Plus size={14} />
                {t('manage.addSocial')}
              </button>
            </form>
          </div>
        )}

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

        <div className="manage-list-scroll">
          {loading ? (
            <p className="loading-state">{t('gallery.loading')}</p>
          ) : artists.length === 0 ? (
            <p className="manage-empty">{t('manage.empty')}</p>
          ) : visibleArtists.length === 0 ? (
            <p className="manage-empty">{t('manage.noResults')}</p>
          ) : (
            <ul className="manage-list">
              {visibleArtists.map((artist) => (
                <li
                  key={artist.id}
                  className={
                    editingArtist?.id === artist.id
                      ? 'manage-list-item manage-list-item-editing'
                      : 'manage-list-item'
                  }
                >
                  <EntityThumbnail kind="artist" id={artist.id} />
                  <span className="manage-item-name">{artist.name}</span>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`${t('manage.edit')} ${artist.name}`}
                    onClick={() => startEdit(artist)}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`${t('manage.delete')} ${artist.name}`}
                    onClick={() => handleDelete(artist.id, artist.name)}
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
