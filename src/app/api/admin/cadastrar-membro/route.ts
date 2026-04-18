import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: NextRequest) {
  try {
    const { nome, email, senha, groupId } = await req.json()

    if (!nome || !email || !senha || !groupId) {
      return NextResponse.json({ error: 'Dados incompletos.' }, { status: 400 })
    }

    if (senha.length < 6) {
      return NextResponse.json({ error: 'A senha deve ter pelo menos 6 caracteres.' }, { status: 400 })
    }

    // 1. Cria o usuário no Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password: senha,
      email_confirm: true,
      user_metadata: { full_name: nome },
    })

    if (authError) {
      if (authError.message.includes('already') || authError.status === 422) {
        // Usuário já existe — busca o user_id existente e adiciona ao grupo
        const { data: existingUser } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('id', (await supabaseAdmin.auth.admin.listUsers()).data.users.find(u => u.email === email.toLowerCase())?.id ?? '')
          .single()

        if (!existingUser) {
          return NextResponse.json({ error: 'Este email já está cadastrado em outra conta.' }, { status: 400 })
        }
      } else {
        return NextResponse.json({ error: authError.message }, { status: 400 })
      }
    }

    const userId = authData?.user?.id

    if (!userId) {
      return NextResponse.json({ error: 'Erro ao obter ID do usuário.' }, { status: 500 })
    }

    // 2. Atualiza o perfil com o nome
    await supabaseAdmin
      .from('profiles')
      .upsert({ id: userId, full_name: nome })

    // 3. Adiciona ao grupo se ainda não for membro
    const { data: jaEMembro } = await supabaseAdmin
      .from('group_members')
      .select('id')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .single()

    if (!jaEMembro) {
      const { error: memberError } = await supabaseAdmin
        .from('group_members')
        .insert({ group_id: groupId, user_id: userId, role: 'player', is_active: true })

      if (memberError) {
        return NextResponse.json({ error: 'Usuário criado mas erro ao adicionar ao grupo.' }, { status: 500 })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Erro ao cadastrar membro:', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
