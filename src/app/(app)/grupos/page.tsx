'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, LogIn, MapPin, ChevronRight, Trophy, Download } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import type { GroupWithMeta } from '@/lib/types'
import ModalCriarGrupo from '@/components/grupos/ModalCriarGrupo'
import ModalEntrarGrupo from '@/components/grupos/ModalEntrarGrupo'

export default function GruposPage() {
  const router = useRouter()
  const supabase = createClient()
  const { profile } = useAuthStore()

  const [grupos, setGrupos] = useState<GroupWithMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [modalCriar, setModalCriar] = useState(false)
  const [modalEntrar, setModalEntrar] = useState(false)
  const [proximaRodada, setProximaRodada] = useState<{ id: string; groupId: string; groupName: string; title: string; date: string; time: string; status: string } | null>(null)

  // PWA Install
  const [promptEvento, setPromptEvento] = useState<any>(null)
  const [mostrarBotaoInstalar, setMostrarBotaoInstalar] = useState(false)
  const [mostrarInstrucoes, setMostrarInstrucoes] = useState(false)
  const [isAndroid, setIsAndroid] = useState(false)

  useEffect(() => {
    fetchGrupos()

    // Já instalado — não mostra nada
    if (window.matchMedia('(display-mode: standalone)').matches) return
    if ((window.navigator as any).standalone === true) return
    if (localStorage.getItem('pwa-dispensado')) return

    const android = /android/i.test(navigator.userAgent)
    setIsAndroid(android)

    // Captura evento nativo do Chrome
    const handler = (e: any) => {
      e.preventDefault()
      setPromptEvento(e)
      setMostrarBotaoInstalar(true)
    }
    window.addEventListener('beforeinstallprompt', handler)

    // Fallback: mostra botão mesmo sem o evento (Android que ignorou antes)
    if (android) {
      setTimeout(() => {
        setMostrarBotaoInstalar(true)
      }, 2000)
    }

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function handleInstalar() {
    if (promptEvento) {
      // Tem o evento nativo — dispara o prompt do Chrome
      promptEvento.prompt()
      const { outcome } = await promptEvento.userChoice
      if (outcome === 'accepted') {
        localStorage.setItem('pwa-dispensado', 'true')
        setMostrarBotaoInstalar(false)
      }
    } else {
      // Sem evento nativo — mostra instruções manuais
      setMostrarInstrucoes(true)
    }
  }

  async function fetchGrupos() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('group_members')
      .select(`
        role,
        groups (
          id, name, description, city, invite_code, photo_url, created_at,
          seasons (id, name, status)
        )
      `)
      .eq('user_id', user.id)
      .eq('is_active', true)

    if (error || !data) { setLoading(false); return }

    const gruposFormatados: GroupWithMeta[] = data
      .filter((item: any) => item.groups)
      .map((item: any) => ({
        ...item.groups,
        my_role: item.role,
        active_season: item.groups.seasons?.find((s: any) => s.status === 'active') ?? null,
      }))

    setGrupos(gruposFormatados)

    const groupIds = gruposFormatados.map((g: any) => g.id)
    if (groupIds.length > 0) {
      const { data: rodadas } = await supabase
        .from('rounds')
        .select('id, group_id, title, scheduled_date, start_time, status')
        .in('group_id', groupIds)
        .in('status', ['scheduled', 'ongoing'])
        .gte('scheduled_date', new Date().toISOString().split('T')[0])
        .order('scheduled_date', { ascending: true })
        .limit(1)
        .single()

      if (rodadas) {
        const grupo = gruposFormatados.find((g: any) => g.id === rodadas.group_id)
        setProximaRodada({
          id: rodadas.id,
          groupId: rodadas.group_id,
          groupName: grupo?.name ?? '',
          title: rodadas.title ?? `Rodada de ${new Date(rodadas.scheduled_date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long' })}`,
          date: new Date(rodadas.scheduled_date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' }),
          time: rodadas.start_time ? rodadas.start_time.slice(0, 5) : '',
          status: rodadas.status,
        })
      }
    }

    setLoading(false)
  }

  const firstName = profile?.full_name?.split(' ')[0] ?? 'Jogador'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-green-600 pt-12 pb-6 px-4">
        <div className="max-w-lg mx-auto">
          <p className="text-green-200 text-sm">Olá,</p>
          <h1 className="text-white text-2xl font-bold">{firstName} ⚽</h1>
          <p className="text-green-200 text-sm mt-1">
            {grupos.length === 0
              ? 'Você ainda não participa de nenhum baba'
              : `Você participa de ${grupos.length} baba${grupos.length > 1 ? 's' : ''}`}
          </p>
        </div>
      </div>

      {/* Botões de ação */}
      <div className="max-w-lg mx-auto px-4 -mt-4">
        <div className="flex gap-3">
          <button
            onClick={() => setModalCriar(true)}
            className="flex-1 flex items-center justify-center gap-2 bg-white text-green-700 font-semibold py-3 px-4 rounded-2xl shadow-sm border border-green-100 hover:bg-green-50 transition-all active:scale-95"
          >
            <Plus size={18} />
            Criar Baba
          </button>
          <button
            onClick={() => setModalEntrar(true)}
            className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white font-semibold py-3 px-4 rounded-2xl shadow-sm hover:bg-green-700 transition-all active:scale-95"
          >
            <LogIn size={18} />
            Entrar com Codigo
          </button>
        </div>
      </div>

      {/* Banner próxima rodada */}
      {proximaRodada && (
        <div className="max-w-lg mx-auto px-4 mt-3">
          <button
            onClick={() => router.push(`/grupos/${proximaRodada.groupId}/rodadas/${proximaRodada.id}`)}
            style={{ background: proximaRodada.status === 'ongoing' ? 'linear-gradient(135deg, #f97316, #ea580c)' : 'linear-gradient(135deg, #1e293b, #334155)' }}
            className="w-full flex items-center gap-3 p-4 rounded-2xl shadow-md active:scale-[0.99] transition-all text-left"
          >
            <div style={{ backgroundColor: 'rgba(255,255,255,0.15)' }} className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-2xl">
              {proximaRodada.status === 'ongoing' ? '🔴' : '📅'}
            </div>
            <div className="flex-1 min-w-0">
              <p style={{ color: 'rgba(255,255,255,0.75)' }} className="text-xs font-semibold uppercase tracking-wide mb-0.5">
                {proximaRodada.status === 'ongoing' ? '🔴 Rodada em andamento' : '⏭ Próxima rodada'} · {proximaRodada.groupName}
              </p>
              <p className="text-white font-bold text-base truncate">{proximaRodada.title}</p>
              <p style={{ color: 'rgba(255,255,255,0.7)' }} className="text-xs mt-0.5">
                📅 {proximaRodada.date}{proximaRodada.time ? ` às ${proximaRodada.time}` : ''}
              </p>
            </div>
            <ChevronRight size={20} color="rgba(255,255,255,0.6)" className="flex-shrink-0" />
          </button>
        </div>
      )}

      {/* Lista de grupos */}
      <div className="max-w-lg mx-auto px-4 mt-6 space-y-3 pb-6">
        {loading ? (
          [1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-2xl p-4 border border-gray-100 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 bg-gray-200 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
              </div>
            </div>
          ))
        ) : grupos.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">⚽</div>
            <h3 className="text-gray-700 font-semibold text-lg mb-2">Nenhum baba ainda</h3>
            <p className="text-gray-400 text-sm max-w-xs mx-auto">
              Crie seu primeiro baba ou entre em um usando o código de convite
            </p>
          </div>
        ) : (
          grupos.map(grupo => (
            <button
              key={grupo.id}
              onClick={() => router.push(`/grupos/${grupo.id}`)}
              className="w-full bg-white rounded-2xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition-all active:scale-[0.99] text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {grupo.photo_url ? (
                    <img src={grupo.photo_url} alt={grupo.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl">⚽</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-gray-800 truncate">{grupo.name}</h3>
                    {grupo.my_role === 'admin' && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium flex-shrink-0">
                        Admin
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    {grupo.city && (
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <MapPin size={11} />
                        {grupo.city}
                      </span>
                    )}
                    {grupo.active_season ? (
                      <span className="flex items-center gap-1 text-xs text-green-600">
                        <Trophy size={11} />
                        {grupo.active_season.name}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">Sem temporada ativa</span>
                    )}
                  </div>
                </div>
                <ChevronRight size={18} className="text-gray-300 flex-shrink-0" />
              </div>
            </button>
          ))
        )}
      </div>

      {/* Botão convidar amigo */}
      <div className="max-w-lg mx-auto px-4 pb-3">
        <button
          onClick={() => {
            const url = window.location.origin + '/landing'
            if (navigator.share) {
              navigator.share({ title: 'MeuBaba', text: 'Conhece o MeuBaba? É a plataforma perfeita para organizar seu grupo de futebol!', url })
            } else {
              navigator.clipboard.writeText(url)
              alert('Link copiado! Compartilhe com seus amigos.')
            }
          }}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl border-2 border-dashed border-green-200 text-green-600 font-semibold text-sm hover:bg-green-50 transition-all"
        >
          <span>🔗</span> Convidar amigo para conhecer o MeuBaba
        </button>
      </div>

      {/* Botão manual de uso */}
      <div className="max-w-lg mx-auto px-4 pb-3">
        <button
          onClick={() => router.push('/manual')}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl border-2 border-dashed border-blue-200 text-blue-500 font-semibold text-sm hover:bg-blue-50 transition-all"
        >
          <span>📖</span> Aprender a usar o MeuBaba
        </button>
      </div>

      {/* Botão instalar app */}
      {mostrarBotaoInstalar && (
        <div className="max-w-lg mx-auto px-4 pb-8">
          <button
            onClick={handleInstalar}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-green-600 text-white font-semibold text-sm hover:bg-green-700 transition-all active:scale-95 shadow-sm"
          >
            <Download size={16} />
            Instale o app no seu celular
          </button>

          {/* Instruções manuais (fallback quando não tem o evento nativo) */}
          {mostrarInstrucoes && (
            <div className="mt-3 bg-white rounded-2xl border border-green-100 p-4 shadow-sm">
              <p className="text-gray-700 font-semibold text-sm mb-3">Como instalar:</p>
              <div className="flex flex-col gap-2">
                {isAndroid ? (
                  <>
                    <div className="flex items-start gap-2">
                      <span className="w-5 h-5 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">1</span>
                      <span className="text-sm text-gray-600">Toque no menu <strong>⋮</strong> (três pontos) no canto superior direito do Chrome</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="w-5 h-5 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">2</span>
                      <span className="text-sm text-gray-600">Toque em <strong>"Adicionar à tela inicial"</strong></span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="w-5 h-5 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">3</span>
                      <span className="text-sm text-gray-600">Confirme tocando em <strong>"Adicionar"</strong></span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-start gap-2">
                      <span className="w-5 h-5 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">1</span>
                      <span className="text-sm text-gray-600">Toque no botão <strong>Compartilhar</strong> (ícone de seta para cima) no Safari</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="w-5 h-5 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">2</span>
                      <span className="text-sm text-gray-600">Role e toque em <strong>"Adicionar à Tela de Início"</strong></span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="w-5 h-5 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">3</span>
                      <span className="text-sm text-gray-600">Toque em <strong>"Adicionar"</strong> no canto superior direito</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modais */}
      {modalCriar && (
        <ModalCriarGrupo
          onClose={() => setModalCriar(false)}
          onSuccess={() => { setModalCriar(false); fetchGrupos() }}
        />
      )}
      {modalEntrar && (
        <ModalEntrarGrupo
          onClose={() => setModalEntrar(false)}
          onSuccess={() => { setModalEntrar(false); fetchGrupos() }}
        />
      )}
    </div>
  )
}
