'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Trash2, ChevronRight, Lock, Eye, Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Poll {
  id: string
  type: string
  title: string
  description: string | null
  is_multiple_choice: boolean
  show_partial: boolean
  is_closed: boolean
  opens_at: string
  closes_at: string
  created_at: string
  total_votes?: number
  total_options?: number
}

export default function EnquetesPage() {
  const { groupId } = useParams<{ groupId: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [polls, setPolls] = useState<Poll[]>([])
  const [myUserId, setMyUserId] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  useEffect(() => { fetchData() }, [groupId])

  async function fetchData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setMyUserId(user.id)

    const { data: member } = await supabase
      .from('group_members').select('role').eq('group_id', groupId).eq('user_id', user.id).single()
    setIsAdmin(member?.role === 'admin')

    const { data: season } = await supabase
      .from('seasons').select('id').eq('group_id', groupId).eq('status', 'active').single()

    if (!season) { setLoading(false); return }

    const { data: pollsData } = await supabase
      .from('polls')
      .select('*, poll_options(id), poll_votes(id)')
      .eq('group_id', groupId)
      .eq('season_id', season.id)
      .in('type', ['general', 'best_of_year', 'best_goalkeeper', 'best_defender', 'best_left_back', 'best_right_back', 'best_midfielder', 'best_playmaker', 'best_striker', 'best_overall'])
      .order('created_at', { ascending: false })

    const lista: Poll[] = (pollsData ?? []).map((p: any) => ({
      id: p.id,
      type: p.type,
      title: p.title,
      description: p.description,
      is_multiple_choice: p.is_multiple_choice,
      show_partial: p.show_partial,
      is_closed: p.is_closed,
      opens_at: p.opens_at,
      closes_at: p.closes_at,
      created_at: p.created_at,
      total_votes: p.poll_votes?.length ?? 0,
      total_options: p.poll_options?.length ?? 0,
    }))

    // Fecha automaticamente as encerradas
    const agora = new Date()
    for (const p of lista) {
      if (!p.is_closed && new Date(p.closes_at) < agora) {
        await supabase.from('polls').update({ is_closed: true }).eq('id', p.id)
        p.is_closed = true
      }
    }

    setPolls(lista)
    setLoading(false)
  }

  async function deletarEnquete(id: string) {
    await supabase.from('poll_votes').delete().eq('poll_id', id)
    await supabase.from('poll_options').delete().eq('poll_id', id)
    await supabase.from('polls').delete().eq('id', id)
    setConfirmDelete(null)
    setPolls(prev => prev.filter(p => p.id !== id))
  }

  function getStatusInfo(poll: Poll) {
    const agora = new Date()
    const fecha = new Date(poll.closes_at)
    if (poll.is_closed || fecha < agora) return { label: 'Encerrada', color: '#64748b', bg: '#f1f5f9' }
    const diff = fecha.getTime() - agora.getTime()
    const h = Math.floor(diff / 3600000)
    const d = Math.floor(h / 24)
    if (d > 0) return { label: `${d}d restantes`, color: '#16a34a', bg: '#dcfce7' }
    if (h > 0) return { label: `${h}h restantes`, color: '#ca8a04', bg: '#fef9c3' }
    return { label: 'Encerrando', color: '#dc2626', bg: '#fee2e2' }
  }

  function getTipoLabel(type: string) {
    const map: Record<string, string> = {
      general: '📋 Geral',
      best_of_year: '🏆 Melhores da Temporada',
      best_goalkeeper: '🧤 Melhor Goleiro',
      best_defender: '🛡️ Melhor Zagueiro',
      best_left_back: '↙️ Melhor Lateral Esquerdo',
      best_right_back: '↗️ Melhor Lateral Direito',
      best_midfielder: '⚙️ Melhor Volante',
      best_playmaker: '🎯 Melhor Meia',
      best_striker: '⚡ Melhor Atacante',
      best_overall: '⭐ Melhor Jogador Geral',
    }
    return map[type] ?? '📋 Enquete'
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: '3rem' }}>🗳️</div>
    </div>
  )

  const abertas = polls.filter(p => !p.is_closed && new Date(p.closes_at) > new Date())
  const encerradas = polls.filter(p => p.is_closed || new Date(p.closes_at) <= new Date())

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', paddingBottom: '6rem' }}>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #0f172a, #1e293b)', paddingTop: '3rem', paddingBottom: '1.25rem', paddingLeft: '1rem', paddingRight: '1rem' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.7)' }}>
              <ArrowLeft size={22} />
            </button>
            <div>
              <h1 style={{ color: 'white', fontWeight: 700, margin: 0, fontSize: '1.1rem' }}>🗳️ Enquetes</h1>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', margin: '2px 0 0' }}>{polls.length} enquete{polls.length !== 1 ? 's' : ''} na temporada</p>
            </div>
          </div>
          {isAdmin && (
            <button onClick={() => router.push(`/grupos/${groupId}/enquetes/nova`)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#16a34a', border: 'none', borderRadius: '0.75rem', padding: '8px 14px', color: 'white', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>
              <Plus size={16} /> Nova
            </button>
          )}
        </div>
      </div>

      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

        {/* Banner Melhores da Temporada */}
        {polls.some(p => ['best_goalkeeper','best_defender','best_left_back','best_right_back','best_midfielder','best_playmaker','best_striker'].includes(p.type)) && (
          <button onClick={() => router.push(`/grupos/${groupId}/enquetes/melhores`)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.875rem', background: 'linear-gradient(135deg, #166534, #15803d)', border: 'none', borderRadius: '1rem', padding: '1rem', cursor: 'pointer', textAlign: 'left', boxShadow: '0 4px 16px rgba(22,101,52,0.3)' }}>
            <div style={{ width: '2.75rem', height: '2.75rem', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '1.4rem' }}>🌟</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 2px' }}>Ver resultado consolidado</p>
              <p style={{ color: 'white', fontSize: '0.95rem', fontWeight: 800, margin: 0 }}>Melhores da Temporada</p>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.72rem', margin: '2px 0 0' }}>Campo + card para compartilhar</p>
            </div>
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '1.5rem', flexShrink: 0 }}>›</span>
          </button>
        )}

        {polls.length === 0 && (
          <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
            <p style={{ fontSize: '3.5rem', margin: '0 0 0.75rem' }}>🗳️</p>
            <p style={{ color: '#475569', fontWeight: 700, fontSize: '1rem', margin: 0 }}>Nenhuma enquete ainda</p>
            {isAdmin && <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginTop: '0.5rem' }}>Clique em "Nova" para criar uma enquete</p>}
          </div>
        )}

        {/* Abertas */}
        {abertas.length > 0 && (
          <div>
            <p style={{ fontSize: '0.7rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.5rem' }}>
              🔥 Abertas ({abertas.length})
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              {abertas.map(poll => {
                const status = getStatusInfo(poll)
                return (
                  <PollCard key={poll.id} poll={poll} status={status} isAdmin={isAdmin}
                    confirmDelete={confirmDelete} setConfirmDelete={setConfirmDelete}
                    deletarEnquete={deletarEnquete} getTipoLabel={getTipoLabel}
                    onClick={() => router.push(`/grupos/${groupId}/enquetes/${poll.id}`)} />
                )
              })}
            </div>
          </div>
        )}

        {/* Encerradas */}
        {encerradas.length > 0 && (
          <div>
            <p style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.5rem' }}>
              ✅ Encerradas ({encerradas.length})
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              {encerradas.map(poll => {
                const status = getStatusInfo(poll)
                return (
                  <PollCard key={poll.id} poll={poll} status={status} isAdmin={isAdmin}
                    confirmDelete={confirmDelete} setConfirmDelete={setConfirmDelete}
                    deletarEnquete={deletarEnquete} getTipoLabel={getTipoLabel}
                    onClick={() => router.push(`/grupos/${groupId}/enquetes/${poll.id}`)} />
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function PollCard({ poll, status, isAdmin, confirmDelete, setConfirmDelete, deletarEnquete, getTipoLabel, onClick }: any) {
  return (
    <div style={{ backgroundColor: 'white', borderRadius: '1rem', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9' }}>
      <button onClick={onClick} style={{ width: '100%', padding: '1rem', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', backgroundColor: '#f1f5f9', borderRadius: '9999px', padding: '2px 8px' }}>
              {getTipoLabel(poll.type)}
            </span>
            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: status.color, backgroundColor: status.bg, borderRadius: '9999px', padding: '2px 8px' }}>
              {status.label}
            </span>
          </div>
          <p style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1e293b', margin: '0 0 0.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {poll.title}
          </p>
          <div style={{ display: 'flex', gap: '0.875rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '3px' }}>
              👥 {poll.total_votes} voto{poll.total_votes !== 1 ? 's' : ''}
            </span>
            <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '3px' }}>
              {poll.show_partial ? <Eye size={11} /> : <Lock size={11} />}
              {poll.show_partial ? 'Parcial visível' : 'Resultado no fim'}
            </span>
            <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '3px' }}>
              {poll.is_multiple_choice ? '☑️ Múltipla' : '🔘 Única'}
            </span>
          </div>
        </div>
        <ChevronRight size={18} color="#cbd5e1" style={{ flexShrink: 0 }} />
      </button>

      {isAdmin && (
        <div style={{ borderTop: '1px solid #f8fafc', padding: '0.5rem 1rem', display: 'flex', justifyContent: 'flex-end' }}>
          {confirmDelete === poll.id ? (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Excluir enquete?</span>
              <button onClick={() => deletarEnquete(poll.id)}
                style={{ fontSize: '0.72rem', backgroundColor: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: '0.5rem', padding: '4px 10px', cursor: 'pointer', fontWeight: 700 }}>
                Confirmar
              </button>
              <button onClick={() => setConfirmDelete(null)}
                style={{ fontSize: '0.72rem', backgroundColor: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '0.5rem', padding: '4px 10px', cursor: 'pointer' }}>
                Cancelar
              </button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(poll.id)}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}>
              <Trash2 size={13} /> Excluir
            </button>
          )}
        </div>
      )}
    </div>
  )
}
