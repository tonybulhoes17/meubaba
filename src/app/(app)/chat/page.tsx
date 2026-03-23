'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Conversa {
  group_id: string
  group_name: string
  ultima_msg: string | null
  ultima_msg_hora: string | null
  ultima_msg_sender: string | null
  nao_lidas: number
}

export default function ChatListPage() {
  const router = useRouter()
  const supabase = createClient()
  const [conversas, setConversas] = useState<Conversa[]>([])
  const [loading, setLoading] = useState(true)
  const [myUserId, setMyUserId] = useState('')

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setMyUserId(user.id)

    // Busca todos os grupos que o usuário participa
    const { data: grupos } = await supabase
      .from('group_members')
      .select('group_id, joined_at, groups(name)')
      .eq('user_id', user.id)
      .eq('is_active', true)

    if (!grupos || grupos.length === 0) { setLoading(false); return }

    const lista: Conversa[] = []

    for (const g of grupos) {
      const group = g.groups as any
      const groupId = g.group_id

      // Última mensagem do grupo
      const { data: ultimaMsgData } = await supabase
        .from('chat_messages')
        .select('content, audio_url, photo_url, created_at, sender:profiles!sender_id(full_name)')
        .eq('group_id', groupId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      let preview = null
      let hora = null
      let sender = null

      if (ultimaMsgData) {
        hora = ultimaMsgData.created_at
        sender = (ultimaMsgData.sender as any)?.full_name?.split(' ')[0] ?? ''
        if (ultimaMsgData.photo_url) preview = '📷 Foto'
        else if (ultimaMsgData.audio_url) preview = '🎙️ Áudio'
        else preview = ultimaMsgData.content
      }

      lista.push({
        group_id: groupId,
        group_name: group?.name ?? 'Grupo',
        ultima_msg: preview,
        ultima_msg_hora: hora,
        ultima_msg_sender: sender,
        nao_lidas: 0, // simplificado por ora
      })
    }

    // Ordena por última mensagem mais recente
    lista.sort((a, b) => {
      if (!a.ultima_msg_hora) return 1
      if (!b.ultima_msg_hora) return -1
      return new Date(b.ultima_msg_hora).getTime() - new Date(a.ultima_msg_hora).getTime()
    })

    setConversas(lista)
    setLoading(false)
  }

  function formatHora(iso: string | null) {
    if (!iso) return ''
    const d = new Date(iso)
    const hoje = new Date()
    const ontem = new Date(hoje)
    ontem.setDate(hoje.getDate() - 1)
    if (d.toDateString() === hoje.toDateString())
      return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    if (d.toDateString() === ontem.toDateString()) return 'Ontem'
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  }

  function getInitials(name: string) {
    return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: '3rem' }}>💬</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc' }}>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', paddingTop: '3rem', paddingBottom: '1.25rem', paddingLeft: '1rem', paddingRight: '1rem' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto' }}>
          <h1 style={{ color: 'white', fontWeight: 700, margin: 0, fontSize: '1.2rem' }}>💬 Conversas</h1>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', margin: '3px 0 0' }}>
            {conversas.length} grupo{conversas.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
        {conversas.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
            <p style={{ fontSize: '3.5rem', margin: '0 0 0.75rem' }}>💬</p>
            <p style={{ color: '#475569', fontWeight: 700 }}>Nenhuma conversa ainda</p>
            <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              Entre em um grupo para começar a conversar
            </p>
          </div>
        ) : (
          <div style={{ backgroundColor: 'white' }}>
            {conversas.map((c, i) => (
              <button key={c.group_id}
                onClick={() => router.push(`/grupos/${c.group_id}/chat`)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '0.875rem',
                  padding: '0.875rem 1rem', background: 'none', border: 'none', cursor: 'pointer',
                  textAlign: 'left', borderBottom: i < conversas.length - 1 ? '1px solid #f1f5f9' : 'none',
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>

                {/* Avatar do grupo */}
                <div style={{
                  width: '3rem', height: '3rem', borderRadius: '9999px', flexShrink: 0,
                  background: 'linear-gradient(135deg, #16a34a, #15803d)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.25rem',
                }}>
                  ⚽
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '2px' }}>
                    <p style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1e293b', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>
                      {c.group_name}
                    </p>
                    <span style={{ fontSize: '0.68rem', color: '#94a3b8', flexShrink: 0 }}>
                      {formatHora(c.ultima_msg_hora)}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.82rem', color: '#64748b', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.ultima_msg
                      ? <>{c.ultima_msg_sender && <span style={{ fontWeight: 600 }}>{c.ultima_msg_sender}: </span>}{c.ultima_msg}</>
                      : <span style={{ color: '#cbd5e1', fontStyle: 'italic' }}>Nenhuma mensagem ainda</span>}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
