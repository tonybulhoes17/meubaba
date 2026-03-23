'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Save, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Jogador {
  user_id: string
  full_name: string
  photo_url: string | null
  initials: string
}

export default function NotasPage() {
  const { groupId, roundId } = useParams<{ groupId: string; roundId: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [myUserId, setMyUserId] = useState('')
  const [seasonId, setSeasonId] = useState('')
  const [rodadaTitle, setRodadaTitle] = useState('')
  const [jogadores, setJogadores] = useState<Jogador[]>([])
  const [notas, setNotas] = useState<Record<string, number>>({}) // rated_id -> nota
  const [jaVotados, setJaVotados] = useState<Set<string>>(new Set()) // rated_ids já votados
  const [notasSalvas, setNotasSalvas] = useState(false)

  useEffect(() => { fetchData() }, [roundId])

  async function fetchData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setMyUserId(user.id)

    // Busca rodada
    const { data: round } = await supabase
      .from('rounds').select('title, scheduled_date, season_id, status, finished_at')
      .eq('id', roundId).single()
    if (!round) return
    setSeasonId(round.season_id)
    setRodadaTitle(round.title ?? 'Rodada')

    // Verifica se votação ainda está aberta (4h após encerramento)
    if (round.finished_at) {
      const fechaEm = new Date(round.finished_at).getTime() + 4 * 60 * 60 * 1000
      if (Date.now() > fechaEm) {
        // Votação encerrada — só leitura
      }
    }

    // Jogadores com check-in (exceto o próprio usuário)
    const { data: atts } = await supabase
      .from('round_attendance')
      .select('user_id, profile:profiles(full_name, photo_url)')
      .eq('round_id', roundId)
      .eq('checked_in', true)
      .eq('is_guest', false)
      .neq('user_id', user.id)

    const jogs: Jogador[] = (atts ?? [])
      .filter((a: any) => a.user_id)
      .map((a: any) => {
        const nome = a.profile?.full_name ?? 'Jogador'
        return {
          user_id: a.user_id,
          full_name: nome,
          photo_url: a.profile?.photo_url ?? null,
          initials: nome.split(' ').map((n: string) => n[0]).slice(0, 2).join(''),
        }
      })
    setJogadores(jogs)

    // Notas já dadas por este usuário nesta rodada
    const { data: minhasNotas } = await supabase
      .from('player_ratings')
      .select('rated_id, rating')
      .eq('round_id', roundId)
      .eq('rater_id', user.id)

    const jaVotadosSet = new Set<string>()
    const notasMap: Record<string, number> = {}
    for (const n of minhasNotas ?? []) {
      jaVotadosSet.add(n.rated_id)
      notasMap[n.rated_id] = n.rating
    }
    setJaVotados(jaVotadosSet)
    setNotas(notasMap)
    if (jaVotadosSet.size > 0) setNotasSalvas(true)

    setLoading(false)
  }

  // Inicializa nota padrão 70 ao primeiro toque
  function handleNotaChange(userId: string, valor: number) {
    if (jaVotados.has(userId)) return
    setNotas(prev => ({ ...prev, [userId]: valor }))
  }

  async function salvarNotas() {
    setSaving(true)
    const novos = jogadores.filter(j => !jaVotados.has(j.user_id) && notas[j.user_id] !== undefined)

    if (novos.length === 0) {
      setSaving(false)
      return
    }

    const { error } = await supabase.from('player_ratings').insert(
      novos.map(j => ({
        round_id: roundId,
        season_id: seasonId,
        rated_id: j.user_id,
        rater_id: myUserId,
        rating: notas[j.user_id],
      }))
    )

    if (error) {
      alert(`Erro ao salvar: ${error.message}`)
      setSaving(false)
      return
    }

    // Marca todos como já votados
    setJaVotados(prev => {
      const s = new Set(prev)
      novos.forEach(j => s.add(j.user_id))
      return s
    })
    setNotasSalvas(true)
    setSaving(false)
    router.back()
  }

  function getNotaColor(nota: number) {
    if (nota >= 80) return { bg: '#dcfce7', color: '#15803d', border: '#16a34a' }
    if (nota >= 60) return { bg: '#dbeafe', color: '#1d4ed8', border: '#2563eb' }
    if (nota >= 40) return { bg: '#fef9c3', color: '#a16207', border: '#ca8a04' }
    return { bg: '#fee2e2', color: '#b91c1c', border: '#dc2626' }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: '3rem' }}>⭐</div>
    </div>
  )

  const pendentes = jogadores.filter(j => !jaVotados.has(j.user_id))
  const votados = jogadores.filter(j => jaVotados.has(j.user_id))

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', paddingBottom: '7rem' }}>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', paddingTop: '3rem', paddingBottom: '1.5rem', paddingLeft: '1rem', paddingRight: '1rem' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.8)' }}>
            <ArrowLeft size={22} />
          </button>
          <div>
            <h1 style={{ color: 'white', fontWeight: 700, margin: 0, fontSize: '1.1rem' }}>⭐ Notas dos Jogadores</h1>
            <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.75rem', margin: '2px 0 0' }}>{rodadaTitle} · 0 a 100</p>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

        {/* Aviso */}
        <div style={{ backgroundColor: '#ede9fe', border: '1px solid #7c3aed33', borderRadius: '1rem', padding: '0.875rem 1rem' }}>
          <p style={{ fontSize: '0.8rem', color: '#5b21b6', fontWeight: 600, margin: 0 }}>
            🔒 Anônimo · Cada jogador só pode avaliar uma vez · Você não avalia a si mesmo
          </p>
          <p style={{ fontSize: '0.75rem', color: '#6d28d9', margin: '4px 0 0' }}>
            A nota exibida é sempre a <strong>média</strong> de todas as avaliações recebidas
          </p>
        </div>

        {/* Jogadores pendentes */}
        {pendentes.length > 0 && (
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9' }}>
            <div style={{ padding: '0.75rem 1rem', backgroundColor: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
              <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', margin: 0 }}>
                📝 Avaliar — {pendentes.length} jogador{pendentes.length !== 1 ? 'es' : ''}
              </p>
            </div>
            {pendentes.map(j => {
              const nota = notas[j.user_id] ?? 70
              const { bg, color, border } = getNotaColor(nota)
              return (
                <div key={j.user_id} style={{ padding: '0.875rem 1rem', borderBottom: '1px solid #f8fafc' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    {/* Avatar */}
                    <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '9999px', backgroundColor: '#ede9fe', border: '2px solid #7c3aed44', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                      {j.photo_url
                        ? <img src={j.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#7c3aed' }}>{j.initials}</span>}
                    </div>
                    <p style={{ flex: 1, fontSize: '0.875rem', fontWeight: 600, color: '#1e293b', margin: 0 }}>{j.full_name}</p>
                    {/* Badge nota */}
                    <div style={{ backgroundColor: bg, border: `2px solid ${border}`, borderRadius: '0.75rem', padding: '4px 14px', minWidth: '52px', textAlign: 'center' }}>
                      <span style={{ fontSize: '1.1rem', fontWeight: 900, color }}>{notas[j.user_id] ?? '–'}</span>
                    </div>
                  </div>
                  {/* Slider */}
                  <div style={{ position: 'relative' }}>
                    <input
                      type="range" min={0} max={100} step={1}
                      value={notas[j.user_id] ?? 70}
                      onChange={e => handleNotaChange(j.user_id, Number(e.target.value))}
                      style={{ width: '100%', accentColor: border, height: '6px', cursor: 'pointer' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
                      <span style={{ fontSize: '0.6rem', color: '#94a3b8' }}>0</span>
                      <span style={{ fontSize: '0.6rem', color: '#94a3b8' }}>25</span>
                      <span style={{ fontSize: '0.6rem', color: '#94a3b8' }}>50</span>
                      <span style={{ fontSize: '0.6rem', color: '#94a3b8' }}>75</span>
                      <span style={{ fontSize: '0.6rem', color: '#94a3b8' }}>100</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Jogadores já avaliados */}
        {votados.length > 0 && (
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9' }}>
            <div style={{ padding: '0.75rem 1rem', backgroundColor: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
              <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', margin: 0 }}>
                ✅ Já avaliados — {votados.length} jogador{votados.length !== 1 ? 'es' : ''}
              </p>
            </div>
            {votados.map(j => {
              const nota = notas[j.user_id]
              const { bg, color, border } = nota !== undefined ? getNotaColor(nota) : { bg: '#f1f5f9', color: '#64748b', border: '#94a3b8' }
              return (
                <div key={j.user_id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', borderBottom: '1px solid #f8fafc', opacity: 0.7 }}>
                  <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '9999px', backgroundColor: '#f1f5f9', border: '2px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                    {j.photo_url
                      ? <img src={j.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8' }}>{j.initials}</span>}
                  </div>
                  <p style={{ flex: 1, fontSize: '0.875rem', fontWeight: 500, color: '#64748b', margin: 0 }}>{j.full_name}</p>
                  <div style={{ backgroundColor: bg, border: `2px solid ${border}`, borderRadius: '0.75rem', padding: '4px 14px', minWidth: '52px', textAlign: 'center' }}>
                    <span style={{ fontSize: '1rem', fontWeight: 900, color }}>{nota ?? '–'}</span>
                  </div>
                  <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>✓ avaliado</span>
                </div>
              )
            })}
          </div>
        )}

        {jogadores.length === 0 && (
          <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
            <p style={{ fontSize: '3rem', margin: '0 0 0.5rem' }}>👥</p>
            <p style={{ color: '#64748b', fontWeight: 600 }}>Nenhum jogador para avaliar</p>
          </div>
        )}
      </div>

      {/* Botão salvar */}
      {pendentes.length > 0 && (
        <div style={{ position: 'fixed', bottom: '5rem', left: 0, right: 0, padding: '0 1rem', zIndex: 40 }}>
          <div style={{ maxWidth: '640px', margin: '0 auto' }}>
            <button onClick={salvarNotas} disabled={saving}
              style={{ width: '100%', background: saving ? '#c4b5fd' : 'linear-gradient(135deg, #7c3aed, #6d28d9)', border: 'none', borderRadius: '1rem', padding: '1rem', color: 'white', fontWeight: 700, fontSize: '1rem', cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', boxShadow: '0 4px 20px rgba(124,58,237,0.4)' }}>
              {saving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
              {saving ? 'Salvando...' : `⭐ Salvar ${pendentes.length} nota${pendentes.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      )}

      {notasSalvas && pendentes.length === 0 && (
        <div style={{ position: 'fixed', bottom: '5rem', left: 0, right: 0, padding: '0 1rem', zIndex: 40 }}>
          <div style={{ maxWidth: '640px', margin: '0 auto' }}>
            <div style={{ backgroundColor: '#dcfce7', border: '1px solid #16a34a', borderRadius: '1rem', padding: '1rem', textAlign: 'center' }}>
              <p style={{ color: '#15803d', fontWeight: 700, fontSize: '0.9rem', margin: 0 }}>✅ Todas as notas já foram salvas!</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
