import { useEffect } from 'react'
import { useChatStore } from './store/chatStore'
import { useSettingsStore } from './store/settingsStore'
import { checkHealth, listSessions, createSession, getSession, initBaseURL } from './services/api'
import MainLayout from './components/Layout/MainLayout'

export default function App() {
  const setSessions = useChatStore((s) => s.setSessions)
  const setActiveSession = useChatStore((s) => s.setActiveSession)
  const setBackendConnected = useSettingsStore((s) => s.setBackendConnected)

  useEffect(() => {
    let cancelled = false
    async function init() {
      try {
        // Init base URL (handles Electron async port)
        await initBaseURL()
        // Check backend
        const health = await checkHealth()
        if (!cancelled) {
          setBackendConnected(health.status === 'ok')
        }

        // Load or create session
        const { sessions } = await listSessions()
        if (cancelled) return
        setSessions(sessions)

        if (sessions.length > 0) {
          const full = await getSession(sessions[0].id)
          if (!cancelled) setActiveSession(full)
        } else {
          const session = await createSession()
          if (!cancelled) {
            const full = await getSession(session.id)
            setActiveSession(full)
            setSessions([{
              id: session.id,
              title: session.title,
              created_at: session.created_at,
              updated_at: session.updated_at,
              message_count: 0,
            }])
          }
        }
      } catch (err) {
        console.error('Init failed:', err)
        if (!cancelled) setBackendConnected(false)
      }
    }
    init()
    return () => { cancelled = true }
  }, [])

  return <MainLayout />
}
