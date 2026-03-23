'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export function OneSignalInit() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    const init = async () => {
      await window.OneSignalDeferred?.push(async (OneSignal: any) => {
        await OneSignal.init({
          appId: 'e05868c8-924f-4cf3-9668-7f8f0d60b1a9',
          serviceWorkerPath: '/OneSignalSDKWorker.js',
          notifyButton: { enable: false },
          promptOptions: {
            slidedown: {
              prompts: [{
                type: 'push',
                autoPrompt: false,
              }]
            }
          }
        })
      })
    }

    const script = document.createElement('script')
    script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js'
    script.defer = true
    script.onload = init
    document.head.appendChild(script)
  }, [])

  // Vincula user_id do Supabase como tag no OneSignal
  useEffect(() => {
    const linkUser = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      window.OneSignalDeferred = window.OneSignalDeferred || []
      window.OneSignalDeferred.push(async (OneSignal: any) => {
        await OneSignal.User.addTag('user_id', user.id)
      })
    }
    linkUser()
  }, [])

  return null
}

declare global {
  interface Window {
    OneSignalDeferred: any[]
  }
}
