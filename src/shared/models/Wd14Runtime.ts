export type Wd14RuntimeStatus = { state: 'not-installed' } | { state: 'installed' }

export type Wd14RuntimeEvent =
  | {
      type: 'progress'
      step: 'python' | 'packages' | 'model' | 'extracting' | 'installing'
      percent: number
    }
  | { type: 'installed' }
  | { type: 'error'; message: string }
