import { create } from 'zustand'

interface SettingsState {
  backendPort: number
  backendConnected: boolean
  setBackendPort: (port: number) => void
  setBackendConnected: (val: boolean) => void
}

export const useSettingsStore = create<SettingsState>((set) => ({
  backendPort: 8000,
  backendConnected: false,
  setBackendPort: (port) => set({ backendPort: port }),
  setBackendConnected: (val) => set({ backendConnected: val }),
}))
