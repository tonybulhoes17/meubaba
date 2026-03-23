'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export function OneSignalInit() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if ((window as any).OneSignalInitialized) return
    ;(window as any).OneSignalInitialized = true

    window.OneSignalDeferred = window.OneSignalDeferred || []

    const script = document.createElement('script')
    script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js'
    script.async = true
    script.onload = () => {
      window.OneSignalDeferred.push(async function(OneSignal: any) {
        await OneSignal.init({
          appId: 'e05868c8-924f-4cf3-9668-7f8f0d60b1a9',
          notifyButton: { enable: false },
          allowLocalhostAsSecureOrigin: false,
          promptOptions: {
            slidedown: {
              prompts: []
            }
          }
        })

        setTimeout(async () => {
          try {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
              // Vincula user_id do Supabase como tag (igual ao projeto de referência)
              await OneSignal.User.addTags({ user_id: user.id })
            }

            // Pede permissão só se ainda não respondeu
            const permission = Notification.permission
            if (permission === 'default') {
              await OneSignal.Notifications.requestPermission()
            }
          } catch(e) {
            console.log('OneSignal error:', e)
          }
        }, 2000)
      })
    }
    document.head.appendChild(script)
  }, [])

  return null
}

declare global {
  interface Window {
    OneSignalDeferred: any[]
  }
}
