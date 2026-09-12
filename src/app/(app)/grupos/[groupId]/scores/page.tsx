'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Edit2, Check, X, Loader2, Star } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const CRITERIOS = [
  { key: 'velocidade',     label: 'Velocidade',     short: 'Vel', icon: '⚡' },
  { key: 'forca_fisica',   label: 'Força Física',   short: 'Fís', icon: '💪' },
  { key: 'passe',          label: 'Passe',           short: 'Pas', icon: '🎯' },
  { key: 'chute',          label: 'Chute',           short: 'Chu', icon: '👟' },
  { key: 'marcacao',       label: 'Marcação',        short: 'Mar', icon: '🛡️' },
  { key: 'drible',         label: 'Drible',          short: 'Dri', icon: '🪄' },
  { key: 'posicionamento', label: 'Posicionamento',  short: 'Pos', icon: '🧠' },
  { key: 'resistencia',    label: 'Resistência',     short: 'Res', icon: '🫀' },
  { key: 'jogo_aereo',     label: 'Jogo Aéreo',     short: 'Aér', icon: '✈️' },
] as const

type Criterio = typeof CRITERIOS[number]['key']

interface PlayerScore {
  user_id: string
  full_name: string
  photo_url: string | null
  initials: string
  position_1: string | null
  never_edited: boolean
  velocidade: number
  forca_fisica: number
  passe: number
  chute: number
  marcacao: number
  drible: number
  posicionamento: number
  resistencia: number
  jogo_aereo: number
  media: number
}

function scoreColor(v: number) {
  if (v >= 4.5) return { bg: '#dcfce7', text: '#15803d', border: '#86efac' }
  if (v >= 3.5) return { bg: '#dbeafe', text: '#1d4ed8', border: '#93c5fd' }
  if (v >= 2.5) return { bg: '#fef9c3', text: '#854d0e', border: '#fde047' }
  return { bg: '#fee2e2', text: '#b91c1c', border: '#fca5a5' }
}

function calcMedia(s: PlayerScore) {
  const vals = CRITERIOS.map(c => s[c.key as Criterio])
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
}

export default function ScoresPage() {
  const { groupId } = useParams<{ groupId: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [players, setPlayers] = useState<PlayerScore[]>([])
  const [editPlayer, setEditPlayer] = useState<PlayerScore | null>(null)
  const [editScores, setEditScores] = useState<Record<Criterio, number>>({} as any)
  const [editTexts, setEditTexts] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => { fetchData() }, [groupId])

  async function fetchData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    // Verifica se é admin
    const { data: member } = await supabase
      .from('group_members').select('role')
      .eq('group_id', groupId).eq('user_id', user.id).single()
    if (member?.role !== 'admin') { router.push(`/grupos/${groupId}`); return }

    // Busca membros ativos
    const { data: members } = await supabase
      .from('group_members')
      .select('user_id')
      .eq('group_id', groupId)
      .eq('is_active', true)

    if (!members || members.length === 0) { setLoading(false); return }

    const userIds = members.map((m: any) => m.user_id)

    // Busca perfis
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, photo_url, position_1')
      .in('id', userIds)

    // Busca scores
    const { data: scores } = await supabase
      .from('player_scores')
      .select('*')
      .eq('group_id', groupId)
      .in('user_id', userIds)

    const profileMap: Record<string, any> = {}
    ;(profiles ?? []).forEach((p: any) => { profileMap[p.id] = p })

    const scoreMap: Record<string, any> = {}
    ;(scores ?? []).forEach((s: any) => { scoreMap[s.user_id] = s })

    const lista: PlayerScore[] = (members ?? []).map((m: any) => {
      const prof = profileMap[m.user_id] ?? {}
      const sc = scoreMap[m.user_id] ?? {}
      const nome = prof.full_name ?? 'Jogador'
      const player: PlayerScore = {
        user_id: m.user_id,
        full_name: nome,
        photo_url: prof.photo_url ?? null,
        initials: nome.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase(),
        position_1: prof.position_1 ?? null,
        never_edited: sc.never_edited ?? true,
        velocidade:     sc.velocidade     ?? 3,
        forca_fisica:   sc.forca_fisica   ?? 3,
        passe:          sc.passe          ?? 3,
        chute:          sc.chute          ?? 3,
        marcacao:       sc.marcacao       ?? 3,
        drible:         sc.drible         ?? 3,
        posicionamento: sc.posicionamento ?? 3,
        resistencia:    sc.resistencia    ?? 3,
        jogo_aereo:     sc.jogo_aereo     ?? 3,
        media: 0,
      }
      player.media = calcMedia(player)
      return player
    })

    lista.sort((a, b) => a.full_name.localeCompare(b.full_name, 'pt-BR'))
    setPlayers(lista)
    setLoading(false)
  }

  function abrirEdicao(p: PlayerScore) {
    setEditPlayer(p)
    const scores = {
      velocidade:     p.velocidade,
      forca_fisica:   p.forca_fisica,
      passe:          p.passe,
      chute:          p.chute,
      marcacao:       p.marcacao,
      drible:         p.drible,
      posicionamento: p.posicionamento,
      resistencia:    p.resistencia,
      jogo_aereo:     p.jogo_aereo,
    }
    setEditScores(scores)
    // Inicializa textos com os valores atuais
    const textos: Record<string, string> = {}
    Object.entries(scores).forEach(([k, v]) => { textos[k] = String(v).replace('.', ',') })
    setEditTexts(textos)
  }

  async function salvarEdicao() {
    if (!editPlayer) return
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    const payload = {
      group_id: groupId,
      user_id: editPlayer.user_id,
      ...editScores,
      never_edited: false,
      updated_by: user?.id,
      updated_at: new Date().toISOString(),
    }

    await supabase.from('player_scores')
      .upsert(payload, { onConflict: 'group_id,user_id' })

    // Atualiza local
    setPlayers(prev => prev.map(p => {
      if (p.user_id !== editPlayer.user_id) return p
      const updated = { ...p, ...editScores, never_edited: false }
      updated.media = calcMedia(updated)
      return updated
    }))

    setSaving(false)
    setEditPlayer(null)
  }

  const filtered = players.filter(p =>
    p.full_name.toLowerCase().includes(search.toLowerCase())
  )

  const neverEdited = players.filter(p => p.never_edited).length

  if (loading) return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: '2.5rem' }}>⚽</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', paddingBottom: '6rem' }}>
      {/* Header */}
      <div style={{ backgroundColor: 'white', borderBottom: '1px solid #f1f5f9', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', position: 'sticky', top: 0, zIndex: 10 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
          <ArrowLeft size={20} color="#64748b" />
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>⭐ Scores dos Jogadores</h1>
          <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: 0 }}>{players.length} jogadores · {neverEdited > 0 ? `${neverEdited} sem avaliação` : 'Todos avaliados ✅'}</p>
        </div>
      </div>

      <div style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

        {/* Aviso nunca editados */}
        {neverEdited > 0 && (
          <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '1rem', padding: '0.875rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.25rem' }}>⚠️</span>
            <p style={{ fontSize: '0.78rem', color: '#92400e', margin: 0 }}>
              <strong>{neverEdited} jogador{neverEdited > 1 ? 'es' : ''}</strong> ainda {neverEdited > 1 ? 'não foram avaliados' : 'não foi avaliado'} — {neverEdited > 1 ? 'estão' : 'está'} com nota 3 em tudo. Toque em ✏️ para editar.
            </p>
          </div>
        )}

        {/* Busca */}
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Buscar jogador..."
          style={{ width: '100%', padding: '0.625rem 0.875rem', border: '1.5px solid #e2e8f0', borderRadius: '0.875rem', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box' as const, backgroundColor: 'white' }}
        />

        {/* Tabela */}
        <div style={{ backgroundColor: 'white', borderRadius: '1rem', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9' }}>
          <div style={{ overflowX: 'auto' as const, overflowY: 'auto' as const, maxHeight: '65vh' }}>
            <table style={{ borderCollapse: 'collapse' as const, minWidth: '100%' }}>
              <thead style={{ position: 'sticky' as const, top: 0, zIndex: 3 }}>
                <tr style={{ backgroundColor: '#f8fafc' }}>
                  <th style={{ padding: '0.625rem 0.875rem', textAlign: 'left' as const, fontSize: '0.7rem', fontWeight: 700, color: '#475569', borderBottom: '1px solid #e2e8f0', position: 'sticky' as const, left: 0, backgroundColor: '#f8fafc', zIndex: 4, minWidth: '130px', whiteSpace: 'nowrap' as const }}>
                    Jogador
                  </th>
                  <th style={{ padding: '0.5rem 0.5rem', textAlign: 'center' as const, fontSize: '0.65rem', fontWeight: 700, color: '#16a34a', borderBottom: '1px solid #e2e8f0', minWidth: '48px', whiteSpace: 'nowrap' as const }}>
                    Média
                  </th>
                  {CRITERIOS.map(c => (
                    <th key={c.key} style={{ padding: '0.5rem 0.25rem', textAlign: 'center' as const, fontSize: '0.62rem', fontWeight: 700, color: '#64748b', borderBottom: '1px solid #e2e8f0', minWidth: '38px' }}>
                      <span title={c.label}>{c.short}</span>
                    </th>
                  ))}
                  <th style={{ padding: '0.5rem 0.5rem', textAlign: 'center' as const, fontSize: '0.65rem', fontWeight: 700, color: '#64748b', borderBottom: '1px solid #e2e8f0', minWidth: '44px' }}>
                    Editar
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, idx) => {
                  const mc = scoreColor(p.media)
                  return (
                    <tr key={p.user_id} style={{ backgroundColor: idx % 2 === 0 ? 'white' : '#fafafa' }}>
                      {/* Nome */}
                      <td style={{ padding: '0.5rem 0.875rem', position: 'sticky' as const, left: 0, backgroundColor: idx % 2 === 0 ? 'white' : '#fafafa', zIndex: 1, borderBottom: '1px solid #f1f5f9' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{ position: 'relative' as const }}>
                            <div style={{ width: '1.75rem', height: '1.75rem', borderRadius: '9999px', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                              {p.photo_url
                                ? <img src={p.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                : <span style={{ fontSize: '0.55rem', fontWeight: 700, color: '#64748b' }}>{p.initials}</span>}
                            </div>
                            {p.never_edited && (
                              <div style={{ position: 'absolute' as const, top: -3, right: -3, width: '10px', height: '10px', backgroundColor: '#f59e0b', borderRadius: '9999px', border: '1.5px solid white' }} title="Nunca avaliado" />
                            )}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#1e293b', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, maxWidth: '80px' }}>
                              {p.full_name.split(' ')[0]}
                            </p>
                            {p.position_1 && (
                              <p style={{ fontSize: '0.6rem', color: '#94a3b8', margin: 0, textTransform: 'capitalize' as const }}>{p.position_1}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Média */}
                      <td style={{ padding: '0.375rem 0.5rem', textAlign: 'center' as const, borderBottom: '1px solid #f1f5f9' }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 800, padding: '3px 7px', borderRadius: '9999px', backgroundColor: mc.bg, color: mc.text, border: `1px solid ${mc.border}` }}>
                          {p.media.toFixed(1)}
                        </span>
                      </td>

                      {/* Critérios */}
                      {CRITERIOS.map(c => {
                        const val = p[c.key as Criterio]
                        const cc = scoreColor(val)
                        return (
                          <td key={c.key} style={{ padding: '0.375rem 0.25rem', textAlign: 'center' as const, borderBottom: '1px solid #f1f5f9' }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 5px', borderRadius: '0.375rem', backgroundColor: cc.bg, color: cc.text }}>
                              {val.toFixed(1)}
                            </span>
                          </td>
                        )
                      })}

                      {/* Editar */}
                      <td style={{ padding: '0.375rem 0.5rem', textAlign: 'center' as const, borderBottom: '1px solid #f1f5f9' }}>
                        <button onClick={() => abrirEdicao(p)}
                          style={{ width: '28px', height: '28px', borderRadius: '0.5rem', backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Edit2 size={13} color="#64748b" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Legenda cores */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' as const, padding: '0.5rem 0' }}>
          {[['≥4.5','Elite','#dcfce7','#15803d'],['≥3.5','Bom','#dbeafe','#1d4ed8'],['≥2.5','Médio','#fef9c3','#854d0e'],['<2.5','Baixo','#fee2e2','#b91c1c']].map(([range, label, bg, text]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <div style={{ width: '20px', height: '14px', borderRadius: '4px', backgroundColor: bg, border: `1px solid ${text}` }} />
              <span style={{ fontSize: '0.65rem', color: '#64748b' }}>{range} {label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Modal edição */}
      {editPlayer && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '1.25rem 1.25rem 0 0', padding: '1.5rem 1.5rem 5rem 1.5rem', width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto' as const }}>
            {/* Header modal */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '9999px', backgroundColor: '#f1f5f9', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {editPlayer.photo_url
                  ? <img src={editPlayer.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b' }}>{editPlayer.initials}</span>}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>{editPlayer.full_name}</p>
                <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: 0 }}>
                  {editPlayer.position_1 ? `Posição: ${editPlayer.position_1}` : 'Sem posição cadastrada'} · Média atual: {editPlayer.media.toFixed(1)}
                </p>
              </div>
              <button onClick={() => setEditPlayer(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} color="#94a3b8" />
              </button>
            </div>

            {/* Critérios */}
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '1rem', marginBottom: '1.5rem' }}>
              {CRITERIOS.map(c => {
                const val = editScores[c.key as Criterio] ?? 3
                return (
                  <div key={c.key}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#475569' }}>{c.icon} {c.label}</span>
                      <span style={{ fontSize: '0.9rem', fontWeight: 800, color: scoreColor(val).text }}>{val}</span>
                    </div>
                    {/* Botões rápidos 1-5 */}
                    <div style={{ display: 'flex', gap: '0.375rem', marginBottom: '0.375rem' }}>
                      {[1, 2, 3, 4, 5].map(n => (
                        <button key={n}
                          onClick={() => {
                            setEditScores(prev => ({ ...prev, [c.key]: n }))
                            setEditTexts(prev => ({ ...prev, [c.key]: String(n) }))
                          }}
                          style={{
                            flex: 1, padding: '0.5rem 0', borderRadius: '0.625rem',
                            border: `2px solid ${Math.floor(val) === n && Number.isInteger(val) ? scoreColor(n).text : '#e2e8f0'}`,
                            backgroundColor: Math.floor(val) === n && Number.isInteger(val) ? scoreColor(n).bg : 'white',
                            color: Math.floor(val) === n && Number.isInteger(val) ? scoreColor(n).text : '#94a3b8',
                            fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', transition: 'all 0.1s'
                          }}>
                          {n}
                        </button>
                      ))}
                    </div>
                    {/* Campo para valor decimal */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={editTexts[c.key] ?? String(val)}
                        onChange={e => {
                          const txt = e.target.value.replace(/[^0-9,\.]/g, '')
                          setEditTexts(prev => ({ ...prev, [c.key]: txt }))
                          const num = parseFloat(txt.replace(',', '.'))
                          if (!isNaN(num) && num >= 1 && num <= 5) {
                            setEditScores(prev => ({ ...prev, [c.key]: Math.round(num * 10) / 10 }))
                          }
                        }}
                        placeholder="ex: 3,5"
                        style={{
                          flex: 1, padding: '0.375rem 0.625rem', border: `1.5px solid ${scoreColor(val).border}`,
                          borderRadius: '0.5rem', fontSize: '0.9rem', fontWeight: 700,
                          color: scoreColor(val).text, textAlign: 'center' as const,
                          outline: 'none', backgroundColor: scoreColor(val).bg,
                        }}
                      />
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8', whiteSpace: 'nowrap' as const }}>1.0 a 5.0</span>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Prévia da média */}
            <div style={{ backgroundColor: '#f8fafc', borderRadius: '0.875rem', padding: '0.875rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.82rem', color: '#475569', fontWeight: 600 }}>Nova média</span>
              <span style={{ fontSize: '1.25rem', fontWeight: 800, color: scoreColor(Object.values(editScores).reduce((a,b)=>a+b,0)/9).text }}>
                {(Object.values(editScores).reduce((a,b)=>a+b,0)/9).toFixed(1)}
              </span>
            </div>

            {/* Botões */}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => setEditPlayer(null)}
                style={{ flex: 1, backgroundColor: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '0.875rem', padding: '0.875rem', fontWeight: 600, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={salvarEdicao} disabled={saving}
                style={{ flex: 2, backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '0.875rem', padding: '0.875rem', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                {saving ? 'Salvando...' : 'Salvar avaliação'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
