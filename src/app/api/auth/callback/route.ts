import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'

// Recebe os links que o Supabase manda por email (recuperação de senha,
// confirmação de cadastro etc.) e cria a sessão no servidor.
// Suporta os dois formatos:
//   ?code=...                     (PKCE — padrão do resetPasswordForEmail do app)
//   ?token_hash=...&type=recovery (template de email com {{ .TokenHash }})
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const nextParam = searchParams.get('next')
  // Só aceita caminhos internos (evita open redirect)
  const next = nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/grupos'
  const isRecoveryHint = next === '/redefinir-senha' || type === 'recovery'

  const errorCode = searchParams.get('error_code') || searchParams.get('error')
  if (errorCode) {
    return NextResponse.redirect(
      `${origin}${isRecoveryHint ? '/redefinir-senha' : '/login'}?error=${encodeURIComponent(errorCode)}`
    )
  }

  const supabase = await createClient()

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    if (!error) {
      return NextResponse.redirect(`${origin}${type === 'recovery' ? '/redefinir-senha' : next}`)
    }
    return NextResponse.redirect(
      `${origin}${type === 'recovery' ? '/redefinir-senha' : '/login'}?error=link_invalido`
    )
  }

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // auth-js devolve redirectType em runtime (ex.: 'recovery'), mas o tipo público não declara
      const redirectType = (data as { redirectType?: string | null } | null)?.redirectType
      const isRecovery = redirectType === 'recovery' || isRecoveryHint
      return NextResponse.redirect(`${origin}${isRecovery ? '/redefinir-senha' : next}`)
    }
    if (isRecoveryHint) {
      return NextResponse.redirect(`${origin}/redefinir-senha?error=link_invalido`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`)
}
