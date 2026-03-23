'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export function usePushNotifications() {
  const supabase = createClient()

  useEffect(() => {
    registrar()
  }, [])

  async function registrar() {
    // Suporte a push?
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

    // Permissão já negada — não pede de novo
    if (Notification.permission === 'denied') return

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Registra o service worker
      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready

      // Pede permissão se ainda não deu
      if (Notification.permission === 'default') {
        const perm = await Notification.requestPermission()
        if (perm !== 'granted') return
      }

      // Cria subscription
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
        ),
      })

      // Salva no Supabase
      await supabase.from('push_subscriptions').upsert({
        user_id: user.id,
        subscription: subscription.toJSON(),
      }, { onConflict: 'user_id, subscription' })

    } catch (err) {
      console.error('Push registration error:', err)
    }
  }
}

// Converte VAPID key de base64 para Uint8Array
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}
