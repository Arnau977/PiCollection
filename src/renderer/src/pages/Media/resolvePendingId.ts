import type { IpcResult } from '@shared/ipc/contracts'

export interface PendingDraft {
  id: string
  name: string
}

/**
 * Resolves a possibly-pending id to a real one. If `id` isn't found in
 * `pending`, it's already real and is returned as-is. Otherwise, reuses a
 * same-named entity from `existing` (case-insensitive) if one exists, or
 * creates a new one via `create` and returns its id.
 */
export async function resolvePendingId<T extends PendingDraft>(
  id: string,
  pending: T[],
  existing: T[],
  create: (name: string) => Promise<IpcResult<T>>
): Promise<string> {
  const draft = pending.find((p) => p.id === id)
  if (!draft) return id

  const match = existing.find((e) => e.name.toLowerCase() === draft.name.toLowerCase())
  if (match) return match.id

  const result = await create(draft.name)
  if (!result.success) throw new Error(result.error.message)
  return result.data.id
}
