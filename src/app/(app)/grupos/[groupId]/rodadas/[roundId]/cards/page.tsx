'use client'
//comentario
import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Download, Share2, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Jogador {
  user_id: string
  nome: string
  foto: string | null
  initials: string
  valor: number // gols, assistências ou nota
}

interface DadosRodada {
  groupName: string
  roundTitle: string
  roundDate: string
  craque: { nome: string; foto: string | null; initials: string } | null
  bolaMurcha: { nome: string; foto: string | null; initials: string } | null
  paredao: { nome: string; foto: string | null; initials: string } | null
  artilheiros: Jogador[]
  assistentes: Jogador[]
  topNotas: Jogador[]
}

type TipoCard = 'craque' | 'bola_murcha' | 'paredao' | 'artilheiros' | 'assistencias' | 'notas'

const CARD_CONFIG: Record<TipoCard, { titulo: string; emoji: string; cor1: string; cor2: string; label: string }> = {
  craque:       { titulo: 'Craque da Rodada',    emoji: '🏆', cor1: '#f59e0b', cor2: '#d97706', label: 'votos' },
  bola_murcha:  { titulo: 'Bola Murcha',          emoji: '💩', cor1: '#64748b', cor2: '#475569', label: 'votos' },
  artilheiros:  { titulo: 'Top Artilheiros',      emoji: '⚽', cor1: '#16a34a', cor2: '#15803d', label: 'gols' },
  assistencias: { titulo: 'Top Assistências',     emoji: '🅰️', cor1: '#2563eb', cor2: '#1d4ed8', label: 'assist.' },
  notas:        { titulo: 'Top Notas da Rodada',  emoji: '⭐', cor1: '#7c3aed', cor2: '#6d28d9', label: 'pts' },
  paredao:      { titulo: 'Paredão da Rodada',     emoji: '🧤', cor1: '#0891b2', cor2: '#0e7490', label: 'votos' },
}

export default function CardsPage() {
  const { groupId, roundId } = useParams<{ groupId: string; roundId: string }>()
  const router = useRouter()
  const supabase = createClient()
  const cardRef = useRef<HTMLDivElement>(null)

  const [loading, setLoading] = useState(true)
  const [gerando, setGerando] = useState(false)
  const [dados, setDados] = useState<DadosRodada | null>(null)
  const [tipoAtivo, setTipoAtivo] = useState<TipoCard>('craque')
  const [myUserId, setMyUserId] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => { fetchData() }, [roundId])

  async function fetchData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setMyUserId(user.id)

    const { data: member } = await supabase
      .from('group_members').select('role').eq('group_id', groupId).eq('user_id', user.id).single()
    setIsAdmin(member?.role === 'admin')

    // Grupo e rodada
    const { data: group } = await supabase.from('groups').select('name').eq('id', groupId).single()
    const { data: round } = await supabase.from('rounds').select('title, scheduled_date').eq('id', roundId).single()

    // Polls (craque e bola murcha)
    const { data: polls } = await supabase
      .from('polls')
      .select('id, type, poll_options(id, user_id, label, profile:profiles(full_name, photo_url)), poll_votes(option_id)')
      .eq('round_id', roundId)
      .in('type', ['craque', 'bola_murcha'])

    function getVencedor(poll: any) {
      if (!poll) return null
      const contagem: Record<string, number> = {}
      for (const v of poll.poll_votes ?? []) contagem[v.option_id] = (contagem[v.option_id] ?? 0) + 1
      const opcoes = [...(poll.poll_options ?? [])].sort((a: any, b: any) => (contagem[b.id] ?? 0) - (contagem[a.id] ?? 0))
      const venc = opcoes[0]
      if (!venc) return null
      const prof = venc.profile as any
      const nome = prof?.full_name ?? venc.label ?? 'Jogador'
      return { nome, foto: prof?.photo_url ?? null, initials: nome.split(' ').map((n: string) => n[0]).slice(0, 2).join('') }
    }

    const pollCraque = polls?.find((p: any) => p.type === 'craque')
    const pollBolaMurcha = polls?.find((p: any) => p.type === 'bola_murcha')
    const pollParedao = paredaoData?.[0] ?? null

    // Eventos (gols e assistências)
    const { data: eventos } = await supabase
      .from('match_events').select('user_id, event_type, profile:profiles!match_events_user_id_fkey(full_name, photo_url)')
      .eq('round_id', roundId).eq('is_guest', false)

    const golsMap: Record<string, Jogador> = {}
    const assistMap: Record<string, Jogador> = {}
    for (const ev of eventos ?? []) {
      if (!ev.user_id) continue
      const prof = ev.profile as any
      const nome = prof?.full_name ?? 'Jogador'
      const initials = nome.split(' ').map((n: string) => n[0]).slice(0, 2).join('')
      if (ev.event_type === 'goal') {
        if (!golsMap[ev.user_id]) golsMap[ev.user_id] = { user_id: ev.user_id, nome, foto: prof?.photo_url ?? null, initials, valor: 0 }
        golsMap[ev.user_id].valor++
      }
      if (ev.event_type === 'assist') {
        if (!assistMap[ev.user_id]) assistMap[ev.user_id] = { user_id: ev.user_id, nome, foto: prof?.photo_url ?? null, initials, valor: 0 }
        assistMap[ev.user_id].valor++
      }
    }

    // Notas
    const { data: ratings } = await supabase
      .from('player_ratings').select('rated_id, rating, profile:profiles!player_ratings_rated_id_fkey(full_name, photo_url)')
      .eq('round_id', roundId)

    const notasMap: Record<string, { soma: number; total: number; nome: string; foto: string | null }> = {}
    for (const r of ratings ?? []) {
      const prof = r.profile as any
      if (!notasMap[r.rated_id]) notasMap[r.rated_id] = { soma: 0, total: 0, nome: prof?.full_name ?? 'Jogador', foto: prof?.photo_url ?? null }
      notasMap[r.rated_id].soma += r.rating
      notasMap[r.rated_id].total++
    }

    const topNotas: Jogador[] = Object.entries(notasMap).map(([uid, d]) => ({
      user_id: uid, nome: d.nome, foto: d.foto,
      initials: d.nome.split(' ').map((n: string) => n[0]).slice(0, 2).join(''),
      valor: Math.round(d.soma / d.total),
    })).sort((a, b) => b.valor - a.valor).slice(0, 3)

    setDados({
      groupName: group?.name ?? 'MeuBaba',
      roundTitle: round?.title ?? 'Rodada',
      roundDate: round?.scheduled_date ? new Date(round.scheduled_date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' }) : '',
      craque: getVencedor(pollCraque),
      bolaMurcha: getVencedor(pollBolaMurcha),
      paredao: getVencedor(pollParedao),
      artilheiros: Object.values(golsMap).sort((a, b) => b.valor - a.valor).slice(0, 3),
      assistentes: Object.values(assistMap).sort((a, b) => b.valor - a.valor).slice(0, 3),
      topNotas,
    })

    setLoading(false)
  }

  async function gerarCard() {
    if (!cardRef.current) return
    setGerando(true)
    try {
      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(cardRef.current, {
        scale: 3,
        useCORS: true,
        backgroundColor: null,
        logging: false,
      })
      const url = canvas.toDataURL('image/png')

      // Tenta compartilhar via Web Share API (mobile)
      if (navigator.share) {
        const blob = await (await fetch(url)).blob()
        const file = new File([blob], 'meubaba-card.png', { type: 'image/png' })
        await navigator.share({ files: [file], title: 'MeuBaba' })
      } else {
        // Fallback: download
        const a = document.createElement('a')
        a.href = url
        a.download = `meubaba-${tipoAtivo}.png`
        a.click()
      }
    } catch (e) {
      console.error(e)
    }
    setGerando(false)
  }

  // Todos podem gerar todos os cards
  const cardsDisponiveis: TipoCard[] = ['craque', 'bola_murcha', ...(dados?.paredao ? ['paredao' as TipoCard] : []), 'artilheiros', 'assistencias', 'notas']

  if (loading || !dados) return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: '3rem' }}>🃏</div>
    </div>
  )

  const cfg = CARD_CONFIG[tipoAtivo]

  // Conteúdo do card baseado no tipo
  function renderCardContent() {
    if (tipoAtivo === 'craque' || tipoAtivo === 'bola_murcha' || tipoAtivo === 'paredao') {
      const pessoa = tipoAtivo === 'craque' ? dados!.craque : tipoAtivo === 'paredao' ? dados!.paredao : dados!.bolaMurcha
      if (!pessoa) return (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '1rem' }}>Sem dados ainda</p>
        </div>
      )
      return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.5rem' }}>
          {/* Avatar grande */}
          <div style={{
            width: '140px', height: '140px', borderRadius: '9999px',
            backgroundColor: 'rgba(255,255,255,0.2)',
            border: '5px solid rgba(255,255,255,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            ...(pessoa.foto ? {
              backgroundImage: `url(${pessoa.foto})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            } : {}),
          }}>
            {!pessoa.foto && <span style={{ fontSize: '3.5rem', fontWeight: 900, color: 'white' }}>{pessoa.initials}</span>}
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.9rem', fontWeight: 600, margin: '0 0 0.25rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              {cfg.titulo}
            </p>
            <p style={{ color: 'white', fontSize: '2rem', fontWeight: 900, margin: 0, textShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
              {pessoa.nome.split(' ')[0]}
            </p>
            {pessoa.nome.includes(' ') && (
              <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '1.2rem', fontWeight: 700, margin: '0.25rem 0 0' }}>
                {pessoa.nome.split(' ').slice(1).join(' ')}
              </p>
            )}
          </div>
          <div style={{ backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: '9999px', padding: '0.5rem 1.5rem' }}>
            <span style={{ color: 'white', fontWeight: 800, fontSize: '1rem' }}>
              {tipoAtivo === 'craque' ? '⭐ Melhor em campo' : tipoAtivo === 'paredao' ? '🧤 Melhor goleiro' : '😴 Abaixo do esperado'}
            </span>
          </div>
        </div>
      )
    }

    // Top 3
    const lista = tipoAtivo === 'artilheiros' ? dados!.artilheiros : tipoAtivo === 'assistencias' ? dados!.assistentes : dados!.topNotas
    const medalhas = ['🥇', '🥈', '🥉']
    const tamanhos = [56, 48, 44] // avatar maior para o 1º lugar

    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '0.75rem', padding: '0 0.25rem' }}>
        {lista.length === 0 ? (
          <p style={{ color: 'rgba(255,255,255,0.6)', textAlign: 'center', fontSize: '1rem' }}>Sem dados ainda</p>
        ) : lista.map((j, i) => (
          <div key={j.user_id} style={{
            display: 'flex', alignItems: 'center', gap: '0.875rem',
            backgroundColor: i === 0 ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.10)',
            borderRadius: '1rem', padding: '0.875rem',
            border: i === 0 ? '2px solid rgba(255,255,255,0.35)' : '1px solid rgba(255,255,255,0.12)',
          }}>
            {/* Medalha */}
            <span style={{ fontSize: i === 0 ? '2rem' : '1.6rem', flexShrink: 0, width: '2.25rem', textAlign: 'center' }}>{medalhas[i]}</span>

            {/* Avatar + Nome empilhados */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.375rem', minWidth: 0 }}>
              <div style={{
                width: `${tamanhos[i]}px`, height: `${tamanhos[i]}px`,
                borderRadius: '9999px',
                backgroundColor: 'rgba(255,255,255,0.2)',
                border: `${i === 0 ? 3 : 2}px solid rgba(255,255,255,0.5)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden', flexShrink: 0,
                ...(j.foto ? {
                  backgroundImage: `url(${j.foto})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                } : {}),
              }}>
                {!j.foto && <span style={{ fontSize: i === 0 ? '1.25rem' : '1rem', fontWeight: 700, color: 'white' }}>{j.initials}</span>}
              </div>
              <p style={{
                color: 'white',
                fontSize: i === 0 ? '0.9rem' : '0.8rem',
                fontWeight: i === 0 ? 800 : 700,
                margin: 0,
                textAlign: 'center',
                lineHeight: 1.25,
                wordBreak: 'break-word',
              }}>
                {j.nome}
              </p>
            </div>

            {/* Valor */}
            <div style={{
              backgroundColor: 'rgba(255,255,255,0.3)',
              borderRadius: '0.75rem', padding: '8px 14px',
              flexShrink: 0, textAlign: 'center',
              minWidth: '52px',
            }}>
              <p style={{ color: 'white', fontSize: i === 0 ? '1.4rem' : '1.2rem', fontWeight: 900, margin: 0 }}>{j.valor}</p>
              <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.58rem', fontWeight: 700, margin: 0, textTransform: 'uppercase' }}>{cfg.label}</p>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', paddingBottom: '6rem' }}>

      {/* Header */}
      <div style={{ padding: '3rem 1rem 1rem', maxWidth: '400px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
          <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.7)' }}>
            <ArrowLeft size={22} />
          </button>
          <div>
            <h1 style={{ color: 'white', fontWeight: 700, margin: 0, fontSize: '1.1rem' }}>🃏 Gerar Cards</h1>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', margin: '2px 0 0' }}>Compartilhe no WhatsApp e Stories</p>
          </div>
        </div>

        {/* Seletor de tipo */}
        <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
          {cardsDisponiveis.map(tipo => {
            const c = CARD_CONFIG[tipo]
            return (
              <button key={tipo} onClick={() => setTipoAtivo(tipo)}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', borderRadius: '9999px', border: `2px solid ${tipoAtivo === tipo ? 'white' : 'rgba(255,255,255,0.2)'}`, backgroundColor: tipoAtivo === tipo ? 'white' : 'transparent', cursor: 'pointer', transition: 'all 0.15s' }}>
                <span style={{ fontSize: '0.85rem' }}>{c.emoji}</span>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: tipoAtivo === tipo ? '#1e293b' : 'rgba(255,255,255,0.7)' }}>{c.titulo}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Preview do card 9:16 */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: '0 1rem' }}>
        <div
          ref={cardRef}
          style={{
            width: '320px',
            height: '568px', // 9:16
            borderRadius: '1.5rem',
            background: `linear-gradient(160deg, ${cfg.cor1}, ${cfg.cor2}, #1e293b)`,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
            position: 'relative',
          }}>

          {/* Padrão de fundo decorativo */}
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.08) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(255,255,255,0.05) 0%, transparent 50%)' }} />

          {/* Header do card */}
          <div style={{ padding: '1.25rem 1.25rem 0.75rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
            <div>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.65rem', fontWeight: 600, margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                {dados.groupName}
              </p>
              <p style={{ color: 'white', fontSize: '0.9rem', fontWeight: 800, margin: 0 }}>{dados.roundTitle}</p>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.65rem', margin: '2px 0 0' }}>{dados.roundDate}</p>
            </div>
            {/* Logo MeuBaba */}
            <div style={{ backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: '0.75rem', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '5px', border: '1px solid rgba(255,255,255,0.2)' }}>
              <span style={{ fontSize: '1rem' }}>⚽</span>
              <span style={{ color: 'white', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.02em' }}>MeuBaba</span>
            </div>
          </div>

          {/* Divisor */}
          <div style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.15)', margin: '0 1.25rem', position: 'relative', zIndex: 1 }} />

          {/* Emoji grande + título do card */}
          <div style={{ padding: '1rem 1.25rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', position: 'relative', zIndex: 1 }}>
            <span style={{ fontSize: '2.25rem' }}>{cfg.emoji}</span>
            <p style={{ color: 'white', fontSize: '1.1rem', fontWeight: 900, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em', textShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
              {cfg.titulo}
            </p>
          </div>

          {/* Conteúdo dinâmico */}
          <div style={{ flex: 1, padding: '0 1.25rem 1rem', display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1 }}>
            {renderCardContent()}
          </div>

          {/* Footer */}
          <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.6rem', fontWeight: 600, margin: 0, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
              ⚽ meubaba.app · gerencie seu baba
            </p>
          </div>
        </div>
      </div>

      {/* Botão gerar/compartilhar */}
      <div style={{ position: 'fixed', bottom: '5rem', left: 0, right: 0, padding: '0 1rem', zIndex: 40 }}>
        <div style={{ maxWidth: '400px', margin: '0 auto', display: 'flex', gap: '0.75rem' }}>
          <button onClick={gerarCard} disabled={gerando}
            style={{ flex: 1, background: gerando ? '#334155' : 'linear-gradient(135deg, #16a34a, #15803d)', border: 'none', borderRadius: '1rem', padding: '1rem', color: 'white', fontWeight: 700, fontSize: '1rem', cursor: gerando ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', boxShadow: '0 4px 20px rgba(22,163,74,0.4)' }}>
            {gerando ? <Loader2 size={20} className="animate-spin" /> : <Share2 size={20} />}
            {gerando ? 'Gerando...' : 'Compartilhar'}
          </button>
          <button onClick={async () => {
            if (!cardRef.current) return
            setGerando(true)
            const html2canvas = (await import('html2canvas')).default
            const canvas = await html2canvas(cardRef.current, { scale: 3, useCORS: true, backgroundColor: null })
            const a = document.createElement('a')
            a.href = canvas.toDataURL('image/png')
            a.download = `meubaba-${tipoAtivo}.png`
            a.click()
            setGerando(false)
          }} disabled={gerando}
            style={{ width: '52px', height: '52px', borderRadius: '1rem', backgroundColor: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Download size={20} color="white" />
          </button>
        </div>
      </div>
    </div>
  )
}
