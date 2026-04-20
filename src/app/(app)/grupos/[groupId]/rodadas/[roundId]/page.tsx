'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Clock, Users, Edit2, Flag, Search, UserPlus, Check, X, Settings, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Round, Match, MemberRole } from '@/lib/types'
import { formatDateShort, formatTime } from '@/lib/utils'
import { notificarMembros, notificarUsuario } from '@/lib/notificacoes'

type Tab = 'presenca' | 'times' | 'jogos' | 'stats' | 'encerrar'

interface Membro {
  user_id: string
  full_name: string
  checked_in: boolean
  status: string // resposta antecipada
  is_guest: false
  attendance_id?: string
  arrival_order: number | null
}

interface Convidado {
  attendance_id: string
  guest_name: string
  checked_in: boolean
  is_guest: true
  arrival_order: number | null
}

type Presenca = Membro | Convidado

export default function RodadaPage() {
  const { groupId, roundId } = useParams<{ groupId: string; roundId: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [rodada, setRodada] = useState<Round | null>(null)
  const [membros, setMembros] = useState<Membro[]>([])
  const [convidados, setConvidados] = useState<Convidado[]>([])
  const [myRole, setMyRole] = useState<MemberRole>('player')
  const [myUserId, setMyUserId] = useState('')
  const [myStatus, setMyStatus] = useState('pending')
  const [jogos, setJogos] = useState<Match[]>([])
  const [timesCount, setTimesCount] = useState(0)
  const [activeTab, setActiveTab] = useState<Tab>('presenca')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  // Modal configurações
  const [modalConfig, setModalConfig] = useState(false)
  const [editNome, setEditNome] = useState('')
  const [editData, setEditData] = useState('')
  const [editHorario, setEditHorario] = useState('')
  const [savingConfig, setSavingConfig] = useState(false)

  // Polls
  const [polls, setPolls] = useState<any[]>([])
  const [meuVoto, setMeuVoto] = useState<Record<string, string>>({})
  const [notasRodada, setNotasRodada] = useState<{user_id: string; nome: string; foto: string|null; initials: string; media: number; total: number}[]>([])
  const [verTodasNotas, setVerTodasNotas] = useState(false) // poll_id -> option_id
  const [votando, setVotando] = useState<string | null>(null)
  const [agora, setAgora] = useState(new Date())

  // Cronômetro
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // Busca e convidado
  const [busca, setBusca] = useState('')
  const [novoConvidado, setNovoConvidado] = useState('')
  const [adicionandoConvidado, setAdicionandoConvidado] = useState(false)

  useEffect(() => { fetchData() }, [roundId])

  async function fetchData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setMyUserId(user.id)

    const { data: member } = await supabase
      .from('group_members').select('role')
      .eq('group_id', groupId).eq('user_id', user.id).single()
    setMyRole((member?.role as MemberRole) ?? 'player')

    const { data: round } = await supabase
      .from('rounds').select('*').eq('id', roundId).single()
    setRodada(round)

    // Busca TODOS os membros do grupo em ordem alfabética
    const { data: todosMemb } = await supabase
      .from('group_members')
      .select('user_id, profile:profiles(full_name)')
      .eq('group_id', groupId)
      .eq('is_active', true)
      .order('user_id')

    // Busca presenças existentes
    const { data: atts } = await supabase
      .from('round_attendance')
      .select('*')
      .eq('round_id', roundId)

    // Monta lista de membros com status
    const membrosFormatados: Membro[] = (todosMemb ?? [])
      .map((m: any) => {
        const att = atts?.find(a => a.user_id === m.user_id && !a.is_guest)
        return {
          user_id: m.user_id,
          full_name: m.profile?.full_name ?? 'Jogador',
          checked_in: att?.checked_in ?? false,
          status: att?.status ?? 'pending',
          is_guest: false as const,
          attendance_id: att?.id,
          arrival_order: att?.arrival_order ?? null,
        }
      })
      .sort((a, b) => a.full_name.localeCompare(b.full_name, 'pt-BR'))

    setMembros(membrosFormatados)

    // Minha resposta antecipada
    const myAtt = atts?.find(a => a.user_id === user.id && !a.is_guest)
    setMyStatus(myAtt?.status ?? 'pending')

    // Convidados
    const convs: Convidado[] = (atts ?? [])
      .filter(a => a.is_guest)
      .map(a => ({
        attendance_id: a.id,
        guest_name: a.guest_name ?? 'Convidado',
        checked_in: a.checked_in ?? false,
        is_guest: true as const,
        arrival_order: a.arrival_order ?? null,
      }))
    setConvidados(convs)

    // Times e jogos
    const { count: tc } = await supabase
      .from('teams').select('*', { count: 'exact', head: true }).eq('round_id', roundId)
    setTimesCount(tc ?? 0)

    const { data: matchesData } = await supabase
      .from('matches')
      .select('*, home_team:teams!home_team_id(id,name,color), away_team:teams!away_team_id(id,name,color)')
      .eq('round_id', roundId).order('match_order')

    const { data: eventsData } = await supabase
      .from('match_events')
      .select('*, profile:profiles(full_name)')
      .eq('round_id', roundId)

    const jogosComEventos = (matchesData ?? []).map((m: any) => ({
      ...m,
      eventos: (eventsData ?? []).filter((e: any) => e.match_id === m.id),
    }))
    setJogos(jogosComEventos)

    // Polls da rodada
    const { data: pollsData } = await supabase
      .from('polls')
      .select('*, poll_options(id, user_id, label, profile:profiles(full_name, photo_url)), poll_votes(option_id)')
      .eq('round_id', roundId)
      .order('created_at')

    setPolls(pollsData ?? [])

    // Votos do usuário atual
    if (user.id && pollsData && pollsData.length > 0) {
      const pollIds = pollsData.map((p: any) => p.id)
      const { data: votosData } = await supabase
        .from('poll_votes')
        .select('poll_id, option_id')
        .eq('voter_id', user.id)
        .in('poll_id', pollIds)

      const votosMap: Record<string, string> = {}
      for (const v of votosData ?? []) votosMap[v.poll_id] = v.option_id
      setMeuVoto(votosMap)
    }

    // Busca notas da rodada (média por jogador)
    const { data: ratingsData } = await supabase
      .from('player_ratings')
      .select('rated_id, rating, profile:profiles!player_ratings_rated_id_fkey(full_name, photo_url)')
      .eq('round_id', roundId)

    if (ratingsData && ratingsData.length > 0) {
      const mapaNotas: Record<string, { soma: number; total: number; nome: string; foto: string | null }> = {}
      for (const r of ratingsData) {
        const prof = r.profile as any
        if (!mapaNotas[r.rated_id]) {
          mapaNotas[r.rated_id] = { soma: 0, total: 0, nome: prof?.full_name ?? 'Jogador', foto: prof?.photo_url ?? null }
        }
        mapaNotas[r.rated_id].soma += r.rating
        mapaNotas[r.rated_id].total++
      }
      const lista = Object.entries(mapaNotas).map(([uid, d]) => ({
        user_id: uid,
        nome: d.nome,
        foto: d.foto,
        initials: d.nome.split(' ').map((n: string) => n[0]).slice(0, 2).join(''),
        media: Math.round(d.soma / d.total),
        total: d.total,
      })).sort((a, b) => b.media - a.media)
      setNotasRodada(lista)
    }

    setLoading(false)
  }

  // Resposta antecipada (jogador)
  async function handleResposta(status: 'confirmed' | 'maybe' | 'declined') {
    setSaving('resposta')
    await supabase.from('round_attendance').upsert({
      round_id: roundId,
      user_id: myUserId,
      status,
      is_guest: false,
      checked_in: false,
    }, { onConflict: 'round_id,user_id' })
    setMyStatus(status)
    setSaving(null)
    fetchData()
  }

  // Check-in pelo admin
  async function handleCheckin(membro: Membro) {
    setSaving(membro.user_id)
    const novoCheckin = !membro.checked_in

    // Calcula próximo número de chegada
    const maxOrder = Math.max(
      0,
      ...membros.filter(m => m.checked_in && m.arrival_order).map(m => m.arrival_order!),
      ...convidados.filter(c => c.checked_in && c.arrival_order).map(c => c.arrival_order!)
    )
    const novoOrder = novoCheckin ? maxOrder + 1 : null

    if (membro.attendance_id) {
      await supabase.from('round_attendance')
        .update({ checked_in: novoCheckin, arrival_order: novoOrder })
        .eq('id', membro.attendance_id)
    } else {
      await supabase.from('round_attendance').insert({
        round_id: roundId,
        user_id: membro.user_id,
        status: 'confirmed',
        is_guest: false,
        checked_in: true,
        arrival_order: novoOrder,
      })
    }

    setSaving(null)
    fetchData()
  }

  // Check-in convidado
  async function handleCheckinConvidado(conv: Convidado) {
    setSaving(conv.attendance_id)
    const novoCheckin = !conv.checked_in

    const maxOrder = Math.max(
      0,
      ...membros.filter(m => m.checked_in && m.arrival_order).map(m => m.arrival_order!),
      ...convidados.filter(c => c.checked_in && c.arrival_order).map(c => c.arrival_order!)
    )
    const novoOrder = novoCheckin ? maxOrder + 1 : null

    await supabase.from('round_attendance')
      .update({ checked_in: novoCheckin, arrival_order: novoOrder })
      .eq('id', conv.attendance_id)
    setSaving(null)
    fetchData()
  }

  // Adicionar convidado
  async function handleAdicionarConvidado() {
    if (!novoConvidado.trim()) return
    setAdicionandoConvidado(true)
    await supabase.from('round_attendance').insert({
      round_id: roundId,
      user_id: null,
      status: 'confirmed',
      is_guest: true,
      guest_name: novoConvidado.trim(),
      checked_in: true,
    })
    setNovoConvidado('')
    setAdicionandoConvidado(false)
    fetchData()
  }

  // Remover convidado
  async function handleRemoverConvidado(id: string) {
    await supabase.from('round_attendance').delete().eq('id', id)
    fetchData()
  }

  async function handleSalvarConfig() {
    if (!editNome.trim()) return
    setSavingConfig(true)
    await supabase.from('rounds').update({
      title: editNome.trim(),
      scheduled_date: editData,
      start_time: editHorario || null,
    }).eq('id', roundId)
    setSavingConfig(false)
    setModalConfig(false)
    fetchData()
  }

  async function handleExcluirRodada() {
    if (!confirm('Tem certeza que deseja excluir esta rodada? Esta ação não pode ser desfeita.')) return
    setSavingConfig(true)
    await supabase.from('rounds').delete().eq('id', roundId)
    router.push(`/grupos/${groupId}/rodadas`)
  }

  async function handleEncerrarRodada() {
    if (!confirm('Encerrar a rodada? Isso abrirá as votações de Craque e Bola Murcha.')) return
    setSaving('encerrar')

    const agora = new Date().toISOString()
    const fechaEm4h = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()

    await supabase.from('rounds').update({ status: 'finished', finished_at: agora }).eq('id', roundId)

    // Apenas membros (não convidados) participam das enquetes
    const checkedInMembers = membros.filter(m => m.checked_in)

    if (checkedInMembers.length > 0) {
      for (const tipo of ['craque', 'bola_murcha'] as const) {
        const titulo = tipo === 'craque' ? '⭐ Craque da Rodada' : '🥱 Bola Murcha'
        const { data: poll } = await supabase.from('polls').insert({
          group_id: groupId,
          round_id: roundId,
          season_id: rodada!.season_id,
          type: tipo,
          title: titulo,
          show_partial: false,
          is_multiple_choice: false,
          created_by: myUserId,
          opens_at: agora,
          closes_at: fechaEm4h,
          is_closed: false,
        }).select().single()

        if (poll) {
          await supabase.from('poll_options').insert(
            checkedInMembers.map(m => ({
              poll_id: poll.id,
              user_id: m.user_id,
              label: m.full_name,
            }))
          )
        }
      }
    }

    setSaving(null)

    // Notifica membros sobre rodada encerrada e enquetes abertas
    const tituloRodada = rodada?.title ?? 'Rodada'
    await notificarMembros(groupId, 'round_finished',
      `✅ ${tituloRodada} encerrada!`,
      'Vote no Craque da Rodada e dê notas aos jogadores 🏆',
      { round_id: roundId }, undefined)

    fetchData()
    setActiveTab('presenca')
  }

  async function handleVotar(pollId: string, optionId: string) {
    if (meuVoto[pollId]) return // já votou
    setVotando(pollId)
    const { error } = await supabase.from('poll_votes').insert({
      poll_id: pollId,
      option_id: optionId,
      voter_id: myUserId,
    })
    if (!error) {
      setMeuVoto(v => ({ ...v, [pollId]: optionId }))
    }
    setVotando(null)
  }

  function formatCronometro(closesAt: string) {
    const diff = new Date(closesAt).getTime() - agora.getTime()
    if (diff <= 0) return null
    const h = Math.floor(diff / 3600000)
    const m = Math.floor((diff % 3600000) / 60000)
    const s = Math.floor((diff % 60000) / 1000)
    return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`
  }

  if (loading || !rodada) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl animate-bounce mb-2">⚽</div>
          <p className="text-gray-400 text-sm">Carregando...</p>
        </div>
      </div>
    )
  }

  const isAdmin = myRole === 'admin'
  const isFinished = rodada.status === 'finished'
  const isCancelled = rodada.status === 'cancelled'

  const checkedInCount = membros.filter(m => m.checked_in).length + convidados.filter(c => c.checked_in).length
  const confirmadosAntecipados = membros.filter(m => m.status === 'confirmed').length
  const talvezCount = membros.filter(m => m.status === 'maybe').length

  // Filtro de busca
  const membrosFiltrados = membros.filter(m =>
    m.full_name.toLowerCase().includes(busca.toLowerCase())
  )

  const tabs: { key: Tab; label: string }[] = [
    { key: 'presenca', label: 'Presença' },
    { key: 'times', label: 'Times' },
    { key: 'jogos', label: 'Jogos' },
    { key: 'stats', label: 'Stats' },
    ...(isAdmin ? [{ key: 'encerrar' as Tab, label: 'Encerrar' }] : []),
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className={`pt-12 pb-4 px-4 ${isFinished ? 'bg-green-600' : 'bg-green-600'}`}>
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => router.push(`/grupos/${groupId}/rodadas`)} className="text-white/70 hover:text-white">
              <ArrowLeft size={22} />
            </button>
            <span className={`text-base px-3 py-1 rounded-full font-semibold ${
              isFinished ? 'bg-white/20 text-white' :
              rodada.status === 'ongoing' ? 'bg-green-500 text-white' :
              isCancelled ? 'bg-red-500 text-white' :
              'bg-white/20 text-white'
            }`}>
              {isFinished ? '✅ Finalizada' : rodada.status === 'ongoing' ? '🟢 Em andamento' : isCancelled ? '❌ Cancelada' : '📅 Agendada'}
            </span>
            {isAdmin && !isFinished
              ? <button onClick={() => {
                  setEditNome(rodada.title ?? '')
                  setEditData(rodada.scheduled_date ?? '')
                  setEditHorario(rodada.start_time?.slice(0,5) ?? '')
                  setModalConfig(true)
                }} className="text-white/70 hover:text-white transition-colors">
                  <Settings size={20} />
                </button>
              : <div className="w-6" />
            }
          </div>

          <h1 className="text-white text-xl font-bold">
            {rodada.title ?? `Rodada de ${formatDateShort(rodada.scheduled_date)}`}
          </h1>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-white/70 text-sm flex items-center gap-1"><Clock size={13} /> {formatTime(rodada.start_time)}</span>
            <span className="text-white/70 text-sm flex items-center gap-1"><Users size={13} /> {rodada.players_per_team}x{rodada.players_per_team}</span>
            <span className="text-white/70 text-sm">⏱ {rodada.match_duration_minutes}min</span>
          </div>

          <div className="flex gap-1 mt-4 bg-white/10 rounded-xl p-1">
            {tabs.map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === tab.key ? 'bg-white text-green-700 shadow' : 'text-white/80 hover:text-white'
                }`}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-3 pb-8">

        {/* ======================== TAB: PRESENÇA ======================== */}
        {activeTab === 'presenca' && (
          <>
            {/* Minha resposta antecipada (qualquer jogador) */}
            {!isFinished && !isCancelled && (
              <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                <p className="text-sm font-semibold text-gray-700 mb-1">Você vai no próximo baba?</p>
                <p className="text-xs text-gray-400 mb-3">Aviso antecipado — o admin confirma no dia</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { status: 'confirmed', label: 'Vou ✅', color: myStatus === 'confirmed' ? 'bg-green-500 text-white border-transparent' : 'border-gray-200 text-gray-600' },
                    { status: 'maybe', label: 'Talvez ❓', color: myStatus === 'maybe' ? 'bg-yellow-400 text-white border-transparent' : 'border-gray-200 text-gray-600' },
                    { status: 'declined', label: 'Não vou ❌', color: myStatus === 'declined' ? 'bg-red-400 text-white border-transparent' : 'border-gray-200 text-gray-600' },
                  ].map(opt => (
                    <button key={opt.status}
                      onClick={() => handleResposta(opt.status as any)}
                      disabled={saving === 'resposta'}
                      className={`py-2.5 rounded-xl text-sm font-semibold border-2 transition-all active:scale-95 ${opt.color}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Termômetro — só quando rodada não finalizada */}
            {!isFinished && (
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-green-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-green-600">{checkedInCount}</p>
                <p className="text-xs text-green-700 font-semibold">Presentes</p>
                <p className="text-xs text-green-600">(no dia)</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-blue-600">{confirmadosAntecipados}</p>
                <p className="text-xs text-blue-700 font-semibold">Confirmados</p>
                <p className="text-xs text-blue-600">(antecipado)</p>
              </div>
              <div className="bg-yellow-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-yellow-600">{talvezCount}</p>
                <p className="text-xs text-yellow-700 font-semibold">Talvez</p>
                <p className="text-xs text-yellow-600">(antecipado)</p>
              </div>
            </div>
            )}

            {/* CHECK-IN ADMIN */}
            {isAdmin && !isFinished && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                  <p className="text-sm font-bold text-gray-700">✅ Check-in do dia</p>
                  <p className="text-xs text-gray-400 mt-0.5">Marque quem chegou para jogar</p>
                </div>

                {/* Lista de presentes por ordem de chegada */}
                {(() => {
                  const presentes = [
                    ...membros.filter(m => m.checked_in && m.arrival_order),
                    ...convidados.filter(c => c.checked_in && c.arrival_order),
                  ].sort((a, b) => (a.arrival_order ?? 0) - (b.arrival_order ?? 0))

                  if (presentes.length === 0) return null

                  async function reordenar(fromIdx: number, toIdx: number) {
                    const reordenados = [...presentes]
                    const [item] = reordenados.splice(fromIdx, 1)
                    reordenados.splice(toIdx, 0, item)
                    // Atualiza arrival_order de todos
                    for (let i = 0; i < reordenados.length; i++) {
                      const p = reordenados[i]
                      await supabase.from('round_attendance')
                        .update({ arrival_order: i + 1 })
                        .eq('id', p.is_guest ? (p as any).attendance_id : (p as any).attendance_id)
                    }
                    fetchData()
                  }

                  return (
                    <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9' }}>
                      <p style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.5rem' }}>
                        🏃 Ordem de chegada
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        {presentes.map((p, i) => {
                          const nome = p.is_guest ? (p as any).guest_name : (p as any).full_name
                          return (
                            <div key={p.is_guest ? (p as any).attendance_id : (p as any).user_id}
                              draggable
                              onDragStart={e => e.dataTransfer.setData('text/plain', String(i))}
                              onDragOver={e => e.preventDefault()}
                              onDrop={e => { e.preventDefault(); reordenar(Number(e.dataTransfer.getData('text/plain')), i) }}
                              style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.5rem 0.625rem', backgroundColor: i < 3 ? '#f0fdf4' : '#f8fafc', borderRadius: '0.625rem', cursor: 'grab', border: '1px solid #e2e8f0' }}>
                              <span style={{ fontSize: '0.7rem', color: '#94a3b8', width: '1.25rem', textAlign: 'center', flexShrink: 0 }}>⠿</span>
                              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: i < 3 ? '#16a34a' : '#64748b', flexShrink: 0, width: '1.75rem', textAlign: 'center' }}>
                                {i + 1}º
                              </span>
                              <p style={{ flex: 1, fontSize: '0.85rem', fontWeight: i < 3 ? 700 : 500, color: '#1e293b', margin: 0 }}>{nome}</p>
                              {p.is_guest && <span style={{ fontSize: '0.62rem', color: '#94a3b8', backgroundColor: '#f1f5f9', padding: '1px 6px', borderRadius: '9999px' }}>convidado</span>}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}

                {/* Busca */}
                <div className="px-4 py-3 border-b border-gray-100">
                  <div className="relative">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={busca}
                      onChange={e => setBusca(e.target.value)}
                      placeholder="Buscar jogador..."
                      className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-green-400"
                    />
                  </div>
                </div>

                {/* Lista de membros — só quem ainda NÃO fez check-in */}
                <div className="divide-y divide-gray-50">
                  {membrosFiltrados.filter(m => !m.checked_in).map(membro => (
                    <button
                      key={membro.user_id}
                      onClick={() => handleCheckin(membro)}
                      disabled={saving === membro.user_id}
                      className={`w-full flex items-center gap-3 px-4 py-3 transition-all text-left active:scale-[0.99] ${
                        membro.checked_in ? 'bg-green-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      {/* Checkbox visual */}
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                        membro.checked_in ? 'bg-green-500' : 'bg-gray-200'
                      }`}>
                        {membro.checked_in && <Check size={14} className="text-white" strokeWidth={3} />}
                      </div>

                      {/* Nome */}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold truncate ${membro.checked_in ? 'text-green-700' : 'text-gray-700'}`}>
                          {membro.full_name}
                        </p>
                        {membro.status !== 'pending' && (
                          <p className="text-xs text-gray-400">
                            {membro.status === 'confirmed' ? '✅ disse que vem' :
                             membro.status === 'maybe' ? '❓ talvez' : '❌ disse que não vem'}
                          </p>
                        )}
                      </div>

                      {saving === membro.user_id && (
                        <div className="w-4 h-4 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
                      )}
                    </button>
                  ))}
                </div>

                {/* Convidados existentes */}
                {convidados.length > 0 && (
                  <div className="border-t border-gray-100">
                    <div className="px-4 py-2 bg-blue-50">
                      <p className="text-xs font-bold text-blue-600">🎟️ Convidados</p>
                    </div>
                    {convidados.map(conv => (
                      <div key={conv.attendance_id}
                        className={`flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0 ${conv.checked_in ? 'bg-green-50' : ''}`}>
                        <button onClick={() => handleCheckinConvidado(conv)}
                          className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${conv.checked_in ? 'bg-green-500' : 'bg-gray-200'}`}>
                          {conv.checked_in && <Check size={14} className="text-white" strokeWidth={3} />}
                        </button>
                        <p className={`flex-1 text-sm font-semibold ${conv.checked_in ? 'text-green-700' : 'text-gray-700'}`}>
                          {conv.guest_name}
                          <span className="ml-1 text-xs font-normal text-blue-500">(convidado)</span>
                        </p>
                        <button onClick={() => handleRemoverConvidado(conv.attendance_id)}
                          className="text-red-400 hover:text-red-500 transition-colors">
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Adicionar convidado */}
                <div className="border-t border-gray-100 p-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={novoConvidado}
                      onChange={e => setNovoConvidado(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAdicionarConvidado()}
                      placeholder="Nome do convidado..."
                      className="flex-1 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-400"
                    />
                    <button
                      onClick={handleAdicionarConvidado}
                      disabled={!novoConvidado.trim() || adicionandoConvidado}
                      className="bg-blue-500 hover:bg-blue-600 disabled:opacity-40 text-white px-3 py-2.5 rounded-xl transition-all flex items-center gap-1 text-sm font-semibold"
                    >
                      <UserPlus size={15} />
                      Add
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Lista de presentes (visão de jogador, só quando não finalizada) */}
            {!isAdmin && !isFinished && checkedInCount > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-bold text-gray-700">✅ Presentes ({checkedInCount})</p>
                </div>
                {membros.filter(m => m.checked_in).map(m => (
                  <div key={m.user_id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0">
                    <div className="w-7 h-7 bg-green-100 rounded-full flex items-center justify-center text-xs font-bold text-green-600">
                      {m.full_name[0]}
                    </div>
                    <p className="text-sm font-medium text-gray-700">{m.full_name}</p>
                  </div>
                ))}
                {convidados.filter(c => c.checked_in).map(c => (
                  <div key={c.attendance_id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0">
                    <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center text-xs font-bold text-blue-500">
                      {c.guest_name[0]}
                    </div>
                    <p className="text-sm font-medium text-gray-700">{c.guest_name}
                      <span className="ml-1 text-xs text-blue-400">(convidado)</span>
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Banner de notas */}
            {isFinished && (
              <button
                onClick={() => router.push(`/grupos/${groupId}/rodadas/${roundId}/notas`)}
                style={{ width: '100%', background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', border: 'none', borderRadius: '1rem', padding: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.875rem', boxShadow: '0 4px 16px rgba(124,58,237,0.3)' }}>
                <div style={{ width: '2.5rem', height: '2.5rem', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '1.25rem' }}>⭐</div>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <p style={{ color: 'white', fontWeight: 700, fontSize: '0.95rem', margin: 0 }}>Dar notas aos jogadores</p>
                  <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.75rem', margin: '2px 0 0' }}>Avalie o desempenho de cada um · 4h para votar</p>
                </div>
                <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '1.25rem' }}>›</span>
              </button>
            )}

            {/* Votações pós-rodada */}
            {isFinished && polls.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
                <p style={{ fontSize: '0.7rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                  🗳️ Votações da rodada
                </p>
                {polls.map((poll: any) => {
                  const isCraque = poll.type === 'craque'
                  const cronometro = formatCronometro(poll.closes_at)
                  const encerrada = !cronometro || poll.is_closed
                  const jaVotou = !!meuVoto[poll.id]
                  const cor = isCraque ? '#f59e0b' : '#64748b'
                  const bg = isCraque ? '#fef9c3' : '#f1f5f9'

                  // Conta votos por opção
                  const contagemVotos: Record<string, number> = {}
                  // Para resultado, precisaríamos buscar — por ora mostramos após encerrar

                  return (
                    <div key={poll.id} style={{ backgroundColor: 'white', borderRadius: '1rem', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: `1px solid ${cor}33` }}>
                      {/* Header */}
                      <div style={{ padding: '0.875rem 1rem', background: `linear-gradient(135deg, ${cor}, ${cor}cc)`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <p style={{ color: 'white', fontWeight: 700, fontSize: '0.95rem', margin: 0 }}>
                            {isCraque ? '🏆 Craque da Rodada' : '💩 Bola Murcha'}
                          </p>
                          <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.75rem', margin: '2px 0 0', fontWeight: 500 }}>
                            {isCraque ? 'Quem foi o melhor?' : 'Quem decepcionou?'}
                          </p>
                        </div>
                        {/* Cronômetro */}
                        {!encerrada && (
                          <div style={{ backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '0.75rem', padding: '4px 10px', textAlign: 'center' }}>
                            <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.6rem', fontWeight: 700, margin: '0 0 1px', textTransform: 'uppercase' }}>Fecha em</p>
                            <p style={{ color: 'white', fontSize: '0.8rem', fontWeight: 900, margin: 0, fontVariantNumeric: 'tabular-nums' }}>{cronometro}</p>
                          </div>
                        )}
                        {encerrada && (
                          <div style={{ backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: '0.75rem', padding: '4px 10px' }}>
                            <p style={{ color: 'white', fontSize: '0.7rem', fontWeight: 700, margin: 0 }}>✅ Encerrada</p>
                          </div>
                        )}
                      </div>

                      <div style={{ padding: '0.875rem' }}>
                        {/* Já votou */}
                        {jaVotou && !encerrada && (
                          <div style={{ backgroundColor: '#dcfce7', border: '1px solid #16a34a33', borderRadius: '0.75rem', padding: '0.75rem', textAlign: 'center', marginBottom: '0.75rem' }}>
                            <p style={{ color: '#15803d', fontWeight: 700, fontSize: '0.875rem', margin: 0 }}>
                              ✅ Voto registrado! Resultado disponível após o encerramento.
                            </p>
                          </div>
                        )}

                        {/* Votação aberta */}
                        {!encerrada && !jaVotou && (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                            {(poll.poll_options ?? []).map((opt: any) => {
                              const prof = opt.profile
                              const nome = prof?.full_name ?? opt.label ?? 'Jogador'
                              const initials = nome.split(' ').map((n: string) => n[0]).slice(0, 2).join('')
                              return (
                                <button key={opt.id}
                                  onClick={() => handleVotar(poll.id, opt.id)}
                                  disabled={votando === poll.id}
                                  style={{
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                                    padding: '0.75rem 0.5rem', borderRadius: '0.875rem',
                                    border: `2px solid ${cor}33`, backgroundColor: bg,
                                    cursor: votando === poll.id ? 'not-allowed' : 'pointer',
                                    opacity: votando === poll.id ? 0.6 : 1,
                                    transition: 'all 0.15s',
                                  }}
                                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = cor; (e.currentTarget as HTMLElement).style.backgroundColor = bg }}
                                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = cor + '33' }}>
                                  <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '9999px', backgroundColor: 'white', border: `2px solid ${cor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                    {prof?.photo_url
                                      ? <img src={prof.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                      : <span style={{ fontSize: '0.7rem', fontWeight: 700, color: cor }}>{initials}</span>}
                                  </div>
                                  <p style={{ fontSize: '0.78rem', fontWeight: 700, color: '#1e293b', margin: 0, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                                    {nome.split(' ')[0]}
                                  </p>
                                </button>
                              )
                            })}
                          </div>
                        )}

                        {/* Resultado encerrado — mostra vencedor */}
                        {encerrada && (() => {
                          // Conta votos por opção
                          const contagem: Record<string, number> = {}
                          const totalVotos = poll.poll_votes?.length ?? 0
                          for (const v of poll.poll_votes ?? []) {
                            contagem[v.option_id] = (contagem[v.option_id] ?? 0) + 1
                          }
                          const opcoesOrdenadas = [...(poll.poll_options ?? [])].sort((a: any, b: any) =>
                            (contagem[b.id] ?? 0) - (contagem[a.id] ?? 0)
                          )
                          const vencedor = opcoesOrdenadas[0]
                          if (!vencedor) return <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem', padding: '0.5rem' }}>Nenhum voto registrado</p>
                          const profV = vencedor.profile as any
                          const nomeV = profV?.full_name ?? vencedor.label ?? 'Jogador'
                          const initialsV = nomeV.split(' ').map((n: string) => n[0]).slice(0, 2).join('')
                          const votosV = contagem[vencedor.id] ?? 0
                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                              {/* Vencedor destacado */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', backgroundColor: bg, borderRadius: '0.875rem', padding: '0.875rem', border: `2px solid ${cor}44` }}>
                                <div style={{ fontSize: '1.75rem' }}>{isCraque ? '🏆' : '💩'}</div>
                                <div style={{ width: '3rem', height: '3rem', borderRadius: '9999px', backgroundColor: 'white', border: `3px solid ${cor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                                  {profV?.photo_url
                                    ? <img src={profV.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    : <span style={{ fontSize: '0.8rem', fontWeight: 700, color: cor }}>{initialsV}</span>}
                                </div>
                                <div style={{ flex: 1 }}>
                                  <p style={{ fontSize: '1rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>{nomeV}</p>
                                  <p style={{ fontSize: '0.72rem', color: cor, fontWeight: 700, margin: '2px 0 0' }}>{votosV} voto{votosV !== 1 ? 's' : ''} · {totalVotos > 0 ? Math.round(votosV/totalVotos*100) : 0}%</p>
                                </div>
                              </div>
                              {/* Demais opções */}
                              {opcoesOrdenadas.slice(1, 4).map((opt: any, i: number) => {
                                const prof = opt.profile as any
                                const nome = prof?.full_name ?? opt.label ?? 'Jogador'
                                const initials = nome.split(' ').map((n: string) => n[0]).slice(0, 2).join('')
                                const votos = contagem[opt.id] ?? 0
                                const pct = totalVotos > 0 ? Math.round(votos/totalVotos*100) : 0
                                return (
                                  <div key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.5rem 0.75rem', borderRadius: '0.75rem', backgroundColor: '#f8fafc' }}>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', width: '1.25rem' }}>#{i+2}</span>
                                    <div style={{ width: '1.75rem', height: '1.75rem', borderRadius: '9999px', backgroundColor: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                                      {prof?.photo_url
                                        ? <img src={prof.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        : <span style={{ fontSize: '0.55rem', fontWeight: 700, color: '#64748b' }}>{initials}</span>}
                                    </div>
                                    <p style={{ flex: 1, fontSize: '0.8rem', fontWeight: 600, color: '#475569', margin: 0 }}>{nome.split(' ')[0]}</p>
                                    <div style={{ textAlign: 'right' }}>
                                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>{votos}v</span>
                                      <span style={{ fontSize: '0.65rem', color: '#94a3b8', marginLeft: '4px' }}>{pct}%</span>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )
                        })()}
                      </div>
                    </div>
                  )
                })}

                {/* Ranking de notas — só após encerramento das enquetes */}
                {notasRodada.length > 0 && polls.every(p => !formatCronometro(p.closes_at)) && (
                  <div style={{ backgroundColor: 'white', borderRadius: '1rem', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #ede9fe' }}>
                    <div style={{ padding: '0.875rem 1rem', background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <p style={{ color: 'white', fontWeight: 700, fontSize: '0.95rem', margin: 0 }}>⭐ Notas da Rodada</p>
                      <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.7rem', margin: 0 }}>Média</p>
                    </div>
                    {(verTodasNotas ? notasRodada : notasRodada.slice(0, 5)).map((j, i) => {
                      const medalha = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null
                      const notaCor = j.media >= 80 ? '#15803d' : j.media >= 60 ? '#1d4ed8' : j.media >= 40 ? '#a16207' : '#b91c1c'
                      const notaBg = j.media >= 80 ? '#dcfce7' : j.media >= 60 ? '#dbeafe' : j.media >= 40 ? '#fef9c3' : '#fee2e2'
                      return (
                        <div key={j.user_id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', borderBottom: '1px solid #f8fafc', backgroundColor: i < 3 ? '#faf5ff' : 'white' }}>
                          <div style={{ width: '1.75rem', textAlign: 'center', flexShrink: 0 }}>
                            {medalha ? <span style={{ fontSize: '1.1rem' }}>{medalha}</span> : <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8' }}>#{i+1}</span>}
                          </div>
                          <div style={{ width: '2.25rem', height: '2.25rem', borderRadius: '9999px', backgroundColor: '#ede9fe', border: '2px solid #7c3aed44', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                            {j.foto ? <img src={j.foto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#7c3aed' }}>{j.initials}</span>}
                          </div>
                          <p style={{ flex: 1, fontSize: '0.875rem', fontWeight: i < 3 ? 700 : 500, color: '#1e293b', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.nome}</p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{j.total}v</span>
                            <div style={{ backgroundColor: notaBg, border: `2px solid ${notaCor}44`, borderRadius: '0.625rem', padding: '3px 10px' }}>
                              <span style={{ fontSize: '0.9rem', fontWeight: 900, color: notaCor }}>{j.media}</span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                    {notasRodada.length > 5 && (
                      <button onClick={() => setVerTodasNotas(v => !v)}
                        style={{ width: '100%', padding: '0.75rem', backgroundColor: '#faf5ff', border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700, color: '#7c3aed', borderTop: '1px solid #ede9fe' }}>
                        {verTodasNotas ? '▲ Ver menos' : `▼ Ver todos (${notasRodada.length})`}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ======================== TAB: TIMES ======================== */}
        {activeTab === 'times' && (
          <>
            {isAdmin && !isFinished && (
              <button
                onClick={() => router.push(`/grupos/${groupId}/rodadas/${roundId}/times`)}
                className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-3.5 rounded-2xl transition-all">
                <Users size={18} />
                {timesCount > 0 ? 'Editar Times' : 'Montar Times'}
              </button>
            )}
            {timesCount === 0 ? (
              <div className="text-center py-12">
                <div className="text-4xl mb-2">👕</div>
                <p className="text-gray-500 font-medium">Times ainda não formados</p>
                {isAdmin && checkedInCount === 0 && (
                  <p className="text-gray-400 text-sm mt-1">Faça o check-in dos jogadores primeiro</p>
                )}
              </div>
            ) : (
              <TimesDisplay roundId={roundId} />
            )}
          </>
        )}

        {/* ======================== TAB: JOGOS ======================== */}
        {activeTab === 'jogos' && (
          <>
            {isAdmin && timesCount >= 2 && (
              <button
                onClick={() => router.push(`/grupos/${groupId}/rodadas/${roundId}/jogos`)}
                className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-3.5 rounded-2xl transition-all">
                <Edit2 size={18} /> Gerenciar Jogos
              </button>
            )}
            {jogos.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-4xl mb-2">⚽</div>
                <p className="text-gray-500 font-medium">Nenhum jogo cadastrado</p>
                {isAdmin && timesCount < 2 && <p className="text-gray-400 text-sm mt-1">Monte os times primeiro</p>}
              </div>
            ) : (
              jogos.map(jogo => {
                const eventos = (jogo as any).eventos ?? []
                const EVENT_ICONS: Record<string, string> = { goal: '⚽', assist: '🅰️', yellow_card: '🟨', red_card: '🟥' }
                const EVENT_COLORS: Record<string, string> = { goal: '#dcfce7', assist: '#dbeafe', yellow_card: '#fef9c3', red_card: '#fee2e2' }
                const EVENT_TEXT: Record<string, string> = { goal: '#16a34a', assist: '#2563eb', yellow_card: '#ca8a04', red_card: '#dc2626' }
                return (
                  <div key={jogo.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <p className="text-xs text-gray-400 text-center pt-3 pb-1">Jogo {jogo.match_order}</p>
                    <div className="flex items-center justify-between gap-4 px-4 pb-3">
                      <div className="flex-1 text-center">
                        <div className="w-8 h-8 rounded-full mx-auto mb-1" style={{ backgroundColor: (jogo as any).home_team?.color ?? '#16a34a' }} />
                        <p className="text-sm font-bold text-gray-800 truncate">{(jogo as any).home_team?.name}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold text-gray-800">{jogo.home_score}</span>
                        <span className="text-gray-300 font-bold">×</span>
                        <span className="text-2xl font-bold text-gray-800">{jogo.away_score}</span>
                      </div>
                      <div className="flex-1 text-center">
                        <div className="w-8 h-8 rounded-full mx-auto mb-1" style={{ backgroundColor: (jogo as any).away_team?.color ?? '#dc2626' }} />
                        <p className="text-sm font-bold text-gray-800 truncate">{(jogo as any).away_team?.name}</p>
                      </div>
                    </div>
                    {eventos.filter((ev: any) => ev.event_type !== 'substitution').length > 0 && (
                      <div style={{ borderTop: '1px solid #f1f5f9', padding: '0.5rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        {eventos.filter((ev: any) => ev.event_type !== 'substitution').map((ev: any, i: number) => {
                          const nome = ev.is_guest ? ev.guest_name : (ev.profile?.full_name ?? 'Jogador')
                          const initials = (nome ?? 'J').split(' ').map((n: string) => n[0]).slice(0, 2).join('')
                          const teamColor = ev.team_id === (jogo as any).home_team_id ? (jogo as any).home_team?.color : (jogo as any).away_team?.color
                          return (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 6px', borderRadius: '0.5rem', backgroundColor: EVENT_COLORS[ev.event_type] ?? '#f8fafc' }}>
                              <span style={{ fontSize: '0.85rem' }}>{EVENT_ICONS[ev.event_type]}</span>
                              <div style={{ width: '20px', height: '20px', borderRadius: '9999px', backgroundColor: teamColor ?? '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <span style={{ fontSize: '0.5rem', fontWeight: 700, color: 'white' }}>{initials}</span>
                              </div>
                              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#1e293b', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nome}</span>
                              <span style={{ fontSize: '0.65rem', fontWeight: 700, color: EVENT_TEXT[ev.event_type] }}>{ev.event_type === 'goal' ? 'Gol' : ev.event_type === 'assist' ? 'Assist.' : ev.event_type === 'yellow_card' ? 'Amarelo' : ev.event_type === 'red_card' ? 'Vermelho' : ''}</span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })
            )}

            {/* Botão gerar cards — só após todas as enquetes encerradas */}
            {(() => {
              const enquetesAbertas = polls
                .filter((p: any) => p.type === 'craque' || p.type === 'bola_murcha')
                .some((p: any) => formatCronometro(p.closes_at) !== null && !p.is_closed)

              if (!isFinished || jogos.length === 0) return null

              if (enquetesAbertas) {
                return (
                  <div style={{ width: '100%', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '1rem', padding: '0.875rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>🃏 Cards disponíveis após encerramento das enquetes</span>
                  </div>
                )
              }

              return (
                <button onClick={() => router.push(`/grupos/${groupId}/rodadas/${roundId}/cards`)}
                  style={{ width: '100%', background: 'linear-gradient(135deg, #1e293b, #334155)', border: 'none', borderRadius: '1rem', padding: '0.875rem', color: 'white', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  🃏 Gerar Cards para Compartilhar
                </button>
              )
            })()}
          </>
        )}
        {activeTab === 'stats' && (() => {
          // Agrega todos eventos da rodada
          const todosEventos = jogos.flatMap((j: any) => j.eventos ?? [])
          const statsMap: Record<string, { nome: string; initials: string; foto: string | null; gols: number; assistencias: number; amarelos: number; vermelhos: number }> = {}

          for (const ev of todosEventos) {
            if (ev.is_guest) continue
            const uid = ev.user_id
            if (!uid) continue
            if (!statsMap[uid]) {
              const nome = ev.profile?.full_name ?? 'Jogador'
              statsMap[uid] = {
                nome, foto: ev.profile?.photo_url ?? null,
                initials: nome.split(' ').map((n: string) => n[0]).slice(0, 2).join(''),
                gols: 0, assistencias: 0, amarelos: 0, vermelhos: 0,
              }
            }
            if (ev.event_type === 'goal')        statsMap[uid].gols++
            if (ev.event_type === 'assist')      statsMap[uid].assistencias++
            if (ev.event_type === 'yellow_card') statsMap[uid].amarelos++
            if (ev.event_type === 'red_card')    statsMap[uid].vermelhos++
          }

          const stats = Object.values(statsMap)
          const artilheiros = [...stats].filter(s => s.gols > 0).sort((a, b) => b.gols - a.gols)
          const assistentes = [...stats].filter(s => s.assistencias > 0).sort((a, b) => b.assistencias - a.assistencias)
          const cartoes = [...stats].filter(s => s.amarelos + s.vermelhos > 0).sort((a, b) => (b.amarelos + b.vermelhos) - (a.amarelos + a.vermelhos))

          const RankingBloco = ({ titulo, icon, cor, bg, lista, campo, label }: any) => (
            <div style={{ backgroundColor: 'white', borderRadius: '1rem', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', backgroundColor: bg, borderBottom: `2px solid ${cor}22` }}>
                <span style={{ fontSize: '1rem' }}>{icon}</span>
                <p style={{ fontSize: '0.8rem', fontWeight: 700, color: cor, margin: 0, flex: 1 }}>{titulo}</p>
                <p style={{ fontSize: '0.7rem', fontWeight: 700, color: cor, margin: 0 }}>{label}</p>
              </div>
              {lista.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#cbd5e1', fontSize: '0.8rem', padding: '1.5rem' }}>Nenhum registro</p>
              ) : lista.map((s: any, i: number) => {
                const medalha = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem 1rem', borderBottom: '1px solid #f8fafc', backgroundColor: i < 3 ? bg + '55' : 'white' }}>
                    <div style={{ width: '1.5rem', textAlign: 'center', flexShrink: 0 }}>
                      {medalha ? <span style={{ fontSize: '1rem' }}>{medalha}</span> : <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8' }}>#{i+1}</span>}
                    </div>
                    <div style={{ width: '2rem', height: '2rem', borderRadius: '9999px', backgroundColor: bg, border: `2px solid ${cor}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                      {s.foto ? <img src={s.foto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '0.62rem', fontWeight: 700, color: cor }}>{s.initials}</span>}
                    </div>
                    <p style={{ flex: 1, fontSize: '0.85rem', fontWeight: i < 3 ? 700 : 500, color: '#1e293b', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.nome}</p>
                    <div style={{ backgroundColor: i < 3 ? cor : '#f1f5f9', borderRadius: '9999px', padding: '3px 12px' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 800, color: i < 3 ? 'white' : '#64748b' }}>{s[campo]}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )

          return (
            <>
              {todosEventos.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                  <p style={{ fontSize: '3rem', margin: '0 0 0.5rem' }}>📊</p>
                  <p style={{ color: '#64748b', fontWeight: 600 }}>Nenhum evento registrado</p>
                  <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginTop: '0.25rem' }}>Lance os gols e cartões na aba Jogos</p>
                </div>
              ) : (
                <>
                  <RankingBloco titulo="Artilharia" icon="⚽" cor="#16a34a" bg="#dcfce7" lista={artilheiros} campo="gols" label="Gols" />
                  <RankingBloco titulo="Assistências" icon="🅰️" cor="#2563eb" bg="#dbeafe" lista={assistentes} campo="assistencias" label="Assist." />
                  <RankingBloco titulo="Cartões" icon="🟨" cor="#ca8a04" bg="#fef9c3" lista={cartoes} campo="amarelos" label="Amarelos" />
                </>
              )}
            </>
          )
        })()}

        {/* ======================== TAB: ENCERRAR ======================== */}
        {activeTab === 'encerrar' && isAdmin && (
          <>
            {isFinished ? (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-5 text-center">
                <div className="text-4xl mb-2">✅</div>
                <p className="text-green-700 font-bold">Rodada encerrada!</p>
                <p className="text-green-600 text-sm mt-1">Votações abertas para os {membros.filter(m => m.checked_in).length} jogadores presentes.</p>
              </div>
            ) : (
              <>
                <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm space-y-3">
                  <h3 className="font-bold text-gray-800">Resumo da rodada</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-50 rounded-xl p-3 text-center">
                      <p className="text-2xl font-bold text-gray-700">{membros.filter(m => m.checked_in).length}</p>
                      <p className="text-xs text-gray-400">Jogadores</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3 text-center">
                      <p className="text-2xl font-bold text-gray-700">{convidados.filter(c => c.checked_in).length}</p>
                      <p className="text-xs text-gray-400">Convidados</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3 text-center">
                      <p className="text-2xl font-bold text-gray-700">{timesCount}</p>
                      <p className="text-xs text-gray-400">Times</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3 text-center">
                      <p className="text-2xl font-bold text-gray-700">{jogos.length}</p>
                      <p className="text-xs text-gray-400">Jogos</p>
                    </div>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                  <p className="text-amber-800 font-semibold text-sm">⚠️ Ao encerrar:</p>
                  <ul className="text-amber-700 text-sm mt-2 space-y-1">
                    <li>• Votações de <strong>Craque</strong> e <strong>Bola Murcha</strong> abertas por 4h</li>
                    <li>• Apenas membros do grupo votam e são votados</li>
                    <li>• Convidados ficam fora das votações</li>
                  </ul>
                </div>

                <button onClick={handleEncerrarRodada} disabled={saving === 'encerrar'}
                  className="w-full bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2 text-base">
                  <Flag size={20} />
                  {saving === 'encerrar' ? 'Encerrando...' : 'Encerrar Rodada'}
                </button>
              </>
            )}
          </>
        )}
      </div>
      {/* ======================== MODAL CONFIGURAÇÕES ======================== */}
      {modalConfig && (
        <>
          {/* Overlay */}
          <div onClick={() => setModalConfig(false)}
            style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 50 }} />

          {/* Modal */}
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 51,
            backgroundColor: 'white', borderRadius: '1.5rem 1.5rem 0 0',
            padding: '1.5rem', paddingBottom: '2.5rem',
            boxShadow: '0 -4px 32px rgba(0,0,0,0.15)',
          }}>
            {/* Header modal */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>⚙️ Configurar Rodada</h2>
              <button onClick={() => setModalConfig(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Nome */}
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '6px' }}>
                  Nome da rodada
                </label>
                <input
                  value={editNome}
                  onChange={e => setEditNome(e.target.value)}
                  placeholder="Ex: Rodada de quarta"
                  style={{
                    width: '100%', padding: '0.75rem 1rem', borderRadius: '0.75rem',
                    border: '2px solid #e2e8f0', fontSize: '0.9rem', outline: 'none',
                    boxSizing: 'border-box',
                  }}
                  onFocus={e => e.target.style.borderColor = '#16a34a'}
                  onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                />
              </div>

              {/* Data */}
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '6px' }}>
                  Data
                </label>
                <input
                  type="date"
                  value={editData}
                  onChange={e => setEditData(e.target.value)}
                  style={{
                    width: '100%', padding: '0.75rem 1rem', borderRadius: '0.75rem',
                    border: '2px solid #e2e8f0', fontSize: '0.9rem', outline: 'none',
                    boxSizing: 'border-box',
                  }}
                  onFocus={e => e.target.style.borderColor = '#16a34a'}
                  onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                />
              </div>

              {/* Horário */}
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '6px' }}>
                  Horário
                </label>
                <input
                  type="time"
                  value={editHorario}
                  onChange={e => setEditHorario(e.target.value)}
                  style={{
                    width: '100%', padding: '0.75rem 1rem', borderRadius: '0.75rem',
                    border: '2px solid #e2e8f0', fontSize: '0.9rem', outline: 'none',
                    boxSizing: 'border-box',
                  }}
                  onFocus={e => e.target.style.borderColor = '#16a34a'}
                  onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                />
              </div>

              {/* Botão salvar */}
              <button onClick={handleSalvarConfig} disabled={savingConfig || !editNome.trim()}
                style={{
                  width: '100%', padding: '0.875rem', borderRadius: '0.875rem', border: 'none',
                  background: savingConfig || !editNome.trim() ? '#e2e8f0' : 'linear-gradient(135deg, #16a34a, #15803d)',
                  color: savingConfig || !editNome.trim() ? '#94a3b8' : 'white',
                  fontWeight: 700, fontSize: '0.95rem', cursor: savingConfig || !editNome.trim() ? 'not-allowed' : 'pointer',
                }}>
                {savingConfig ? 'Salvando...' : '💾 Salvar alterações'}
              </button>

              {/* Divisor */}
              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem' }}>
                <button onClick={handleExcluirRodada} disabled={savingConfig}
                  style={{
                    width: '100%', padding: '0.875rem', borderRadius: '0.875rem', border: '2px solid #fee2e2',
                    backgroundColor: '#fff5f5', color: '#dc2626',
                    fontWeight: 700, fontSize: '0.95rem', cursor: savingConfig ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  }}>
                  <Trash2 size={16} />
                  Excluir rodada
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// Componente auxiliar para exibir times
function TimesDisplay({ roundId }: { roundId: string }) {
  const supabase = createClient()
  const [times, setTimes] = useState<any[]>([])
  // mapa: user_id -> nome de quem saiu (substituição)
  const [subMap, setSubMap] = useState<Record<string, string>>({})

  useEffect(() => {
    async function load() {
      const { data: timesData } = await supabase
        .from('teams')
        .select('*, team_players(*, profile:profiles(full_name))')
        .eq('round_id', roundId)
      setTimes(timesData ?? [])

      // Busca eventos de substituição da rodada para mostrar "entrou no lugar de X"
      const { data: subs } = await supabase
        .from('match_events')
        .select('user_id, attendance_id, sub_out_name, is_guest, guest_name')
        .eq('round_id', roundId)
        .eq('event_type', 'substitution')

      const map: Record<string, string> = {}
      for (const s of subs ?? []) {
        if (s.sub_out_name) {
          // chave: user_id ou attendance_id para convidados
          const key = s.is_guest ? s.attendance_id : s.user_id
          if (key) map[key] = s.sub_out_name
        }
      }
      setSubMap(map)
    }
    load()
  }, [roundId])

  return (
    <>
      {times.map(time => (
        <div key={time.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 flex items-center gap-2 border-b border-gray-50"
            style={{ borderLeft: `4px solid ${time.color ?? '#16a34a'}` }}>
            <p className="font-bold text-gray-800">{time.name}</p>
            <span className="text-xs text-gray-400">({time.team_players?.length ?? 0} jogadores)</span>
          </div>
          {(time.team_players ?? []).map((tp: any) => {
            const nome = tp.profile?.full_name ?? tp.guest_name ?? 'Jogador'
            const chave = tp.is_guest ? tp.attendance_id : tp.user_id
            const subOutName = subMap[chave]
            return (
              <div key={tp.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-50 last:border-0">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                  style={{ backgroundColor: subOutName ? '#7c3aed' : (time.color ?? '#16a34a') }}>
                  {subOutName ? '🔄' : nome[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700">
                    {nome}
                    {tp.is_guest && <span className="ml-1 text-xs text-blue-400">(convidado)</span>}
                  </p>
                  {subOutName && (
                    <p className="text-xs text-purple-500 font-medium">
                      🔄 entrou no lugar de {subOutName.split(' ')[0]}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ))}
    </>
  )
}
