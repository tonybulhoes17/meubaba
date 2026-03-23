import Link from 'next/link'

export default function NotFound() {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center' }}>
      <div style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', width: '6rem', height: '6rem', borderRadius: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem', marginBottom: '1.5rem', boxShadow: '0 8px 24px rgba(22,163,74,0.3)' }}>
        ⚽
      </div>
      <h1 style={{ color: '#0f172a', fontSize: '5rem', fontWeight: 900, margin: '0 0 0.25rem', lineHeight: 1 }}>404</h1>
      <h2 style={{ color: '#1e293b', fontSize: '1.5rem', fontWeight: 800, margin: '0 0 0.75rem' }}>Bola fora!</h2>
      <p style={{ color: '#64748b', fontSize: '1rem', maxWidth: '360px', lineHeight: 1.6, margin: '0 0 2rem' }}>
        Essa página saiu pela linha de fundo. Ela não existe ou foi removida.
      </p>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        <Link href="/grupos"
          style={{ backgroundColor: '#16a34a', border: 'none', borderRadius: '0.875rem', padding: '0.875rem 1.5rem', color: 'white', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', textDecoration: 'none' }}>
          Ir para meus grupos
        </Link>
        <Link href="/landing"
          style={{ backgroundColor: 'white', border: '1.5px solid #e2e8f0', borderRadius: '0.875rem', padding: '0.875rem 1.5rem', color: '#475569', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', textDecoration: 'none' }}>
          Conhecer o MeuBaba
        </Link>
      </div>
    </div>
  )
}
