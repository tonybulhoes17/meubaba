'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Home, MessageCircle, Bell, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import PWAInstallBanner from '@/components/PWAInstallBanner'
import { usePushNotifications } from '@/hooks/usePushNotifications'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { fetchProfile } = useAuthStore()
  const supabase = createClient()
  usePushNotifications()

  const [temNotificacao, setTemNotificacao] = useState(false)
  const [temMensagem, setTemMensagem] = useState(false)
  const [myUserId, setMyUserId] = useState('')

  useEffect(() => {
    fetchProfile()
    initRealtime()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) router.push('/login')
    })

    return () => subscription.unsubscribe()
  }, [])

  // Quando entra na página de notificações, limpa o badge
  useEffect(() => {
    if (pathname === '/notificacoes') setTemNotificacao(false)
    if (pathname.includes('/chat')) setTemMensagem(false)
  }, [pathname])

  async function initRealtime() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setMyUserId(user.id)

    // Verifica notificações não lidas existentes
    const { count: notifCount } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false)
    if ((notifCount ?? 0) > 0) setTemNotificacao(true)

    // Verifica mensagens não lidas
    const { data: grupos } = await supabase
      .from('group_members').select('group_id, joined_at')
      .eq('user_id', user.id).eq('is_active', true)

    for (const g of grupos ?? []) {
      const { count: msgCount } = await supabase
        .from('chat_messages')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', g.group_id)
        .eq('is_deleted', false)
        .neq('sender_id', user.id)
        .gt('created_at', g.joined_at)
      if ((msgCount ?? 0) > 0) { setTemMensagem(true); break }
    }

    // Realtime — nova notificação
    supabase.channel('notificacoes-user')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, () => {
        setTemNotificacao(true)
      })
      .subscribe()

    // Realtime — nova mensagem no chat (só para badge, não interfere no chat aberto)
    supabase.channel(`chat-badge-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'chat_messages',
      }, (payload: any) => {
        // Só ativa badge se não estiver na página do chat
        if (payload.new.sender_id !== user.id) {
          setTemMensagem(true)
        }
      })
      .subscribe()
  }

  async function handleChatClick(e: React.MouseEvent) {
    e.preventDefault()
    setTemMensagem(false)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: grupo } = await supabase
      .from('group_members').select('group_id').eq('user_id', user.id).eq('is_active', true).limit(1).single()
    if (grupo?.group_id) router.push(`/grupos/${grupo.group_id}/chat`)
    else router.push('/grupos')
  }

  const isChatActive = pathname.includes('/chat')
  const isNotifActive = pathname === '/notificacoes'

  const navItems = [
    { href: '/grupos', icon: Home, label: 'Início', badge: false },
    { href: '/chat', icon: MessageCircle, label: 'Chat', badge: temMensagem },
    { href: '/notificacoes', icon: Bell, label: 'Avisos', badge: temNotificacao },
    { href: '/perfil', icon: User, label: 'Perfil', badge: false },
  ]

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <main className="flex-1 pb-20">{children}</main>
      <PWAInstallBanner />

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 pb-safe z-50">
        <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-4">
          {navItems.map(({ href, icon: Icon, label, badge }) => {
            const isActive = href === '/chat' ? isChatActive : href === '/notificacoes' ? isNotifActive : (pathname === href || pathname.startsWith(href + '/'))
            if (href === '/chat') {
              return (
                <button key={href} onClick={handleChatClick}
                  className={`flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl transition-all border-none bg-transparent cursor-pointer relative ${isActive ? 'text-green-600' : 'text-gray-400 hover:text-gray-600'}`}>
                  <div style={{ position: 'relative' }}>
                    <Icon size={22} strokeWidth={isActive ? 2.5 : 1.8} />
                    {badge && <span style={{ position: 'absolute', top: '-3px', right: '-3px', width: '8px', height: '8px', backgroundColor: '#ef4444', borderRadius: '9999px', border: '2px solid white' }} />}
                  </div>
                  <span className={`text-xs font-medium ${isActive ? 'text-green-600' : 'text-gray-400'}`}>{label}</span>
                </button>
              )
            }
            return (
              <Link key={href} href={href}
                className={`flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl transition-all relative ${isActive ? 'text-green-600' : 'text-gray-400 hover:text-gray-600'}`}>
                <div style={{ position: 'relative' }}>
                  <Icon size={22} strokeWidth={isActive ? 2.5 : 1.8} />
                  {badge && <span style={{ position: 'absolute', top: '-3px', right: '-3px', width: '8px', height: '8px', backgroundColor: '#ef4444', borderRadius: '9999px', border: '2px solid white' }} />}
                </div>
                <span className={`text-xs font-medium ${isActive ? 'text-green-600' : 'text-gray-400'}`}>{label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
