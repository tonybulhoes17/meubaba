'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, Lock, Eye } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Opcao {
  id: string
  user_id: string | null
  label: string
  position: string | null
  order_index: number
  photo_url?: string | null
  votos?: number
}

interface Poll {
  id: string
  type: string
  title: string
  description: string | null
  is_multiple_choice: boolean
  show_partial: boolean
  is_closed: boolean
  closes_at: string
  opcoes: Opcao[]
  total_votos: number
}

export default function PollPage() {
  const { groupId, pollId } = useParams<{ groupId: string; pollId: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [voting, setVoting] = useState(false)
  const [poll, setPoll] = useState<Poll | null>(null)
  const [myUserId, setMyUserId] = useState('')
  const [meuVoto, setMeuVoto] = useState<string[]>([]) // option_ids
  const [selecionados, setSelecionados] = useState<string[]>([]) // antes de confirmar
  const [jaVotou, setJaVotou] = useState(false)
  const [agora, setAgora] = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => { fetchData() }, [pollId])

  async function fetchData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setMyUserId(user.id)

    const { data: pollData } = await supabase
      .from('polls')
      .select('*, poll_options(id, user_id, label, position, order_index, profile:profiles(full_name, photo_url)), poll_votes(id, option_id, voter_id)')
      .eq('id', pollId).single()

    if (!pollData) return

    const totalVotos = pollData.poll_votes?.length ?? 0
    const contagemVotos: Record<string, number> = {}
    for (const v of pollData.poll_votes ?? []) {
      contagemVotos[v.option_id] = (contagemVotos[v.option_id] ?? 0) + 1
    }

    const opcoes: Opcao[] = (pollData.poll_options ?? [])
      .sort((a: any, b: any) => a.order_index - b.order_index)
      .map((o: any) => ({
        id: o.id,
        user_id: o.user_id,
        label: o.profile?.full_name ?? o.label,
        position: o.position,
        order_index: o.order_index,
        photo_url: o.profile?.photo_url ?? null,
        votos: contagemVotos[o.id] ?? 0,
      }))

    setPoll({
      id: pollData.id, type: pollData.type, title: pollData.title,
      description: pollData.description,
      is_multiple_choice: pollData.is_multiple_choice,
      show_partial: pollData.show_partial,
      is_closed: pollData.is_closed,
      closes_at: pollData.closes_at,
      opcoes, total_votos: totalVotos,
    })

    // Meu voto atual
    const meusVotos = (pollData.poll_votes ?? []).filter((v: any) => v.voter_id === user.id)
    if (meusVotos.length > 0) {
      setJaVotou(true)
      setMeuVoto(meusVotos.map((v: any) => v.option_id))
    }

    setLoading(false)
  }

  async function confirmarVoto() {
    if (selecionados.length === 0) return
    setVoting(true)
    const { error } = await supabase.from('poll_votes').insert(
      selecionados.map(optId => ({ poll_id: pollId, option_id: optId, voter_id: myUserId }))
    )
    if (error) { alert(`Erro: ${error.message}`); setVoting(false); return }
    setJaVotou(true)
    setMeuVoto(selecionados)
    setVoting(false)
    await fetchData()
  }

  function toggleSelecao(optId: string) {
    if (jaVotou) return
    if (poll?.is_multiple_choice) {
      setSelecionados(prev => prev.includes(optId) ? prev.filter(id => id !== optId) : [...prev, optId])
    } else {
      setSelecionados([optId])
    }
  }

  function formatCronometro(closesAt: string) {
    const diff = new Date(closesAt).getTime() - agora.getTime()
    if (diff <= 0) return null
    const d = Math.floor(diff / 86400000)
    const h = Math.floor((diff % 86400000) / 3600000)
    const m = Math.floor((diff % 3600000) / 60000)
    const s = Math.floor((diff % 60000) / 1000)
    if (d > 0) return `${d}d ${h}h ${String(m).padStart(2,'0')}m`
    return `${h}h ${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s`
  }

  if (loading || !poll) return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: '3rem' }}>🗳️</div>
    </div>
  )

  const cronometro = formatCronometro(poll.closes_at)
  const encerrada = !cronometro || poll.is_closed
  const mostrarResultado = encerrada || (poll.show_partial && jaVotou)
  const maxVotos = Math.max(...poll.opcoes.map(o => o.votos ?? 0), 1)

  // Agrupa por posição para enquete melhores da temporada
  const ehMelhores = poll.type !== 'general'
  const grupos: Record<string, Opcao[]> = {}
  if (ehMelhores) {
    for (const op of poll.opcoes) {
      const key = op.position ?? 'geral'
      if (!grupos[key]) grupos[key] = []
      grupos[key].push(op)
    }
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', paddingBottom: '7rem' }}>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #0f172a, #1e293b)', paddingTop: '3rem', paddingBottom: '1.25rem', paddingLeft: '1rem', paddingRight: '1rem' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
            <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.7)' }}>
              <ArrowLeft size={22} />
            </button>
            <div style={{ flex: 1 }}>
              <h1 style={{ color: 'white', fontWeight: 700, margin: 0, fontSize: '1.05rem', lineHeight: 1.3 }}>{poll.title}</h1>
              {poll.description && <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', margin: '3px 0 0' }}>{poll.description}</p>}
            </div>
          </div>

          {/* Status bar */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {encerrada ? (
              <span style={{ fontSize: '0.7rem', fontWeight: 700, backgroundColor: '#475569', color: 'white', borderRadius: '9999px', padding: '3px 10px' }}>✅ Encerrada</span>
            ) : (
              <span style={{ fontSize: '0.7rem', fontWeight: 700, backgroundColor: '#16a34a', color: 'white', borderRadius: '9999px', padding: '3px 10px' }}>⏱ {cronometro}</span>
            )}
            <span style={{ fontSize: '0.7rem', fontWeight: 700, backgroundColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)', borderRadius: '9999px', padding: '3px 10px' }}>
              👥 {poll.total_votos} voto{poll.total_votos !== 1 ? 's' : ''}
            </span>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, backgroundColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)', borderRadius: '9999px', padding: '3px 10px', display: 'flex', alignItems: 'center', gap: '3px' }}>
              {poll.show_partial ? <Eye size={10} /> : <Lock size={10} />}
              {poll.show_partial ? 'Parcial visível' : 'Resultado no fim'}
            </span>
            {poll.is_multiple_choice && (
              <span style={{ fontSize: '0.7rem', fontWeight: 700, backgroundColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)', borderRadius: '9999px', padding: '3px 10px' }}>
                ☑️ Múltipla escolha
              </span>
            )}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

        {/* Já votou */}
        {jaVotou && (
          <div style={{ backgroundColor: '#dcfce7', border: '1px solid #16a34a33', borderRadius: '0.875rem', padding: '0.75rem 1rem' }}>
            <p style={{ color: '#15803d', fontWeight: 700, fontSize: '0.875rem', margin: 0 }}>
              ✅ Seu voto foi registrado!
              {!encerrada && !poll.show_partial && ' O resultado será revelado ao encerrar.'}
            </p>
          </div>
        )}

        {/* Opções */}
        <div style={{ backgroundColor: 'white', borderRadius: '1rem', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9' }}>
          {poll.opcoes.map((op, i) => {
            const selecionado = selecionados.includes(op.id)
            const foiVotadoPorMim = meuVoto.includes(op.id)
            const pct = poll.total_votos > 0 ? Math.round(((op.votos ?? 0) / poll.total_votos) * 100) : 0
            const initials = op.label.split(' ').map(n => n[0]).slice(0, 2).join('')
            const vencedor = mostrarResultado && op.votos === Math.max(...poll.opcoes.map(o => o.votos ?? 0))

            return (
              <button key={op.id} onClick={() => toggleSelecao(op.id)} disabled={jaVotou || encerrada}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.875rem 1rem', background: 'none', border: 'none',
                  borderBottom: i < poll.opcoes.length - 1 ? '1px solid #f8fafc' : 'none',
                  cursor: jaVotou || encerrada ? 'default' : 'pointer',
                  backgroundColor: selecionado ? '#f0fdf4' : foiVotadoPorMim ? '#f0fdf4' : vencedor ? '#fefce8' : 'white',
                  position: 'relative', overflow: 'hidden', textAlign: 'left',
                }}>

                {/* Barra de progresso */}
                {mostrarResultado && (
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, backgroundColor: vencedor ? '#fef08a44' : '#f1f5f9', transition: 'width 0.5s', zIndex: 0 }} />
                )}

                <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
                  {/* Avatar (se enquete de jogadores) */}
                  {op.user_id && (
                    <div style={{ width: '2.25rem', height: '2.25rem', borderRadius: '9999px', backgroundColor: '#f1f5f9', border: `2px solid ${foiVotadoPorMim ? '#16a34a' : '#e2e8f0'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                      {op.photo_url
                        ? <img src={op.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b' }}>{initials}</span>}
                    </div>
                  )}

                  {/* Checkbox/radio visual (enquete geral) */}
                  {!op.user_id && (
                    <div style={{ width: '20px', height: '20px', borderRadius: poll.is_multiple_choice ? '4px' : '9999px', border: `2px solid ${selecionado || foiVotadoPorMim ? '#16a34a' : '#cbd5e1'}`, backgroundColor: selecionado || foiVotadoPorMim ? '#16a34a' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {(selecionado || foiVotadoPorMim) && <span style={{ color: 'white', fontSize: '0.65rem', fontWeight: 900 }}>✓</span>}
                    </div>
                  )}

                  <p style={{ flex: 1, fontSize: '0.9rem', fontWeight: foiVotadoPorMim || vencedor ? 700 : 500, color: '#1e293b', margin: 0 }}>
                    {op.label} {vencedor && mostrarResultado && '🏆'}
                  </p>
                </div>

                {/* Resultado */}
                {mostrarResultado && (
                  <div style={{ position: 'relative', zIndex: 1, textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ fontSize: '0.9rem', fontWeight: 800, color: vencedor ? '#ca8a04' : '#64748b', margin: 0 }}>{pct}%</p>
                    <p style={{ fontSize: '0.65rem', color: '#94a3b8', margin: 0 }}>{op.votos}v</p>
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {/* Botão votar */}
        {!jaVotou && !encerrada && selecionados.length > 0 && (
          <button onClick={confirmarVoto} disabled={voting}
            style={{ width: '100%', background: voting ? '#94a3b8' : 'linear-gradient(135deg, #0f172a, #1e293b)', border: 'none', borderRadius: '1rem', padding: '1rem', color: 'white', fontWeight: 700, fontSize: '1rem', cursor: voting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', boxShadow: '0 4px 16px rgba(15,23,42,0.3)' }}>
            {voting ? <Loader2 size={20} className="animate-spin" /> : '🗳️'}
            {voting ? 'Registrando...' : `Votar${selecionados.length > 1 ? ` (${selecionados.length} opções)` : ''}`}
          </button>
        )}

        {!jaVotou && !encerrada && selecionados.length === 0 && (
          <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem' }}>
            {poll.is_multiple_choice ? 'Selecione uma ou mais opções' : 'Selecione uma opção para votar'}
          </p>
        )}

        {encerrada && !mostrarResultado && (
          <div style={{ textAlign: 'center', padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '1rem' }}>
            <p style={{ color: '#64748b', fontSize: '0.875rem', margin: 0 }}>🔒 Resultado não disponível</p>
          </div>
        )}
      </div>
    </div>
  )
}
