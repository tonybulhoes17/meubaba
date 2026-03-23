import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

async function enviarPush(user_ids: string[], title: string, body: string, url: string) {
  try {
    await fetch('/api/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_ids, title, body, url }),
    })
  } catch (err) {
    console.error('Push send error:', err)
  }
}

export async function notificarMembros(
  groupId: string,
  tipo: string,
  titulo: string,
  corpo: string | null,
  data: Record<string, any> | null,
  excluirUserId?: string
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

  const url = data?.round_id
    ? `/grupos/${groupId}/rodadas/${data.round_id}`
    : data?.poll_id
    ? `/grupos/${groupId}/enquetes/${data.poll_id}`
    : `/grupos/${groupId}`

  enviarPush(destinatarios, titulo, corpo ?? '', url)
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

  const url = groupId ? `/grupos/${groupId}` : '/'
  enviarPush([userId], titulo, corpo ?? '', url)
}
