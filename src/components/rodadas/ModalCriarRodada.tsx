'use client'

import { useState } from 'react'
import { Loader2, ArrowLeft } from 'lucide-react'
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
  const [titulo, setTitulo] = useState('')
  const [data, setData] = useState(today)
  const [horario, setHorario] = useState('08:00')
  const [horarioFim, setHorarioFim] = useState('10:00')

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
      max_arrival_time: horarioFim,
      players_per_team: 5,
      match_duration_minutes: 10,
      has_two_halves: false,
      formation_mode: 'manual',
      status: 'scheduled',
      created_by: user.id,
    })

    if (error) {
      setError('Erro ao criar rodada. Tente novamente.')
      setLoading(false)
      return
    }

    const dataFormatada = new Date(data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
    const tituloRodada = titulo.trim() || `Rodada de ${dataFormatada}`
    await notificarMembros(groupId, 'round_created',
      `📅 Nova rodada agendada!`,
      `${tituloRodada} · ${dataFormatada} às ${horario}`,
      { group_id: groupId }, user.id)

    onSuccess()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: '#f8fafc', zIndex: 50, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ backgroundColor: '#16a34a', paddingTop: '3rem', paddingBottom: '1rem', paddingLeft: '1rem', paddingRight: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.8)', padding: '4px' }}>
          <ArrowLeft size={22} />
        </button>
        <h2 style={{ color: 'white', fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>📅 Nova Rodada</h2>
      </div>

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
              Hora início <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input type="time" value={horario} onChange={e => setHorario(e.target.value)} required className="input-baba" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.375rem' }}>
              Hora fim
            </label>
            <input type="time" value={horarioFim} onChange={e => setHorarioFim(e.target.value)} className="input-baba" />
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
            style={{ flex: 1, border: '1px solid #e2e8f0', color: '#475569', fontWeight: 600, padding: '0.875rem', borderRadius: '0.875rem', backgroundColor: 'white', cursor: 'pointer' }}>
            Cancelar
          </button>
          <button type="submit" disabled={loading}
            style={{ flex: 2, backgroundColor: loading ? '#86efac' : '#16a34a', color: 'white', fontWeight: 700, padding: '0.875rem', borderRadius: '0.875rem', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '1rem' }}>
            {loading ? <Loader2 size={18} /> : '📅'}
            {loading ? 'Criando...' : 'Criar Rodada'}
          </button>
        </div>
      </form>
    </div>
  )
}
