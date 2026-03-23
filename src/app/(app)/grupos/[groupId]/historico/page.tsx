'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, ChevronRight, Share2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Vencedor {
  posicao: string
  tipo: string
  nome: string
  foto: string | null
  initials: string
  votos: number
  total_votos: number
}

interface Temporada {
  id: string
  name: string
  group_name: string
  started_at: string | null
  ended_at: string | null
  total_rodadas: number
  total_jogadores: number
  artilheiro: { nome: string; gols: number } | null
  craque: { nome: string; vezes: number } | null
  top_nota: { nome: string; media: number } | null
  melhores: Vencedor[]
}

const POSICOES: Record<string, { label: string; emoji: string }> = {
  best_goalkeeper: { label: 'Goleiro',   emoji: '🧤' },
  best_defender:   { label: 'Zagueiro',  emoji: '🛡️' },
  best_left_back:  { label: 'Lateral E', emoji: '↙️' },
  best_right_back: { label: 'Lateral D', emoji: '↘️' },
  best_midfielder: { label: 'Volante',   emoji: '⚙️' },
  best_playmaker:  { label: 'Meia',      emoji: '🎯' },
  best_striker:    { label: 'Atacante',  emoji: '⚡' },
}

const CAMPO_POS: Record<string, { top: number; left: number }> = {
  best_striker:    { top: 12, left: 50 },
  best_playmaker:  { top: 30, left: 50 },
  best_left_back:  { top: 50, left: 18 },
  best_midfielder: { top: 50, left: 50 },
  best_right_back: { top: 50, left: 82 },
  best_defender:   { top: 70, left: 50 },
  best_goalkeeper: { top: 86, left: 50 },
}

const ORDEM = ['best_striker','best_playmaker','best_left_back','best_midfielder','best_right_back','best_defender','best_goalkeeper']

export default function HistoricoPage() {
  const { groupId } = useParams<{ groupId: string }>()
  const router = useRouter()
  const supabase = createClient()
  const [temporadas, setTemporadas] = useState<Temporada[]>([])
  const [loading, setLoading] = useState(true)
  const [expandida, setExpandida] = useState<string | null>(null)
  const [gerandoCard, setGerandoCard] = useState(false)

  useEffect(() => { fetchData() }, [groupId])

  async function fetchData() {
    const { data: group } = await supabase.from('groups').select('name').eq('id', groupId).single()
    const { data: seasons } = await supabase.from('seasons').select('id, name, started_at, ended_at')
      .eq('group_id', groupId).eq('status', 'finished').order('ended_at', { ascending: false })

    if (!seasons || seasons.length === 0) { setLoading(false); return }

    const lista: Temporada[] = []
    for (const s of seasons) {
      const { data: rodadas } = await supabase.from('rounds').select('id').eq('season_id', s.id).eq('status', 'finished')
      const roundIds = (rodadas ?? []).map((r: any) => r.id)

      const { count: totalJogadores } = await supabase.from('round_attendance')
        .select('user_id', { count: 'exact', head: true })
        .in('round_id', roundIds.length > 0 ? roundIds : ['none'])
        .eq('checked_in', true).eq('is_guest', false)

      // Artilheiro
      let artilheiro = null
      if (roundIds.length > 0) {
        const { data: gols } = await supabase.from('match_events')
          .select('user_id, profile:profiles!match_events_user_id_fkey(full_name)')
          .eq('event_type', 'goal').eq('is_guest', false).in('round_id', roundIds)
        if (gols && gols.length > 0) {
          const m: Record<string, { nome: string; gols: number }> = {}
          for (const g of gols) {
            if (!g.user_id) continue
            const nome = (g.profile as any)?.full_name ?? 'Jogador'
            if (!m[g.user_id]) m[g.user_id] = { nome, gols: 0 }
            m[g.user_id].gols++
          }
          artilheiro = Object.values(m).sort((a, b) => b.gols - a.gols)[0] ?? null
        }
      }

      // Craque (rodadas)
      let craque = null
      const { data: pCraque } = await supabase.from('polls').select('id')
        .eq('season_id', s.id).eq('type', 'craque').eq('is_closed', true)
      if (pCraque && pCraque.length > 0) {
        const { data: vcr } = await supabase.from('poll_votes')
          .select('option_id, poll_options(user_id, label, profile:profiles(full_name))')
          .in('poll_id', pCraque.map((p: any) => p.id))
        if (vcr && vcr.length > 0) {
          const cm: Record<string, { nome: string; vezes: number }> = {}
          for (const v of vcr) {
            const opt = v.poll_options as any
            if (!opt?.user_id) continue
            const nome = opt.profile?.full_name ?? opt.label ?? 'Jogador'
            if (!cm[opt.user_id]) cm[opt.user_id] = { nome, vezes: 0 }
            cm[opt.user_id].vezes++
          }
          craque = Object.values(cm).sort((a, b) => b.vezes - a.vezes)[0] ?? null
        }
      }

      // Top nota — só jogadores com ≥40% de presenças
      let top_nota = null
      const totalRodadas = roundIds.length
      const minimoRodadas = Math.ceil(totalRodadas * 0.4)
      const { data: presencasNota } = await supabase.from('round_attendance')
        .select('user_id')
        .in('round_id', roundIds.length > 0 ? roundIds : ['none'])
        .eq('checked_in', true).eq('is_guest', false)
      const presencasNM: Record<string, number> = {}
      for (const p of presencasNota ?? []) presencasNM[p.user_id] = (presencasNM[p.user_id] ?? 0) + 1

      const { data: notas } = await supabase.from('player_ratings')
        .select('rated_id, rating, profile:profiles!player_ratings_rated_id_fkey(full_name)')
        .eq('season_id', s.id)
      if (notas && notas.length > 0) {
        const nm: Record<string, { nome: string; soma: number; total: number }> = {}
        for (const n of notas) {
          const nome = (n.profile as any)?.full_name ?? 'Jogador'
          if (!nm[n.rated_id]) nm[n.rated_id] = { nome, soma: 0, total: 0 }
          nm[n.rated_id].soma += n.rating; nm[n.rated_id].total++
        }
        top_nota = Object.entries(nm)
          .filter(([uid]) => (presencasNM[uid] ?? 0) >= minimoRodadas)
          .map(([, n]) => ({ nome: n.nome, media: Math.round(n.soma / n.total) }))
          .sort((a, b) => b.media - a.media)[0] ?? null
      }

      // Melhores da temporada
      const melhores: Vencedor[] = []
      const { data: pollsMelh } = await supabase.from('polls')
        .select('id, type').eq('season_id', s.id).in('type', Object.keys(POSICOES))
      for (const poll of pollsMelh ?? []) {
        const { data: opcoes } = await supabase.from('poll_options')
          .select('id, user_id, label, profile:profiles(full_name, photo_url)').eq('poll_id', poll.id)
        const { data: votos } = await supabase.from('poll_votes').select('option_id').eq('poll_id', poll.id)
        if (!opcoes || opcoes.length === 0) continue
        const cont: Record<string, number> = {}
        for (const v of votos ?? []) cont[v.option_id] = (cont[v.option_id] ?? 0) + 1
        const totalVotos = (votos ?? []).length
        const venc = opcoes.reduce((a: any, b: any) => (cont[b.id] ?? 0) > (cont[a.id] ?? 0) ? b : a)
        const prof = venc.profile as any
        const nome = prof?.full_name ?? venc.label ?? 'Jogador'
        melhores.push({
          posicao: POSICOES[poll.type]?.label ?? poll.type,
          tipo: poll.type, nome,
          foto: prof?.photo_url ?? null,
          initials: nome.split(' ').map((n: string) => n[0]).slice(0, 2).join(''),
          votos: cont[venc.id] ?? 0, total_votos: totalVotos,
        })
      }
      melhores.sort((a, b) => ORDEM.indexOf(a.tipo) - ORDEM.indexOf(b.tipo))

      lista.push({ id: s.id, name: s.name, group_name: group?.name ?? '',
        started_at: s.started_at, ended_at: s.ended_at,
        total_rodadas: roundIds.length, total_jogadores: totalJogadores ?? 0,
        artilheiro, craque, top_nota, melhores })
    }
    setTemporadas(lista)
    setLoading(false)
  }

  function formatPeriodo(s: string | null, e: string | null) {
    const fmt = (d: string) => new Date(d).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
    if (s && e) return `${fmt(s)} → ${fmt(e)}`
    if (e) return `Encerrada em ${fmt(e)}`
    return '—'
  }

  async function gerarCard(t: Temporada) {
    setGerandoCard(true)
    try {
      const html2canvas = (await import('html2canvas')).default
      const el = document.getElementById(`card-${t.id}`)
      if (!el) return
      el.style.display = 'flex'
      await new Promise(r => setTimeout(r, 200))
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: null })
      el.style.display = 'none'
      const url = canvas.toDataURL('image/png')
      if (navigator.share) {
        const blob = await (await fetch(url)).blob()
        await navigator.share({ files: [new File([blob], 'melhores-temporada.png', { type: 'image/png' })] })
      } else {
        const a = document.createElement('a'); a.href = url; a.download = 'melhores-temporada.png'; a.click()
      }
    } finally { setGerandoCard(false) }
  }

  function CampoJogadores({ melhores, tamanho = 40 }: { melhores: Vencedor[], tamanho?: number }) {
    return (
      <>
        {melhores.map(v => {
          const pos = CAMPO_POS[v.tipo]
          if (!pos) return null
          return (
            <div key={v.tipo} style={{ position: 'absolute', transform: 'translate(-50%,-50%)', left: `${pos.left}%`, top: `${pos.top}%`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
              <div style={{ width: tamanho, height: tamanho, borderRadius: '9999px', border: '2px solid white', overflow: 'hidden', backgroundColor: '#15803d', boxShadow: '0 2px 8px rgba(0,0,0,0.4)', flexShrink: 0 }}>
                {v.foto
                  ? <img src={v.foto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} crossOrigin="anonymous"/>
                  : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: tamanho * 0.3 + 'px', fontWeight: 700, color: 'white' }}>{v.initials}</div>}
              </div>
              <div style={{ backgroundColor: 'rgba(0,0,0,0.72)', borderRadius: '9999px', padding: '1px 6px' }}>
                <p style={{ fontSize: tamanho * 0.28 + 'px', fontWeight: 700, color: 'white', margin: 0, whiteSpace: 'nowrap', maxWidth: tamanho * 1.8 + 'px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.nome.split(' ')[0]}</p>
              </div>
            </div>
          )
        })}
      </>
    )
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: '3rem' }}>🏁</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', paddingBottom: '5rem' }}>
      <div style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', paddingTop: '3rem', paddingBottom: '1.25rem', padding: '3rem 1rem 1.25rem' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.8)' }}>
            <ArrowLeft size={22} />
          </button>
          <div>
            <h1 style={{ color: 'white', fontWeight: 700, margin: 0, fontSize: '1.1rem' }}>🏁 Histórico de Temporadas</h1>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', margin: '2px 0 0' }}>{temporadas.length} temporada{temporadas.length !== 1 ? 's' : ''} encerrada{temporadas.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
        {temporadas.length === 0 && (
          <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
            <p style={{ fontSize: '3.5rem', margin: '0 0 0.75rem' }}>🏁</p>
            <p style={{ color: '#475569', fontWeight: 700 }}>Nenhuma temporada encerrada ainda</p>
          </div>
        )}

        {temporadas.map(t => (
          <div key={t.id} style={{ backgroundColor: 'white', borderRadius: '1rem', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <button onClick={() => setExpandida(expandida === t.id ? null : t.id)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.875rem', padding: '1rem', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
              <div style={{ width: '2.75rem', height: '2.75rem', borderRadius: '0.75rem', background: 'linear-gradient(135deg, #16a34a, #15803d)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '1.25rem' }}>🏆</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>{t.name}</p>
                <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: '2px 0 0' }}>{formatPeriodo(t.started_at, t.ended_at)}</p>
              </div>
              <ChevronRight size={18} color="#94a3b8" style={{ transform: expandida === t.id ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
            </button>

            <div style={{ display: 'flex', borderTop: '1px solid #f1f5f9', borderBottom: expandida === t.id ? '1px solid #f1f5f9' : 'none' }}>
              <div style={{ flex: 1, padding: '0.75rem', textAlign: 'center', borderRight: '1px solid #f1f5f9' }}>
                <p style={{ fontSize: '1.25rem', fontWeight: 800, color: '#16a34a', margin: 0 }}>{t.total_rodadas}</p>
                <p style={{ fontSize: '0.65rem', color: '#94a3b8', margin: '2px 0 0', fontWeight: 600 }}>RODADAS</p>
              </div>
              <div style={{ flex: 1, padding: '0.75rem', textAlign: 'center' }}>
                <p style={{ fontSize: '1.25rem', fontWeight: 800, color: '#16a34a', margin: 0 }}>{t.total_jogadores}</p>
                <p style={{ fontSize: '0.65rem', color: '#94a3b8', margin: '2px 0 0', fontWeight: 600 }}>PRESENÇAS</p>
              </div>
            </div>

            {expandida === t.id && (
              <div style={{ padding: '0.875rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                {t.craque && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem 0.875rem', backgroundColor: '#fffbeb', borderRadius: '0.75rem', border: '1px solid #fde68a' }}>
                    <span style={{ fontSize: '1.25rem' }}>🏆</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: '0.65rem', fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Craque da Temporada</p>
                      <p style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1e293b', margin: '1px 0 0' }}>{t.craque.nome}</p>
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#d97706', backgroundColor: '#fef3c7', padding: '2px 8px', borderRadius: '9999px' }}>{t.craque.vezes}x eleito</span>
                  </div>
                )}
                {t.artilheiro && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem 0.875rem', backgroundColor: '#f0fdf4', borderRadius: '0.75rem', border: '1px solid #bbf7d0' }}>
                    <span style={{ fontSize: '1.25rem' }}>⚽</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: '0.65rem', fontWeight: 700, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Artilheiro</p>
                      <p style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1e293b', margin: '1px 0 0' }}>{t.artilheiro.nome}</p>
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#16a34a', backgroundColor: '#dcfce7', padding: '2px 8px', borderRadius: '9999px' }}>{t.artilheiro.gols} gols</span>
                  </div>
                )}
                {t.top_nota && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem 0.875rem', backgroundColor: '#faf5ff', borderRadius: '0.75rem', border: '1px solid #e9d5ff' }}>
                    <span style={{ fontSize: '1.25rem' }}>⭐</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: '0.65rem', fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Melhor Nota</p>
                      <p style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1e293b', margin: '1px 0 0' }}>{t.top_nota.nome}</p>
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#7c3aed', backgroundColor: '#ede9fe', padding: '2px 8px', borderRadius: '9999px' }}>média {t.top_nota.media}</span>
                  </div>
                )}

                {/* Melhores da temporada */}
                {t.melhores.length > 0 && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                      <p style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>🌟 Melhores da Temporada</p>
                      <button onClick={() => gerarCard(t)} disabled={gerandoCard}
                        style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', fontWeight: 700, color: '#16a34a', backgroundColor: '#dcfce7', border: 'none', borderRadius: '0.5rem', padding: '5px 10px', cursor: 'pointer' }}>
                        <Share2 size={12} />{gerandoCard ? 'Gerando...' : 'Card Story'}
                      </button>
                    </div>

                    {/* Campo visual */}
                    <div style={{ position: 'relative', width: '100%', paddingBottom: '145%', backgroundColor: '#166534', borderRadius: '0.875rem', overflow: 'hidden', marginBottom: '0.875rem', boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}>
                      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} viewBox="0 0 100 145" preserveAspectRatio="none">
                        <rect x="4" y="3" width="92" height="139" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.6"/>
                        <line x1="4" y1="72" x2="96" y2="72" stroke="rgba(255,255,255,0.3)" strokeWidth="0.6"/>
                        <circle cx="50" cy="72" r="11" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.6"/>
                        <rect x="22" y="3" width="56" height="20" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5"/>
                        <rect x="36" y="3" width="28" height="9" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5"/>
                        <rect x="22" y="122" width="56" height="20" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5"/>
                        <rect x="36" y="133" width="28" height="9" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5"/>
                        <rect x="41" y="1" width="18" height="3" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.5"/>
                        <rect x="41" y="141" width="18" height="3" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.5"/>
                        {[8,18,28,38,48,58,68,78,88,98,108,118,128,138].map((y, i) => (
                          <rect key={i} x="4" y={y} width="92" height="5" fill={i%2===0 ? 'rgba(255,255,255,0.03)' : 'transparent'}/>
                        ))}
                      </svg>
                      <div style={{ position: 'absolute', inset: 0 }}>
                        {t.melhores.map(v => {
                          const pos = CAMPO_POS[v.tipo]
                          if (!pos) return null
                          return (
                            <div key={v.tipo} style={{ position: 'absolute', transform: 'translate(-50%,-50%)', left: `${pos.left}%`, top: `${pos.top}%`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                              <div style={{ width: '38px', height: '38px', borderRadius: '9999px', border: '2px solid white', overflow: 'hidden', backgroundColor: '#15803d', boxShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>
                                {v.foto
                                  ? <img src={v.foto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} crossOrigin="anonymous"/>
                                  : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700, color: 'white' }}>{v.initials}</div>}
                              </div>
                              <div style={{ backgroundColor: 'rgba(0,0,0,0.72)', borderRadius: '9999px', padding: '1px 5px' }}>
                                <p style={{ fontSize: '0.52rem', fontWeight: 700, color: 'white', margin: 0, whiteSpace: 'nowrap' }}>{v.nome.split(' ')[0]}</p>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Tabela lista */}
                    <div style={{ backgroundColor: '#f8fafc', borderRadius: '0.875rem', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                      {t.melhores.map((v, i) => {
                        const pct = v.total_votos > 0 ? Math.round((v.votos / v.total_votos) * 100) : 0
                        const posInfo = POSICOES[v.tipo]
                        return (
                          <div key={v.tipo} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', borderBottom: i < t.melhores.length - 1 ? '1px solid #e2e8f0' : 'none', backgroundColor: 'white' }}>
                            <span style={{ fontSize: '1rem', width: '1.5rem', textAlign: 'center', flexShrink: 0 }}>{posInfo?.emoji}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 1px' }}>{v.posicao}</p>
                              <p style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1e293b', margin: '0 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.nome}</p>
                              <div style={{ height: '4px', backgroundColor: '#f1f5f9', borderRadius: '9999px', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${pct}%`, backgroundColor: '#16a34a', borderRadius: '9999px' }} />
                              </div>
                            </div>
                            <span style={{ fontSize: '0.875rem', fontWeight: 800, color: '#16a34a', flexShrink: 0 }}>{pct}%</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                <button onClick={() => router.push(`/grupos/${groupId}/estatisticas?season=${t.id}`)}
                  style={{ width: '100%', padding: '0.75rem', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.75rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  Ver estatísticas completas →
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Cards ocultos para geração */}
      {temporadas.map(t => (
        <div key={`card-${t.id}`} id={`card-${t.id}`} style={{
          display: 'none', position: 'fixed', left: '-9999px', top: 0, zIndex: -1,
          width: '390px', height: '693px', flexDirection: 'column',
          background: 'linear-gradient(180deg, #052e16 0%, #14532d 45%, #166534 100%)',
          fontFamily: 'system-ui, sans-serif', overflow: 'hidden',
        }}>
          <div style={{ padding: '1.25rem 1.25rem 0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 2px' }}>{t.group_name}</p>
              <p style={{ color: 'white', fontSize: '1.1rem', fontWeight: 900, margin: 0 }}>🌟 Melhores da Temporada</p>
              <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.72rem', margin: '2px 0 0' }}>{t.name}</p>
            </div>
            <div style={{ backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: '0.75rem', padding: '6px 12px' }}>
              <p style={{ color: 'white', fontSize: '0.72rem', fontWeight: 800, margin: 0 }}>⚽ MeuBaba</p>
            </div>
          </div>

          {/* Campo no card */}
          <div style={{ position: 'relative', flex: 1, margin: '0.25rem 1rem 0.25rem' }}>
            <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} viewBox="0 0 100 140" preserveAspectRatio="none">
              <rect x="3" y="2" width="94" height="136" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.7"/>
              <line x1="3" y1="70" x2="97" y2="70" stroke="rgba(255,255,255,0.35)" strokeWidth="0.7"/>
              <circle cx="50" cy="70" r="11" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.7"/>
              <rect x="22" y="2" width="56" height="19" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="0.5"/>
              <rect x="36" y="2" width="28" height="9" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="0.5"/>
              <rect x="22" y="119" width="56" height="19" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="0.5"/>
              <rect x="36" y="129" width="28" height="9" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="0.5"/>
              {[8,18,28,38,48,58,68,78,88,98,108,118,128].map((y, i) => (
                <rect key={i} x="3" y={y} width="94" height="5" fill={i%2===0 ? 'rgba(255,255,255,0.04)' : 'transparent'}/>
              ))}
            </svg>
            <div style={{ position: 'absolute', inset: 0 }}>
              {t.melhores.map(v => {
                const pos = CAMPO_POS[v.tipo]
                if (!pos) return null
                return (
                  <div key={v.tipo} style={{ position: 'absolute', transform: 'translate(-50%,-50%)', left: `${pos.left}%`, top: `${pos.top}%`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                    <div style={{ width: '46px', height: '46px', borderRadius: '9999px', border: '2.5px solid white', overflow: 'hidden', backgroundColor: '#15803d', boxShadow: '0 3px 12px rgba(0,0,0,0.5)' }}>
                      {v.foto
                        ? <img src={v.foto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} crossOrigin="anonymous"/>
                        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700, color: 'white' }}>{v.initials}</div>}
                    </div>
                    <div style={{ backgroundColor: 'rgba(0,0,0,0.75)', borderRadius: '9999px', padding: '1px 7px' }}>
                      <p style={{ fontSize: '0.6rem', fontWeight: 700, color: 'white', margin: 0, whiteSpace: 'nowrap' }}>{v.nome.split(' ')[0]}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div style={{ padding: '0.5rem 1.25rem 1.25rem', textAlign: 'center' }}>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.58rem', margin: 0, letterSpacing: '0.05em' }}>meubaba.app</p>
          </div>
        </div>
      ))}
    </div>
  )
}
