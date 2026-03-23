import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

export async function notificarMembros(
  groupId: string,
  tipo: string,
  titulo: string,
  corpo: string | null,
  data: Record<string, any> | null,
  excluirUserId?: string // não notifica quem gerou a ação
) {
  const { data: membros } = await supabase
    .from('group_members')
    .select('user_id')
    .eq('group_id', groupId)
    .eq('is_active', true)

  const destinatarios = (membros ?? [])
    .map(m => m.user_id)
    .filter(uid => uid !== excluirUserId)

  if (destinatarios.length === 0) return

  await supabase.from('notifications').insert(
    destinatarios.map(uid => ({
      user_id: uid,
      group_id: groupId,
      type: tipo,
      title: titulo,
      body: corpo,
      data: data,
      is_read: false,
    }))
  )
}

export async function notificarUsuario(
  userId: string,
  groupId: string | null,
  tipo: string,
  titulo: string,
  corpo: string | null,
  data: Record<string, any> | null
) {
  await supabase.from('notifications').insert({
    user_id: userId,
    group_id: groupId,
    type: tipo,
    title: titulo,
    body: corpo,
    data: data,
    is_read: false,
  })
}
