'use client'

import { useState } from 'react'
import { X, Loader2, ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { notificarMembros } from '@/lib/notificacoes'

interface Props {
  groupId: string
  seasonId: string
  onClose: () => void
  onSuccess: () => void
}

export default function ModalCriarRodada({ groupId, seasonId, onClose, onSuccess }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const today = new Date().toISOString().split('T')[0]
  const [data, setData] = useState(today)
  const [horario, setHorario] = useState('08:00')
  const [horarioMaxChegada, setHorarioMaxChegada] = useState('08:30')
  const [jogadoresPorTime, setJogadoresPorTime] = useState(5)
  const [duracaoJogo, setDuracaoJogo] = useState(10)
  const [doisTempos, setDoisTempos] = useState(false)
  const [modoFormacao, setModoFormacao] = useState<'manual' | 'balanced' | 'queue'>('manual')
  const [titulo, setTitulo] = useState('')

  async function handleCriar(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.from('rounds').insert({
      group_id: groupId,
      season_id: seasonId,
      title: titulo.trim() || null,
      scheduled_date: data,
      start_time: horario,
      max_arrival_time: horarioMaxChegada,
      players_per_team: jogadoresPorTime,
      match_duration_minutes: duracaoJogo,
      has_two_halves: doisTempos,
      formation_mode: modoFormacao,
      status: 'scheduled',
      created_by: user.id,
    })

    if (error) {
      setError('Erro ao criar rodada. Tente novamente.')
      setLoading(false)
      return
    }

    // Notifica membros sobre nova rodada
    const dataFormatada = new Date(data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
    const tituloRodada = titulo.trim() || `Rodada de ${dataFormatada}`
    await notificarMembros(groupId, 'round_created',
      `📅 Nova rodada agendada!`,
      `${tituloRodada} · ${dataFormatada} às ${horario}`,
      { group_id: groupId }, user.id)

    onSuccess()
  }

  // Renderiza como página full-screen em vez de modal
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: '#f8fafc',
      zIndex: 50,
      display: 'flex',
      flexDirection: 'column',
      overflowY: 'auto',
    }}>
      {/* Header */}
      <div style={{
        backgroundColor: '#16a34a',
        paddingTop: '3rem',
        paddingBottom: '1rem',
        paddingLeft: '1rem',
        paddingRight: '1rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        flexShrink: 0,
      }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.8)', padding: '4px' }}>
          <ArrowLeft size={22} />
        </button>
        <h2 style={{ color: 'white', fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>📅 Nova Rodada</h2>
      </div>

      {/* Form */}
      <form onSubmit={handleCriar} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: '480px', width: '100%', margin: '0 auto' }}>

        {/* Título */}
        <div>
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.375rem' }}>
            Título <span style={{ color: '#9ca3af', fontWeight: 400 }}>(opcional)</span>
          </label>
          <input type="text" value={titulo} onChange={e => setTitulo(e.target.value)}
            placeholder="Ex: Rodada especial de aniversário" maxLength={60} className="input-baba" />
        </div>

        {/* Data */}
        <div>
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.375rem' }}>
            Data <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <input type="date" value={data} onChange={e => setData(e.target.value)} required className="input-baba" />
        </div>

        {/* Horários */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.375rem' }}>
              Horário início <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input type="time" value={horario} onChange={e => setHorario(e.target.value)} required className="input-baba" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.375rem' }}>
              Limite chegada
            </label>
            <input type="time" value={horarioMaxChegada} onChange={e => setHorarioMaxChegada(e.target.value)} className="input-baba" />
          </div>
        </div>

        {/* Jogadores por time */}
        <div>
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>
            Jogadores por time: <span style={{ color: '#16a34a' }}>{jogadoresPorTime}</span>
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {[4, 5, 6, 7, 8, 9, 10, 11].map(n => (
              <button key={n} type="button" onClick={() => setJogadoresPorTime(n)}
                style={{
                  flex: 1, padding: '0.625rem 0', borderRadius: '0.75rem', fontSize: '0.875rem',
                  fontWeight: 600, border: 'none', cursor: 'pointer',
                  backgroundColor: jogadoresPorTime === n ? '#16a34a' : '#f1f5f9',
                  color: jogadoresPorTime === n ? 'white' : '#64748b',
                }}>
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Duração */}
        <div>
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>
            Duração de cada jogo: <span style={{ color: '#16a34a' }}>{duracaoJogo} min</span>
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {[5, 7, 10, 12, 15, 20].map(n => (
              <button key={n} type="button" onClick={() => setDuracaoJogo(n)}
                style={{
                  flex: 1, padding: '0.625rem 0', borderRadius: '0.75rem', fontSize: '0.875rem',
                  fontWeight: 600, border: 'none', cursor: 'pointer',
                  backgroundColor: duracaoJogo === n ? '#16a34a' : '#f1f5f9',
                  color: duracaoJogo === n ? 'white' : '#64748b',
                }}>
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Dois tempos */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          backgroundColor: 'white', borderRadius: '0.75rem', padding: '0.875rem 1rem',
          border: '1px solid #e2e8f0',
        }}>
          <div>
            <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151', margin: 0 }}>Dois tempos?</p>
            <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: '2px 0 0' }}>Divide o tempo em dois períodos</p>
          </div>
          <button type="button" onClick={() => setDoisTempos(!doisTempos)}
            style={{
              width: '3rem', height: '1.5rem', borderRadius: '9999px', border: 'none',
              cursor: 'pointer', position: 'relative', flexShrink: 0,
              backgroundColor: doisTempos ? '#22c55e' : '#cbd5e1', transition: 'all 0.2s',
            }}>
            <span style={{
              position: 'absolute', top: '2px',
              left: doisTempos ? '26px' : '2px',
              width: '20px', height: '20px',
              backgroundColor: 'white', borderRadius: '9999px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s',
            }} />
          </button>
        </div>

        {/* Formação */}
        <div>
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>
            Formação dos times
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {[
              { value: 'manual', emoji: '✋', label: 'Manual', desc: 'Admin monta os times' },
              { value: 'balanced', emoji: '⚖️', label: 'Equilibrado', desc: 'Sorteio por posição' },
              { value: 'queue', emoji: '🔢', label: 'Fila', desc: 'Ordem de chegada' },
            ].map(opt => (
              <button key={opt.value} type="button" onClick={() => setModoFormacao(opt.value as any)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.875rem 1rem', borderRadius: '0.75rem',
                  border: modoFormacao === opt.value ? '2px solid #16a34a' : '2px solid #e2e8f0',
                  backgroundColor: modoFormacao === opt.value ? '#f0fdf4' : 'white',
                  cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                }}>
                <span style={{ fontSize: '1.5rem' }}>{opt.emoji}</span>
                <div>
                  <p style={{ fontSize: '0.875rem', fontWeight: 700, color: modoFormacao === opt.value ? '#15803d' : '#374151', margin: 0 }}>
                    {opt.label}
                  </p>
                  <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: '2px 0 0' }}>{opt.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div style={{ backgroundColor: '#fef2f2', color: '#dc2626', fontSize: '0.875rem', padding: '0.875rem 1rem', borderRadius: '0.75rem' }}>
            {error}
          </div>
        )}

        {/* Botões */}
        <div style={{ display: 'flex', gap: '0.75rem', paddingBottom: '6rem' }}>
          <button type="button" onClick={onClose}
            style={{
              flex: 1, border: '1px solid #e2e8f0', color: '#475569', fontWeight: 600,
              padding: '0.875rem', borderRadius: '0.875rem', backgroundColor: 'white', cursor: 'pointer',
            }}>
            Cancelar
          </button>
          <button type="submit" disabled={loading}
            style={{
              flex: 2, backgroundColor: loading ? '#86efac' : '#16a34a', color: 'white',
              fontWeight: 700, padding: '0.875rem', borderRadius: '0.875rem',
              border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              fontSize: '1rem',
            }}>
            {loading ? <Loader2 size={18} /> : '📅'}
            {loading ? 'Criando...' : 'Criar Rodada'}
          </button>
        </div>
      </form>
    </div>
  )
}
