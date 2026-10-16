import type { WorkbenchAPI } from '../renderer/src/types/global'

declare global {
  interface Window {
    workbench: WorkbenchAPI
  }
}

export {}
