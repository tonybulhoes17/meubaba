'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Trash2, Shuffle, Save, Loader2, Search } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Jogador {
  key: string
  user_id: string | null
  attendance_id: string
  full_name: string
  photo_url: string | null
  position_1: string | null
  is_guest: boolean
  is_goalkeeper?: boolean
}

interface Time {
  id?: string
  name: string
  color: string
  jogadores: Jogador[]
}

// Paleta com cores vibrantes e nomes legíveis
const PALETA = [
  { name: 'Time Verde',    color: '#16a34a', text: 'white' },
  { name: 'Time Vermelho', color: '#dc2626', text: 'white' },
  { name: 'Time Azul',     color: '#2563eb', text: 'white' },
  { name: 'Time Laranja',  color: '#ea580c', text: 'white' },
  { name: 'Time Roxo',     color: '#7c3aed', text: 'white' },
  { name: 'Time Rosa',     color: '#db2777', text: 'white' },
  { name: 'Time Ciano',    color: '#0891b2', text: 'white' },
  { name: 'Time Amarelo',  color: '#ca8a04', text: 'white' },
]

const posicaoIcon: Record<string, string> = {
  goleiro: '🧤', zagueiro: '🛡️', lateral: '↔️',
  volante: '⚙️', meia: '🎯', atacante: '⚡',
}

export default function TimesPage() {
  const { groupId, roundId } = useParams<{ groupId: string; roundId: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [presentes, setPresentes] = useState<Jogador[]>([])
  const [times, setTimes] = useState<Time[]>([])
  const [semTime, setSemTime] = useState<Jogador[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [viewMode, setViewMode] = useState<'lista' | 'vs'>('lista')
  const [busca, setBusca] = useState('')
  const [goleiros, setGoleiros] = useState<Record<string, boolean>>({})
  const [erroGoleiro, setErroGoleiro] = useState<string | null>(null)

  useEffect(() => { fetchData() }, [roundId])

  async function fetchData() {
    const { data: atts } = await supabase
      .from('round_attendance')
      .select('id, user_id, guest_name, is_guest, checked_in, profile:profiles(full_name, photo_url, position_1)')
      .eq('round_id', roundId)
      .eq('checked_in', true)

    const jogadores: Jogador[] = (atts ?? []).map((a: any) => ({
      key: a.is_guest ? `guest_${a.id}` : a.user_id,
      user_id: a.is_guest ? null : a.user_id,
      attendance_id: a.id,
      full_name: a.is_guest ? (a.guest_name ?? 'Convidado') : (a.profile?.full_name ?? 'Jogador'),
      photo_url: a.is_guest ? null : (a.profile?.photo_url ?? null),
      position_1: a.is_guest ? null : (a.profile?.position_1 ?? null),
      is_guest: a.is_guest,
      is_goalkeeper: false,
    }))

    setPresentes(jogadores)

    const { data: timesDB } = await supabase
      .from('teams')
      .select('*, team_players(user_id, attendance_id)')
      .eq('round_id', roundId)

    if (timesDB && timesDB.length > 0) {
      const timesFormatados: Time[] = timesDB.map((t: any) => ({
        id: t.id,
        name: t.name,
        color: t.color ?? '#16a34a',
        jogadores: jogadores.filter(j =>
          t.team_players.some((tp: any) =>
            j.is_guest ? tp.attendance_id === j.attendance_id : tp.user_id === j.user_id
          )
        ),
      }))
      setTimes(timesFormatados)
      const emTime = timesDB.flatMap((t: any) => [
        ...t.team_players.filter((tp: any) => tp.user_id).map((tp: any) => tp.user_id),
        ...t.team_players.filter((tp: any) => !tp.user_id && tp.attendance_id).map((tp: any) => `guest_${tp.attendance_id}`),
      ])
      setSemTime(jogadores.filter(j => !emTime.includes(j.key)))
    } else {
      setSemTime(jogadores)
    }

    setLoading(false)
  }

  function adicionarTime() {
    const paletaIdx = times.length % PALETA.length
    const cor = PALETA[paletaIdx]
    setTimes([...times, { name: cor.name, color: cor.color, jogadores: [] }])
  }

  function moverJogador(jogador: Jogador, paraTimeIdx: number) {
    const novosTempos = times.map(t => ({
      ...t, jogadores: t.jogadores.filter(j => j.key !== jogador.key),
    }))
    const novoSemTime = semTime.filter(j => j.key !== jogador.key)
    if (paraTimeIdx === -1) {
      setSemTime([...novoSemTime, jogador])
      setTimes(novosTempos)
    } else {
      novosTempos[paraTimeIdx].jogadores.push(jogador)
      setTimes(novosTempos)
      setSemTime(novoSemTime)
    }
  }

  function sortearTimes() {
    if (times.length === 0) return
    const shuffled = [...presentes].sort(() => Math.random() - 0.5)
    const novosTempos = times.map(t => ({ ...t, jogadores: [] as Jogador[] }))
    shuffled.forEach((j, i) => { novosTempos[i % novosTempos.length].jogadores.push(j) })
    setTimes(novosTempos)
    setSemTime([])
  }

  async function salvarTimes() {
    setErroGoleiro(null)

    // Valida: cada time com jogadores deve ter exatamente 1 goleiro
    const timesComJogadores = times.filter(t => t.jogadores.length > 0)
    for (const time of timesComJogadores) {
      const goleirosDoTime = time.jogadores.filter(j => goleiros[j.key])
      if (goleirosDoTime.length === 0) {
        setErroGoleiro(`O time "${time.name}" não tem goleiro marcado. Marque um goleiro com 🧤 antes de salvar.`)
        return
      }
      if (goleirosDoTime.length > 1) {
        setErroGoleiro(`O time "${time.name}" tem ${goleirosDoTime.length} goleiros marcados. Cada time pode ter apenas 1 goleiro.`)
        return
      }
    }

    setSaving(true)
    const { data: antigos } = await supabase.from('teams').select('id').eq('round_id', roundId)
    if (antigos && antigos.length > 0) {
      await supabase.from('team_players').delete().in('team_id', antigos.map((t: any) => t.id))
      await supabase.from('teams').delete().eq('round_id', roundId)
    }
    for (const time of times) {
      if (time.jogadores.length === 0) continue
      const { data: novoTime } = await supabase
        .from('teams').insert({ round_id: roundId, name: time.name, color: time.color }).select().single()
      if (novoTime) {
        await supabase.from('team_players').insert(
          time.jogadores.map(j => ({
            team_id: novoTime.id,
            user_id: j.user_id,
            attendance_id: j.is_guest ? j.attendance_id : null,
            is_guest: j.is_guest,
            is_goalkeeper: goleiros[j.key] ?? false,
          }))
        )
      }
    }
    setSaving(false)
    router.push(`/grupos/${groupId}/rodadas/${roundId}`)
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-4xl animate-bounce">⚽</div>
    </div>
  )

  // Card de jogador — botão ✕ direto, sem dropdown
  function JogadorCard({ j, cor, onRemover }: {
    j: Jogador
    cor?: string
    onRemover?: () => void
  }) {
    const initials = j.full_name.split(' ').map(n => n[0]).slice(0, 2).join('')
    const isGk = goleiros[j.key] ?? false
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.75rem',
        padding: '0.625rem 1rem',
        borderBottom: '1px solid rgba(0,0,0,0.04)',
        backgroundColor: isGk ? '#fef9c3' : 'white',
      }}>
        {/* Avatar */}
        <div style={{
          width: '2.5rem', height: '2.5rem', borderRadius: '9999px', flexShrink: 0,
          backgroundColor: cor ? cor + '33' : '#f1f5f9',
          border: `2px solid ${isGk ? '#ca8a04' : (cor ?? '#e2e8f0')}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
        }}>
          {j.photo_url
            ? <img src={j.photo_url} alt={j.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ fontSize: '0.75rem', fontWeight: 700, color: cor ?? '#64748b' }}>{initials}</span>}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1e293b', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {isGk && <span style={{ marginRight: '4px' }}>🧤</span>}
            {j.full_name}
          </p>
          <p style={{ fontSize: '0.7rem', color: '#94a3b8', margin: '1px 0 0' }}>
            {j.is_guest ? '🎟️ convidado' : j.position_1 ? `${posicaoIcon[j.position_1] ?? ''} ${j.position_1}` : '—'}
          </p>
        </div>

        {/* Botão goleiro */}
        <button onClick={() => setGoleiros(prev => ({ ...prev, [j.key]: !prev[j.key] }))}
          title={isGk ? 'Remover goleiro' : 'Marcar como goleiro'}
          style={{
            padding: '3px 8px', borderRadius: '9999px', border: `1px solid ${isGk ? '#ca8a04' : '#e2e8f0'}`,
            backgroundColor: isGk ? '#fef08a' : '#f8fafc', cursor: 'pointer',
            fontSize: '0.75rem', fontWeight: 700, color: isGk ? '#92400e' : '#94a3b8',
            flexShrink: 0,
          }}>
          🧤
        </button>

        {/* Botão remover */}
        {onRemover && (
          <button onClick={onRemover}
            style={{
              width: '28px', height: '28px', borderRadius: '9999px',
              backgroundColor: '#fee2e2', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#ef4444', fontSize: '0.85rem', fontWeight: 700, flexShrink: 0,
            }}>
            ✕
          </button>
        )}
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', paddingBottom: '7rem' }}>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', paddingTop: '3rem', paddingBottom: '1rem', paddingLeft: '1rem', paddingRight: '1rem' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.8)', padding: '4px' }}>
            <ArrowLeft size={22} />
          </button>
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ color: 'white', fontWeight: 700, margin: 0, fontSize: '1.1rem' }}>👕 Montar Times</h1>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', margin: '2px 0 0' }}>
              {presentes.length} presentes · {presentes.filter(p => p.is_guest).length} convidados
            </p>
          </div>
          {/* Toggle view */}
          <button onClick={() => setViewMode(viewMode === 'lista' ? 'vs' : 'lista')}
            style={{
              background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '0.5rem',
              padding: '6px 10px', color: 'white', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600,
            }}>
            {viewMode === 'lista' ? '⚔️ VS' : '📋 Lista'}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

        {presentes.length === 0 && (
          <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '1rem', padding: '1rem', textAlign: 'center' }}>
            <p style={{ color: '#92400e', fontWeight: 600, fontSize: '0.875rem' }}>⚠️ Faça o check-in na aba Presença primeiro</p>
          </div>
        )}

        {/* Ações */}
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={adicionarTime}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              backgroundColor: 'white', border: '2px solid #e2e8f0', borderRadius: '0.875rem',
              padding: '0.75rem', fontWeight: 700, color: '#374151', cursor: 'pointer', fontSize: '0.875rem',
            }}>
            <Plus size={16} /> Novo Time
          </button>
          <button onClick={sortearTimes} disabled={times.length === 0}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              background: times.length === 0 ? '#e2e8f0' : 'linear-gradient(135deg, #f97316, #ea580c)',
              border: 'none', borderRadius: '0.875rem',
              padding: '0.75rem', fontWeight: 700,
              color: times.length === 0 ? '#94a3b8' : 'white',
              cursor: times.length === 0 ? 'not-allowed' : 'pointer', fontSize: '0.875rem',
              boxShadow: times.length === 0 ? 'none' : '0 4px 12px rgba(249,115,22,0.4)',
            }}>
            <Shuffle size={16} /> 🎲 Sortear
          </button>
        </div>

        {/* Sem time */}
        {semTime.length > 0 && (
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', border: '2px dashed #cbd5e1', overflow: 'hidden' }}>
            <div style={{ padding: '0.75rem 1rem', backgroundColor: '#f8fafc', borderBottom: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <p style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', margin: 0 }}>
                ⏳ Sem time — {semTime.length} jogador{semTime.length !== 1 ? 'es' : ''}
              </p>
              {/* Campo de busca */}
              <div style={{ position: 'relative' }}>
                <Search size={13} style={{ position: 'absolute', left: '0.625rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  value={busca}
                  onChange={e => setBusca(e.target.value)}
                  placeholder="Buscar jogador..."
                  style={{ width: '100%', paddingLeft: '2rem', paddingRight: '0.75rem', paddingTop: '0.5rem', paddingBottom: '0.5rem', border: '1px solid #e2e8f0', borderRadius: '0.625rem', fontSize: '0.8rem', outline: 'none', boxSizing: 'border-box', backgroundColor: 'white' }}
                />
              </div>
            </div>
            {semTime.filter(j => j.full_name.toLowerCase().includes(busca.toLowerCase())).map(j => (
              <div key={j.key} style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.625rem 1rem', borderBottom: '1px solid rgba(0,0,0,0.04)',
              }}>
                {/* Avatar + nome embaixo */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', flexShrink: 0, width: '3rem' }}>
                  <div style={{
                    width: '2.25rem', height: '2.25rem', borderRadius: '9999px',
                    backgroundColor: '#f1f5f9', border: '2px solid #e2e8f0',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                  }}>
                    {j.photo_url
                      ? <img src={j.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b' }}>
                          {j.full_name.split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
                        </span>}
                  </div>
                  <p style={{
                    fontSize: '0.6rem', fontWeight: 600, color: '#475569',
                    margin: 0, textAlign: 'center',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    width: '3rem',
                  }}>
                    {j.full_name.split(' ')[0]}
                  </p>
                </div>

                {/* Botões de destino — ocupam o restante */}
                <div style={{ flex: 1, display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {times.map((t, idx) => (
                    <button key={idx} onClick={() => moverJogador(j, idx)}
                      style={{
                        padding: '5px 10px', borderRadius: '9999px', border: 'none',
                        backgroundColor: t.color, color: 'white',
                        fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer',
                        whiteSpace: 'nowrap', flexShrink: 0,
                      }}>
                      → {t.name.split(' ').pop()}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ======= VIEW: LISTA ======= */}
        {viewMode === 'lista' && (
          <>
            {times.map((time, idx) => (
              <div key={idx} style={{
                backgroundColor: 'white', borderRadius: '1rem',
                overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                border: `2px solid ${time.color}22`,
              }}>
                {/* Cabeçalho do time */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0.875rem 1rem',
                  background: `linear-gradient(135deg, ${time.color}, ${time.color}dd)`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '9999px', backgroundColor: 'rgba(255,255,255,0.6)', flexShrink: 0 }} />
                    <input value={time.name}
                      onChange={e => { const n = [...times]; n[idx].name = e.target.value; setTimes(n) }}
                      style={{
                        fontWeight: 700, fontSize: '1rem', color: 'white',
                        backgroundColor: 'transparent', border: 'none', outline: 'none', flex: 1,
                      }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ backgroundColor: 'rgba(255,255,255,0.25)', color: 'white', fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px' }}>
                      {time.jogadores.length} jog.
                    </span>
                    <button onClick={() => { setSemTime([...semTime, ...time.jogadores]); setTimes(times.filter((_, i) => i !== idx)) }}
                      style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '0.5rem', padding: '4px 8px', color: 'white', cursor: 'pointer', fontSize: '0.7rem' }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {time.jogadores.length === 0 ? (
                  <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem', padding: '1.5rem' }}>
                    Nenhum jogador — use "Mover" ou clique em Sortear
                  </p>
                ) : (
                  time.jogadores.map(j => (
                    <JogadorCard key={j.key} j={j} cor={time.color}
                      onRemover={() => moverJogador(j, -1)} />
                  ))
                )}
              </div>
            ))}
          </>
        )}

        {/* ======= VIEW: VS (lado a lado) ======= */}
        {viewMode === 'vs' && times.length >= 2 && (
          <>
            {/* Mostra de 2 em 2 */}
            {Array.from({ length: Math.ceil(times.length / 2) }, (_, pairIdx) => {
              const t1 = times[pairIdx * 2]
              const t2 = times[pairIdx * 2 + 1]
              return (
                <div key={pairIdx}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '0.5rem', alignItems: 'start' }}>
                    {/* Time 1 */}
                    <div style={{ backgroundColor: 'white', borderRadius: '1rem', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                      <div style={{ padding: '0.75rem', background: `linear-gradient(135deg, ${t1.color}, ${t1.color}cc)`, textAlign: 'center' }}>
                        <p style={{ color: 'white', fontWeight: 800, fontSize: '0.9rem', margin: 0 }}>{t1.name}</p>
                        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.7rem', margin: '2px 0 0' }}>{t1.jogadores.length} jogadores</p>
                      </div>
                      {t1.jogadores.map(j => {
                        const initials = j.full_name.split(' ').map(n => n[0]).slice(0, 2).join('')
                        return (
                          <div key={j.key} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 8px', borderBottom: '1px solid #f8fafc' }}>
                            <div style={{
                              width: '26px', height: '26px', borderRadius: '9999px', flexShrink: 0,
                              backgroundColor: t1.color + '22', border: `2px solid ${t1.color}55`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                            }}>
                              {j.photo_url
                                ? <img src={j.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                : <span style={{ fontSize: '0.6rem', fontWeight: 700, color: t1.color }}>{initials}</span>}
                            </div>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <p style={{ fontSize: '0.72rem', fontWeight: 600, color: '#1e293b', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {j.full_name.split(' ')[0]}
                              </p>
                              <p style={{ fontSize: '0.58rem', color: '#94a3b8', margin: 0 }}>
                                {j.is_guest ? '🎟️' : j.position_1 ? `${posicaoIcon[j.position_1] ?? ''} ${j.position_1}` : '—'}
                              </p>
                            </div>
                            <button onClick={() => moverJogador(j, -1)}
                              style={{ width: '18px', height: '18px', borderRadius: '9999px', backgroundColor: '#fee2e2', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '0.6rem', fontWeight: 700, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              ✕
                            </button>
                          </div>
                        )
                      })}
                      {t1.jogadores.length === 0 && <p style={{ textAlign: 'center', color: '#cbd5e1', fontSize: '0.75rem', padding: '1rem' }}>Vazio</p>}
                    </div>

                    {/* VS */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: '3rem', gap: '4px' }}>
                      <div style={{
                        width: '36px', height: '36px', borderRadius: '9999px',
                        background: 'linear-gradient(135deg, #1e293b, #334155)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                      }}>
                        <span style={{ color: 'white', fontWeight: 900, fontSize: '0.65rem', letterSpacing: '0.05em' }}>VS</span>
                      </div>
                    </div>

                    {/* Time 2 */}
                    {t2 ? (
                      <div style={{ backgroundColor: 'white', borderRadius: '1rem', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                        <div style={{ padding: '0.75rem', background: `linear-gradient(135deg, ${t2.color}, ${t2.color}cc)`, textAlign: 'center' }}>
                          <p style={{ color: 'white', fontWeight: 800, fontSize: '0.9rem', margin: 0 }}>{t2.name}</p>
                          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.7rem', margin: '2px 0 0' }}>{t2.jogadores.length} jogadores</p>
                        </div>
                        {t2.jogadores.map(j => {
                          const initials = j.full_name.split(' ').map(n => n[0]).slice(0, 2).join('')
                          return (
                            <div key={j.key} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 8px', borderBottom: '1px solid #f8fafc' }}>
                              <div style={{
                                width: '26px', height: '26px', borderRadius: '9999px', flexShrink: 0,
                                backgroundColor: t2.color + '22', border: `2px solid ${t2.color}55`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                              }}>
                                {j.photo_url
                                  ? <img src={j.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  : <span style={{ fontSize: '0.6rem', fontWeight: 700, color: t2.color }}>{initials}</span>}
                              </div>
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <p style={{ fontSize: '0.72rem', fontWeight: 600, color: '#1e293b', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {j.full_name.split(' ')[0]}
                                </p>
                                <p style={{ fontSize: '0.58rem', color: '#94a3b8', margin: 0 }}>
                                  {j.is_guest ? '🎟️' : j.position_1 ? `${posicaoIcon[j.position_1] ?? ''} ${j.position_1}` : '—'}
                                </p>
                              </div>
                              <button onClick={() => moverJogador(j, -1)}
                                style={{ width: '18px', height: '18px', borderRadius: '9999px', backgroundColor: '#fee2e2', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '0.6rem', fontWeight: 700, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                ✕
                              </button>
                            </div>
                          )
                        })}
                        {t2.jogadores.length === 0 && <p style={{ textAlign: 'center', color: '#cbd5e1', fontSize: '0.75rem', padding: '1rem' }}>Vazio</p>}
                      </div>
                    ) : <div />}
                  </div>
                </div>
              )
            })}
          </>
        )}

        {viewMode === 'vs' && times.length < 2 && (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
            <p>Crie pelo menos 2 times para ver o modo VS ⚔️</p>
          </div>
        )}

        {times.length === 0 && presentes.length > 0 && (
          <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
            <p style={{ fontSize: '3rem', margin: '0 0 0.5rem' }}>👕</p>
            <p style={{ color: '#64748b', fontWeight: 600 }}>Clique em "Novo Time" para começar</p>
            <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginTop: '0.25rem' }}>Ou crie 2 times e use o Sortear 🎲</p>
          </div>
        )}
      </div>

      {/* Erro de validação goleiro */}
      {erroGoleiro && (
        <div style={{ position: 'fixed', bottom: '9rem', left: 0, right: 0, padding: '0 1rem', zIndex: 41 }}>
          <div style={{ maxWidth: '640px', margin: '0 auto', backgroundColor: '#fee2e2', border: '1px solid #dc2626', borderRadius: '1rem', padding: '0.875rem 1rem', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>⚠️</span>
            <p style={{ color: '#dc2626', fontSize: '0.85rem', fontWeight: 600, margin: 0 }}>{erroGoleiro}</p>
            <button onClick={() => setErroGoleiro(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', flexShrink: 0, padding: '0 4px', fontWeight: 700 }}>✕</button>
          </div>
        </div>
      )}

      {/* Botão salvar fixo */}
      {times.length > 0 && (
        <div style={{ position: 'fixed', bottom: '5rem', left: 0, right: 0, padding: '0 1rem', zIndex: 40 }}>
          <div style={{ maxWidth: '640px', margin: '0 auto' }}>
            <button onClick={salvarTimes} disabled={saving}
              style={{
                width: '100%', background: saving ? '#86efac' : 'linear-gradient(135deg, #16a34a, #15803d)',
                border: 'none', borderRadius: '1rem', padding: '1rem',
                color: 'white', fontWeight: 700, fontSize: '1rem', cursor: saving ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                boxShadow: '0 4px 20px rgba(22,163,74,0.4)',
              }}>
              {saving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
              {saving ? 'Salvando...' : '💾 Salvar Times'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
