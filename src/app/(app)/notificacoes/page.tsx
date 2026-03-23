'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Check } from 'lucide-react'

interface Notificacao {
  id: string
  type: string
  title: string
  body: string | null
  is_read: boolean
  created_at: string
  data: any
  group_id: string | null
}

const TIPO_CONFIG: Record<string, { icon: string; cor: string; bg: string }> = {
  chat_message:   { icon: '💬', cor: '#2563eb', bg: '#dbeafe' },
  round_created:  { icon: '📅', cor: '#16a34a', bg: '#dcfce7' },
  round_finished: { icon: '✅', cor: '#16a34a', bg: '#dcfce7' },
  round_reminder: { icon: '⏰', cor: '#ca8a04', bg: '#fef9c3' },
  poll_open:      { icon: '🗳️', cor: '#7c3aed', bg: '#ede9fe' },
  craque_eleito:  { icon: '🏆', cor: '#f59e0b', bg: '#fef9c3' },
  mention:        { icon: '@',  cor: '#0891b2', bg: '#cffafe' },
  season_finished:{ icon: '🏁', cor: '#64748b', bg: '#f1f5f9' },
}

export default function NotificacoesPage() {
  const router = useRouter()
  const supabase = createClient()
  const [notifs, setNotifs] = useState<Notificacao[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    setNotifs(data ?? [])

    // Marca todas como lidas
    await supabase.from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false)

    setLoading(false)
  }

  function formatTempo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime()
    const min = Math.floor(diff / 60000)
    const h = Math.floor(diff / 3600000)
    const d = Math.floor(diff / 86400000)
    if (min < 1) return 'Agora'
    if (min < 60) return `${min}min atrás`
    if (h < 24) return `${h}h atrás`
    if (d < 7) return `${d}d atrás`
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  }

  function handleClick(n: Notificacao) {
    if (n.group_id) {
      if (n.type === 'chat_message') router.push(`/grupos/${n.group_id}/chat`)
      else if (n.type === 'poll_open' && n.data?.poll_id) router.push(`/grupos/${n.group_id}/enquetes/${n.data.poll_id}`)
      else if (n.type === 'round_created' && n.data?.round_id) router.push(`/grupos/${n.group_id}/rodadas/${n.data.round_id}`)
      else router.push(`/grupos/${n.group_id}`)
    }
  }

  const naoLidas = notifs.filter(n => !n.is_read)
  const lidas = notifs.filter(n => n.is_read)

  if (loading) return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: '3rem' }}>🔔</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', paddingBottom: '5rem' }}>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', paddingTop: '3rem', paddingBottom: '1.25rem', paddingLeft: '1rem', paddingRight: '1rem' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.8)' }}>
            <ArrowLeft size={22} />
          </button>
          <div>
            <h1 style={{ color: 'white', fontWeight: 700, margin: 0, fontSize: '1.1rem' }}>🔔 Notificações</h1>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', margin: '2px 0 0' }}>
              {notifs.length === 0 ? 'Nenhuma notificação' : `${notifs.length} notificação${notifs.length !== 1 ? 'ões' : ''}`}
            </p>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

        {notifs.length === 0 && (
          <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
            <p style={{ fontSize: '3.5rem', margin: '0 0 0.75rem' }}>🔔</p>
            <p style={{ color: '#475569', fontWeight: 700 }}>Nenhuma notificação ainda</p>
            <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginTop: '0.25rem' }}>As novidades do grupo aparecerão aqui</p>
          </div>
        )}

        {notifs.map(n => {
          const cfg = TIPO_CONFIG[n.type] ?? { icon: '🔔', cor: '#64748b', bg: '#f1f5f9' }
          return (
            <button key={n.id} onClick={() => handleClick(n)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.875rem', padding: '0.875rem 1rem', backgroundColor: n.is_read ? 'white' : '#f0fdf4', borderRadius: '1rem', border: `1px solid ${n.is_read ? '#f1f5f9' : '#bbf7d0'}`, cursor: 'pointer', textAlign: 'left', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
              {/* Ícone */}
              <div style={{ width: '2.75rem', height: '2.75rem', borderRadius: '9999px', backgroundColor: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '1.25rem' }}>
                {cfg.icon}
              </div>
              {/* Conteúdo */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '0.875rem', fontWeight: n.is_read ? 500 : 700, color: '#1e293b', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {n.title}
                </p>
                {n.body && (
                  <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {n.body}
                  </p>
                )}
                <p style={{ fontSize: '0.68rem', color: '#94a3b8', margin: '3px 0 0' }}>
                  {formatTempo(n.created_at)}
                </p>
              </div>
              {/* Indicador não lida */}
              {!n.is_read && (
                <div style={{ width: '8px', height: '8px', borderRadius: '9999px', backgroundColor: '#16a34a', flexShrink: 0 }} />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
