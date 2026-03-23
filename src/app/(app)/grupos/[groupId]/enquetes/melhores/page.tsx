'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Share2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Vencedor {
  posicao: string
  tipo: string
  nome: string
  foto: string | null
  initials: string
  votos: number
  total_votos: number
  encerrada: boolean
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

export default function MelhoresTemporadaPage() {
  const { groupId } = useParams<{ groupId: string }>()
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [vencedores, setVencedores] = useState<Vencedor[]>([])
  const [seasonName, setSeasonName] = useState('')
  const [groupName, setGroupName] = useState('')
  const [gerandoCard, setGerandoCard] = useState(false)

  useEffect(() => { fetchData() }, [groupId])

  async function fetchData() {
    const { data: group } = await supabase.from('groups').select('name').eq('id', groupId).single()
    setGroupName(group?.name ?? '')

    const { data: season } = await supabase.from('seasons').select('id, name')
      .eq('group_id', groupId).eq('status', 'active').single()
    if (!season) { setLoading(false); return }
    setSeasonName(season.name)

    const { data: polls } = await supabase.from('polls')
      .select('id, type, is_closed, closes_at')
      .eq('season_id', season.id)
      .in('type', Object.keys(POSICOES))

    const lista: Vencedor[] = []
    for (const poll of polls ?? []) {
      const encerrada = poll.is_closed || new Date(poll.closes_at) < new Date()

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

      lista.push({
        posicao: POSICOES[poll.type]?.label ?? poll.type,
        tipo: poll.type, nome,
        foto: prof?.photo_url ?? null,
        initials: nome.split(' ').map((n: string) => n[0]).slice(0, 2).join(''),
        votos: cont[venc.id] ?? 0, total_votos: totalVotos,
        encerrada,
      })
    }

    lista.sort((a, b) => ORDEM.indexOf(a.tipo) - ORDEM.indexOf(b.tipo))
    setVencedores(lista)
    setLoading(false)
  }

  async function gerarCard() {
    setGerandoCard(true)
    try {
      const html2canvas = (await import('html2canvas')).default
      const el = document.getElementById('card-melhores')
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

  const encerradas = vencedores.filter(v => v.encerrada)
  const pendentes = vencedores.filter(v => !v.encerrada)

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: '3rem' }}>🌟</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', paddingBottom: '5rem' }}>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #0f172a, #1e293b)', paddingTop: '3rem', paddingBottom: '1.25rem', padding: '3rem 1rem 1.25rem' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.7)' }}>
              <ArrowLeft size={22} />
            </button>
            <div>
              <h1 style={{ color: 'white', fontWeight: 700, margin: 0, fontSize: '1.1rem' }}>🌟 Melhores da Temporada</h1>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', margin: '2px 0 0' }}>{seasonName}</p>
            </div>
          </div>
          {encerradas.length > 0 && (
            <button onClick={gerarCard} disabled={gerandoCard}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#16a34a', border: 'none', borderRadius: '0.75rem', padding: '8px 14px', color: 'white', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>
              <Share2 size={15} /> {gerandoCard ? 'Gerando...' : 'Card Story'}
            </button>
          )}
        </div>
      </div>

      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

        {vencedores.length === 0 && (
          <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
            <p style={{ fontSize: '3rem', margin: '0 0 0.75rem' }}>🌟</p>
            <p style={{ color: '#475569', fontWeight: 700 }}>Nenhuma enquete de Melhores criada ainda</p>
            <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginTop: '0.25rem' }}>Vá em Enquetes → Nova → Melhores da Temporada</p>
          </div>
        )}

        {/* Aviso enquetes ainda abertas */}
        {pendentes.length > 0 && (
          <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '1rem', padding: '0.875rem 1rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>⏳</span>
            <div>
              <p style={{ fontSize: '0.8rem', fontWeight: 700, color: '#92400e', margin: '0 0 2px' }}>Votação ainda aberta</p>
              <p style={{ fontSize: '0.75rem', color: '#a16207', margin: 0 }}>
                {pendentes.map(p => POSICOES[p.tipo]?.label).join(', ')} — resultado parcial abaixo
              </p>
            </div>
          </div>
        )}

        {/* Campo visual — só mostra se tem ao menos 1 encerrada */}
        {encerradas.length > 0 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <p style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>⚽ Escalação dos Melhores</p>
              <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{encerradas.length}/{vencedores.length} posições</span>
            </div>

            <div style={{ position: 'relative', width: '100%', paddingBottom: '145%', backgroundColor: '#166534', borderRadius: '1rem', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
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
                {encerradas.map(v => {
                  const pos = CAMPO_POS[v.tipo]
                  if (!pos) return null
                  return (
                    <div key={v.tipo} style={{ position: 'absolute', transform: 'translate(-50%,-50%)', left: `${pos.left}%`, top: `${pos.top}%`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '9999px', border: '2px solid white', overflow: 'hidden', backgroundColor: '#15803d', boxShadow: '0 2px 10px rgba(0,0,0,0.4)' }}>
                        {v.foto
                          ? <img src={v.foto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} crossOrigin="anonymous"/>
                          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700, color: 'white' }}>{v.initials}</div>}
                      </div>
                      <div style={{ backgroundColor: 'rgba(0,0,0,0.72)', borderRadius: '9999px', padding: '1px 6px' }}>
                        <p style={{ fontSize: '0.52rem', fontWeight: 700, color: 'white', margin: 0, whiteSpace: 'nowrap' }}>{v.nome.split(' ')[0]}</p>
                      </div>
                    </div>
                  )
                })}
                {/* Posições ainda pendentes — placeholder */}
                {pendentes.map(v => {
                  const pos = CAMPO_POS[v.tipo]
                  if (!pos) return null
                  return (
                    <div key={v.tipo} style={{ position: 'absolute', transform: 'translate(-50%,-50%)', left: `${pos.left}%`, top: `${pos.top}%`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '9999px', border: '2px dashed rgba(255,255,255,0.4)', backgroundColor: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: '0.7rem' }}>⏳</span>
                      </div>
                      <div style={{ backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: '9999px', padding: '1px 6px' }}>
                        <p style={{ fontSize: '0.52rem', color: 'rgba(255,255,255,0.6)', margin: 0, whiteSpace: 'nowrap' }}>{POSICOES[v.tipo]?.label}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Tabela de resultados */}
        {vencedores.length > 0 && (
          <div>
            <p style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1e293b', margin: '0 0 0.75rem' }}>📋 Resultados por posição</p>
            <div style={{ backgroundColor: 'white', borderRadius: '1rem', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
              {vencedores.map((v, i) => {
                const pct = v.total_votos > 0 ? Math.round((v.votos / v.total_votos) * 100) : 0
                const posInfo = POSICOES[v.tipo]
                return (
                  <div key={v.tipo} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.875rem 1rem', borderBottom: i < vencedores.length - 1 ? '1px solid #f1f5f9' : 'none', backgroundColor: v.encerrada ? 'white' : '#fffbeb' }}>
                    <span style={{ fontSize: '1rem', width: '1.5rem', textAlign: 'center', flexShrink: 0 }}>{posInfo?.emoji}</span>
                    <div style={{ width: '2.25rem', height: '2.25rem', borderRadius: '9999px', border: `2px solid ${v.encerrada ? '#16a34a33' : '#fde68a'}`, overflow: 'hidden', backgroundColor: v.encerrada ? '#dcfce7' : '#fef9c3', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {v.foto
                        ? <img src={v.foto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                        : <span style={{ fontSize: '0.6rem', fontWeight: 700, color: v.encerrada ? '#16a34a' : '#92400e' }}>{v.encerrada ? v.initials : '⏳'}</span>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2px' }}>
                        <p style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>{v.posicao}</p>
                        {!v.encerrada && <span style={{ fontSize: '0.55rem', backgroundColor: '#fef9c3', color: '#92400e', fontWeight: 700, padding: '1px 5px', borderRadius: '9999px' }}>votação aberta</span>}
                      </div>
                      <p style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1e293b', margin: '0 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.nome}</p>
                      <div style={{ height: '4px', backgroundColor: '#f1f5f9', borderRadius: '9999px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, backgroundColor: v.encerrada ? '#16a34a' : '#f59e0b', borderRadius: '9999px' }} />
                      </div>
                    </div>
                    <span style={{ fontSize: '0.875rem', fontWeight: 800, color: v.encerrada ? '#16a34a' : '#d97706', flexShrink: 0 }}>{pct}%</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Card oculto para gerar */}
      <div id="card-melhores" style={{
        display: 'none', position: 'fixed', left: '-9999px', top: 0, zIndex: -1,
        width: '390px', height: '693px', flexDirection: 'column',
        background: 'linear-gradient(180deg, #052e16 0%, #14532d 45%, #166534 100%)',
        fontFamily: 'system-ui, sans-serif', overflow: 'hidden',
      }}>
        <div style={{ padding: '1.25rem 1.25rem 0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 2px' }}>{groupName}</p>
            <p style={{ color: 'white', fontSize: '1.1rem', fontWeight: 900, margin: 0 }}>🌟 Melhores da Temporada</p>
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.72rem', margin: '2px 0 0' }}>{seasonName}</p>
          </div>
          <div style={{ backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: '0.75rem', padding: '6px 12px' }}>
            <p style={{ color: 'white', fontSize: '0.72rem', fontWeight: 800, margin: 0 }}>⚽ MeuBaba</p>
          </div>
        </div>
        <div style={{ position: 'relative', flex: 1, margin: '0.25rem 1rem' }}>
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
            {encerradas.map(v => {
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
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.58rem', margin: 0 }}>meubaba.app</p>
        </div>
      </div>
    </div>
  )
}
