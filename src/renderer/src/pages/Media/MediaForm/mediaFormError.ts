import type { IpcResult } from '@shared/ipc/contracts'

export type MediaFormField = 'artist' | 'tags' | 'characters' | 'series'

export interface MediaFormError {
  message: string
  /** The field the error points at, when the main process said which. */
  field?: MediaFormField
}

// Codes thrown by mediaService's assertRelationsExist.
const FIELD_BY_CODE: Record<string, MediaFormField> = {
  MISSING_ARTIST: 'artist',
  MISSING_TAGS: 'tags',
  MISSING_CHARACTERS: 'characters',
  MISSING_SERIES: 'series'
}

export function toMediaFormError(
  error: Extract<IpcResult<never>, { success: false }>['error']
): MediaFormError {
  return { message: error.message, field: FIELD_BY_CODE[error.code] }
}
