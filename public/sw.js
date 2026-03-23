// Service Worker — MeuBaba Push Notifications
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))

// Recebe push notification
self.addEventListener('push', e => {
  if (!e.data) return

  let data = {}
  try { data = e.data.json() } catch { data = { title: 'MeuBaba', body: e.data.text() } }

  const { title = 'MeuBaba ⚽', body = '', icon = '/icons/icon-192.png', badge = '/icons/icon-192.png', url = '/' } = data

  e.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge,
      vibrate: [200, 100, 200],
      data: { url },
      actions: [{ action: 'open', title: 'Abrir' }],
    })
  )
})

// Clique na notificação — abre o app na URL correta
self.addEventListener('notificationclick', e => {
  e.notification.close()
  const url = e.notification.data?.url || '/'

  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      // Se já tem janela aberta, foca e navega
      for (const client of clients) {
        if ('focus' in client) {
          client.focus()
          client.navigate(url)
          return
        }
      }
      // Senão abre nova janela
      if (self.clients.openWindow) return self.clients.openWindow(url)
    })
  )
})
