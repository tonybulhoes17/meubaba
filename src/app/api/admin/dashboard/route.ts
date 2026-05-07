import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const ADMIN_EMAIL = 'tonybulhoes17@gmail.com'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function GET(req: NextRequest) {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const { data: { users }, error: usersError } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
  if (usersError) return NextResponse.json({ error: usersError.message }, { status: 500 })

  const { data: profiles } = await supabaseAdmin.from('profiles').select('id, full_name')
  const profileMap: Record<string, string> = {}
  for (const p of profiles ?? []) profileMap[p.id] = p.full_name ?? ''

  const trintaDiasAtras = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const usuariosFormatados = users.map(u => ({
    id: u.id,
    full_name: profileMap[u.id] ?? u.user_metadata?.full_name ?? '—',
    email: u.email ?? '—',
    created_at: u.created_at,
  }))

  const usuariosAtivos30d = users.filter(u => u.last_sign_in_at && u.last_sign_in_at > trintaDiasAtras).length

  const { data: grupos } = await supabaseAdmin
    .from('groups')
    .select('id, name, city, created_at, group_members(user_id, role, is_active)')
    .order('created_at', { ascending: false })

  const gruposFormatados = (grupos ?? []).map((g: any) => {
    const adminMembro = g.group_members?.find((m: any) => m.role === 'admin')
    let adminName = '—'
    let adminEmail = '—'

    if (adminMembro) {
      adminName = profileMap[adminMembro.user_id] ?? '—'
      const adminUser = users.find((u: any) => u.id === adminMembro.user_id)
      adminEmail = adminUser?.email ?? '—'
    }

    const totalMembros = g.group_members?.filter((m: any) => m.is_active).length ?? 0

    return {
      id: g.id,
      name: g.name,
      city: g.city,
      created_at: g.created_at,
      admin_name: adminName,
      admin_email: adminEmail,
      total_membros: totalMembros,
    }
  })

  return NextResponse.json({
    usuarios: usuariosFormatados,
    grupos: gruposFormatados,
    totalUsuarios: users.length,
    totalGrupos: grupos?.length ?? 0,
    usuariosAtivos30d,
  })
}
