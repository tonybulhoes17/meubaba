'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Plus, X, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { notificarMembros } from '@/lib/notificacoes'

type TipoEnquete = 'general' | 'best_of_year'

const POSICOES_MELHORES = [
  { key: 'best_goalkeeper',  label: 'Melhor Goleiro',           emoji: '🧤', position: 'goleiro' },
  { key: 'best_defender',    label: 'Melhor Zagueiro',          emoji: '🛡️', position: 'zagueiro' },
  { key: 'best_left_back',   label: 'Melhor Lateral Esquerdo',  emoji: '↙️', position: 'lateral_esquerdo' },
  { key: 'best_right_back',  label: 'Melhor Lateral Direito',   emoji: '↗️', position: 'lateral_direito' },
  { key: 'best_midfielder',  label: 'Melhor Volante',           emoji: '⚙️', position: 'volante' },
  { key: 'best_playmaker',   label: 'Melhor Meia',              emoji: '🎯', position: 'meia' },
  { key: 'best_striker',     label: 'Melhor Atacante',          emoji: '⚡', position: 'atacante' },
  { key: 'best_overall',     label: 'Melhor Jogador Geral',     emoji: '⭐', position: 'all' },
]

export default function NovaEnquetePage() {
  const { groupId } = useParams<{ groupId: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [saving, setSaving] = useState(false)
  const [myUserId, setMyUserId] = useState('')
  const [seasonId, setSeasonId] = useState('')
  const [membros, setMembros] = useState<{ user_id: string; nome: string; position_1: string | null }[]>([])

  // Tipo de enquete
  const [tipo, setTipo] = useState<TipoEnquete>('general')

  // Campos gerais
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [isMultiple, setIsMultiple] = useState(false)
  const [showPartial, setShowPartial] = useState(false)
  const [isAnonymous, setIsAnonymous] = useState(true)
  const [closesAt, setClosesAt] = useState('')
  const [opcoes, setOpcoes] = useState(['', ''])

  // Melhores da temporada
  const [posicoesAtivas, setPosicoesAtivas] = useState<string[]>(POSICOES_MELHORES.map(p => p.key))

  useEffect(() => { fetchData() }, [groupId])

  async function fetchData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setMyUserId(user.id)

    const { data: member } = await supabase
      .from('group_members').select('role').eq('group_id', groupId).eq('user_id', user.id).single()
    if (member?.role !== 'admin') { router.push(`/grupos/${groupId}/enquetes`); return }

    const { data: season } = await supabase
      .from('seasons').select('id').eq('group_id', groupId).eq('status', 'active').single()
    if (!season) { router.push(`/grupos/${groupId}/enquetes`); return }
    setSeasonId(season.id)

    // Membros com posição para melhores da temporada
    const { data: membrosData } = await supabase
      .from('group_members')
      .select('user_id, profile:profiles(full_name, position_1)')
      .eq('group_id', groupId).eq('is_active', true)

    setMembros((membrosData ?? []).map((m: any) => ({
      user_id: m.user_id,
      nome: m.profile?.full_name ?? 'Jogador',
      position_1: m.profile?.position_1 ?? null,
    })))

    // Default closes_at = 3 dias a partir de agora
    const d = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
    setClosesAt(d.toISOString().slice(0, 16))
  }

  async function salvar() {
    if (!closesAt) { alert('Defina a data de encerramento'); return }
    setSaving(true)

    const closesAtISO = new Date(closesAt).toISOString()
    const agora = new Date().toISOString()

    if (tipo === 'general') {
      if (!titulo.trim()) { alert('Defina o título'); setSaving(false); return }
      const opcoesValidas = opcoes.filter(o => o.trim())
      if (opcoesValidas.length < 2) { alert('Adicione pelo menos 2 opções'); setSaving(false); return }

      const { data: poll, error } = await supabase.from('polls').insert({
        group_id: groupId, season_id: seasonId,
        type: 'general', title: titulo.trim(),
        description: descricao.trim() || null,
        is_multiple_choice: isMultiple,
        show_partial: showPartial,
        is_closed: false,
        created_by: myUserId,
        opens_at: agora, closes_at: closesAtISO,
      }).select().single()

      if (error || !poll) { alert(`Erro: ${error?.message}`); setSaving(false); return }

      await supabase.from('poll_options').insert(
        opcoesValidas.map((label, i) => ({ poll_id: poll.id, label: label.trim(), order_index: i }))
      )

    } else {
      // Melhores da temporada — cria uma poll por posição ativa
      for (const posKey of posicoesAtivas) {
        const pos = POSICOES_MELHORES.find(p => p.key === posKey)!

        // Todos os membros concorrem em todas as posições
        const candidatos = membros

        if (candidatos.length === 0) continue

        const { data: poll } = await supabase.from('polls').insert({
          group_id: groupId, season_id: seasonId,
          type: posKey, title: `${pos.emoji} ${pos.label}`,
          is_multiple_choice: false,
          show_partial: showPartial,
          is_closed: false,
          created_by: myUserId,
          opens_at: agora, closes_at: closesAtISO,
        }).select().single()

        if (poll) {
          await supabase.from('poll_options').insert(
            candidatos.map((m, i) => ({
              poll_id: poll.id,
              user_id: m.user_id,
              label: m.nome,
              position: pos.position,
              order_index: i,
            }))
          )
        }
      }
    }

    setSaving(false)

    // Notifica membros sobre nova enquete
    const tituloNotif = tipo === 'general' ? titulo.trim() : '🏆 Melhores da Temporada'
    await notificarMembros(groupId, 'poll_open',
      `🗳️ Nova enquete aberta!`,
      tituloNotif,
      { group_id: groupId }, myUserId)

    router.push(`/grupos/${groupId}/enquetes`)
  }

  const Toggle = ({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid #f1f5f9' }}>
      <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>{label}</span>
      <button onClick={() => onChange(!value)}
        style={{ width: '44px', height: '24px', borderRadius: '9999px', border: 'none', cursor: 'pointer', backgroundColor: value ? '#16a34a' : '#cbd5e1', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
        <div style={{ width: '18px', height: '18px', borderRadius: '9999px', backgroundColor: 'white', position: 'absolute', top: '3px', left: value ? '23px' : '3px', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
      </button>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', paddingBottom: '6rem' }}>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #0f172a, #1e293b)', paddingTop: '3rem', paddingBottom: '1.25rem', paddingLeft: '1rem', paddingRight: '1rem' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.7)' }}>
            <ArrowLeft size={22} />
          </button>
          <div>
            <h1 style={{ color: 'white', fontWeight: 700, margin: 0, fontSize: '1.1rem' }}>➕ Nova Enquete</h1>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', margin: '2px 0 0' }}>Configure e publique</p>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

        {/* Tipo de enquete */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          {([
            { key: 'general', icon: '📋', label: 'Enquete Geral', desc: 'Pergunta livre com opções' },
            { key: 'best_of_year', icon: '🏆', label: 'Melhores da Temporada', desc: 'Votação por posição' },
          ] as { key: TipoEnquete; icon: string; label: string; desc: string }[]).map(t => (
            <button key={t.key} onClick={() => setTipo(t.key)}
              style={{ padding: '1rem', borderRadius: '1rem', border: `2px solid ${tipo === t.key ? '#1e293b' : '#e2e8f0'}`, backgroundColor: tipo === t.key ? '#1e293b' : 'white', cursor: 'pointer', textAlign: 'left' }}>
              <p style={{ fontSize: '1.5rem', margin: '0 0 0.25rem' }}>{t.icon}</p>
              <p style={{ fontSize: '0.8rem', fontWeight: 700, color: tipo === t.key ? 'white' : '#1e293b', margin: '0 0 2px' }}>{t.label}</p>
              <p style={{ fontSize: '0.68rem', color: tipo === t.key ? 'rgba(255,255,255,0.6)' : '#94a3b8', margin: 0 }}>{t.desc}</p>
            </button>
          ))}
        </div>

        {/* ===== ENQUETE GERAL ===== */}
        {tipo === 'general' && (
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>📋 Enquete Geral</p>

            <input value={titulo} onChange={e => setTitulo(e.target.value)}
              placeholder="Título da enquete *"
              style={{ width: '100%', padding: '0.75rem', border: '2px solid #e2e8f0', borderRadius: '0.75rem', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box', color: '#1e293b', fontWeight: 600 }} />

            <textarea value={descricao} onChange={e => setDescricao(e.target.value)}
              placeholder="Descrição (opcional)"
              rows={2}
              style={{ width: '100%', padding: '0.75rem', border: '2px solid #e2e8f0', borderRadius: '0.75rem', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box', color: '#1e293b', resize: 'none', fontFamily: 'inherit' }} />

            {/* Opções */}
            <div>
              <p style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', margin: '0 0 0.5rem' }}>Opções de resposta</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {opcoes.map((op, i) => (
                  <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input value={op} onChange={e => { const n = [...opcoes]; n[i] = e.target.value; setOpcoes(n) }}
                      placeholder={`Opção ${i + 1}`}
                      style={{ flex: 1, padding: '0.625rem 0.875rem', border: '2px solid #e2e8f0', borderRadius: '0.75rem', fontSize: '0.875rem', outline: 'none', color: '#1e293b' }} />
                    {opcoes.length > 2 && (
                      <button onClick={() => setOpcoes(opcoes.filter((_, j) => j !== i))}
                        style={{ width: '32px', height: '32px', borderRadius: '0.5rem', backgroundColor: '#fee2e2', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <X size={14} color="#ef4444" />
                      </button>
                    )}
                  </div>
                ))}
                {opcoes.length < 8 && (
                  <button onClick={() => setOpcoes([...opcoes, ''])}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0.625rem', border: '2px dashed #e2e8f0', borderRadius: '0.75rem', backgroundColor: 'transparent', color: '#64748b', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                    <Plus size={14} /> Adicionar opção
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ===== MELHORES DA TEMPORADA ===== */}
        {tipo === 'best_of_year' && (
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9' }}>
            <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.875rem' }}>🏆 Posições incluídas</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {POSICOES_MELHORES.map(pos => {
                const ativa = posicoesAtivas.includes(pos.key)
                // Conta candidatos
                const candidatos = pos.position === 'all'
                  ? membros.length
                  : pos.position === 'lateral_esquerdo' || pos.position === 'lateral_direito'
                    ? membros.filter(m => m.position_1 === 'lateral').length
                    : membros.filter(m => m.position_1 === pos.position).length

                return (
                  <button key={pos.key} onClick={() => setPosicoesAtivas(prev => ativa ? prev.filter(k => k !== pos.key) : [...prev, pos.key])}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', borderRadius: '0.75rem', border: `2px solid ${ativa ? '#16a34a' : '#e2e8f0'}`, backgroundColor: ativa ? '#f0fdf4' : 'white', cursor: 'pointer', textAlign: 'left' }}>
                    <span style={{ fontSize: '1.25rem', flexShrink: 0 }}>{pos.emoji}</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>{pos.label}</p>
                      <p style={{ fontSize: '0.7rem', color: '#94a3b8', margin: 0 }}>{candidatos} candidato{candidatos !== 1 ? 's' : ''}</p>
                    </div>
                    <div style={{ width: '20px', height: '20px', borderRadius: '9999px', backgroundColor: ativa ? '#16a34a' : '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {ativa && <span style={{ color: 'white', fontSize: '0.7rem', fontWeight: 900 }}>✓</span>}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Configurações */}
        <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9' }}>
          <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.5rem' }}>⚙️ Configurações</p>

          {tipo === 'general' && (
            <Toggle value={isMultiple} onChange={setIsMultiple} label="Múltipla escolha" />
          )}
          <Toggle value={showPartial} onChange={setShowPartial} label="Mostrar resultado parcial" />
          <Toggle value={isAnonymous} onChange={setIsAnonymous} label="Voto anônimo" />

          <div style={{ paddingTop: '0.875rem' }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
              📅 Encerramento *
            </label>
            <input type="datetime-local" value={closesAt} onChange={e => setClosesAt(e.target.value)}
              style={{ width: '100%', padding: '0.75rem', border: '2px solid #e2e8f0', borderRadius: '0.75rem', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box', color: '#1e293b' }} />
          </div>
        </div>

        {/* Botão publicar */}
        <button onClick={salvar} disabled={saving}
          style={{ width: '100%', background: saving ? '#94a3b8' : 'linear-gradient(135deg, #0f172a, #1e293b)', border: 'none', borderRadius: '1rem', padding: '1rem', color: 'white', fontWeight: 700, fontSize: '1rem', cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', boxShadow: '0 4px 16px rgba(15,23,42,0.3)' }}>
          {saving ? <Loader2 size={20} className="animate-spin" /> : '🚀'}
          {saving ? 'Publicando...' : tipo === 'best_of_year' ? `Publicar ${posicoesAtivas.length} enquete${posicoesAtivas.length !== 1 ? 's' : ''}` : 'Publicar Enquete'}
        </button>
      </div>
    </div>
  )
}
