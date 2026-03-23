'use client'

import { useState } from 'react'
import { X, Loader2, Trophy } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  groupId: string
  onClose: () => void
  onSuccess: () => void
}

export default function ModalCriarTemporada({ groupId, onClose, onSuccess }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nome, setNome] = useState(`Temporada ${new Date().getFullYear()}`)
  const [dataInicio, setDataInicio] = useState(
    new Date().toISOString().split('T')[0]
  )

  async function handleCriar(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase
      .from('seasons')
      .insert({
        group_id: groupId,
        name: nome.trim(),
        started_at: dataInicio,
        status: 'active',
        created_by: user.id,
      })

    if (error) {
      setError('Erro ao criar temporada. Tente novamente.')
      setLoading(false)
      return
    }

    onSuccess()
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center">
              <Trophy size={20} className="text-yellow-600" />
            </div>
            <h2 className="text-lg font-bold text-gray-800">Nova Temporada</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={22} />
          </button>
        </div>

        <form onSubmit={handleCriar} className="p-5 space-y-4">
          <p className="text-sm text-gray-500">
            A temporada organiza todas as estatísticas, rodadas e rankings do seu baba.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nome da temporada
            </label>
            <input
              type="text"
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="Ex: Temporada 2026"
              required
              maxLength={50}
              className="input-baba"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Data de início
            </label>
            <input
              type="date"
              value={dataInicio}
              onChange={e => setDataInicio(e.target.value)}
              required
              className="input-baba"
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">{error}</div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-200 text-gray-600 font-semibold py-3 rounded-xl hover:bg-gray-50 transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !nome.trim()}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Trophy size={18} />}
              {loading ? 'Criando...' : 'Iniciar Temporada'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
