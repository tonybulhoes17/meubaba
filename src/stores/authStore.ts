import { create } from 'zustand'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types'

interface AuthState {
  profile: Profile | null
  loading: boolean
  setProfile: (profile: Profile | null) => void
  setLoading: (loading: boolean) => void
  fetchProfile: () => Promise<void>
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  profile: null,
  loading: true,

  setProfile: (profile) => set({ profile }),
  setLoading: (loading) => set({ loading }),

  fetchProfile: async () => {
    const supabase = createClient()
    set({ loading: true })

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      set({ profile: null, loading: false })
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    set({ profile: profile ?? null, loading: false })
  },

  signOut: async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    set({ profile: null })
  },
}))
