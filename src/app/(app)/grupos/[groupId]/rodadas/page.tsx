'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Calendar, Clock, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Round, MemberRole, Season } from '@/lib/types'
import { formatDateShort, formatTime, getRoundStatusLabel } from '@/lib/utils'
import ModalCriarRodada from '@/components/rodadas/ModalCriarRodada'

export default function RodadasPage() {
  const { groupId } = useParams<{ groupId: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [rodadas, setRodadas] = useState<Round[]>([])
  const [myRole, setMyRole] = useState<MemberRole>('player')
  const [season, setSeason] = useState<Season | null>(null)
  const [loading, setLoading] = useState(true)
  const [modalCriar, setModalCriar] = useState(false)

  useEffect(() => { fetchData() }, [groupId])

  async function fetchData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: member } = await supabase
      .from('group_members')
      .select('role')
      .eq('group_id', groupId)
      .eq('user_id', user.id)
      .single()

    setMyRole((member?.role as MemberRole) ?? 'player')

    const { data: activeSeason } = await supabase
      .from('seasons')
      .select('*')
      .eq('group_id', groupId)
      .eq('status', 'active')
      .single()

    setSeason(activeSeason ?? null)

    if (activeSeason) {
      const { data: rounds } = await supabase
        .from('rounds')
        .select('*')
        .eq('group_id', groupId)
        .eq('season_id', activeSeason.id)
        .order('scheduled_date', { ascending: false })

      setRodadas(rounds ?? [])
    }

    setLoading(false)
  }

  const isAdmin = myRole === 'admin'

  const statusColors: Record<string, string> = {
    scheduled: 'bg-blue-100 text-blue-700',
    ongoing: 'bg-green-100 text-green-700',
    finished: 'bg-gray-100 text-gray-500',
    cancelled: 'bg-red-100 text-red-500',
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-green-600 pt-12 pb-6 px-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between">
            <button onClick={() => router.push(`/grupos/${groupId}`)} className="text-green-200 hover:text-white transition-colors">
              <ArrowLeft size={22} />
            </button>
            <h1 className="text-white font-bold text-lg">Rodadas</h1>
            <div className="w-6" />
          </div>
          {season && (
            <p className="text-green-200 text-sm text-center mt-2">🏆 {season.name}</p>
          )}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-3">

        {/* Sem temporada */}
        {!season && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center">
            <p className="text-amber-700 font-semibold text-sm">Nenhuma temporada ativa</p>
            <p className="text-amber-500 text-xs mt-1">Inicie uma temporada para criar rodadas.</p>
          </div>
        )}

        {/* Botão criar (admin) */}
        {isAdmin && season && (
          <button
            onClick={() => setModalCriar(true)}
            className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-3.5 rounded-2xl transition-all active:scale-95 shadow-sm"
          >
            <Plus size={18} />
            Nova Rodada
          </button>
        )}

        {/* Loading */}
        {loading && (
          [1,2,3].map(i => (
            <div key={i} className="bg-white rounded-2xl p-4 border border-gray-100 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-1/3" />
            </div>
          ))
        )}

        {/* Lista de rodadas */}
        {!loading && rodadas.length === 0 && season && (
          <div className="text-center py-16">
            <div className="text-5xl mb-3">📅</div>
            <p className="text-gray-600 font-semibold">Nenhuma rodada ainda</p>
            <p className="text-gray-400 text-sm mt-1">
              {isAdmin ? 'Crie a primeira rodada!' : 'Aguarde o admin criar uma rodada.'}
            </p>
          </div>
        )}

        {rodadas.map(rodada => (
          <button
            key={rodada.id}
            onClick={() => router.push(`/grupos/${groupId}/rodadas/${rodada.id}`)}
            className="w-full bg-white rounded-2xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition-all text-left active:scale-[0.99]"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[rodada.status]}`}>
                    {getRoundStatusLabel(rodada.status)}
                  </span>
                </div>
                <p className="font-bold text-gray-800">
                  {rodada.title ?? `Rodada de ${formatDateShort(rodada.scheduled_date)}`}
                </p>
                <div className="flex items-center gap-3 mt-2">
                  <span className="flex items-center gap-1 text-xs text-gray-400">
                    <Calendar size={11} />
                    {formatDateShort(rodada.scheduled_date)}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-gray-400">
                    <Clock size={11} />
                    {formatTime(rodada.start_time)}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-gray-400">
                    <Users size={11} />
                    {rodada.players_per_team}x{rodada.players_per_team}
                  </span>
                </div>
              </div>
              <span className="text-gray-300 text-xl ml-2">›</span>
            </div>
          </button>
        ))}
      </div>

      {modalCriar && season && (
        <ModalCriarRodada
          groupId={groupId}
          seasonId={season.id}
          onClose={() => setModalCriar(false)}
          onSuccess={() => { setModalCriar(false); fetchData() }}
        />
      )}
    </div>
  )
}
