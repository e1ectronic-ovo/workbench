/** 应用更新相关的跨进程类型 */

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'none'
  | 'downloading'
  | 'downloaded'
  | 'error'

export interface UpdateState {
  status: UpdateStatus
  /** 可更新 / 已下载的版本号 */
  version: string
  notes: string
  releasedAt: string
  percent: number
  downloaded: number
  total: number
  error: string | null
}

export function idleUpdateState(): UpdateState {
  return {
    status: 'idle',
    version: '',
    notes: '',
    releasedAt: '',
    percent: 0,
    downloaded: 0,
    total: 0,
    error: null
  }
}
