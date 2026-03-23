'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Loader2, Save, Minus, ChevronDown, ChevronUp, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Team { id: string; name: string; color: string }

interface Jogador {
  key: string
  user_id: string | null
  attendance_id: string
  full_name: string
  photo_url: string | null
  position_1: string | null
  is_guest: boolean
  team_id: string
}

interface Evento {
  id?: string
  event_type: 'goal' | 'assist' | 'yellow_card' | 'red_card'
  user_id: string | null
  attendance_id: string
  team_id: string
  is_guest: boolean
  guest_name: string | null
  player_name: string
  player_initials: string
}

interface Match {
  id?: string
  home_team_id: string
  away_team_id: string
  home_score: number
  away_score: number
  match_order: number
  homeTeam?: Team
  awayTeam?: Team
  eventos: Evento[]
  expandido: boolean
}

const EVENT_LABELS: Record<string, { icon: string; label: string; color: string; bg: string }> = {
  goal:        { icon: '⚽', label: 'Gol',         color: '#16a34a', bg: '#dcfce7' },
  assist:      { icon: '🅰️', label: 'Assistência',  color: '#2563eb', bg: '#dbeafe' },
  yellow_card: { icon: '🟨', label: 'Amarelo',      color: '#ca8a04', bg: '#fef9c3' },
  red_card:    { icon: '🟥', label: 'Vermelho',     color: '#dc2626', bg: '#fee2e2' },
}

export default function JogosPage() {
  const { groupId, roundId } = useParams<{ groupId: string; roundId: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [times, setTimes] = useState<Team[]>([])
  const [jogadores, setJogadores] = useState<Jogador[]>([])
  const [jogos, setJogos] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [modalAberto, setModalAberto] = useState(false)
  const [jogoIdx, setJogoIdx] = useState(0)
  const [tipoEvento, setTipoEvento] = useState<'goal' | 'assist' | 'yellow_card' | 'red_card'>('goal')
  const [teamFiltro, setTeamFiltro] = useState<string>('')

  useEffect(() => { fetchData() }, [roundId])

  async function fetchData() {
    const { data: teamsData } = await supabase
      .from('teams').select('id, name, color').eq('round_id', roundId)
    setTimes(teamsData ?? [])

    const { data: atts } = await supabase
      .from('round_attendance')
      .select('id, user_id, guest_name, is_guest, profile:profiles(full_name, photo_url, position_1)')
      .eq('round_id', roundId)
      .eq('checked_in', true)

    const { data: teamPlayers } = await supabase
      .from('team_players')
      .select('user_id, attendance_id, team_id, is_guest')
      .in('team_id', (teamsData ?? []).map((t: any) => t.id))

    const jogs: Jogador[] = (atts ?? []).map((a: any) => {
      const tp = (teamPlayers ?? []).find((tp: any) =>
        a.is_guest ? tp.attendance_id === a.id : tp.user_id === a.user_id
      )
      return {
        key: a.is_guest ? `guest_${a.id}` : a.user_id,
        user_id: a.is_guest ? null : a.user_id,
        attendance_id: a.id,
        full_name: a.is_guest ? (a.guest_name ?? 'Convidado') : (a.profile?.full_name ?? 'Jogador'),
        photo_url: a.is_guest ? null : (a.profile?.photo_url ?? null),
        position_1: a.is_guest ? null : (a.profile?.position_1 ?? null),
        is_guest: a.is_guest,
        team_id: tp?.team_id ?? '',
      }
    })
    setJogadores(jogs)

    const { data: matchesData } = await supabase
      .from('matches')
      .select('*, home_team:teams!home_team_id(id,name,color), away_team:teams!away_team_id(id,name,color)')
      .eq('round_id', roundId)
      .order('match_order')

    const { data: eventsData } = await supabase
      .from('match_events')
      .select('*')
      .eq('round_id', roundId)

    if (matchesData && matchesData.length > 0) {
      setJogos(matchesData.map((m: any) => ({
        id: m.id,
        home_team_id: m.home_team_id,
        away_team_id: m.away_team_id,
        home_score: m.home_score ?? 0,
        away_score: m.away_score ?? 0,
        match_order: m.match_order,
        homeTeam: m.home_team,
        awayTeam: m.away_team,
        expandido: false,
        eventos: (eventsData ?? [])
          .filter((e: any) => e.match_id === m.id)
          .map((e: any) => {
            const j = jogs.find(j => j.is_guest ? j.attendance_id === e.attendance_id : j.user_id === e.user_id)
            return {
              id: e.id,
              event_type: e.event_type,
              user_id: e.user_id,
              attendance_id: e.attendance_id,
              team_id: e.team_id,
              is_guest: e.is_guest,
              guest_name: e.guest_name,
              player_name: j?.full_name ?? e.guest_name ?? 'Jogador',
              player_initials: (j?.full_name ?? 'J').split(' ').map((n: string) => n[0]).slice(0, 2).join(''),
            }
          }),
      })))
    }

    setLoading(false)
  }

  function adicionarJogo() {
    if (times.length < 2) return
    const homeIdx = jogos.length % times.length
    const awayIdx = (jogos.length + 1) % times.length
    setJogos([...jogos, {
      home_team_id: times[homeIdx].id,
      away_team_id: times[awayIdx].id,
      home_score: 0, away_score: 0,
      match_order: jogos.length + 1,
      homeTeam: times[homeIdx], awayTeam: times[awayIdx],
      eventos: [], expandido: true,
    }])
  }

  function atualizarTime(idx: number, lado: 'home' | 'away', teamId: string) {
    const novos = [...jogos]
    const team = times.find(t => t.id === teamId)
    if (lado === 'home') { novos[idx].home_team_id = teamId; novos[idx].homeTeam = team }
    else { novos[idx].away_team_id = teamId; novos[idx].awayTeam = team }
    setJogos(novos)
  }

  function alterarPlacar(idx: number, lado: 'home' | 'away', delta: number) {
    const novos = [...jogos]
    if (lado === 'home') novos[idx].home_score = Math.max(0, novos[idx].home_score + delta)
    else novos[idx].away_score = Math.max(0, novos[idx].away_score + delta)
    setJogos(novos)
  }

  function abrirModalEvento(idx: number, tipo: 'goal' | 'assist' | 'yellow_card' | 'red_card') {
    setJogoIdx(idx)
    setTipoEvento(tipo)
    setTeamFiltro(jogos[idx].home_team_id)
    setModalAberto(true)
  }

  function adicionarEvento(jogador: Jogador) {
    const novos = [...jogos]
    novos[jogoIdx].eventos.push({
      event_type: tipoEvento,
      user_id: jogador.user_id,
      attendance_id: jogador.attendance_id,
      team_id: jogador.team_id,
      is_guest: jogador.is_guest,
      guest_name: jogador.is_guest ? jogador.full_name : null,
      player_name: jogador.full_name,
      player_initials: jogador.full_name.split(' ').map(n => n[0]).slice(0, 2).join(''),
    })
    setJogos(novos)
    setModalAberto(false)
  }

  function removerEvento(jogoIdx: number, evIdx: number) {
    const novos = [...jogos]
    novos[jogoIdx].eventos.splice(evIdx, 1)
    setJogos(novos)
  }

  async function salvarTudo() {
    setSaving(true)
    await supabase.from('match_events').delete().eq('round_id', roundId)
    await supabase.from('matches').delete().eq('round_id', roundId)

    for (const jogo of jogos) {
      const { data: novoJogo, error: matchErr } = await supabase.from('matches').insert({
        round_id: roundId,
        home_team_id: jogo.home_team_id,
        away_team_id: jogo.away_team_id,
        home_score: jogo.home_score ?? 0,
        away_score: jogo.away_score ?? 0,
        match_order: jogo.match_order,
      }).select().single()

      if (matchErr || !novoJogo) {
        alert(`Erro ao salvar jogo: ${matchErr?.message}`)
        setSaving(false)
        return
      }

      if (jogo.eventos.length > 0) {
        const { error: evErr } = await supabase.from('match_events').insert(
          jogo.eventos.map(ev => ({
            match_id: novoJogo.id,
            round_id: roundId,
            user_id: ev.user_id,
            attendance_id: ev.attendance_id,
            team_id: ev.team_id,
            event_type: ev.event_type,
            is_guest: ev.is_guest,
            guest_name: ev.guest_name,
          }))
        )
        if (evErr) {
          alert(`Erro ao salvar eventos: ${evErr.message}`)
          setSaving(false)
          return
        }
      }
    }

    setSaving(false)
    router.push(`/grupos/${groupId}/rodadas/${roundId}`)
  }

  const jogadoresDoTime = jogadores.filter(j => j.team_id === teamFiltro)
  const jogoAtual = jogos[jogoIdx]

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-4xl animate-bounce">⚽</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', paddingBottom: '7rem' }}>

      <div style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', paddingTop: '3rem', paddingBottom: '1rem', paddingLeft: '1rem', paddingRight: '1rem' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.8)' }}>
            <ArrowLeft size={22} />
          </button>
          <h1 style={{ color: 'white', fontWeight: 700, margin: 0, fontSize: '1.1rem' }}>⚽ Jogos e Placares</h1>
          <div style={{ width: 22 }} />
        </div>
      </div>

      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

        {times.length < 2 && (
          <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '1rem', padding: '1rem', textAlign: 'center' }}>
            <p style={{ color: '#92400e', fontWeight: 600, fontSize: '0.875rem', margin: 0 }}>⚠️ Monte os times primeiro</p>
            <button onClick={() => router.push(`/grupos/${groupId}/rodadas/${roundId}/times`)}
              style={{ color: '#b45309', fontSize: '0.8rem', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', marginTop: '4px' }}>
              Ir para Times
            </button>
          </div>
        )}

        {jogos.map((jogo, idx) => {
          const ev = jogo.eventos
          return (
            <div key={idx} style={{ backgroundColor: 'white', borderRadius: '1rem', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9' }}>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.625rem 1rem', backgroundColor: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Jogo {idx + 1}</span>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <button onClick={() => { const n = [...jogos]; n[idx].expandido = !n[idx].expandido; setJogos(n) }}
                    style={{ fontSize: '0.72rem', color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}>
                    {jogo.expandido ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    {jogo.expandido ? 'Recolher' : 'Gols/Cartões'}
                  </button>
                  <button onClick={() => setJogos(jogos.filter((_, i) => i !== idx))}
                    style={{ fontSize: '0.72rem', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>
                    remover
                  </button>
                </div>
              </div>

              <div style={{ padding: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem' }}>
                  <select value={jogo.home_team_id} onChange={e => atualizarTime(idx, 'home', e.target.value)}
                    style={{ fontSize: '0.8rem', fontWeight: 700, border: `2px solid ${jogo.homeTeam?.color ?? '#e2e8f0'}`, color: jogo.homeTeam?.color ?? '#374151', borderRadius: '0.75rem', padding: '6px 8px', textAlign: 'center', outline: 'none', cursor: 'pointer', backgroundColor: 'white' }}>
                    {times.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 700 }}>vs</span>
                  <select value={jogo.away_team_id} onChange={e => atualizarTime(idx, 'away', e.target.value)}
                    style={{ fontSize: '0.8rem', fontWeight: 700, border: `2px solid ${jogo.awayTeam?.color ?? '#e2e8f0'}`, color: jogo.awayTeam?.color ?? '#374151', borderRadius: '0.75rem', padding: '6px 8px', textAlign: 'center', outline: 'none', cursor: 'pointer', backgroundColor: 'white' }}>
                    {times.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.5rem', marginBottom: jogo.expandido ? '1rem' : '0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <button onClick={() => alterarPlacar(idx, 'home', -1)}
                      style={{ width: '36px', height: '36px', borderRadius: '0.75rem', backgroundColor: '#f1f5f9', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Minus size={15} color="#64748b" />
                    </button>
                    <span style={{ fontSize: '2.5rem', fontWeight: 900, color: '#1e293b', width: '2.5rem', textAlign: 'center', lineHeight: 1 }}>{jogo.home_score}</span>
                    <button onClick={() => alterarPlacar(idx, 'home', 1)}
                      style={{ width: '36px', height: '36px', borderRadius: '0.75rem', backgroundColor: '#f1f5f9', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Plus size={15} color="#64748b" />
                    </button>
                  </div>
                  <span style={{ fontSize: '1.5rem', color: '#cbd5e1', fontWeight: 700 }}>×</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <button onClick={() => alterarPlacar(idx, 'away', -1)}
                      style={{ width: '36px', height: '36px', borderRadius: '0.75rem', backgroundColor: '#f1f5f9', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Minus size={15} color="#64748b" />
                    </button>
                    <span style={{ fontSize: '2.5rem', fontWeight: 900, color: '#1e293b', width: '2.5rem', textAlign: 'center', lineHeight: 1 }}>{jogo.away_score}</span>
                    <button onClick={() => alterarPlacar(idx, 'away', 1)}
                      style={{ width: '36px', height: '36px', borderRadius: '0.75rem', backgroundColor: '#f1f5f9', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Plus size={15} color="#64748b" />
                    </button>
                  </div>
                </div>

                {jogo.expandido && (
                  <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '0.875rem' }}>
                    <p style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.5rem' }}>Registrar evento</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.4rem', marginBottom: '0.875rem' }}>
                      {(['goal', 'assist', 'yellow_card', 'red_card'] as const).map(tipo => {
                        const cfg = EVENT_LABELS[tipo]
                        return (
                          <button key={tipo} onClick={() => abrirModalEvento(idx, tipo)}
                            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', padding: '8px 4px', borderRadius: '0.75rem', border: `1px solid ${cfg.color}33`, backgroundColor: cfg.bg, cursor: 'pointer' }}>
                            <span style={{ fontSize: '1.1rem' }}>{cfg.icon}</span>
                            <span style={{ fontSize: '0.6rem', fontWeight: 700, color: cfg.color }}>{cfg.label}</span>
                          </button>
                        )
                      })}
                    </div>

                    {ev.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {ev.map((e, evIdx) => {
                          const cfg = EVENT_LABELS[e.event_type]
                          const time = times.find(t => t.id === e.team_id)
                          return (
                            <div key={evIdx} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '0.625rem', backgroundColor: cfg.bg }}>
                              <span style={{ fontSize: '1rem' }}>{cfg.icon}</span>
                              <div style={{ width: '26px', height: '26px', borderRadius: '9999px', backgroundColor: time?.color ?? '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <span style={{ fontSize: '0.6rem', fontWeight: 700, color: 'white' }}>{e.player_initials}</span>
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ fontSize: '0.78rem', fontWeight: 600, color: '#1e293b', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.player_name}</p>
                                <p style={{ fontSize: '0.62rem', color: cfg.color, margin: 0, fontWeight: 600 }}>{cfg.label} · {time?.name}</p>
                              </div>
                              <button onClick={() => removerEvento(idx, evIdx)}
                                style={{ width: '20px', height: '20px', borderRadius: '9999px', backgroundColor: 'rgba(0,0,0,0.08)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <X size={10} color="#64748b" />
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                    {ev.length === 0 && (
                      <p style={{ fontSize: '0.75rem', color: '#cbd5e1', textAlign: 'center', margin: '0.5rem 0 0' }}>Nenhum evento registrado</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {times.length >= 2 && (
          <button onClick={adicionarJogo}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', border: '2px dashed #86efac', color: '#16a34a', fontWeight: 700, padding: '1rem', borderRadius: '1rem', backgroundColor: 'transparent', cursor: 'pointer', fontSize: '0.875rem' }}>
            <Plus size={18} /> Adicionar Jogo
          </button>
        )}

        {jogos.length === 0 && times.length >= 2 && (
          <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
            <p style={{ fontSize: '3rem', margin: '0 0 0.5rem' }}>⚽</p>
            <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Toque em "Adicionar Jogo" para começar</p>
          </div>
        )}
      </div>

      {jogos.length > 0 && (
        <div style={{ position: 'fixed', bottom: '5rem', left: 0, right: 0, padding: '0 1rem', zIndex: 40 }}>
          <div style={{ maxWidth: '640px', margin: '0 auto' }}>
            <button onClick={salvarTudo} disabled={saving}
              style={{ width: '100%', background: saving ? '#86efac' : 'linear-gradient(135deg, #16a34a, #15803d)', border: 'none', borderRadius: '1rem', padding: '1rem', color: 'white', fontWeight: 700, fontSize: '1rem', cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', boxShadow: '0 4px 20px rgba(22,163,74,0.4)' }}>
              {saving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
              {saving ? 'Salvando...' : '💾 Salvar Tudo'}
            </button>
          </div>
        </div>
      )}

      {/* MODAL */}
      {modalAberto && jogoAtual && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end' }}
          onClick={() => setModalAberto(false)}>
          <div style={{ width: '100%', maxWidth: '640px', margin: '0 auto', backgroundColor: 'white', borderRadius: '1.25rem 1.25rem 0 0', padding: '1.25rem', maxHeight: '75vh', display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div>
                <p style={{ fontWeight: 700, fontSize: '1rem', color: '#1e293b', margin: 0 }}>
                  {EVENT_LABELS[tipoEvento].icon} Quem fez o {EVENT_LABELS[tipoEvento].label}?
                </p>
                <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '2px 0 0' }}>
                  {jogoAtual.homeTeam?.name} × {jogoAtual.awayTeam?.name}
                </p>
              </div>
              <button onClick={() => setModalAberto(false)}
                style={{ width: '32px', height: '32px', borderRadius: '9999px', backgroundColor: '#f1f5f9', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={16} color="#64748b" />
              </button>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.875rem' }}>
              {[jogoAtual.home_team_id, jogoAtual.away_team_id].map(tid => {
                const t = times.find(t => t.id === tid)
                return (
                  <button key={tid} onClick={() => setTeamFiltro(tid)}
                    style={{ flex: 1, padding: '8px', borderRadius: '0.75rem', border: `2px solid ${teamFiltro === tid ? (t?.color ?? '#16a34a') : '#e2e8f0'}`, backgroundColor: teamFiltro === tid ? (t?.color ?? '#16a34a') + '18' : 'white', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem', color: teamFiltro === tid ? (t?.color ?? '#16a34a') : '#94a3b8' }}>
                    {t?.name}
                  </button>
                )
              })}
            </div>

            <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {jogadoresDoTime.length === 0 && (
                <p style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem', fontSize: '0.875rem' }}>
                  Nenhum jogador neste time
                </p>
              )}
              {jogadoresDoTime.map(j => {
                const initials = j.full_name.split(' ').map(n => n[0]).slice(0, 2).join('')
                const time = times.find(t => t.id === j.team_id)
                return (
                  <button key={j.key} onClick={() => adicionarEvento(j)}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', borderRadius: '0.875rem', border: '1px solid #f1f5f9', backgroundColor: 'white', cursor: 'pointer', textAlign: 'left', width: '100%' }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'white')}>
                    <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '9999px', backgroundColor: (time?.color ?? '#94a3b8') + '22', border: `2px solid ${time?.color ?? '#e2e8f0'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                      {j.photo_url
                        ? <img src={j.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <span style={{ fontSize: '0.75rem', fontWeight: 700, color: time?.color ?? '#64748b' }}>{initials}</span>}
                    </div>
                    <div>
                      <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1e293b', margin: 0 }}>{j.full_name}</p>
                      <p style={{ fontSize: '0.7rem', color: '#94a3b8', margin: 0 }}>
                        {j.is_guest ? '🎟️ convidado' : j.position_1 ?? '—'}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
