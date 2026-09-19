'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Trash2, Save, Loader2, Search, Star, ChevronRight, RefreshCw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// ─── Tipos ───────────────────────────────────────────────────
interface Jogador {
  key: string
  user_id: string | null
  attendance_id: string
  full_name: string
  photo_url: string | null
  position_1: string | null
  position_2: string | null
  position_3: string | null
  is_guest: boolean
  is_goalkeeper?: boolean
  // scores
  velocidade: number; forca_fisica: number; passe: number; chute: number
  marcacao: number; drible: number; posicionamento: number; resistencia: number; jogo_aereo: number
  never_edited: boolean
  // calculados
  scoreGeral: number
  scorePosicional: Record<string, number>
}

interface Time {
  id?: string
  name: string
  color: string
  jogadores: JogadorNoTime[]
}

interface JogadorNoTime {
  jogador: Jogador
  posicaoNoTime: string // posição que está jogando neste time
  scoreNoTime: number  // score ponderado para essa posição
}

interface PesoRow {
  posicao: string
  velocidade: number; forca_fisica: number; passe: number; chute: number
  marcacao: number; drible: number; posicionamento: number; resistencia: number; jogo_aereo: number
}

interface FormacaoConfig {
  numTimes: number
  jogadoresPorTime: number
  posicoes: { posicao: string; quantidade: number }[]
  modo: 'score' | 'posicao' | 'manual'
}

// ─── Constantes ──────────────────────────────────────────────
const PALETA = [
  { name: 'Time Verde',    color: '#16a34a' },
  { name: 'Time Vermelho', color: '#dc2626' },
  { name: 'Time Azul',     color: '#2563eb' },
  { name: 'Time Laranja',  color: '#ea580c' },
  { name: 'Time Roxo',     color: '#7c3aed' },
  { name: 'Time Rosa',     color: '#db2777' },
  { name: 'Time Ciano',    color: '#0891b2' },
  { name: 'Time Amarelo',  color: '#ca8a04' },
]

const POSICOES_LINHA = ['zagueiro','lateral','volante','meia','atacante']
const posicaoIcon: Record<string, string> = {
  goleiro:'🧤', zagueiro:'🛡️', lateral:'↔️', volante:'⚙️', meia:'🎯', atacante:'⚡',
}

const CRITERIOS = ['velocidade','forca_fisica','passe','chute','marcacao','drible','posicionamento','resistencia','jogo_aereo'] as const

// ─── Funções de score ─────────────────────────────────────────
function calcScorePosicional(j: Jogador, posicao: string, pesos: PesoRow[]): number {
  const peso = pesos.find(p => p.posicao === posicao)
  if (!j || !peso) return j?.scoreGeral ?? 3
  let soma = 0, totalPeso = 0
  for (const c of CRITERIOS) {
    soma += j[c] * peso[c]
    totalPeso += peso[c]
  }
  return totalPeso > 0 ? Math.round((soma / totalPeso) * 10) / 10 : 3
}

function calcScoreGeral(j: any): number {
  const vals = CRITERIOS.map(c => j[c] ?? 3)
  return Math.round((vals.reduce((a: number, b: number) => a + b, 0) / vals.length) * 10) / 10
}

function scoreMediaTime(time: Time): number {
  if (time.jogadores.length === 0) return 0
  const soma = time.jogadores.reduce((a, jt) => a + jt.scoreNoTime, 0)
  return Math.round((soma / time.jogadores.length) * 10) / 10
}

function scoreColor(v: number) {
  if (v >= 4.5) return '#15803d'
  if (v >= 3.5) return '#1d4ed8'
  if (v >= 2.5) return '#854d0e'
  return '#b91c1c'
}

// ─── Helpers do algoritmo ────────────────────────────────────
function scoreSomaTime(t: Time): number {
  return t.jogadores.reduce((a, jt) => a + jt.scoreNoTime, 0)
}

function desvioEntresTimes(times: Time[]): number {
  const somas = times.map(scoreSomaTime)
  const max = Math.max(...somas)
  const min = Math.min(...somas)
  return max - min
}

function melhorPosicaoParaJogador(j: Jogador, posicoes: { posicao: string }[], pesos: PesoRow[]): string {
  const lista = posicoes.map(p => p.posicao)
  if (lista.length === 0) return j.position_1 ?? 'meia'
  return lista.reduce((best, pos) =>
    calcScorePosicional(j, pos, pesos) > calcScorePosicional(j, best, pesos) ? pos : best
  , lista[0])
}

// ─── Algoritmo de divisão ─────────────────────────────────────
function dividirTimes(
  jogadores: Jogador[],
  config: FormacaoConfig,
  pesos: PesoRow[]
): Time[] {
  const { numTimes, posicoes, modo } = config

  // jogadoresPorTime na UI = jogadores de LINHA por time (goleiro não conta)
  // totalLinha = soma das posições configuradas
  const totalLinhaPorTime = posicoes.reduce((a, p) => a + p.quantidade, 0)
  const totalPorTime      = totalLinhaPorTime + 1  // +1 goleiro
  const totalVagas        = totalPorTime * numTimes
  const vagasLinha        = totalLinhaPorTime * numTimes

  // Separa goleiros e linha
  const todosGoleiros = jogadores.filter(j => j.position_1 === 'goleiro')
  const todosLinha    = jogadores.filter(j => j.position_1 !== 'goleiro')

  // ── Seleciona goleiros: 1 por time ──
  // Embaralha e pega os primeiros numTimes
  const goleirosEmb = [...todosGoleiros].sort(() => Math.random() - 0.5)
  const goleiros = goleirosEmb.slice(0, numTimes)

  // Modo score: pré-seleciona os melhores por score geral
  // Modo posição: seleção feita dentro do loop por posição (pool compartilhado)
  const linhaEscolhida = modo !== 'posicao'
    ? [...todosLinha].sort((a, b) => b.scoreGeral - a.scoreGeral).slice(0, vagasLinha)
    : []

  // Inicializa times
  const times: Time[] = Array.from({ length: numTimes }, (_, i) => ({
    name: PALETA[i % PALETA.length].name,
    color: PALETA[i % PALETA.length].color,
    jogadores: [],
  }))

  // Helper: time com menor soma que ainda cabe jogador
  // maxTotal = totalPorTime (inclui goleiro)
  function timeComMenorSoma(maxJogs: number): number {
    return times
      .map((t, i) => ({ i, n: t.jogadores.length, soma: scoreSomaTime(t) }))
      .filter(t => t.n < maxJogs)
      .sort((a, b) => a.soma - b.soma)[0]?.i ?? 0
  }

  // ── Distribui goleiros: greedy, 1 por time, menor soma primeiro ──
  const goleirosOrd = [...goleiros].sort((a, b) =>
    (b.scorePosicional['goleiro'] ?? b.scoreGeral) - (a.scorePosicional['goleiro'] ?? a.scoreGeral)
  )
  for (const g of goleirosOrd) {
    const timeIdx = times
      .map((t, i) => ({ i, temGol: t.jogadores.some(jt => jt.posicaoNoTime === 'goleiro'), soma: scoreSomaTime(t) }))
      .filter(t => !t.temGol)
      .sort((a, b) => a.soma - b.soma)[0]?.i ?? 0
    times[timeIdx].jogadores.push({
      jogador: { ...g, is_goalkeeper: true },
      posicaoNoTime: 'goleiro',
      scoreNoTime: g.scorePosicional['goleiro'] ?? g.scoreGeral,
    })
  }

  if (modo === 'posicao') {
    // ════════════════════════════════════════════════════
    // MODO POSIÇÃO — algoritmo em 2 fases:
    //
    // FASE 1 — RESERVA: para cada posição, marca os jogadores
    //   ideais (pos1 exata) como reservados. Processa em ordem
    //   de escassez (menos candidatos por vaga = entra primeiro).
    //   Só usa pos2/pos3/qualquer se realmente não houver pos1.
    //
    // FASE 2 — DISTRIBUIÇÃO: distribui os reservados de cada
    //   posição garantindo EXATAMENTE `quantidade` por time,
    //   greedy pelo score posicional.
    // ════════════════════════════════════════════════════

    // Índice rápido de jogadores por key
    const jogadorPorKey: Record<string, Jogador> = {}
    for (const j of todosLinha) jogadorPorKey[j.key] = j

    // Pool de disponíveis (keys)
    const pool = new Set<string>(todosLinha.map(j => j.key))

    // Mapa de reservas: posicao → lista de Jogador
    const reservas: Record<string, Jogador[]> = {}

    // FASE 1 — TRÊS PASSAGENS para garantir que toda posição seja preenchida:
    //
    // Passagem A: apenas pos1 exata — preenche quem tem a posição como primeira opção
    // Passagem B: apenas pos2/pos3 — completa vagas com segunda e terceira opção
    // Passagem C: qualquer disponível — último recurso para vagas ainda abertas
    //
    // Em cada passagem, processa posições da mais escassa para a menos escassa
    // para evitar que posições raras percam candidatos para posições abundantes.

    // Inicializa reservas com arrays vazios
    for (const { posicao } of posicoes) reservas[posicao] = []

    // ── Passagem A: pos1 exata ──
    {
      const posicoesOrd = [...posicoes].sort((a, b) => {
        const dA = [...pool].filter(k => jogadorPorKey[k]?.position_1 === a.posicao).length
        const dB = [...pool].filter(k => jogadorPorKey[k]?.position_1 === b.posicao).length
        return (dA / (a.quantidade * numTimes)) - (dB / (b.quantidade * numTimes))
      })
      for (const { posicao, quantidade } of posicoesOrd) {
        const vagasTotais = quantidade * numTimes
        const faltam = vagasTotais - reservas[posicao].length
        if (faltam <= 0) continue
        const candidatos = [...pool]
          .map(k => jogadorPorKey[k]).filter(j => j?.position_1 === posicao)
          .sort((a, b) => calcScorePosicional(b, posicao, pesos) - calcScorePosicional(a, posicao, pesos))
          .slice(0, faltam)
        for (const j of candidatos) { reservas[posicao].push(j); pool.delete(j.key) }
      }
    }

    // ── Passagem B: pos2 e pos3 ──
    {
      const posicoesOrd = [...posicoes].sort((a, b) => {
        const vagA = (a.quantidade * numTimes) - reservas[a.posicao].length
        const vagB = (b.quantidade * numTimes) - reservas[b.posicao].length
        // Prioriza quem ainda tem mais vagas abertas
        return vagB - vagA
      })
      for (const { posicao, quantidade } of posicoesOrd) {
        const vagasTotais = quantidade * numTimes
        let faltam = vagasTotais - reservas[posicao].length
        if (faltam <= 0) continue
        for (const filtro of [
          (j: Jogador) => j.position_2 === posicao,
          (j: Jogador) => j.position_3 === posicao,
        ]) {
          if (faltam <= 0) break
          const candidatos = [...pool]
            .map(k => jogadorPorKey[k]).filter(j => j && filtro(j))
            .sort((a, b) => calcScorePosicional(b, posicao, pesos) - calcScorePosicional(a, posicao, pesos))
            .slice(0, faltam)
          for (const j of candidatos) { reservas[posicao].push(j); pool.delete(j.key); faltam-- }
        }
      }
    }

    // ── Passagem C: qualquer disponível (último recurso) ──
    {
      for (const { posicao, quantidade } of posicoes) {
        const vagasTotais = quantidade * numTimes
        let faltam = vagasTotais - reservas[posicao].length
        if (faltam <= 0) continue
        const candidatos = [...pool]
          .map(k => jogadorPorKey[k]).filter(j => !!j)
          .sort((a, b) => calcScorePosicional(b, posicao, pesos) - calcScorePosicional(a, posicao, pesos))
          .slice(0, faltam)
        for (const j of candidatos) { reservas[posicao].push(j); pool.delete(j.key) }
      }
    }

    // Ordem de distribuição = ordem original do admin
    const posicoesOrdenadas = posicoes

    // FASE 2 — distribui cada posição garantindo `quantidade` exata por time
    for (const { posicao, quantidade } of posicoesOrdenadas) {
      const selecionados = reservas[posicao] ?? []
      selecionados.sort((a, b) => calcScorePosicional(b, posicao, pesos) - calcScorePosicional(a, posicao, pesos))

      // contPos[i] = quantos desta posição o time i já recebeu
      const contPos: number[] = times.map(() => 0)
      for (const j of selecionados) {
        const timeIdx = times
          .map((t, i) => ({ i, cont: contPos[i], soma: scoreSomaTime(t) }))
          .filter(t => t.cont < quantidade)
          .sort((a, b) => a.soma - b.soma)[0]?.i ?? 0
        contPos[timeIdx]++
        times[timeIdx].jogadores.push({
          jogador: j,
          posicaoNoTime: posicao,
          scoreNoTime: calcScorePosicional(j, posicao, pesos),
        })
      }
    }

  } else {
    // ── Modo score: distribui greedy por score geral ──
    const ordenada = [...linhaEscolhida].sort((a, b) => b.scoreGeral - a.scoreGeral)
    for (const j of ordenada) {
      const timeIdx = timeComMenorSoma(totalPorTime)
      const melhorPos = melhorPosicaoParaJogador(j, posicoes, pesos)
      times[timeIdx].jogadores.push({
        jogador: j,
        posicaoNoTime: melhorPos,
        scoreNoTime: calcScorePosicional(j, melhorPos, pesos),
      })
    }
  }

  // ── Fase de otimização: trocas que reduzem o desvio entre times ──
  // IMPORTANTE: só troca jogadores da MESMA posição para não quebrar a formação
  let melhorou = true
  let iteracoes = 0
  while (melhorou && iteracoes < 20) {
    melhorou = false
    iteracoes++
    const desvioAtual = desvioEntresTimes(times)
    if (desvioAtual < 0.15) break

    outer:
    for (let i = 0; i < times.length; i++) {
      for (let j = i + 1; j < times.length; j++) {
        for (const jtA of times[i].jogadores) {
          if (jtA.posicaoNoTime === 'goleiro') continue
          for (const jtB of times[j].jogadores) {
            if (jtB.posicaoNoTime === 'goleiro') continue
            // Só troca se forem da MESMA posição — preserva formação
            if (jtA.posicaoNoTime !== jtB.posicaoNoTime) continue
            const somaI = scoreSomaTime(times[i]) - jtA.scoreNoTime + jtB.scoreNoTime
            const somaJ = scoreSomaTime(times[j]) - jtB.scoreNoTime + jtA.scoreNoTime
            const outrosSomas = times.filter((_, k) => k !== i && k !== j).map(scoreSomaTime)
            const novoDesvio = Math.max(...outrosSomas, somaI, somaJ) - Math.min(...outrosSomas, somaI, somaJ)
            if (novoDesvio < desvioAtual - 0.05) {
              times[i].jogadores = times[i].jogadores.filter(x => x.jogador.key !== jtA.jogador.key)
              times[j].jogadores = times[j].jogadores.filter(x => x.jogador.key !== jtB.jogador.key)
              times[i].jogadores.push({ ...jtB, posicaoNoTime: jtB.posicaoNoTime, scoreNoTime: calcScorePosicional(jtB.jogador, jtB.posicaoNoTime, pesos) })
              times[j].jogadores.push({ ...jtA, posicaoNoTime: jtA.posicaoNoTime, scoreNoTime: calcScorePosicional(jtA.jogador, jtA.posicaoNoTime, pesos) })
              melhorou = true
              break outer
            }
          }
        }
      }
    }
  }

  return times
}

// ─── Componente principal ─────────────────────────────────────
export default function TimesPage() {
  const { groupId, roundId } = useParams<{ groupId: string; roundId: string }>()
  const router = useRouter()
  const supabase = createClient()

  // Estado principal
  const [presentes, setPresentes] = useState<Jogador[]>([])
  const [pesos, setPesos] = useState<PesoRow[]>([])
  const [times, setTimes] = useState<Time[]>([])
  const [goleiros, setGoleiros] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [erroGoleiro, setErroGoleiro] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'lista' | 'vs'>('lista')
  const [busca, setBusca] = useState('')

  // Fluxo de configuração
  const [etapa, setEtapa] = useState<'config' | 'times'>('config')
  const [config, setConfig] = useState<FormacaoConfig>({
    numTimes: 2,
    jogadoresPorTime: 7,
    posicoes: [
      { posicao: 'zagueiro', quantidade: 2 },
      { posicao: 'lateral', quantidade: 2 },
      { posicao: 'volante', quantidade: 1 },
      { posicao: 'meia', quantidade: 1 },
      { posicao: 'atacante', quantidade: 1 },
    ],
    modo: 'score',
  })

  // Jogador sendo movido manualmente
  const [movendo, setMovendo] = useState<{ jt: JogadorNoTime; timeIdx: number } | null>(null)
  const [buscaSwap, setBuscaSwap] = useState('')
  const [buscaSemTime, setBuscaSemTime] = useState('')
  const [timeCampo, setTimeCampo] = useState<Time | null>(null)

  useEffect(() => { fetchData() }, [roundId])

  async function fetchData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    // Busca check-ins
    const { data: atts } = await supabase
      .from('round_attendance')
      .select('id, user_id, guest_name, is_guest, checked_in, arrival_order, guest_position_1, guest_position_2, guest_position_3, guest_avg_score, profile:profiles(full_name, photo_url, position_1, position_2, position_3)')
      .eq('round_id', roundId)
      .eq('checked_in', true)
      .order('arrival_order', { ascending: true })

    // Busca scores
    const userIds = (atts ?? []).filter((a: any) => !a.is_guest).map((a: any) => a.user_id)
    const { data: scoresDB } = userIds.length > 0
      ? await supabase.from('player_scores').select('*').eq('group_id', groupId).in('user_id', userIds)
      : { data: [] }
    const scoreMap: Record<string, any> = {}
    ;(scoresDB ?? []).forEach((s: any) => { scoreMap[s.user_id] = s })

    // Busca pesos por posição
    const { data: pesosDB } = await supabase
      .from('position_weights').select('*').eq('group_id', groupId)
    const pesosCarregados: PesoRow[] = (pesosDB ?? []).map((p: any) => ({
      posicao: p.posicao,
      velocidade: p.velocidade, forca_fisica: p.forca_fisica, passe: p.passe,
      chute: p.chute, marcacao: p.marcacao, drible: p.drible,
      posicionamento: p.posicionamento, resistencia: p.resistencia, jogo_aereo: p.jogo_aereo,
    }))
    setPesos(pesosCarregados)

    const jogadores: Jogador[] = (atts ?? []).map((a: any) => {
      const sc = a.is_guest ? null : (scoreMap[a.user_id] ?? null)
      const base = {
        velocidade: sc?.velocidade ?? 3, forca_fisica: sc?.forca_fisica ?? 3,
        passe: sc?.passe ?? 3, chute: sc?.chute ?? 3, marcacao: sc?.marcacao ?? 3,
        drible: sc?.drible ?? 3, posicionamento: sc?.posicionamento ?? 3,
        resistencia: sc?.resistencia ?? 3, jogo_aereo: sc?.jogo_aereo ?? 3,
      }
      if (a.is_guest) {
        const avgScore = a.guest_avg_score ?? 3
        Object.assign(base, {
          velocidade: avgScore, forca_fisica: avgScore, passe: avgScore,
          chute: avgScore, marcacao: avgScore, drible: avgScore,
          posicionamento: avgScore, resistencia: avgScore, jogo_aereo: avgScore,
        })
      }
      const scoreGeral = calcScoreGeral(base)
      const j: Jogador = {
        key: a.is_guest ? `guest_${a.id}` : a.user_id,
        user_id: a.is_guest ? null : a.user_id,
        attendance_id: a.id,
        full_name: a.is_guest ? (a.guest_name ?? 'Convidado') : (a.profile?.full_name ?? 'Jogador'),
        photo_url: a.is_guest ? null : (a.profile?.photo_url ?? null),
        position_1: a.is_guest ? (a.guest_position_1 ?? null) : (a.profile?.position_1 ?? null),
        position_2: a.is_guest ? (a.guest_position_2 ?? null) : (a.profile?.position_2 ?? null),
        position_3: a.is_guest ? (a.guest_position_3 ?? null) : (a.profile?.position_3 ?? null),
        is_guest: a.is_guest,
        is_goalkeeper: a.profile?.position_1 === 'goleiro',
        never_edited: sc?.never_edited ?? true,
        ...base,
        scoreGeral,
        scorePosicional: {},
      }
      // Calcula score posicional para cada posição
      ;['goleiro','zagueiro','lateral','volante','meia','atacante'].forEach(pos => {
        j.scorePosicional[pos] = calcScorePosicional(j, pos, pesosCarregados)
      })
      return j
    })

    setPresentes(jogadores)

    // Verifica se já tem times salvos
    const { data: timesDB } = await supabase
      .from('teams')
      .select('*, team_players(user_id, attendance_id, is_goalkeeper, position_in_team)')
      .eq('round_id', roundId)

    if (timesDB && timesDB.length > 0) {
      // Reconstrói times salvos
      const goleirosCarregados: Record<string, boolean> = {}
      const timesFormatados: Time[] = timesDB.map((t: any) => {
        const jogs: JogadorNoTime[] = []
        t.team_players.forEach((tp: any) => {
          const j = jogadores.find(jj =>
            jj.is_guest ? tp.attendance_id === jj.attendance_id : tp.user_id === jj.user_id
          )
          if (j) {
            if (tp.is_goalkeeper) goleirosCarregados[j.key] = true
            const pos = tp.is_goalkeeper ? 'goleiro' : (tp.position_in_team ?? j.position_1 ?? 'meia')
            jogs.push({
              jogador: { ...j, is_goalkeeper: tp.is_goalkeeper },
              posicaoNoTime: pos,
              scoreNoTime: calcScorePosicional(j, pos, pesosCarregados),
            })
          }
        })
        return { id: t.id, name: t.name, color: t.color ?? '#16a34a', jogadores: jogs }
      })
      setGoleiros(goleirosCarregados)
      setTimes(timesFormatados)
      setEtapa('times')
    }

    setLoading(false)
  }

  // ─── Configuração da formação ─────────────────────────────
  const totalLinha = config.posicoes.reduce((a, p) => a + p.quantidade, 0)
  const totalPorTime = totalLinha + 1 // +1 goleiro
  const totalNecessario = totalPorTime * config.numTimes
  const linhaDisponiveis = presentes.filter(j => j.position_1 !== 'goleiro').length
  const goleirosDisponiveis = presentes.filter(j => j.position_1 === 'goleiro').length
  const formacaoValida = config.modo === 'manual'
    ? config.numTimes >= 2
    : totalNecessario <= presentes.length && goleirosDisponiveis >= config.numTimes

  function updatePosicao(posicao: string, quantidade: number) {
    setConfig(prev => {
      const exists = prev.posicoes.find(p => p.posicao === posicao)
      if (quantidade === 0) return { ...prev, posicoes: prev.posicoes.filter(p => p.posicao !== posicao) }
      if (exists) return { ...prev, posicoes: prev.posicoes.map(p => p.posicao === posicao ? { ...p, quantidade } : p) }
      return { ...prev, posicoes: [...prev.posicoes, { posicao, quantidade }] }
    })
  }

  function gerarTimes() {
    if (config.modo === 'manual') {
      // Modo manual: cria times vazios, todos os jogadores ficam "sem time"
      const timesVazios: Time[] = Array.from({ length: config.numTimes }, (_, i) => ({
        name: PALETA[i % PALETA.length].name,
        color: PALETA[i % PALETA.length].color,
        jogadores: [],
      }))
      setTimes(timesVazios)
      setEtapa('times')
      return
    }
    const timesGerados = dividirTimes(presentes, config, pesos)
    // Marca goleiros no estado
    const novosGoleiros: Record<string, boolean> = {}
    timesGerados.forEach(t => {
      t.jogadores.forEach(jt => {
        if (jt.posicaoNoTime === 'goleiro') novosGoleiros[jt.jogador.key] = true
      })
    })
    setGoleiros(novosGoleiros)
    setTimes(timesGerados)
    setEtapa('times')
  }

  // ─── Mover jogador entre times ────────────────────────────
  function moverParaTime(jogadorKey: string, paraTimeIdx: number) {
    setTimes(prev => {
      // Encontra o jogador em qualquer time
      let jtEncontrado: JogadorNoTime | null = null
      for (const t of prev) {
        const found = t.jogadores.find(x => x.jogador.key === jogadorKey)
        if (found) { jtEncontrado = found; break }
      }
      if (!jtEncontrado) return prev

      // Remove de TODOS os times (garante sem duplicata)
      const novo = prev.map(t => ({
        ...t, jogadores: t.jogadores.filter(x => x.jogador.key !== jogadorKey)
      }))

      // Insere no time destino (paraTimeIdx === -1 = sem time / modo manual)
      if (paraTimeIdx >= 0 && paraTimeIdx < novo.length) {
        const pos = jtEncontrado.posicaoNoTime
        novo[paraTimeIdx].jogadores.push({
          ...jtEncontrado,
          posicaoNoTime: pos,
          scoreNoTime: calcScorePosicional(jtEncontrado.jogador, pos, pesos),
        })
      }
      return novo
    })
    setMovendo(null)
  }

  function moverParaSemTime(jogadorKey: string) {
    setTimes(prev => prev.map(t => ({
      ...t, jogadores: t.jogadores.filter(x => x.jogador.key !== jogadorKey)
    })))
    setMovendo(null)
  }

  // ─── Salvar times ─────────────────────────────────────────
  async function salvarTimes() {
    setErroGoleiro(null)

    // Valida goleiros
    const timesComJogadores = times.filter(t => t.jogadores.length > 0)
    for (const time of timesComJogadores) {
      const gols = time.jogadores.filter(jt => jt.posicaoNoTime === 'goleiro' || goleiros[jt.jogador.key])
      if (gols.length === 0) {
        setErroGoleiro(`O time "${time.name}" não tem goleiro. Marque um goleiro antes de salvar.`)
        return
      }
      if (gols.length > 1) {
        setErroGoleiro(`O time "${time.name}" tem ${gols.length} goleiros. Cada time pode ter apenas 1.`)
        return
      }
    }

    setSaving(true)

    const { data: jogosExistentes } = await supabase
      .from('matches').select('id').eq('round_id', roundId).limit(1)
    const temJogos = (jogosExistentes ?? []).length > 0

    if (temJogos) {
      const { data: antigos } = await supabase.from('teams').select('id, name, color').eq('round_id', roundId)
      const antigosIds = (antigos ?? []).map((t: any) => t.id)
      const antigosMap = Object.fromEntries((antigos ?? []).map((t: any) => [t.id, t]))
      if (antigosIds.length > 0) await supabase.from('team_players').delete().in('team_id', antigosIds)

      for (const time of times) {
        const teamId = time.id
        const isGoleiro = (jt: JogadorNoTime) => jt.posicaoNoTime === 'goleiro' || goleiros[jt.jogador.key]

        if (teamId && antigosMap[teamId]) {
          await supabase.from('teams').update({ name: time.name, color: time.color }).eq('id', teamId)
          if (time.jogadores.length > 0) {
            await supabase.from('team_players').insert(
              time.jogadores.map(jt => ({
                team_id: teamId,
                user_id: jt.jogador.user_id,
                attendance_id: jt.jogador.is_guest ? jt.jogador.attendance_id : null,
                is_guest: jt.jogador.is_guest,
                is_goalkeeper: isGoleiro(jt),
                position_in_team: jt.posicaoNoTime,
              }))
            )
          }
        } else if (time.jogadores.length > 0) {
          const { data: novoTime } = await supabase
            .from('teams').insert({ round_id: roundId, name: time.name, color: time.color }).select().single()
          if (novoTime) {
            await supabase.from('team_players').insert(
              time.jogadores.map(jt => ({
                team_id: novoTime.id,
                user_id: jt.jogador.user_id,
                attendance_id: jt.jogador.is_guest ? jt.jogador.attendance_id : null,
                is_guest: jt.jogador.is_guest,
                is_goalkeeper: isGoleiro(jt),
                position_in_team: jt.posicaoNoTime,
              }))
            )
          }
        }
      }
    } else {
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
            time.jogadores.map(jt => ({
              team_id: novoTime.id,
              user_id: jt.jogador.user_id,
              attendance_id: jt.jogador.is_guest ? jt.jogador.attendance_id : null,
              is_guest: jt.jogador.is_guest,
              is_goalkeeper: jt.posicaoNoTime === 'goleiro' || goleiros[jt.jogador.key],
              position_in_team: jt.posicaoNoTime,
            }))
          )
        }
      }
    }

    setSaving(false)
    router.push(`/grupos/${groupId}/rodadas/${roundId}`)
  }

  // ─── Loading ──────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-4xl animate-bounce">⚽</div>
    </div>
  )

  // ─── ETAPA 1: Configuração ────────────────────────────────
  if (etapa === 'config') return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', paddingBottom: '7rem' }}>
      <div style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', paddingTop: '3rem', paddingBottom: '1rem', padding: '3rem 1rem 1rem' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.8)' }}>
            <ArrowLeft size={22} />
          </button>
          <div>
            <h1 style={{ color: 'white', fontWeight: 700, margin: 0, fontSize: '1.1rem' }}>⚙️ Configurar Times</h1>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', margin: '2px 0 0' }}>
              {presentes.length} presentes · {goleirosDisponiveis} goleiros · {linhaDisponiveis} linha
            </p>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

        {/* Número de times */}
        <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <p style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', margin: '0 0 0.75rem' }}>Quantos times?</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button onClick={() => setConfig(prev => ({ ...prev, numTimes: Math.max(2, prev.numTimes - 1) }))}
              style={{ width: '40px', height: '40px', borderRadius: '9999px', border: '2px solid #e2e8f0', backgroundColor: 'white', fontWeight: 700, fontSize: '1.25rem', color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>−</button>
            <div style={{ flex: 1, textAlign: 'center' as const, padding: '0.625rem', borderRadius: '0.75rem', border: '2px solid #16a34a', backgroundColor: '#f0fdf4' }}>
              <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#15803d' }}>{config.numTimes}</span>
              <p style={{ fontSize: '0.65rem', color: '#94a3b8', margin: '2px 0 0' }}>times</p>
            </div>
            <button onClick={() => setConfig(prev => ({ ...prev, numTimes: Math.min(10, prev.numTimes + 1) }))}
              style={{ width: '40px', height: '40px', borderRadius: '9999px', border: '2px solid #e2e8f0', backgroundColor: 'white', fontWeight: 700, fontSize: '1.25rem', color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>+</button>
          </div>
        </div>

        {/* Modo */}
        <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <p style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', margin: '0 0 0.75rem' }}>Modo de divisão</p>
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '0.5rem' }}>
            {([
              ['score',   '⚡ Score equilibrado', 'Divide automaticamente pelo score dos jogadores'],
              ['posicao', '🎯 Por posição',        'Encaixa nas posições táticas e equilibra scores'],
              ['manual',  '✋ Manual',              'Você move os jogadores livremente entre os times'],
            ] as const).map(([val, label, desc]) => (
              <button key={val} onClick={() => setConfig(prev => ({ ...prev, modo: val }))}
                style={{ width: '100%', padding: '0.875rem', borderRadius: '0.875rem', border: `2px solid ${config.modo === val ? '#16a34a' : '#e2e8f0'}`, backgroundColor: config.modo === val ? '#f0fdf4' : 'white', cursor: 'pointer', textAlign: 'left' as const, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '9999px', backgroundColor: config.modo === val ? '#16a34a' : '#e2e8f0', flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: '0.85rem', fontWeight: 700, color: config.modo === val ? '#15803d' : '#1e293b', margin: '0 0 1px' }}>{label}</p>
                  <p style={{ fontSize: '0.68rem', color: '#94a3b8', margin: 0 }}>{desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Posições — oculta no modo manual */}
        {config.modo !== 'manual' && <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <p style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', margin: '0 0 0.25rem' }}>Jogadores de linha por time</p>
          <p style={{ fontSize: '0.7rem', color: '#94a3b8', margin: '0 0 0.875rem' }}>Goleiro é sempre 1 por time (automático)</p>

          {POSICOES_LINHA.map(pos => {
            const qtd = config.posicoes.find(p => p.posicao === pos)?.quantidade ?? 0
            return (
              <div key={pos} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0', borderBottom: '1px solid #f8fafc' }}>
                <span style={{ fontSize: '1.1rem' }}>{posicaoIcon[pos]}</span>
                <p style={{ flex: 1, fontSize: '0.82rem', fontWeight: 600, color: '#1e293b', margin: 0, textTransform: 'capitalize' as const }}>{pos}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button onClick={() => updatePosicao(pos, Math.max(0, qtd - 1))}
                    style={{ width: '28px', height: '28px', borderRadius: '9999px', border: '1.5px solid #e2e8f0', backgroundColor: 'white', cursor: 'pointer', fontWeight: 700, fontSize: '1rem', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                  <span style={{ fontSize: '1rem', fontWeight: 800, color: qtd > 0 ? '#16a34a' : '#cbd5e1', minWidth: '20px', textAlign: 'center' as const }}>{qtd}</span>
                  <button onClick={() => updatePosicao(pos, qtd + 1)}
                    style={{ width: '28px', height: '28px', borderRadius: '9999px', border: '1.5px solid #e2e8f0', backgroundColor: 'white', cursor: 'pointer', fontWeight: 700, fontSize: '1rem', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                </div>
              </div>
            )
          })}

          {/* Resumo */}
          <div style={{ marginTop: '0.875rem', backgroundColor: '#f8fafc', borderRadius: '0.75rem', padding: '0.75rem' }}>
            <p style={{ fontSize: '0.75rem', color: '#475569', margin: '0 0 2px' }}>
              📋 <strong>{totalLinha}</strong> linha + <strong>1</strong> goleiro = <strong>{totalPorTime}</strong> por time
            </p>
            <p style={{ fontSize: '0.75rem', color: '#475569', margin: 0 }}>
              🏟️ <strong>{config.numTimes}</strong> times × <strong>{totalPorTime}</strong> = <strong>{totalNecessario}</strong> jogadores necessários
              {presentes.length < totalNecessario
                ? <span style={{ color: '#b91c1c', fontWeight: 700 }}> (faltam {totalNecessario - presentes.length})</span>
                : <span style={{ color: '#15803d', fontWeight: 700 }}> ✅ ({presentes.length} disponíveis)</span>
              }
            </p>
            {goleirosDisponiveis < config.numTimes && (
              <p style={{ fontSize: '0.72rem', color: '#b91c1c', fontWeight: 700, margin: '4px 0 0' }}>
                ⚠️ Faltam goleiros: {goleirosDisponiveis} disponíveis para {config.numTimes} times
              </p>
            )}
          </div>
        </div>}

        {/* Botão gerar */}
        <button onClick={gerarTimes} disabled={!formacaoValida}
          style={{ width: '100%', background: formacaoValida ? 'linear-gradient(135deg, #16a34a, #15803d)' : '#e2e8f0', border: 'none', borderRadius: '1rem', padding: '1rem', color: formacaoValida ? 'white' : '#94a3b8', fontWeight: 700, fontSize: '1rem', cursor: formacaoValida ? 'pointer' : 'not-allowed', boxShadow: formacaoValida ? '0 4px 20px rgba(22,163,74,0.4)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
          ⚽ Gerar Times Equilibrados
        </button>
      </div>
    </div>
  )

  // ─── ETAPA 2: Times gerados ───────────────────────────────
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', paddingBottom: '7rem' }}>
      <div style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', paddingTop: '3rem', paddingBottom: '1rem', padding: '3rem 1rem 1rem' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={() => setEtapa('config')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.8)' }}>
            <ArrowLeft size={22} />
          </button>
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ color: 'white', fontWeight: 700, margin: 0, fontSize: '1.1rem' }}>👕 Times</h1>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', margin: '2px 0 0' }}>
              {times.length} times · Toque em um jogador para mover
            </p>
          </div>
          <button onClick={() => setViewMode(v => v === 'lista' ? 'vs' : 'lista')}
            style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '0.5rem', padding: '6px 10px', color: 'white', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>
            {viewMode === 'lista' ? '⚔️ VS' : '📋 Lista'}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

        {/* Resumo de scores */}
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${times.length}, 1fr)`, gap: '0.5rem' }}>
          {times.map((t, i) => {
            const media = scoreMediaTime(t)
            return (
              <div key={i} style={{ backgroundColor: 'white', borderRadius: '0.875rem', padding: '0.75rem', textAlign: 'center' as const, border: `2px solid ${t.color}33`, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '9999px', backgroundColor: t.color, margin: '0 auto 4px' }} />
                <p style={{ fontSize: '0.65rem', fontWeight: 600, color: '#64748b', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{t.name}</p>
                <p style={{ fontSize: '1.1rem', fontWeight: 800, color: scoreColor(media), margin: 0 }}>{media.toFixed(1)}</p>
                <p style={{ fontSize: '0.6rem', color: '#94a3b8', margin: 0 }}>⭐ score</p>
              </div>
            )
          })}
        </div>

        {/* Sem time — visível no modo manual ou quando há jogadores não alocados */}
        {(() => {
          const chavesTimes = new Set(times.flatMap(t => t.jogadores.map(jt => jt.jogador.key)))
          const semTime = presentes.filter(j => !chavesTimes.has(j.key))
          if (semTime.length === 0) return null
          return (
            <div style={{ backgroundColor: 'white', borderRadius: '1rem', border: '2px dashed #cbd5e1', overflow: 'hidden' }}>
              <div style={{ padding: '0.75rem 1rem', backgroundColor: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: buscaSemTime || semTime.length > 5 ? '0.5rem' : '0' }}>
                  <p style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', margin: 0 }}>
                    ⏳ Sem time — {semTime.length} jogador{semTime.length !== 1 ? 'es' : ''}
                  </p>
                </div>
                {semTime.length > 5 && (
                  <input
                    type="text"
                    value={buscaSemTime}
                    onChange={e => setBuscaSemTime(e.target.value)}
                    placeholder="🔍 Buscar jogador..."
                    style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1.5px solid #e2e8f0', borderRadius: '0.625rem', fontSize: '0.78rem', outline: 'none', boxSizing: 'border-box' as const, backgroundColor: 'white' }}
                  />
                )}
              </div>
              {semTime
                .filter(j => buscaSemTime.trim() === '' || j.full_name.toLowerCase().includes(buscaSemTime.toLowerCase()))
                .map(j => {
                const initials = j.full_name.split(' ').map(n => n[0]).slice(0, 2).join('')
                const isMovendo = movendo?.jt.jogador.key === j.key
                return (
                  <div key={j.key} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem 1rem', borderBottom: '1px solid #f8fafc', backgroundColor: isMovendo ? '#f0fdf4' : 'white' }}>
                    <div style={{ width: '2.25rem', height: '2.25rem', borderRadius: '9999px', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                      {j.photo_url ? <img src={j.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b' }}>{initials}</span>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1e293b', margin: 0 }}>{j.full_name.split(' ')[0]}</p>
                      <p style={{ fontSize: '0.65rem', color: '#94a3b8', margin: 0 }}>{j.position_1 ? `${posicaoIcon[j.position_1] ?? ''} ${j.position_1}` : '—'}</p>
                    </div>
                    {/* Botão mover para time */}
                    <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' as const, justifyContent: 'flex-end' }}>
                      {times.map((t, i) => (
                        <button key={i} onClick={() => {
                          // Cria JogadorNoTime para jogador sem time
                          const pos = j.position_1 ?? 'meia'
                          const jt: JogadorNoTime = { jogador: j, posicaoNoTime: pos, scoreNoTime: calcScorePosicional(j, pos, pesos) }
                          setTimes(prev => prev.map((time, idx) =>
                            idx === i ? { ...time, jogadores: [...time.jogadores, jt] } : time
                          ))
                        }}
                          style={{ padding: '3px 8px', borderRadius: '0.5rem', border: `1.5px solid ${t.color}`, backgroundColor: t.color + '15', color: t.color, fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer' }}>
                          +{t.name.split(' ')[1] ?? t.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })()}

        {/* Times em lista */}
        {viewMode === 'lista' && times.map((time, timeIdx) => {
          const media = scoreMediaTime(time)
          return (
            <div key={timeIdx} style={{ backgroundColor: 'white', borderRadius: '1rem', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <div style={{ padding: '0.875rem 1rem', background: `linear-gradient(135deg, ${time.color}, ${time.color}cc)` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ color: 'white', fontWeight: 800, fontSize: '0.95rem', margin: 0 }}>{time.name} <span style={{ fontSize: '0.75rem', fontWeight: 600, opacity: 0.85 }}>⭐ {media.toFixed(1)}</span></p>
                    <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.7rem', margin: '2px 0 0' }}>{time.jogadores.length} jogadores</p>
                  </div>
                  <button onClick={() => setTimeCampo(time)}
                    style={{ padding: '5px 10px', borderRadius: '0.625rem', border: '1.5px solid rgba(255,255,255,0.5)', backgroundColor: 'rgba(255,255,255,0.15)', color: 'white', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' as const }}>
                    🏟️ Ver em campo
                  </button>
                </div>
              </div>

              {/* Jogadores agrupados por posição */}
              {['goleiro','zagueiro','lateral','volante','meia','atacante'].map(pos => {
                const jogs = time.jogadores.filter(jt => jt.posicaoNoTime === pos)
                if (jogs.length === 0) return null
                return (
                  <div key={pos}>
                    <div style={{ padding: '4px 1rem', backgroundColor: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' as const }}>{posicaoIcon[pos]} {pos}</span>
                    </div>
                    {jogs.map(jt => {
                      const j = jt.jogador
                      const initials = j.full_name.split(' ').map(n => n[0]).slice(0, 2).join('')
                      const isMovendo = movendo?.jt.jogador.key === j.key && movendo?.timeIdx === timeIdx
                      return (
                        <div key={j.key} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem 1rem', borderBottom: '1px solid #f8fafc', backgroundColor: isMovendo ? '#f0fdf4' : 'white' }}>
                          <div style={{ width: '2.25rem', height: '2.25rem', borderRadius: '9999px', backgroundColor: time.color + '22', border: `2px solid ${time.color}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                            {j.photo_url
                              ? <img src={j.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              : <span style={{ fontSize: '0.65rem', fontWeight: 700, color: time.color }}>{initials}</span>}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1e293b', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                              {pos === 'goleiro' ? '🧤 ' : ''}{j.full_name.split(' ')[0]}
                              {j.never_edited && <span style={{ marginLeft: '4px', fontSize: '0.6rem', color: '#f59e0b' }}>●</span>}
                            </p>
                            <p style={{ fontSize: '0.65rem', color: '#94a3b8', margin: 0 }}>
                              {j.is_guest ? '🎟️ convidado · ' : ''}score: <strong style={{ color: scoreColor(jt.scoreNoTime) }}>{jt.scoreNoTime.toFixed(1)}</strong>
                            </p>
                          </div>
                          {/* Botão mover */}
                          <button onClick={() => setMovendo(movendo?.jt.jogador.key === j.key && movendo?.timeIdx === timeIdx ? null : { jt, timeIdx })}
                            style={{ padding: '4px 8px', borderRadius: '0.5rem', border: `1px solid ${isMovendo ? '#16a34a' : '#e2e8f0'}`, backgroundColor: isMovendo ? '#dcfce7' : '#f8fafc', color: isMovendo ? '#15803d' : '#64748b', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                            {isMovendo ? '✓ sel.' : '↕️'}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )
        })}

        {/* Painel de swap */}
        {movendo && (() => {
          const jogadorA = movendo.jt
          const timeA = times[movendo.timeIdx]
          // Todos os jogadores dos outros times para trocar
          const candidatos: { jt: JogadorNoTime; timeIdx: number }[] = []
          times.forEach((t, i) => {
            if (i === movendo.timeIdx) return
            t.jogadores.forEach(jt => candidatos.push({ jt, timeIdx: i }))
          })
          return (
            <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1rem', border: '2px solid #16a34a', boxShadow: '0 4px 20px rgba(22,163,74,0.2)', position: 'sticky' as const, top: '4.5rem', zIndex: 9 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ width: '2rem', height: '2rem', borderRadius: '9999px', backgroundColor: timeA.color + '22', border: `2px solid ${timeA.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                    {jogadorA.jogador.photo_url
                      ? <img src={jogadorA.jogador.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span style={{ fontSize: '0.6rem', fontWeight: 700, color: timeA.color }}>{jogadorA.jogador.full_name[0]}</span>}
                  </div>
                  <div>
                    <p style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>
                      {jogadorA.jogador.full_name.split(' ')[0]}
                    </p>
                    <p style={{ fontSize: '0.65rem', color: '#94a3b8', margin: 0 }}>
                      {timeA.name} · score {jogadorA.scoreNoTime.toFixed(1)}
                    </p>
                  </div>
                </div>
                <button onClick={() => { setMovendo(null); setBuscaSwap('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '1.1rem', padding: '4px' }}>✕</button>
              </div>

              <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', margin: '0 0 0.5rem' }}>
                ↕️ Trocar com quem?
              </p>

              <input
                type="text"
                value={buscaSwap}
                onChange={e => setBuscaSwap(e.target.value)}
                placeholder="🔍 Filtrar por nome..."
                style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1.5px solid #e2e8f0', borderRadius: '0.625rem', fontSize: '0.78rem', outline: 'none', marginBottom: '0.5rem', boxSizing: 'border-box' as const }}
                autoFocus
              />

              <div style={{ maxHeight: '220px', overflowY: 'auto' as const, display: 'flex', flexDirection: 'column' as const, gap: '2px' }}>
                {candidatos.filter(({ jt: jtB }) =>
                  buscaSwap.trim() === '' ||
                  jtB.jogador.full_name.toLowerCase().includes(buscaSwap.toLowerCase())
                ).map(({ jt: jtB, timeIdx: timeBIdx }) => {
                  const timeB = times[timeBIdx]
                  return (
                    <button key={jtB.jogador.key}
                      onClick={() => {
                        // Swap: A vai para time B, B vai para time A
                        setTimes(prev => {
                          const novo = prev.map(t => ({ ...t, jogadores: [...t.jogadores] }))
                          // Remove A do time A
                          novo[movendo.timeIdx].jogadores = novo[movendo.timeIdx].jogadores.filter(x => x.jogador.key !== jogadorA.jogador.key)
                          // Remove B do time B
                          novo[timeBIdx].jogadores = novo[timeBIdx].jogadores.filter(x => x.jogador.key !== jtB.jogador.key)
                          // Insere A no time B (mantém posição)
                          novo[timeBIdx].jogadores.push({
                            ...jogadorA,
                            scoreNoTime: calcScorePosicional(jogadorA.jogador, jogadorA.posicaoNoTime, pesos),
                          })
                          // Insere B no time A (mantém posição)
                          novo[movendo.timeIdx].jogadores.push({
                            ...jtB,
                            scoreNoTime: calcScorePosicional(jtB.jogador, jtB.posicaoNoTime, pesos),
                          })
                          return novo
                        })
                        setMovendo(null)
                        setBuscaSwap('')
                      }}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.5rem 0.75rem', borderRadius: '0.75rem', border: `1.5px solid ${timeB.color}33`, backgroundColor: timeB.color + '08', cursor: 'pointer', textAlign: 'left' as const, width: '100%' }}>
                      <div style={{ width: '1.75rem', height: '1.75rem', borderRadius: '9999px', backgroundColor: timeB.color + '22', border: `1.5px solid ${timeB.color}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                        {jtB.jogador.photo_url
                          ? <img src={jtB.jogador.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <span style={{ fontSize: '0.55rem', fontWeight: 700, color: timeB.color }}>{jtB.jogador.full_name[0]}</span>}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '0.78rem', fontWeight: 600, color: '#1e293b', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                          {jtB.jogador.full_name.split(' ')[0]}
                        </p>
                        <p style={{ fontSize: '0.62rem', color: '#94a3b8', margin: 0 }}>
                          {timeB.name} · {posicaoIcon[jtB.posicaoNoTime] ?? ''} {jtB.posicaoNoTime} · score {jtB.scoreNoTime.toFixed(1)}
                        </p>
                      </div>
                      <span style={{ fontSize: '0.7rem', color: timeB.color, fontWeight: 700, flexShrink: 0 }}>⇄</span>
                    </button>
                  )
                })}
                {/* Opção: mover sem trocar (para sem time) */}
                <button onClick={() => { moverParaSemTime(jogadorA.jogador.key); setBuscaSwap('') }}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.5rem 0.75rem', borderRadius: '0.75rem', border: '1.5px solid #e2e8f0', backgroundColor: '#f8fafc', cursor: 'pointer', textAlign: 'left' as const, width: '100%', marginTop: '4px' }}>
                  <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600 }}>✕ Remover do time (sem troca)</span>
                </button>
              </div>
            </div>
          )
        })()}
      </div>

      {/* Erro goleiro */}
      {erroGoleiro && (
        <div style={{ position: 'fixed', bottom: '9rem', left: 0, right: 0, padding: '0 1rem', zIndex: 41 }}>
          <div style={{ maxWidth: '640px', margin: '0 auto', backgroundColor: '#fee2e2', border: '1px solid #dc2626', borderRadius: '1rem', padding: '0.875rem 1rem', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
            <span>⚠️</span>
            <p style={{ color: '#dc2626', fontSize: '0.85rem', fontWeight: 600, margin: 0, flex: 1 }}>{erroGoleiro}</p>
            <button onClick={() => setErroGoleiro(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontWeight: 700 }}>✕</button>
          </div>
        </div>
      )}

      {/* Botão salvar */}
      <div style={{ position: 'fixed', bottom: '5rem', left: 0, right: 0, padding: '0 1rem', zIndex: 40 }}>
        <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', gap: '0.5rem' }}>
          <button onClick={() => { setEtapa('config'); setTimes([]) }}
            style={{ padding: '1rem', borderRadius: '1rem', border: '2px solid #e2e8f0', backgroundColor: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600, color: '#64748b', fontSize: '0.82rem' }}>
            <RefreshCw size={16} /> Refazer
          </button>
          <button onClick={salvarTimes} disabled={saving}
            style={{ flex: 1, background: saving ? '#86efac' : 'linear-gradient(135deg, #16a34a, #15803d)', border: 'none', borderRadius: '1rem', padding: '1rem', color: 'white', fontWeight: 700, fontSize: '1rem', cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', boxShadow: '0 4px 20px rgba(22,163,74,0.4)' }}>
            {saving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
            {saving ? 'Salvando...' : '💾 Salvar Times'}
          </button>
        </div>
      </div>

      {/* Modal visualização em campo */}
      {timeCampo && (() => {
        const posOrdem = ['atacante','meia','volante','lateral','zagueiro','goleiro']
        const jogsPorPos: Record<string, JogadorNoTime[]> = {}
        posOrdem.forEach(pos => {
          jogsPorPos[pos] = timeCampo.jogadores.filter(jt => jt.posicaoNoTime === pos)
        })
        // Filtra posições com jogadores
        const posComJogs = posOrdem.filter(pos => jogsPorPos[pos].length > 0)

        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backgroundColor: 'rgba(0,0,0,0.85)' }}>
            <div style={{ width: '100%', maxWidth: '420px', maxHeight: '90vh', overflowY: 'auto' as const, borderRadius: '1.25rem', overflow: 'hidden', boxShadow: '0 25px 80px rgba(0,0,0,0.5)' }}>
              {/* Header */}
              <div style={{ background: `linear-gradient(135deg, ${timeCampo.color}, ${timeCampo.color}cc)`, padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ color: 'white', fontWeight: 800, fontSize: '1rem', margin: 0 }}>{timeCampo.name}</p>
                  <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.72rem', margin: '2px 0 0' }}>⭐ {scoreMediaTime(timeCampo).toFixed(1)} · {timeCampo.jogadores.length} jogadores</p>
                </div>
                <button onClick={() => setTimeCampo(null)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '9999px', width: '32px', height: '32px', color: 'white', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
              </div>

              {/* Campo */}
              <div style={{
                background: 'linear-gradient(180deg, #15803d 0%, #16a34a 20%, #15803d 40%, #16a34a 60%, #15803d 80%, #16a34a 100%)',
                padding: '1rem 0.5rem',
                minHeight: '520px',
                position: 'relative' as const,
                display: 'flex',
                flexDirection: 'column' as const,
                justifyContent: 'space-between',
              }}>
                {/* Linhas do campo */}
                <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' as const }}>
                  {/* Linha central */}
                  <div style={{ position: 'absolute', top: '50%', left: '5%', right: '5%', height: '2px', backgroundColor: 'rgba(255,255,255,0.3)' }} />
                  {/* Círculo central */}
                  <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '80px', height: '80px', borderRadius: '9999px', border: '2px solid rgba(255,255,255,0.3)' }} />
                  {/* Área do goleiro (base) */}
                  <div style={{ position: 'absolute', bottom: '2%', left: '25%', right: '25%', height: '12%', border: '2px solid rgba(255,255,255,0.3)', borderTop: 'none' }} />
                  {/* Área do goleiro (topo) */}
                  <div style={{ position: 'absolute', top: '2%', left: '25%', right: '25%', height: '12%', border: '2px solid rgba(255,255,255,0.3)', borderBottom: 'none' }} />
                </div>

                {/* Linhas de jogadores por posição — de cima (atacante) pra baixo (goleiro) */}
                {posComJogs.map(pos => (
                  <div key={pos} style={{ display: 'flex', justifyContent: 'space-evenly', alignItems: 'center', padding: '0.5rem 0', position: 'relative', zIndex: 1 }}>
                    {jogsPorPos[pos].map(jt => {
                      const j = jt.jogador
                      const initials = j.full_name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
                      const primeiroNome = j.full_name.split(' ')[0]
                      return (
                        <div key={j.key} style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: '4px', maxWidth: '64px' }}>
                          <div style={{
                            width: '48px', height: '48px', borderRadius: '9999px',
                            border: `3px solid ${timeCampo.color === '#16a34a' ? 'white' : timeCampo.color}`,
                            backgroundColor: 'rgba(0,0,0,0.3)',
                            overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                          }}>
                            {j.photo_url
                              ? <img src={j.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              : <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'white' }}>{initials}</span>}
                          </div>
                          <div style={{ backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: '0.375rem', padding: '2px 6px', textAlign: 'center' as const }}>
                            <p style={{ fontSize: '0.62rem', fontWeight: 700, color: 'white', margin: 0, maxWidth: '56px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{primeiroNome}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
