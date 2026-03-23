import { NextRequest, NextResponse } from 'next/server'

const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID!
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_REST_API_KEY!

export async function POST(req: NextRequest) {
  try {
    const { user_ids, title, body, url } = await req.json()

    if (!user_ids?.length) {
      return NextResponse.json({ error: 'No user_ids' }, { status: 400 })
    }

    const payload = {
      app_id: ONESIGNAL_APP_ID,
      include_aliases: { external_id: user_ids },
      target_channel: 'push',
      headings: { en: title, pt: title },
      contents: { en: body, pt: body },
      url: url
        ? `https://meubaba-nine.vercel.app${url}`
        : 'https://meubaba-nine.vercel.app',
    }

    const response = await fetch('https://api.onesignal.com/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Key ${ONESIGNAL_API_KEY}`,
      },
      body: JSON.stringify(payload),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('OneSignal error:', data)
      return NextResponse.json({ error: data }, { status: response.status })
    }

    return NextResponse.json({ ok: true, data })
  } catch (err) {
    console.error('Push route error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
