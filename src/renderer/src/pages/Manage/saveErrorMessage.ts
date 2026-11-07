import type { TFunction } from 'i18next'
import type { IpcResult } from '@shared/ipc/contracts'

type IpcError = Extract<IpcResult<never>, { success: false }>['error']

/** Errors come from the main process in English; this one is the user's to fix, so it's translated. */
export function saveErrorMessage(error: IpcError, t: TFunction): string {
  return error.code === 'DUPLICATE' ? t('manage.nameInUse') : error.message
}
