'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Settings, Users, Copy, Check, Trophy, AlertTriangle, X, Star, Target, Calendar } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import type { Group, Season, Round, MemberRole } from '@/lib/types'
import { formatDateShort, formatTime, getRoundStatusLabel, copyToClipboard } from '@/lib/utils'
import ModalCriarTemporada from '@/components/grupos/ModalCriarTemporada'

interface GroupData {
  group: Group
  season: Season | null
  nextRound: Round | null
  myRole: MemberRole
  memberCount: number
}

export default function GrupoDashboard() {
  const { groupId } = useParams<{ groupId: string }>()
  const router = useRouter()
  const supabase = createClient()
  const { profile } = useAuthStore()

  const [data, setData] = useState<GroupData | null>(null)
  const [loading, setLoading] = useState(true)
  const [copiado, setCopiado] = useState(false)
  const [modalTemporada, setModalTemporada] = useState(false)
  const [top5, setTop5] = useState<{ user_id: string; nome: string; foto: string | null; initials: string; media: number }[]>([])
  const [topArtilheiros, setTopArtilheiros] = useState<{ user_id: string; nome: string; foto: string | null; initials: string; gols: number }[]>([])
  const [enquetesAbertas, setEnquetesAbertas] = useState<{ id: string; title: string; closes_at: string }[]>([])
  const [ultimoCraque, setUltimoCraque] = useState<{ nome: string; foto: string | null; initials: string; rodada: string } | null>(null)
  const [ultimoParedao, setUltimoParedao] = useState<{ nome: string; foto: string | null; initials: string; rodada: string } | null>(null)
  const [rodadaNotasAberta, setRodadaNotasAberta] = useState<{ id: string; title: string } | null>(null)
  const [minhaNotaInfo, setMinhaNotaInfo] = useState<{ media: number; posicao: number } | null>(null)
  const [modalMembros, setModalMembros] = useState(false)
  const [membrosLista, setMembrosLista] = useState<any[]>([])
  const [loadingMembros, setLoadingMembros] = useState(false)
  const [membroSelecionado, setMembroSelecionado] = useState<any | null>(null)
  const [statsMembro, setStatsMembro] = useState<{ gols: number; presencas: number; media_nota: number } | null>(null)

  useEffect(() => { fetchData() }, [groupId])

  async function abrirModalMembros() {
    setModalMembros(true)
    if (membrosLista.length > 0) return
    setLoadingMembros(true)

    const { data } = await supabase
      .from('group_members')
      .select('user_id, role, profiles(full_name, photo_url, bio, position_1, position_2, position_3)')
      .eq('group_id', groupId)
      .eq('is_active', true)
      .order('role', { ascending: true })

    setMembrosLista(data ?? [])
    setLoadingMembros(false)
  }

  async function abrirMembro(membro: any) {
    setMembroSelecionado(membro)
    setStatsMembro(null)

    const { data: season } = await supabase
      .from('seasons').select('id')
      .eq('group_id', groupId).eq('status', 'active').single()

    if (!season) return

    // Gols
    const { data: roundIds } = await supabase
      .from('rounds').select('id').eq('group_id', groupId)

    const ids = roundIds?.map((r: any) => r.id) ?? []

    const { count: gols } = await supabase
      .from('match_events')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', membro.user_id)
      .eq('event_type', 'goal')
      .in('round_id', ids)

    // Presenças
    const { count: presencas } = await supabase
      .from('round_attendance')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', membro.user_id)
      .eq('checked_in', true)
      .in('round_id', ids)

    // Nota média
    const { data: notas } = await supabase
      .from('player_ratings')
      .select('rating')
      .eq('rated_id', membro.user_id)
      .eq('season_id', season.id)

    const media_nota = notas && notas.length > 0
      ? Math.round(notas.reduce((s: number, n: any) => s + n.rating, 0) / notas.length)
      : 0

    setStatsMembro({ gols: gols ?? 0, presencas: presencas ?? 0, media_nota })
  }

  async function fetchData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: memberData } = await supabase
      .from('group_members')
      .select('role, groups(*)')
      .eq('group_id', groupId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (!memberData) { router.push('/grupos'); return }

    const group = memberData.groups as unknown as Group

    const { data: season } = await supabase
      .from('seasons').select('*')
      .eq('group_id', groupId).eq('status', 'active').single()

    const { data: nextRound } = await supabase
      .from('rounds').select('*')
      .eq('group_id', groupId)
      .in('status', ['scheduled', 'ongoing'])
      .order('scheduled_date', { ascending: true })
      .limit(1).single()

    const { count: memberCount } = await supabase
      .from('group_members')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', groupId).eq('is_active', true)

    setData({
      group,
      season: season ?? null,
      nextRound: nextRound ?? null,
      myRole: memberData.role as MemberRole,
      memberCount: memberCount ?? 0,
    })

    // Top 5 notas da temporada ativa
    if (season) {
      // Total de rodadas finalizadas da temporada
      const { data: rodadasFinalizadas } = await supabase
        .from('rounds').select('id')
        .eq('group_id', groupId).eq('season_id', season.id).eq('status', 'finished')
      const totalRodadas = (rodadasFinalizadas ?? []).length
      const minimoRodadas = Math.ceil(totalRodadas * 0.4)

      // Presenças por jogador na temporada
      const { data: presencas } = await supabase
        .from('round_attendance').select('user_id')
        .in('round_id', (rodadasFinalizadas ?? []).map(r => r.id))
        .eq('checked_in', true).eq('is_guest', false)
      const presencasMap: Record<string, number> = {}
      for (const p of presencas ?? []) {
        presencasMap[p.user_id] = (presencasMap[p.user_id] ?? 0) + 1
      }

      const { data: ratingsRaw } = await supabase
        .from('player_ratings')
        .select('rated_id, rating, profile:profiles!player_ratings_rated_id_fkey(full_name, photo_url)')
        .eq('season_id', season.id)

      if (ratingsRaw && ratingsRaw.length > 0) {
        const mapaNotas: Record<string, { soma: number; total: number; nome: string; foto: string | null }> = {}
        for (const r of ratingsRaw) {
          const prof = r.profile as any
          if (!mapaNotas[r.rated_id]) {
            mapaNotas[r.rated_id] = { soma: 0, total: 0, nome: prof?.full_name ?? 'Jogador', foto: prof?.photo_url ?? null }
          }
          mapaNotas[r.rated_id].soma += r.rating
          mapaNotas[r.rated_id].total++
        }

        // Lista consolidada — só quem atingiu 40% de presença
        const lista = Object.entries(mapaNotas)
          .filter(([uid]) => (presencasMap[uid] ?? 0) >= minimoRodadas)
          .map(([uid, d]) => ({
            user_id: uid, nome: d.nome, foto: d.foto,
            initials: d.nome.split(' ').map((n: string) => n[0]).slice(0, 2).join(''),
            media: Math.round(d.soma / d.total),
          }))
          .sort((a, b) => b.media - a.media)
          .slice(0, 3)
        setTop5(lista)

        // Minha nota — sem filtro de presença (o jogador vê sua própria nota sempre)
        const todasNotas = Object.entries(mapaNotas)
          .filter(([uid]) => (presencasMap[uid] ?? 0) >= minimoRodadas)
          .map(([uid, d]) => ({ user_id: uid, media: Math.round(d.soma / d.total) }))
          .sort((a, b) => b.media - a.media)
        const minhaPosicao = todasNotas.findIndex(n => n.user_id === user.id)
        const meusDadosRaw = mapaNotas[user.id]
        if (meusDadosRaw) {
          const minhaMedia = Math.round(meusDadosRaw.soma / meusDadosRaw.total)
          const apto = (presencasMap[user.id] ?? 0) >= minimoRodadas
          setMinhaNotaInfo({
            media: minhaMedia,
            posicao: apto ? minhaPosicao + 1 : -1, // -1 = não apto
          })
        }
      }

      // Top 3 artilheiros da temporada
      const { data: eventosRaw } = await supabase
        .from('match_events')
        .select('user_id, profile:profiles!match_events_user_id_fkey(full_name, photo_url)')
        .eq('event_type', 'goal')
        .eq('is_guest', false)
        .in('round_id',
          (await supabase.from('rounds').select('id').eq('group_id', groupId).eq('season_id', season.id)).data?.map((r: any) => r.id) ?? []
        )

      if (eventosRaw && eventosRaw.length > 0) {
        const golsMap: Record<string, { nome: string; foto: string | null; gols: number }> = {}
        for (const ev of eventosRaw) {
          if (!ev.user_id) continue
          const prof = ev.profile as any
          if (!golsMap[ev.user_id]) golsMap[ev.user_id] = { nome: prof?.full_name ?? 'Jogador', foto: prof?.photo_url ?? null, gols: 0 }
          golsMap[ev.user_id].gols++
        }
        const artilheiros = Object.entries(golsMap)
          .map(([uid, d]) => ({ user_id: uid, nome: d.nome, foto: d.foto, initials: d.nome.split(' ').map((n: string) => n[0]).slice(0, 2).join(''), gols: d.gols }))
          .sort((a, b) => b.gols - a.gols)
          .slice(0, 3)
        setTopArtilheiros(artilheiros)
      }

      // Último craque da rodada (fechada ou com prazo expirado)
      const { data: ultimaPoll } = await supabase
        .from('polls')
        .select('id, round_id, rounds(title, scheduled_date)')
        .eq('group_id', groupId)
        .eq('type', 'craque')
        .lt('closes_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (ultimaPoll) {
        const { data: opcoes } = await supabase
          .from('poll_options')
          .select('id, user_id, label, profile:profiles(full_name, photo_url)')
          .eq('poll_id', ultimaPoll.id)

        const { data: votos } = await supabase
          .from('poll_votes').select('option_id').eq('poll_id', ultimaPoll.id)

        if (opcoes && opcoes.length > 0) {
          const contagem: Record<string, number> = {}
          for (const v of votos ?? []) contagem[v.option_id] = (contagem[v.option_id] ?? 0) + 1
          const vencedor = opcoes.reduce((a: any, b: any) => (contagem[b.id] ?? 0) > (contagem[a.id] ?? 0) ? b : a)
          const prof = vencedor.profile as any
          const nome = prof?.full_name ?? vencedor.label ?? 'Jogador'
          const round = ultimaPoll.rounds as any
          const dataRodada = round?.scheduled_date
            ? new Date(round.scheduled_date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
            : ''
          setUltimoCraque({
            nome,
            foto: prof?.photo_url ?? null,
            initials: nome.split(' ').map((n: string) => n[0]).slice(0, 2).join(''),
            rodada: round?.title ?? `Rodada de ${dataRodada}`,
          })
        }
      }
    }

    // Último paredão da rodada (fechada ou com prazo expirado)
    if (season) {
      const { data: ultimaPollParedao } = await supabase
        .from('polls')
        .select('id, round_id, rounds(title, scheduled_date)')
        .eq('group_id', groupId)
        .eq('type', 'paredao')
        .lt('closes_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (ultimaPollParedao) {
        const { data: opcoesParedao } = await supabase
          .from('poll_options')
          .select('id, user_id, label, profile:profiles(full_name, photo_url)')
          .eq('poll_id', ultimaPollParedao.id)

        const { data: votosParedao } = await supabase
          .from('poll_votes').select('option_id').eq('poll_id', ultimaPollParedao.id)

        if (opcoesParedao && opcoesParedao.length > 0) {
          const contagemP: Record<string, number> = {}
          for (const v of votosParedao ?? []) contagemP[v.option_id] = (contagemP[v.option_id] ?? 0) + 1
          const vencedorP = opcoesParedao.reduce((a: any, b: any) => (contagemP[b.id] ?? 0) > (contagemP[a.id] ?? 0) ? b : a)
          const profP = vencedorP.profile as any
          const nomeP = profP?.full_name ?? vencedorP.label ?? 'Goleiro'
          const roundP = ultimaPollParedao.rounds as any
          const dataRodadaP = roundP?.scheduled_date
            ? new Date(roundP.scheduled_date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
            : ''
          setUltimoParedao({
            nome: nomeP,
            foto: profP?.photo_url ?? null,
            initials: nomeP.split(' ').map((n: string) => n[0]).slice(0, 2).join(''),
            rodada: roundP?.title ?? `Rodada de ${dataRodadaP}`,
          })
        }
      }
    }

    // Enquetes abertas
    if (season) {
      const agora = new Date().toISOString()
      const { data: pollsAbertas } = await supabase
        .from('polls')
        .select('id, title, closes_at')
        .eq('group_id', groupId)
        .eq('season_id', season.id)
        .eq('is_closed', false)
        .gt('closes_at', agora)
        .order('closes_at', { ascending: true })
      setEnquetesAbertas(pollsAbertas ?? [])

      // Rodada finalizada recentemente com janela de notas aberta (4h após encerramento)
      const { data: rodadaRecente } = await supabase
        .from('rounds')
        .select('id, title, scheduled_date, finished_at')
        .eq('group_id', groupId)
        .eq('status', 'finished')
        .not('finished_at', 'is', null)
        .gt('finished_at', new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString())
        .order('finished_at', { ascending: false })
        .limit(1)
        .single()

      if (rodadaRecente) {
        setRodadaNotasAberta({
          id: rodadaRecente.id,
          title: rodadaRecente.title ?? `Rodada de ${new Date(rodadaRecente.scheduled_date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long' })}`,
        })
      }
    }

    setLoading(false)
  }

  async function handleCopiarCodigo() {
    if (!data) return
    const ok = await copyToClipboard(data.group.invite_code)
    if (ok) { setCopiado(true); setTimeout(() => setCopiado(false), 2000) }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3 animate-bounce">⚽</div>
          <p className="text-gray-400 text-sm">Carregando...</p>
        </div>
      </div>
    )
  }

  if (!data) return null
  const { group, season, nextRound, myRole, memberCount } = data
  const isAdmin = myRole === 'admin'

  const menuItems = [
    { icon: '📅', label: 'Rodadas', desc: 'Ver todas as rodadas', href: `/grupos/${groupId}/rodadas` },
    { icon: '🏆', label: 'Estatísticas', desc: 'Rankings e artilharia', href: `/grupos/${groupId}/estatisticas` },
    { icon: '🗳️', label: 'Enquetes', desc: 'Votações e enquetes', href: `/grupos/${groupId}/enquetes` },
    { icon: '🏁', label: 'Histórico', desc: 'Temporadas encerradas', href: `/grupos/${groupId}/historico` },
    { icon: '💬', label: 'Chat', desc: 'Conversa do grupo', href: `/grupos/${groupId}/chat` },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header verde */}
      <div className="bg-green-600 pt-12 pb-8 px-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => router.push('/grupos')} className="text-green-200 hover:text-white transition-colors">
              <ArrowLeft size={22} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button onClick={abrirModalMembros}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', backgroundColor: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: '9999px', padding: '5px 12px', color: 'white', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}>
                <Users size={13} />
                Membros
              </button>
              {isAdmin && (
                <button onClick={() => router.push(`/grupos/${groupId}/configuracoes`)} className="text-green-200 hover:text-white transition-colors">
                  <Settings size={22} />
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0">⚽</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 className="text-white text-xl font-bold">{group.name}</h1>
              {group.city && <p className="text-green-200 text-sm">📍 {group.city}</p>}
              <div className="flex items-center gap-3 mt-1">
                <span className="text-green-200 text-xs flex items-center gap-1">
                  <Users size={11} /> {memberCount} jogadores
                </span>
                {isAdmin && <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full">Admin</span>}
              </div>
            </div>
            {/* Badge minha nota — simétrico ao ⚽ */}
            {minhaNotaInfo && (
              <div style={{ width: '4rem', height: '4rem', backgroundColor: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer' }}
                onClick={() => router.push(`/grupos/${groupId}/estatisticas`)}>
                <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.5rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 1px' }}>Nota</p>
                <p style={{ color: 'white', fontSize: '1.25rem', fontWeight: 900, margin: 0, lineHeight: 1 }}>{minhaNotaInfo.media}</p>
                <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.5rem', fontWeight: 600, margin: '2px 0 0', textAlign: 'center' }}>
                  {minhaNotaInfo.posicao === -1 ? 'poucos jogos' : `${minhaNotaInfo.posicao}º do grupo`}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-4 space-y-4 pb-6">

        {/* BANNER ONBOARDING — admin sem temporada */}
        {!season && isAdmin && (
          <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl p-5 shadow-lg">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <Trophy size={24} className="text-white" />
              </div>
              <div className="flex-1">
                <p className="text-white font-bold text-base leading-tight">
                  🚀 Primeiro passo: inicie a temporada!
                </p>
                <p className="text-amber-100 text-sm mt-1.5 leading-relaxed">
                  Sem temporada ativa não é possível criar rodadas nem registrar estatísticas. Comece agora!
                </p>
                <button
                  onClick={() => setModalTemporada(true)}
                  className="mt-4 bg-white text-amber-600 font-bold px-5 py-3 rounded-xl text-sm hover:bg-amber-50 transition-all active:scale-95 w-full shadow-sm"
                >
                  🏆 Criar Temporada {new Date().getFullYear()}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Aviso para jogador sem temporada */}
        {!season && !isAdmin && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
            <AlertTriangle size={20} className="text-amber-500 flex-shrink-0" />
            <div>
              <p className="text-amber-800 font-semibold text-sm">Nenhuma temporada ativa</p>
              <p className="text-amber-600 text-xs mt-0.5">Aguarde o administrador iniciar a temporada.</p>
            </div>
          </div>
        )}

        {/* Temporada ativa */}
        {season && (
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center text-xl">🏆</div>
              <div>
                <p className="text-xs text-gray-400 font-medium">Temporada ativa</p>
                <p className="font-bold text-gray-800">{season.name}</p>
              </div>
            </div>
          </div>
        )}

        {/* Próxima rodada */}
        {nextRound ? (
          <div
            className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm cursor-pointer hover:shadow-md transition-all"
            onClick={() => router.push(`/grupos/${groupId}/rodadas/${nextRound.id}`)}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-green-600 uppercase tracking-wide">📅 Próxima Rodada</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${nextRound.status === 'ongoing' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                {getRoundStatusLabel(nextRound.status)}
              </span>
            </div>
            <p className="font-bold text-gray-800 text-lg">
              {nextRound.title ?? `Rodada de ${formatDateShort(nextRound.scheduled_date)}`}
            </p>
            <p className="text-gray-500 text-sm mt-1">
              🗓 {formatDateShort(nextRound.scheduled_date)} às {formatTime(nextRound.start_time)}
            </p>
          </div>
        ) : season ? (
          <div className="bg-white rounded-2xl p-4 border border-dashed border-gray-200 text-center">
            <p className="text-gray-400 text-sm">Nenhuma rodada agendada</p>
            {isAdmin && (
              <button onClick={() => router.push(`/grupos/${groupId}/rodadas`)} className="text-green-600 text-sm font-semibold mt-1 hover:underline">
                + Criar rodada
              </button>
            )}
          </div>
        ) : null}

        {/* Banner enquetes abertas + notas */}
        {(enquetesAbertas.length > 0 || rodadaNotasAberta) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {/* Banner notas */}
            {rodadaNotasAberta && (
              <button
                onClick={() => router.push(`/grupos/${groupId}/rodadas/${rodadaNotasAberta.id}/notas`)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.875rem', background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', border: 'none', borderRadius: '1rem', padding: '0.875rem 1rem', cursor: 'pointer', textAlign: 'left', boxShadow: '0 4px 16px rgba(124,58,237,0.3)' }}>
                <div style={{ width: '2.5rem', height: '2.5rem', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '1.25rem' }}>⭐</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 2px' }}>
                    ⏰ Janela aberta — 4h após a rodada
                  </p>
                  <p style={{ color: 'white', fontSize: '0.875rem', fontWeight: 700, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    Dar notas — {rodadaNotasAberta.title}
                  </p>
                </div>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '1.25rem', flexShrink: 0 }}>›</span>
              </button>
            )}
            {/* Banners enquetes */}
            {enquetesAbertas.slice(0, 3).map(poll => (
              <button key={poll.id}
                onClick={() => router.push(`/grupos/${groupId}/enquetes/${poll.id}`)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.875rem', background: 'linear-gradient(135deg, #0f172a, #1e293b)', border: 'none', borderRadius: '1rem', padding: '0.875rem 1rem', cursor: 'pointer', textAlign: 'left', boxShadow: '0 4px 16px rgba(15,23,42,0.25)' }}>
                <div style={{ width: '2.5rem', height: '2.5rem', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '1.25rem' }}>🗳️</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 2px' }}>
                    🔔 Enquete aberta — vote agora!
                  </p>
                  <p style={{ color: 'white', fontSize: '0.875rem', fontWeight: 700, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {poll.title}
                  </p>
                </div>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '1.25rem', flexShrink: 0 }}>›</span>
              </button>
            ))}
            {enquetesAbertas.length > 3 && (
              <button onClick={() => router.push(`/grupos/${groupId}/enquetes`)}
                style={{ width: '100%', padding: '0.625rem', backgroundColor: 'transparent', border: '1px dashed #cbd5e1', borderRadius: '0.875rem', color: '#64748b', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>
                +{enquetesAbertas.length - 3} enquete{enquetesAbertas.length - 3 !== 1 ? 's' : ''} abertas — ver todas
              </button>
            )}
          </div>
        )}

        {/* Último Craque da Rodada */}
        {ultimoCraque && (
          <div style={{
            background: 'linear-gradient(135deg, #f59e0b, #d97706)',
            borderRadius: '1rem', padding: '1rem', boxShadow: '0 4px 16px rgba(245,158,11,0.3)',
            display: 'flex', alignItems: 'center', gap: '1rem',
          }}>
            {/* Avatar */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div style={{ width: '3.5rem', height: '3.5rem', borderRadius: '9999px', backgroundColor: 'rgba(255,255,255,0.2)', border: '3px solid rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {ultimoCraque.foto
                  ? <img src={ultimoCraque.foto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ fontSize: '1rem', fontWeight: 700, color: 'white' }}>{ultimoCraque.initials}</span>}
              </div>
              <div style={{ position: 'absolute', bottom: '-4px', right: '-4px', fontSize: '1.1rem' }}>🏆</div>
            </div>
            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 2px' }}>
                ⭐ Craque da última rodada
              </p>
              <p style={{ color: 'white', fontSize: '1rem', fontWeight: 800, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {ultimoCraque.nome}
              </p>
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.72rem', margin: '2px 0 0' }}>
                {ultimoCraque.rodada}
              </p>
            </div>
          </div>
        )}

        {/* Último Paredão da Rodada */}
        {ultimoParedao && (
          <div style={{
            background: 'linear-gradient(135deg, #0891b2, #0e7490)',
            borderRadius: '1rem', padding: '1rem', boxShadow: '0 4px 16px rgba(8,145,178,0.3)',
            display: 'flex', alignItems: 'center', gap: '1rem',
          }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div style={{ width: '3.5rem', height: '3.5rem', borderRadius: '9999px', backgroundColor: 'rgba(255,255,255,0.2)', border: '3px solid rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {ultimoParedao.foto
                  ? <img src={ultimoParedao.foto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ fontSize: '1rem', fontWeight: 700, color: 'white' }}>{ultimoParedao.initials}</span>}
              </div>
              <div style={{ position: 'absolute', bottom: '-4px', right: '-4px', fontSize: '1.1rem' }}>🧤</div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 2px' }}>
                🧤 Paredão da última rodada
              </p>
              <p style={{ color: 'white', fontSize: '1rem', fontWeight: 800, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {ultimoParedao.nome}
              </p>
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.72rem', margin: '2px 0 0' }}>
                {ultimoParedao.rodada}
              </p>
            </div>
          </div>
        )}

        {/* Top 3 Notas da Temporada */}
        {top5.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9', background: 'linear-gradient(135deg, #7c3aed11, #6d28d911)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.1rem' }}>⭐</span>
                <div>
                  <p style={{ fontSize: '0.8rem', fontWeight: 700, color: '#5b21b6', margin: 0 }}>Top Notas da Temporada</p>
                  <p style={{ fontSize: '0.65rem', color: '#7c3aed', margin: 0 }}>Média geral das avaliações</p>
                </div>
              </div>
              <button onClick={() => router.push(`/grupos/${groupId}/estatisticas`)}
                style={{ fontSize: '0.7rem', fontWeight: 700, color: '#7c3aed', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', backgroundColor: '#ede9fe', borderRadius: '0.5rem' }}>
                Ver mais ›
              </button>
            </div>
            {top5.map((j, i) => {
              const medalha = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null
              const notaCor = j.media >= 80 ? '#15803d' : j.media >= 60 ? '#1d4ed8' : j.media >= 40 ? '#a16207' : '#b91c1c'
              const notaBg = j.media >= 80 ? '#dcfce7' : j.media >= 60 ? '#dbeafe' : j.media >= 40 ? '#fef9c3' : '#fee2e2'
              return (
                <div key={j.user_id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem 1rem', borderBottom: i < top5.length - 1 ? '1px solid #f8fafc' : 'none', backgroundColor: i === 0 ? '#faf5ff' : 'white' }}>
                  <div style={{ width: '1.5rem', textAlign: 'center', flexShrink: 0 }}>
                    {medalha ? <span style={{ fontSize: '1rem' }}>{medalha}</span> : <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8' }}>#{i + 1}</span>}
                  </div>
                  <div style={{ width: '2rem', height: '2rem', borderRadius: '9999px', backgroundColor: '#ede9fe', border: '2px solid #7c3aed33', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                    {j.foto
                      ? <img src={j.foto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span style={{ fontSize: '0.6rem', fontWeight: 700, color: '#7c3aed' }}>{j.initials}</span>}
                  </div>
                  <p style={{ flex: 1, fontSize: '0.85rem', fontWeight: i === 0 ? 700 : 500, color: '#1e293b', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {j.nome}
                  </p>
                  <div style={{ backgroundColor: notaBg, border: `2px solid ${notaCor}33`, borderRadius: '0.625rem', padding: '3px 10px', flexShrink: 0 }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 900, color: notaCor }}>{j.media}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Top 3 Artilharia da Temporada */}
        {topArtilheiros.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9', background: 'linear-gradient(135deg, #16a34a11, #15803d11)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.1rem' }}>⚽</span>
                <div>
                  <p style={{ fontSize: '0.8rem', fontWeight: 700, color: '#15803d', margin: 0 }}>Artilharia da Temporada</p>
                  <p style={{ fontSize: '0.65rem', color: '#16a34a', margin: 0 }}>Top goleadores</p>
                </div>
              </div>
              <button onClick={() => router.push(`/grupos/${groupId}/estatisticas`)}
                style={{ fontSize: '0.7rem', fontWeight: 700, color: '#16a34a', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', backgroundColor: '#dcfce7', borderRadius: '0.5rem' }}>
                Ver mais ›
              </button>
            </div>
            {topArtilheiros.map((j, i) => {
              const medalha = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'
              return (
                <div key={j.user_id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem 1rem', borderBottom: i < topArtilheiros.length - 1 ? '1px solid #f8fafc' : 'none', backgroundColor: i === 0 ? '#f0fdf4' : 'white' }}>
                  <div style={{ width: '1.5rem', textAlign: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: '1rem' }}>{medalha}</span>
                  </div>
                  <div style={{ width: '2rem', height: '2rem', borderRadius: '9999px', backgroundColor: '#dcfce7', border: '2px solid #16a34a33', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                    {j.foto
                      ? <img src={j.foto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span style={{ fontSize: '0.6rem', fontWeight: 700, color: '#16a34a' }}>{j.initials}</span>}
                  </div>
                  <p style={{ flex: 1, fontSize: '0.85rem', fontWeight: i === 0 ? 700 : 500, color: '#1e293b', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {j.nome}
                  </p>
                  <div style={{ backgroundColor: '#dcfce7', border: '2px solid #16a34a33', borderRadius: '0.625rem', padding: '3px 10px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 900, color: '#15803d' }}>{j.gols}</span>
                    <span style={{ fontSize: '0.65rem', color: '#16a34a', fontWeight: 600 }}>gols</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Menu */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {menuItems.map((item, index) => (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className={`w-full flex items-center gap-4 p-4 hover:bg-gray-50 transition-all text-left ${index < menuItems.length - 1 ? 'border-b border-gray-50' : ''}`}
            >
              <span className="text-2xl w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center flex-shrink-0">{item.icon}</span>
              <div className="flex-1">
                <p className="font-semibold text-gray-800">{item.label}</p>
                <p className="text-xs text-gray-400">{item.desc}</p>
              </div>
              <span className="text-gray-300 text-lg">›</span>
            </button>
          ))}
        </div>

        {/* Código de convite */}
        {isAdmin && (
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <p className="text-xs text-gray-400 font-medium mb-2">Código de convite</p>
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-gray-50 rounded-xl px-4 py-3 text-center">
                <span className="text-xl font-bold tracking-widest text-gray-700">{group.invite_code}</span>
              </div>
              <button
                onClick={handleCopiarCodigo}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold px-4 py-3 rounded-xl transition-all active:scale-95"
              >
                {copiado ? <Check size={16} /> : <Copy size={16} />}
                {copiado ? 'Copiado!' : 'Copiar'}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2 text-center">Compartilhe este código para convidar jogadores</p>
          </div>
        )}
      </div>

      {/* ===== MODAL LISTA DE MEMBROS ===== */}
      {modalMembros && (() => {
        const POSICAO_LABELS: Record<string, string> = {
          goleiro: '🧤 Goleiros', zagueiro: '🛡️ Zagueiros', lateral: '↔️ Laterais',
          volante: '⚙️ Volantes', meia: '🎯 Meias', atacante: '⚡ Atacantes',
        }
        const ORDEM_POS = ['goleiro', 'zagueiro', 'lateral', 'volante', 'meia', 'atacante']

        const porPosicao: Record<string, any[]> = {}
        const semPosicao: any[] = []
        for (const m of membrosLista) {
          const pos = m.profiles?.position_1
          if (pos && POSICAO_LABELS[pos]) {
            if (!porPosicao[pos]) porPosicao[pos] = []
            porPosicao[pos].push(m)
          } else {
            semPosicao.push(m)
          }
        }

        return (
          <>
            <div onClick={() => { setModalMembros(false); setMembroSelecionado(null) }}
              style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 50 }} />
            <div style={{ position: 'fixed', inset: 0, zIndex: 51, display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc', maxWidth: '640px', margin: '0 auto' }}>
              {/* Header */}
              <div style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', padding: '3rem 1rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h2 style={{ color: 'white', fontWeight: 800, fontSize: '1.1rem', margin: 0 }}>👥 Membros do Grupo</h2>
                  <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', margin: '2px 0 0' }}>{membrosLista.length} jogadores</p>
                </div>
                <button onClick={() => setModalMembros(false)}
                  style={{ background: 'rgba(0,0,0,0.2)', border: 'none', borderRadius: '9999px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white' }}>
                  <X size={16} />
                </button>
              </div>

              {/* Lista */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
                {loadingMembros ? (
                  <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>Carregando...</div>
                ) : (
                  <>
                    {ORDEM_POS.filter(p => porPosicao[p]?.length > 0).map(pos => (
                      <div key={pos} style={{ marginBottom: '1.25rem' }}>
                        <p style={{ fontSize: '0.72rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 0.5rem', paddingLeft: '0.25rem' }}>
                          {POSICAO_LABELS[pos]} ({porPosicao[pos].length})
                        </p>
                        <div style={{ backgroundColor: 'white', borderRadius: '1rem', overflow: 'hidden', border: '1px solid #f1f5f9', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                          {porPosicao[pos].map((m: any, i: number) => {
                            const nome = m.profiles?.full_name ?? 'Jogador'
                            const foto = m.profiles?.photo_url
                            const initials = nome.split(' ').map((n: string) => n[0]).slice(0, 2).join('')
                            return (
                              <button key={m.user_id} onClick={() => abrirMembro(m)}
                                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', border: 'none', background: 'none', cursor: 'pointer', borderBottom: i < porPosicao[pos].length - 1 ? '1px solid #f8fafc' : 'none', textAlign: 'left' }}>
                                <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '9999px', backgroundColor: '#f1f5f9', border: '2px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                                  {foto ? <img src={foto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>{initials}</span>}
                                </div>
                                <div style={{ flex: 1 }}>
                                  <p style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>{nome}</p>
                                  {m.role === 'admin' && <span style={{ fontSize: '0.65rem', color: '#16a34a', fontWeight: 700 }}>👑 Admin</span>}
                                </div>
                                <span style={{ color: '#cbd5e1', fontSize: '0.8rem' }}>›</span>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                    {semPosicao.length > 0 && (
                      <div style={{ marginBottom: '1.25rem' }}>
                        <p style={{ fontSize: '0.72rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 0.5rem', paddingLeft: '0.25rem' }}>
                          ⚽ Outros ({semPosicao.length})
                        </p>
                        <div style={{ backgroundColor: 'white', borderRadius: '1rem', overflow: 'hidden', border: '1px solid #f1f5f9', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                          {semPosicao.map((m: any, i: number) => {
                            const nome = m.profiles?.full_name ?? 'Jogador'
                            const foto = m.profiles?.photo_url
                            const initials = nome.split(' ').map((n: string) => n[0]).slice(0, 2).join('')
                            return (
                              <button key={m.user_id} onClick={() => abrirMembro(m)}
                                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', border: 'none', background: 'none', cursor: 'pointer', borderBottom: i < semPosicao.length - 1 ? '1px solid #f8fafc' : 'none', textAlign: 'left' }}>
                                <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '9999px', backgroundColor: '#f1f5f9', border: '2px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                                  {foto ? <img src={foto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>{initials}</span>}
                                </div>
                                <div style={{ flex: 1 }}>
                                  <p style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>{nome}</p>
                                  {m.role === 'admin' && <span style={{ fontSize: '0.65rem', color: '#16a34a', fontWeight: 700 }}>👑 Admin</span>}
                                </div>
                                <span style={{ color: '#cbd5e1', fontSize: '0.8rem' }}>›</span>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* ===== MODAL PERFIL DO MEMBRO ===== */}
            {membroSelecionado && (
              <>
                <div onClick={() => setMembroSelecionado(null)}
                  style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 60 }} />
                <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, maxWidth: '640px', margin: '0 auto', zIndex: 61, backgroundColor: 'white', borderRadius: '1.5rem 1.5rem 0 0', padding: '1.5rem', paddingBottom: '3rem', boxShadow: '0 -8px 40px rgba(0,0,0,0.2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
                    <div style={{ width: '40px', height: '4px', backgroundColor: '#e2e8f0', borderRadius: '9999px' }} />
                  </div>

                  {/* Foto e nome */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                    <div style={{ width: '5rem', height: '5rem', borderRadius: '9999px', backgroundColor: '#f1f5f9', border: '3px solid #16a34a', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {membroSelecionado.profiles?.photo_url
                        ? <img src={membroSelecionado.profiles.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#64748b' }}>
                            {(membroSelecionado.profiles?.full_name ?? 'J').split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
                          </span>}
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>{membroSelecionado.profiles?.full_name ?? 'Jogador'}</p>
                      {membroSelecionado.role === 'admin' && <span style={{ fontSize: '0.72rem', color: '#16a34a', fontWeight: 700 }}>👑 Administrador</span>}
                      {membroSelecionado.profiles?.bio && (
                        <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '6px 0 0', fontStyle: 'italic', maxWidth: '280px' }}>"{membroSelecionado.profiles.bio}"</p>
                      )}
                    </div>
                  </div>

                  {/* Stats da temporada */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                    {[
                      { icon: '⭐', label: 'Nota Média', valor: statsMembro ? (statsMembro.media_nota > 0 ? statsMembro.media_nota : '—') : '...', cor: '#f59e0b' },
                      { icon: '⚽', label: 'Gols', valor: statsMembro ? statsMembro.gols : '...', cor: '#16a34a' },
                      { icon: '📅', label: 'Presenças', valor: statsMembro ? statsMembro.presencas : '...', cor: '#2563eb' },
                    ].map(s => (
                      <div key={s.label} style={{ backgroundColor: '#f8fafc', borderRadius: '0.875rem', padding: '0.875rem', textAlign: 'center', border: `1px solid ${s.cor}22` }}>
                        <p style={{ fontSize: '1.25rem', margin: '0 0 4px' }}>{s.icon}</p>
                        <p style={{ fontSize: '1.25rem', fontWeight: 900, color: s.cor, margin: 0 }}>{s.valor}</p>
                        <p style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 600, margin: '2px 0 0', textTransform: 'uppercase' }}>{s.label}</p>
                      </div>
                    ))}
                  </div>

                  <button onClick={() => setMembroSelecionado(null)}
                    style={{ width: '100%', padding: '0.875rem', borderRadius: '0.875rem', border: '2px solid #e2e8f0', background: 'none', color: '#64748b', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}>
                    Fechar
                  </button>
                </div>
              </>
            )}
          </>
        )
      })()}

      {modalTemporada && (
        <ModalCriarTemporada
          groupId={groupId}
          onClose={() => setModalTemporada(false)}
          onSuccess={() => { setModalTemporada(false); fetchData() }}
        />
      )}
    </div>
  )
}
