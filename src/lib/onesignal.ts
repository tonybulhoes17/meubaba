import OneSignal from 'react-onesignal'

let initialized = false

export async function initOneSignal(userId: string) {
  if (typeof window === 'undefined') return

  if (!initialized) {
    initialized = true
    await OneSignal.init({
      appId: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID!,
      serviceWorkerPath: '/OneSignalSDKWorker.js',
      notifyButton: { enable: false },
      allowLocalhostAsSecureOrigin: false,
    })
  }

  // Vincula o user do Supabase ao OneSignal
  await OneSignal.login(userId)

  // Pede permissão se ainda não foi concedida
  const permission = OneSignal.Notifications.permission
  if (!permission) {
    await OneSignal.Notifications.requestPermission()
  }
}
