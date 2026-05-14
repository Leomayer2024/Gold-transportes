import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { api } from '../services/api'

const AuthContext = createContext(null)
const PROFILE_CACHE_KEY = 'seg-profile-cache'

function readCachedProfile() {
  try {
    const raw = window.sessionStorage.getItem(PROFILE_CACHE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeCachedProfile(profile) {
  try {
    if (!profile) {
      window.sessionStorage.removeItem(PROFILE_CACHE_KEY)
      return
    }

    window.sessionStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile))
  } catch {
    // Ignore cache persistence failures.
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(() => readCachedProfile())
  const [initializing, setInitializing] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)
  const [authError, setAuthError] = useState('')

  async function loadProfile(nextSession) {
    if (!nextSession?.access_token) {
      setProfile(null)
      writeCachedProfile(null)
      setProfileLoading(false)
      return
    }

    setProfileLoading(true)

    try {
      const nextProfile = await api.getProfile()
      setProfile(nextProfile)
      writeCachedProfile(nextProfile)
      setAuthError('')
    } catch (error) {
      setProfile((current) => current)
      setAuthError(error.message || 'Falha ao carregar perfil.')
    } finally {
      setProfileLoading(false)
    }
  }

  useEffect(() => {
    let mounted = true

    function syncSession(nextSession) {
      if (!mounted) {
        return
      }

      setSession(nextSession)
      setUser(nextSession?.user ?? null)
      setInitializing(false)
      void loadProfile(nextSession)
    }

    async function bootstrap() {
      try {
        const {
          data: { session: currentSession },
        } = await supabase.auth.getSession()

        syncSession(currentSession)
      } catch (error) {
        if (mounted) {
          setAuthError(error.message || 'Falha ao inicializar autenticação.')
          setInitializing(false)
        }
      }
    }

    bootstrap()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      syncSession(nextSession)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  async function signIn(email, password) {
    setAuthError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      throw error
    }
  }

  async function signOut() {
    setAuthError('')
    await supabase.auth.signOut()
    setProfile(null)
  }

  async function refreshProfile() {
    await loadProfile(session)
  }

  const assinaturaStatus = profile?.assinatura_status ?? null
  const assinaturaDiasTrial = profile?.assinatura_dias_trial ?? null
  const assinaturaPlano = profile?.assinatura_plano ?? null

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        initializing,
        profileLoading,
        authError,
        isAuthenticated: Boolean(session?.access_token),
        assinaturaStatus,
        assinaturaDiasTrial,
        assinaturaPlano,
        signIn,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider')
  }
  return context
}
