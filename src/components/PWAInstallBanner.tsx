'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'

export default function PWAInstallBanner() {
  const [promptEvento,   setPromptEvento]   = useState<any>(null)
  const [mostrarAndroid, setMostrarAndroid] = useState(false)
  const [mostrarIOS,     setMostrarIOS]     = useState(false)

  useEffect(() => {
    // Já instalado como PWA — não mostra nada
    if (window.matchMedia('(display-mode: standalone)').matches) return
    if ((window.navigator as any).standalone === true) return

    // ── Android/Chrome ──────────────────────────────────────
    const handleBeforeInstall = (e: any) => {
      e.preventDefault()
      setPromptEvento(e)
      const dispensado = localStorage.getItem('pwa-dispensado')
      if (!dispensado) setMostrarAndroid(true)
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstall)

    // ── iOS/Safari ──────────────────────────────────────────
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
    const isSafari = /safari/i.test(navigator.userAgent) && !/chrome/i.test(navigator.userAgent)

    if (isIOS && isSafari) {
      const dispensado = localStorage.getItem('pwa-ios-dispensado')
      if (!dispensado) {
        setTimeout(() => setMostrarIOS(true), 3000)
      }
    }

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
  }, [])

  const instalarAndroid = async () => {
    if (!promptEvento) return
    promptEvento.prompt()
    const { outcome } = await promptEvento.userChoice
    if (outcome === 'accepted') {
      localStorage.setItem('pwa-dispensado', 'true')
    }
    setMostrarAndroid(false)
  }

  const dispensarAndroid = () => {
    localStorage.setItem('pwa-dispensado', 'true')
    setMostrarAndroid(false)
  }

  const dispensarIOS = () => {
    localStorage.setItem('pwa-ios-dispensado', 'true')
    setMostrarIOS(false)
  }

  return (
    <>
      {/* ── BANNER ANDROID — sobe de baixo ─────────────────── */}
      {mostrarAndroid && (
        <div style={{
          position: 'fixed', bottom: '5rem', left: '1rem', right: '1rem',
          zIndex: 99, animation: 'slideUp 0.3s ease',
        }}>
          <style>{`@keyframes slideUp { from { transform: translateY(100px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }`}</style>
          <div style={{
            background: '#0f172a',
            border: '1px solid rgba(22,163,74,0.3)',
            borderRadius: '1rem',
            padding: '1rem',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <img src="/icons/icon-192.png" style={{ width: '3rem', height: '3rem', borderRadius: '0.75rem' }} alt="MeuBaba" />
              <div style={{ flex: 1 }}>
                <p style={{ color: 'white', fontWeight: 700, fontSize: '0.875rem', margin: 0 }}>Instalar MeuBaba</p>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', margin: '2px 0 0' }}>Acesse mais rapido pela tela inicial</p>
              </div>
              <button onClick={dispensarAndroid}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', padding: '4px' }}>
                <X size={16} />
              </button>
            </div>
            <button onClick={instalarAndroid}
              style={{
                width: '100%', marginTop: '0.75rem',
                backgroundColor: '#16a34a', border: 'none', borderRadius: '0.625rem',
                padding: '0.625rem', color: 'white', fontWeight: 700,
                fontSize: '0.875rem', cursor: 'pointer',
              }}>
              Instalar agora
            </button>
          </div>
        </div>
      )}

      {/* ── BANNER iOS ─────────────────────────────────────── */}
      {mostrarIOS && (
        <div style={{
          position: 'fixed', bottom: '5rem', left: '1rem', right: '1rem',
          zIndex: 99, animation: 'slideUp 0.3s ease',
        }}>
          <div style={{
            background: '#0f172a',
            border: '1px solid rgba(22,163,74,0.3)',
            borderRadius: '1rem',
            padding: '1rem',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <p style={{ color: 'white', fontWeight: 700, fontSize: '0.875rem', margin: 0 }}>Instalar no iPhone</p>
              <button onClick={dispensarIOS}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', padding: '4px' }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {[
                { n: '1', txt: 'Toque no botão Compartilhar (seta para cima)' },
                { n: '2', txt: 'Role e toque em "Adicionar à Tela de Início"' },
                { n: '3', txt: 'Toque em "Adicionar" no canto superior direito' },
              ].map(s => (
                <div key={s.n} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{
                    width: '1.5rem', height: '1.5rem', backgroundColor: '#16a34a',
                    color: 'white', borderRadius: '9999px', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.75rem', fontWeight: 700, flexShrink: 0,
                  }}>{s.n}</span>
                  <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.8rem' }}>{s.txt}</span>
                </div>
              ))}
            </div>
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem', textAlign: 'center', marginTop: '0.75rem' }}>
              ↓ botão compartilhar fica aqui embaixo
            </p>
          </div>
        </div>
      )}
    </>
  )
}
