import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Cliente admin separado — não afeta sessão do usuário atual
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false, // CRÍTICO: não persiste sessão
      detectSessionInUrl: false,
    }
  }
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

    // 1. Verifica se email já existe
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers()
    const existente = users?.find(u => u.email?.toLowerCase() === email.toLowerCase())

    let userId: string

    if (existente) {
      // Usuário já existe — só adiciona ao grupo
      userId = existente.id
    } else {
      // 2. Cria usuário novo
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: email.trim().toLowerCase(),
        password: senha,
        email_confirm: true,
        user_metadata: { full_name: nome },
      })

      if (authError || !authData?.user) {
        return NextResponse.json({ error: authError?.message ?? 'Erro ao criar usuário.' }, { status: 400 })
      }

      userId = authData.user.id

      // 3. Atualiza perfil com nome
      await supabaseAdmin
        .from('profiles')
        .upsert({ id: userId, full_name: nome })
    }

    // 4. Adiciona ao grupo se ainda não for membro
    const { data: jaEMembro } = await supabaseAdmin
      .from('group_members')
      .select('id, is_active')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .single()

    if (jaEMembro) {
      if (!jaEMembro.is_active) {
        // Reativa membro removido
        await supabaseAdmin
          .from('group_members')
          .update({ is_active: true })
          .eq('id', jaEMembro.id)
      }
      // Já é membro ativo — ok
    } else {
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
