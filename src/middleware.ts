import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Atualiza sessão (IMPORTANTE: não remover)
  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // Link de email do Supabase que caiu na raiz (Site URL) com código de auth:
  // encaminha para o callback em vez de mandar para o login e perder o código.
  const sp = request.nextUrl.searchParams
  if (pathname === '/' && (sp.has('code') || sp.has('token_hash') || sp.has('error_code'))) {
    const url = request.nextUrl.clone()
    url.pathname = '/api/auth/callback'
    return NextResponse.redirect(url)
  }

  // Rotas públicas (não precisam de login)
  const publicRoutes = ['/login', '/cadastro', '/recuperar-senha', '/redefinir-senha', '/auth/callback', '/api/auth', '/landing']
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route))

  // Rotas públicas que também devem funcionar para quem JÁ tem sessão
  // (o link de recuperação cria uma sessão temporária antes de trocar a senha)
  const allowWhenLoggedIn = ['/redefinir-senha', '/auth/callback', '/api/auth']
  const isAllowedWhenLoggedIn = allowWhenLoggedIn.some(route => pathname.startsWith(route))

  // Redireciona para login se não autenticado e rota protegida
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Redireciona para grupos se já logado e tenta acessar auth
  if (user && isPublicRoute && !isAllowedWhenLoggedIn) {
    const url = request.nextUrl.clone()
    url.pathname = '/grupos'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|OneSignalSDKWorker\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|json|js|ico)$).*)',
  ],
}
