'use client'

import { useEffect, useState } from 'react'
import { Download, X, Share2 } from 'lucide-react'

export default function PWAInstallBanner() {
  const [prompt,     setPrompt]     = useState<any>(null)
  const [mostrar,    setMostrar]    = useState(false)
  const [mostrarIOS, setMostrarIOS] = useState(false)

  useEffect(() => {
    // Já instalado como PWA — não mostra nada
    if (window.matchMedia('(display-mode: standalone)').matches) return
    if ((window.navigator as any).standalone === true) return

    const isIOS    = /iphone|ipad|ipod/i.test(navigator.userAgent)
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)

    // iOS Safari — instruções manuais após 3s
    if (isIOS && isSafari) {
      if (!localStorage.getItem('pwa-ios-dispensado')) {
        setTimeout(() => setMostrarIOS(true), 3000)
      }
      return
    }

    // Android/Chrome — evento nativo
    if (localStorage.getItem('pwa-banner-dispensado')) return

    const handler = (e: Event) => {
      e.preventDefault()
      setPrompt(e)
      setMostrar(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function handleInstalar() {
    if (!prompt) return
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') {
      setMostrar(false)
      localStorage.setItem('pwa-banner-dispensado', '1')
    }
  }

  function dispensarAndroid() {
    setMostrar(false)
    localStorage.setItem('pwa-banner-dispensado', '1')
  }

  function dispensarIOS() {
    setMostrarIOS(false)
    localStorage.setItem('pwa-ios-dispensado', '1')
  }

  return (
    <>
      {/* ── BANNER ANDROID — topo da tela ───────────────── */}
      {mostrar && (
        <div style={{
          position: 'fixed', top: '4rem', left: '0.75rem', right: '0.75rem',
          zIndex: 99, animation: 'slideDown 0.3s ease'
        }}>
          <style>{`@keyframes slideDown { from { transform: translateY(-80px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }`}</style>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.75rem',
            background: 'linear-gradient(135deg, #052e16, #14532d)',
            border: '1px solid rgba(22,163,74,0.4)',
            borderRadius: '1rem', padding: '0.875rem 1rem',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          }}>
            <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem', backgroundColor: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '1.25rem' }}>
              ⚽
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ color: 'white', fontWeight: 700, fontSize: '0.875rem', margin: 0 }}>Instale o MeuBaba!</p>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.72rem', margin: '1px 0 0' }}>Acesso rápido + notificações</p>
            </div>
            <button onClick={handleInstalar}
              style={{ backgroundColor: '#16a34a', border: 'none', borderRadius: '0.625rem', padding: '0.5rem 0.875rem', color: 'white', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', flexShrink: 0 }}>
              Instalar
            </button>
            <button onClick={dispensarAndroid}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', padding: '4px', flexShrink: 0 }}>
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ── BANNER iOS — bottom sheet ────────────────────── */}
      {mostrarIOS && (
        <>
          {/* Overlay */}
          <div onClick={dispensarIOS}
            style={{ position: 'fixed', inset: 0, zIndex: 98, backgroundColor: 'rgba(0,0,0,0.6)' }} />

          {/* Card */}
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 99,
            backgroundColor: '#0f172a', borderTop: '1px solid rgba(22,163,74,0.3)',
            borderRadius: '1.5rem 1.5rem 0 0', padding: '1.5rem 1.5rem 2.5rem',
            animation: 'slideUp 0.3s ease',
          }}>
            <style>{`@keyframes slideUp { from { transform: translateY(100px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }`}</style>

            <button onClick={dispensarIOS}
              style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', padding: '4px' }}>
              <X size={18} />
            </button>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', marginBottom: '1.5rem' }}>
              <div style={{ width: '3rem', height: '3rem', borderRadius: '0.875rem', backgroundColor: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '1.5rem' }}>⚽</div>
              <div>
                <p style={{ color: 'white', fontWeight: 800, fontSize: '1rem', margin: 0 }}>Instale o MeuBaba</p>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', margin: '2px 0 0' }}>Acesso rápido + notificações</p>
              </div>
            </div>

            {/* Passos */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {[
                {
                  n: '1',
                  texto: 'Toque no botão Compartilhar',
                  detalhe: 'Ícone na barra inferior do Safari',
                  icon: <Share2 size={14} color="#16a34a" />,
                },
                {
                  n: '2',
                  texto: 'Role e toque em',
                  destaque: '"Adicionar à Tela de Início"',
                  detalhe: null,
                  icon: null,
                },
                {
                  n: '3',
                  texto: 'Toque em "Adicionar" no canto superior direito',
                  detalhe: null,
                  icon: null,
                },
              ].map(s => (
                <div key={s.n} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                  <div style={{ width: '1.75rem', height: '1.75rem', borderRadius: '9999px', backgroundColor: 'rgba(22,163,74,0.15)', border: '1px solid rgba(22,163,74,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#16a34a' }}>{s.n}</span>
                  </div>
                  <div>
                    <p style={{ color: 'white', fontSize: '0.875rem', margin: 0 }}>{s.texto}</p>
                    {(s as any).destaque && <p style={{ color: '#16a34a', fontWeight: 700, fontSize: '0.875rem', margin: '2px 0 0' }}>{(s as any).destaque}</p>}
                    {s.detalhe && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginTop: '4px' }}>
                        {s.icon && <div style={{ backgroundColor: 'rgba(22,163,74,0.1)', borderRadius: '0.375rem', padding: '4px' }}>{s.icon}</div>}
                        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.72rem' }}>{s.detalhe}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Seta para baixo */}
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.5rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                <div style={{ width: '2px', height: '2rem', backgroundColor: 'rgba(22,163,74,0.3)', borderRadius: '9999px' }} />
                <div style={{ width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '8px solid rgba(22,163,74,0.3)' }} />
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
