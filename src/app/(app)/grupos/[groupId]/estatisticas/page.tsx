'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Jogador {
  user_id: string
  full_name: string
  photo_url: string | null
  gols: number
  assistencias: number
  vermelhos: number
  presencas: number
}

interface DestaqueInfo {
  nome: string
  foto: string | null
  initials: string
  rodada: string
}

interface Destaque {
  craque: DestaqueInfo | null
  bolaMurcha: DestaqueInfo | null
}

type AbaRanking = 'gols' | 'assistencias' | 'vermelhos' | 'presencas'

const ABA_CONFIG: Record<AbaRanking, { icon: string; label: string; color: string; bg: string }> = {
  gols:         { icon: '⚽', label: 'Artilharia',   color: '#16a34a', bg: '#dcfce7' },
  assistencias: { icon: '🅰️', label: 'Assistências', color: '#2563eb', bg: '#dbeafe' },
  vermelhos:    { icon: '🟥', label: 'Disciplina',   color: '#dc2626', bg: '#fee2e2' },
  presencas:    { icon: '📅', label: 'Presenças',    color: '#7c3aed', bg: '#ede9fe' },
}

export default function EstatisticasPage() {
  const { groupId } = useParams<{ groupId: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const seasonIdParam = searchParams.get('season')
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [seasonName, setSeasonName] = useState('')
  const [isHistorico, setIsHistorico] = useState(false)
  const [jogadores, setJogadores] = useState<Jogador[]>([])
  const [destaque, setDestaque] = useState<Destaque>({ craque: null, bolaMurcha: null })
  const [aba, setAba] = useState<AbaRanking>('gols')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) fetchData()
    })
  }, [groupId, seasonIdParam])

  async function fetchData() {
    let season: { id: string; name: string; status?: string } | null = null

    if (seasonIdParam) {
      // Temporada específica passada via query param (histórico)
      const { data } = await supabase.from('seasons').select('id, name, status').eq('id', seasonIdParam).single()
      season = data
      setIsHistorico(data?.status === 'finished')
    } else {
      // Temporada ativa
      const { data } = await supabase.from('seasons').select('id, name').eq('group_id', groupId).eq('status', 'active').single()
      season = data
      setIsHistorico(false)
    }

    if (!season) { setLoading(false); return }
    setSeasonName(season.name)

    const { data: rounds } = await supabase
      .from('rounds').select('id, title, status, scheduled_date')
      .eq('group_id', groupId).eq('season_id', season.id)

    const roundIds = (rounds ?? []).map((r: any) => r.id)
    if (roundIds.length === 0) { setLoading(false); return }

    const { data: membros } = await supabase
      .from('group_members')
      .select('user_id, profile:profiles(full_name, photo_url)')
      .eq('group_id', groupId).eq('is_active', true)

    // Busca todos eventos do grupo e filtra em memória (evita problema com .in() e RLS)
    const { data: eventosRaw } = await supabase
      .from('match_events')
      .select('user_id, event_type, round_id')
      .eq('is_guest', false)
    const eventos = (eventosRaw ?? []).filter((e: any) =>
      roundIds.includes(e.round_id) && ['goal', 'assist', 'red_card'].includes(e.event_type)
    )

    const { data: presencasRaw } = await supabase
      .from('round_attendance')
      .select('user_id, round_id')
      .eq('checked_in', true)
      .eq('is_guest', false)
    const presencas = (presencasRaw ?? []).filter((p: any) => roundIds.includes(p.round_id))

    const statsMap: Record<string, Jogador> = {}
    for (const m of membros ?? []) {
      const p = m.profile as any
      statsMap[m.user_id] = {
        user_id: m.user_id,
        full_name: p?.full_name ?? 'Jogador',
        photo_url: p?.photo_url ?? null,
        gols: 0, assistencias: 0, vermelhos: 0, presencas: 0,
      }
    }
    for (const ev of eventos ?? []) {
      if (!ev.user_id || !statsMap[ev.user_id]) continue
      if (ev.event_type === 'goal')     statsMap[ev.user_id].gols++
      if (ev.event_type === 'assist')   statsMap[ev.user_id].assistencias++
      if (ev.event_type === 'red_card') statsMap[ev.user_id].vermelhos++
    }
    for (const p of presencas ?? []) {
      if (!p.user_id || !statsMap[p.user_id]) continue
      statsMap[p.user_id].presencas++
    }
    setJogadores(Object.values(statsMap))

    // Última rodada finalizada
    const finalizadas = (rounds ?? [])
      .filter((r: any) => r.status === 'finished')
      .sort((a: any, b: any) => new Date(b.scheduled_date).getTime() - new Date(a.scheduled_date).getTime())

    if (finalizadas.length > 0) {
      const ultimaRodada = finalizadas[0]
      const { data: polls } = await supabase
        .from('polls').select('id, type')
        .eq('round_id', ultimaRodada.id)
        .in('type', ['craque', 'bola_murcha'])

      for (const poll of polls ?? []) {
        const { data: opcoes } = await supabase
          .from('poll_options')
          .select('id, user_id, label, profile:profiles(full_name, photo_url)')
          .eq('poll_id', poll.id)

        if (!opcoes || opcoes.length === 0) continue

        const { data: votos } = await supabase
          .from('poll_votes').select('option_id').eq('poll_id', poll.id)

        const contagem: Record<string, number> = {}
        for (const v of votos ?? []) {
          contagem[v.option_id] = (contagem[v.option_id] ?? 0) + 1
        }

        const vencedora = opcoes.reduce((a: any, b: any) =>
          (contagem[b.id] ?? 0) > (contagem[a.id] ?? 0) ? b : a
        )

        const prof = vencedora.profile as any
        const nome = prof?.full_name ?? vencedora.label ?? 'Jogador'
        const info: DestaqueInfo = {
          nome,
          initials: nome.split(' ').map((n: string) => n[0]).slice(0, 2).join(''),
          foto: prof?.photo_url ?? null,
          rodada: ultimaRodada.title ?? 'Última rodada',
        }

        if (poll.type === 'craque') setDestaque(d => ({ ...d, craque: info }))
        else setDestaque(d => ({ ...d, bolaMurcha: info }))
      }
    }

    setLoading(false)
  }

  const ranking = [...jogadores].sort((a, b) => b[aba] - a[aba])

  if (loading) return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: '3rem' }}>📊</div>
    </div>
  )

  const abaCfg = ABA_CONFIG[aba]

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', paddingBottom: '5rem' }}>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', paddingTop: '3rem', paddingBottom: '1.5rem', paddingLeft: '1rem', paddingRight: '1rem' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.8)' }}>
            <ArrowLeft size={22} />
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h1 style={{ color: 'white', fontWeight: 700, margin: 0, fontSize: '1.1rem' }}>📊 Estatísticas</h1>
              {isHistorico && <span style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: 'white', fontSize: '0.6rem', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Histórico</span>}
            </div>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', margin: '2px 0 0' }}>{seasonName || 'Sem temporada ativa'}</p>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

        {!seasonName && (
          <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
            <p style={{ fontSize: '3rem', margin: '0 0 0.5rem' }}>🏆</p>
            <p style={{ color: '#64748b', fontWeight: 600 }}>Nenhuma temporada ativa</p>
          </div>
        )}

        {seasonName && (
          <>
            {/* Destaques */}
            {(destaque.craque || destaque.bolaMurcha) && (
              <div>
                <p style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.5rem' }}>
                  ⭐ Destaque da última rodada
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  {[
                    { key: 'craque', icon: '🏆', label: 'Craque', data: destaque.craque, cor: '#f59e0b', bg: '#fef9c3', borda: '#f59e0b' },
                    { key: 'bolaMurcha', icon: '💩', label: 'Bola Murcha', data: destaque.bolaMurcha, cor: '#94a3b8', bg: '#f1f5f9', borda: '#94a3b8' },
                  ].map(({ key, icon, label, data, cor, bg, borda }) => (
                    <div key={key} style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: `1px solid ${borda}33`, textAlign: 'center' }}>
                      <p style={{ fontSize: '1.5rem', margin: '0 0 0.25rem' }}>{icon}</p>
                      <p style={{ fontSize: '0.62rem', fontWeight: 700, color: cor, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.5rem' }}>{label}</p>
                      {data ? (
                        <>
                          <div style={{ width: '3rem', height: '3rem', borderRadius: '9999px', backgroundColor: bg, border: `3px solid ${borda}`, margin: '0 auto 0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                            {data.foto
                              ? <img src={data.foto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              : <span style={{ fontSize: '0.75rem', fontWeight: 700, color: cor }}>{data.initials}</span>}
                          </div>
                          <p style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>{data.nome.split(' ')[0]}</p>
                          <p style={{ fontSize: '0.62rem', color: '#94a3b8', margin: '2px 0 0' }}>{data.rodada}</p>
                        </>
                      ) : (
                        <p style={{ fontSize: '0.75rem', color: '#cbd5e1', margin: 0 }}>Ainda não eleito</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tabs de ranking */}
            <div>
              <p style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.5rem' }}>
                🏅 Rankings da temporada
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.4rem', marginBottom: '0.875rem' }}>
                {(Object.keys(ABA_CONFIG) as AbaRanking[]).map(key => {
                  const cfg = ABA_CONFIG[key]
                  const ativo = aba === key
                  return (
                    <button key={key} onClick={() => setAba(key)}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', padding: '8px 4px', borderRadius: '0.75rem', border: `2px solid ${ativo ? cfg.color : '#e2e8f0'}`, backgroundColor: ativo ? cfg.bg : 'white', cursor: 'pointer' }}>
                      <span style={{ fontSize: '1rem' }}>{cfg.icon}</span>
                      <span style={{ fontSize: '0.58rem', fontWeight: 700, color: ativo ? cfg.color : '#94a3b8' }}>{cfg.label}</span>
                    </button>
                  )
                })}
              </div>

              {/* Lista */}
              <div style={{ backgroundColor: 'white', borderRadius: '1rem', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', alignItems: 'center', padding: '0.75rem 1rem', backgroundColor: abaCfg.bg, borderBottom: `2px solid ${abaCfg.color}22` }}>
                  <span style={{ fontSize: '1rem', marginRight: '0.5rem' }}>{abaCfg.icon}</span>
                  <p style={{ fontSize: '0.8rem', fontWeight: 700, color: abaCfg.color, margin: 0, flex: 1 }}>{abaCfg.label}</p>
                  <p style={{ fontSize: '0.7rem', fontWeight: 700, color: abaCfg.color, margin: 0 }}>
                    {aba === 'gols' ? 'Gols' : aba === 'assistencias' ? 'Assist.' : aba === 'vermelhos' ? 'Cartões' : 'Jogos'}
                  </p>
                </div>

                {ranking.filter(j => j[aba] > 0).length === 0 ? (
                  <div style={{ padding: '2.5rem', textAlign: 'center' }}>
                    <p style={{ fontSize: '2rem', margin: '0 0 0.25rem' }}>{abaCfg.icon}</p>
                    <p style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Nenhum registro ainda</p>
                  </div>
                ) : (
                  ranking.filter(j => j[aba] > 0).map((j, i) => {
                    const initials = j.full_name.split(' ').map(n => n[0]).slice(0, 2).join('')
                    const medalha = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null
                    const top3 = i < 3
                    return (
                      <div key={j.user_id} style={{
                        display: 'flex', alignItems: 'center', gap: '0.75rem',
                        padding: '0.75rem 1rem', borderBottom: '1px solid #f8fafc',
                        backgroundColor: top3 ? abaCfg.bg + '66' : 'white',
                      }}>
                        <div style={{ width: '1.75rem', textAlign: 'center', flexShrink: 0 }}>
                          {medalha
                            ? <span style={{ fontSize: '1.1rem' }}>{medalha}</span>
                            : <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8' }}>#{i + 1}</span>}
                        </div>
                        <div style={{ width: '2.25rem', height: '2.25rem', borderRadius: '9999px', backgroundColor: abaCfg.bg, border: `2px solid ${abaCfg.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                          {j.photo_url
                            ? <img src={j.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : <span style={{ fontSize: '0.7rem', fontWeight: 700, color: abaCfg.color }}>{initials}</span>}
                        </div>
                        <p style={{ flex: 1, fontSize: '0.875rem', fontWeight: top3 ? 700 : 500, color: '#1e293b', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {j.full_name}
                        </p>
                        <div style={{ backgroundColor: top3 ? abaCfg.color : '#f1f5f9', borderRadius: '9999px', padding: '4px 14px', flexShrink: 0 }}>
                          <span style={{ fontSize: '0.875rem', fontWeight: 800, color: top3 ? 'white' : '#64748b' }}>{j[aba]}</span>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
