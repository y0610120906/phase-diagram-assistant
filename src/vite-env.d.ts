/// <reference types="vite/client" />

interface ElectronAPI {
  getBackendPort: () => Promise<number>
  restartBackend: () => Promise<boolean>
  onBackendError: (callback: (error: string) => void) => void
}

interface Window {
  electronAPI?: ElectronAPI
}
