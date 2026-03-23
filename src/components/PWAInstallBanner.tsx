'use client'

import { useEffect, useState } from 'react'
import { X, Download, Share } from 'lucide-react'

type Plataforma = 'android' | 'ios' | null

export default function PWAInstallBanner() {
  const [plataforma, setPlataforma] = useState<Plataforma>(null)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [visivel, setVisivel] = useState(false)
  const [instalando, setInstalando] = useState(false)

  useEffect(() => {
    // Não mostra se já está instalado (rodando como PWA)
    const jaPWA = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as any).standalone === true
    if (jaPWA) return

    // Não mostra se o usuário já dispensou
    const dispensado = localStorage.getItem('pwa-banner-dispensado')
    if (dispensado) return

    const ua = navigator.userAgent.toLowerCase()
    const isIOS = /iphone|ipad|ipod/.test(ua)
    const isAndroid = /android/.test(ua)
    const isSafari = /safari/.test(ua) && !/chrome/.test(ua)

    // Android — escuta evento nativo
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setPlataforma('android')
      setVisivel(true)
    }
    window.addEventListener('beforeinstallprompt', handler)

    // iOS Safari — mostra instruções manuais
    if (isIOS && isSafari) {
      setPlataforma('ios')
      setTimeout(() => setVisivel(true), 2000) // pequeno delay
    }

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  function dispensar() {
    setVisivel(false)
    localStorage.setItem('pwa-banner-dispensado', '1')
  }

  async function instalarAndroid() {
    if (!deferredPrompt) return
    setInstalando(true)
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setVisivel(false)
      localStorage.setItem('pwa-banner-dispensado', '1')
    }
    setInstalando(false)
    setDeferredPrompt(null)
  }

  if (!visivel) return null

  return (
    <>
      {/* Overlay clicável para fechar */}
      <div
        className="fixed inset-0 z-40 bg-black/20"
        onClick={dispensar}
      />

      {/* Banner — aparece na parte inferior */}
      <div className="fixed bottom-0 left-0 right-0 z-50 p-4 pb-safe"
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
        <div style={{ backgroundColor: 'white', borderRadius: '1.25rem', boxShadow: '0 -4px 32px rgba(0,0,0,0.15)', overflow: 'hidden', maxWidth: '480px', margin: '0 auto' }}>

          {/* Header verde */}
          <div style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', padding: '1rem 1rem 0.875rem', display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
            <div style={{ width: '3rem', height: '3rem', backgroundColor: 'white', borderRadius: '0.875rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>⚽</div>
            <div style={{ flex: 1 }}>
              <p style={{ color: 'white', fontWeight: 800, fontSize: '1rem', margin: 0 }}>Instalar MeuBaba</p>
              <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.75rem', margin: '2px 0 0' }}>Acesso rápido direto da tela inicial</p>
            </div>
            <button onClick={dispensar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.7)', padding: '4px' }}>
              <X size={20} />
            </button>
          </div>

          <div style={{ padding: '1rem' }}>

            {/* Android */}
            {plataforma === 'android' && (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                  {[
                    '✅ Abre direto sem navegador',
                    '⚡ Carrega mais rápido',
                    '🔔 Receba notificações do grupo',
                  ].map(item => (
                    <p key={item} style={{ fontSize: '0.875rem', color: '#475569', margin: 0 }}>{item}</p>
                  ))}
                </div>
                <button onClick={instalarAndroid} disabled={instalando}
                  style={{ width: '100%', background: 'linear-gradient(135deg, #16a34a, #15803d)', border: 'none', borderRadius: '0.875rem', padding: '0.875rem', color: 'white', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  <Download size={18} />
                  {instalando ? 'Instalando...' : 'Instalar agora'}
                </button>
                <button onClick={dispensar}
                  style={{ width: '100%', marginTop: '0.5rem', background: 'none', border: 'none', color: '#94a3b8', fontSize: '0.875rem', cursor: 'pointer', padding: '0.5rem' }}>
                  Agora não
                </button>
              </>
            )}

            {/* iOS */}
            {plataforma === 'ios' && (
              <>
                <p style={{ fontSize: '0.875rem', color: '#475569', margin: '0 0 1rem', lineHeight: 1.6 }}>
                  Para instalar o MeuBaba no seu iPhone, siga os passos:
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
                  {[
                    { num: '1', texto: 'Toque no botão de Compartilhar', icon: '⬆️', desc: '(o ícone de caixinha com seta, na barra inferior do Safari)' },
                    { num: '2', texto: 'Role para baixo e toque em', icon: '➕', desc: '"Adicionar à Tela de Início"' },
                    { num: '3', texto: 'Toque em "Adicionar"', icon: '✅', desc: 'O ícone do MeuBaba vai aparecer na sua tela inicial' },
                  ].map(s => (
                    <div key={s.num} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', backgroundColor: '#f8fafc', borderRadius: '0.75rem', padding: '0.75rem' }}>
                      <div style={{ width: '1.75rem', height: '1.75rem', backgroundColor: '#dcfce7', borderRadius: '9999px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.8rem', color: '#16a34a', flexShrink: 0 }}>{s.num}</div>
                      <div>
                        <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e293b', margin: 0 }}>
                          {s.texto} <span style={{ fontSize: '1rem' }}>{s.icon}</span>
                        </p>
                        <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '2px 0 0' }}>{s.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={dispensar}
                  style={{ width: '100%', background: 'none', border: '1.5px solid #e2e8f0', borderRadius: '0.875rem', padding: '0.75rem', color: '#64748b', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}>
                  Entendi, obrigado!
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
