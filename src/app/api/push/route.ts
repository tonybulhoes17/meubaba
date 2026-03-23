import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

webpush.setVapidDetails(
  process.env.VAPID_EMAIL!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { user_ids, title, body, url } = await req.json()

    if (!user_ids?.length) return NextResponse.json({ ok: true })

    // Busca subscriptions dos usuários
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('subscription')
      .in('user_id', user_ids)

    if (!subs || subs.length === 0) return NextResponse.json({ ok: true })

    const payload = JSON.stringify({
      title: title ?? 'MeuBaba ⚽',
      body: body ?? '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      url: url ?? '/',
    })

    // Envia para todas as subscriptions em paralelo
    await Promise.allSettled(
      subs.map(s => webpush.sendNotification(s.subscription, payload))
    )

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Push error:', err)
    return NextResponse.json({ error: 'Erro ao enviar push' }, { status: 500 })
  }
}
