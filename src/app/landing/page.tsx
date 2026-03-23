'use client'

import { useRouter } from 'next/navigation'

export default function LandingPage() {
  const router = useRouter()

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', backgroundColor: '#f8fafc', overflowX: 'hidden' }}>

      {/* ===== HERO ===== */}
      <div style={{ background: 'linear-gradient(160deg, #052e16 0%, #14532d 50%, #16a34a 100%)', minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>

        {/* Decoração de fundo */}
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', width: '600px', height: '600px', borderRadius: '9999px', border: '1px solid rgba(255,255,255,0.06)', top: '-200px', right: '-200px' }} />
          <div style={{ position: 'absolute', width: '400px', height: '400px', borderRadius: '9999px', border: '1px solid rgba(255,255,255,0.04)', top: '-100px', right: '-100px' }} />
          <div style={{ position: 'absolute', width: '800px', height: '800px', borderRadius: '9999px', border: '1px solid rgba(255,255,255,0.04)', bottom: '-400px', left: '-400px' }} />
        </div>

        {/* Nav */}
        <nav style={{ padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: '1100px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.5rem' }}>⚽</span>
            <span style={{ color: 'white', fontWeight: 900, fontSize: '1.25rem', letterSpacing: '-0.02em' }}>MeuBaba</span>
          </div>
          <button onClick={() => router.push('/login')}
            style={{ backgroundColor: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '0.75rem', padding: '0.5rem 1.25rem', color: 'white', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer' }}>
            Entrar
          </button>
        </nav>

        {/* Hero content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 1.5rem', textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <div style={{ backgroundColor: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '9999px', padding: '0.375rem 1rem', marginBottom: '1.5rem', display: 'inline-block' }}>
            <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.8rem', fontWeight: 700 }}>🚀 Seu baba nunca mais vai ser o mesmo</span>
          </div>
          <h1 style={{ color: 'white', fontSize: 'clamp(2.5rem, 8vw, 4.5rem)', fontWeight: 900, margin: '0 0 1.25rem', lineHeight: 1.05, letterSpacing: '-0.03em', maxWidth: '800px' }}>
            A plataforma que o seu grupo de futebol merecia
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 'clamp(1rem, 2.5vw, 1.25rem)', maxWidth: '560px', lineHeight: 1.65, margin: '0 0 2.5rem' }}>
            Organize rodadas, acompanhe estatísticas, vote nos melhores, troque mensagens e gere cards para postar. Tudo em um só lugar — feito para babas de verdade.
          </p>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button onClick={() => router.push('/cadastro')}
              style={{ backgroundColor: 'white', border: 'none', borderRadius: '0.875rem', padding: '0.875rem 2rem', color: '#15803d', fontWeight: 900, fontSize: '1rem', cursor: 'pointer', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
              Criar meu baba grátis →
            </button>
            <a href="#funcionalidades"
              style={{ backgroundColor: 'transparent', border: '1.5px solid rgba(255,255,255,0.4)', borderRadius: '0.875rem', padding: '0.875rem 1.5rem', color: 'white', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', textDecoration: 'none' }}>
              Ver funcionalidades
            </a>
          </div>

          {/* Stats do app */}
          <div style={{ display: 'flex', gap: '2rem', marginTop: '4rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            {[
              { num: '100%', label: 'Competição garantida' },
              { num: '∞', label: 'Jogadores por grupo' },
              { num: '7', label: 'Tipos de ranking' },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <p style={{ color: 'white', fontSize: '2rem', fontWeight: 900, margin: 0, lineHeight: 1 }}>{s.num}</p>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.78rem', margin: '4px 0 0', fontWeight: 600 }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Wave */}
        <div style={{ marginTop: 'auto' }}>
          <svg viewBox="0 0 1440 80" style={{ display: 'block', width: '100%' }} preserveAspectRatio="none">
            <path d="M0,40 C360,80 720,0 1080,40 C1260,60 1380,50 1440,40 L1440,80 L0,80 Z" fill="#f8fafc"/>
          </svg>
        </div>
      </div>

      {/* ===== PROBLEMA ===== */}
      <div style={{ backgroundColor: '#f8fafc', padding: '5rem 1.5rem' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
          <p style={{ color: '#16a34a', fontWeight: 800, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 1rem' }}>O problema</p>
          <h2 style={{ color: '#0f172a', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', fontWeight: 900, margin: '0 0 1.5rem', lineHeight: 1.15 }}>
            Cansado de organizar baba pelo WhatsApp?
          </h2>
          <p style={{ color: '#475569', fontSize: '1.1rem', lineHeight: 1.7, margin: '0 0 3rem' }}>
            Confirmação de presença no grupo, placar anotado no papel, artilheiro que ninguém lembra, aquela polêmica de quem foi o craque... Tudo perdido no caos de mensagens.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            {[
              { emoji: '😤', text: '"Quem confirmou mesmo?"' },
              { emoji: '📉', text: '"Qual é o placar geral da temporada?"' },
              { emoji: '🤷', text: '"Quem foi o artilheiro esse ano?"' },
              { emoji: '💬', text: '"Mais uma briga no grupo do WhatsApp"' },
            ].map(p => (
              <div key={p.emoji} style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '1rem', padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>{p.emoji}</span>
                <p style={{ color: '#475569', fontSize: '0.875rem', fontStyle: 'italic', margin: 0, lineHeight: 1.5 }}>{p.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ===== FUNCIONALIDADES ===== */}
      <div id="funcionalidades" style={{ backgroundColor: 'white', padding: '5rem 1.5rem' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
            <p style={{ color: '#16a34a', fontWeight: 800, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 1rem' }}>O que tem no MeuBaba</p>
            <h2 style={{ color: '#0f172a', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', fontWeight: 900, margin: 0, lineHeight: 1.15 }}>
              Tudo que seu grupo precisa
            </h2>
          </div>

          {/* Feature 1 — Rodadas */}
          <FeatureRow
            emoji="📅"
            cor="#dcfce7"
            corTexto="#15803d"
            titulo="Rodadas completas"
            desc="Crie cada baba como uma rodada oficial. Defina a data, horário, jogadores por time e formato. O admin organiza tudo, os jogadores confirmam presença antecipadamente."
            items={['✅ Check-in manual no dia com ordem de chegada', '🎯 Sorteio de times equilibrado por posição', '⏱ Cronômetro de partida e placar em tempo real', '📊 Gols, assistências e cartões por jogo']}
          />

          {/* Feature 2 — Estatísticas */}
          <FeatureRow
            emoji="🏆"
            cor="#fef9c3"
            corTexto="#ca8a04"
            titulo="Estatísticas e rankings"
            desc="Chega de dúvida sobre quem é o artilheiro da temporada. O MeuBaba registra tudo automaticamente e gera rankings em tempo real."
            items={['⚽ Artilharia da temporada', '🅰️ Ranking de assistências', '📅 Ranking de presenças', '🟥 Disciplina (cartões amarelos e vermelhos)']}
            reverse
          />

          {/* Feature 3 — Notas */}
          <FeatureRow
            emoji="⭐"
            cor="#ede9fe"
            corTexto="#7c3aed"
            titulo="Notas dos jogadores"
            desc="Após cada rodada, os jogadores avaliam uns aos outros anonimamente com uma nota de 0 a 100. O resultado fica travado até o prazo encerrar — sem influenciar os outros."
            items={['🔒 Anônimo — ninguém sabe quem deu qual nota', '⏰ Janela de 4h após o encerramento da rodada', '📊 Ranking de notas da temporada', '🎯 Mínimo de 40% de presenças para entrar no ranking']}
          />

          {/* Feature 4 — Enquetes */}
          <FeatureRow
            emoji="🗳️"
            cor="#dbeafe"
            corTexto="#1d4ed8"
            titulo="Enquetes e votações"
            desc="O MeuBaba transforma o final de cada rodada em uma experiência social com votações automáticas e enquetes criadas pelo admin."
            items={['🏆 Craque da Rodada (abre automaticamente ao encerrar)', '😴 Bola Murcha (quem decepcionou?)', '🌟 Melhores da Temporada por posição (Goleiro, Zagueiro, Meia...)', '📋 Enquetes livres: qualquer pergunta para o grupo']}
            reverse
          />

          {/* Feature 5 — Chat */}
          <FeatureRow
            emoji="💬"
            cor="#dcfce7"
            corTexto="#15803d"
            titulo="Chat do grupo em tempo real"
            desc="Cada grupo tem seu próprio chat dedicado. Chega de misturar as conversas do baba com o grupo da família no WhatsApp."
            items={['⚡ Mensagens em tempo real', '📷 Envio de fotos com compressão automática', '🎙️ Gravação de áudio direto no app', '💬 Responder, reagir com emoji e @mencionar jogadores']}
          />

          {/* Feature 6 — Cards */}
          <FeatureRow
            emoji="📱"
            cor="#fce7f3"
            corTexto="#be185d"
            titulo="Cards para compartilhar"
            desc="Gere imagens prontas para postar no Instagram Story e no WhatsApp. Mostre pro mundo quem são os melhores do seu baba."
            items={['⚽ Escalação dos melhores da temporada no campo', '🏆 Card do craque da rodada', '📊 Top artilheiros da temporada', '🎨 Visual com identidade do MeuBaba + nome do grupo']}
            reverse
          />

          {/* Feature 7 — Histórico */}
          <FeatureRow
            emoji="🏁"
            cor="#fef3c7"
            corTexto="#d97706"
            titulo="Histórico de temporadas"
            desc="Cada temporada encerrada vira parte da história do grupo. Consulte os campeões de anos anteriores e compare com a temporada atual."
            items={['📆 Registro de todas as temporadas encerradas', '🥇 Craque, artilheiro e melhor nota de cada temporada', '⚽ Escalação histórica dos melhores no campo', '📤 Gerar card da temporada para compartilhar']}
          />
        </div>
      </div>

      {/* ===== COMO FUNCIONA ===== */}
      <div style={{ background: 'linear-gradient(160deg, #052e16, #15803d)', padding: '5rem 1.5rem' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontWeight: 800, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 1rem' }}>Simples assim</p>
          <h2 style={{ color: 'white', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', fontWeight: 900, margin: '0 0 3rem', lineHeight: 1.15 }}>
            Em 3 minutos seu grupo está no ar
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
            {[
              { num: '1', titulo: 'Crie o grupo', desc: 'Dê um nome, cidade e crie o código de convite do seu baba.' },
              { num: '2', titulo: 'Convide os amigos', desc: 'Compartilhe o código e em segundos todos entram no grupo.' },
              { num: '3', titulo: 'Comece a jogar', desc: 'Crie a temporada, agende rodadas e o MeuBaba faz o resto.' },
            ].map(s => (
              <div key={s.num} style={{ backgroundColor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '1.25rem', padding: '1.75rem 1.5rem', textAlign: 'center' }}>
                <div style={{ width: '2.75rem', height: '2.75rem', borderRadius: '9999px', backgroundColor: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', fontSize: '1.25rem', fontWeight: 900, color: 'white' }}>{s.num}</div>
                <p style={{ color: 'white', fontWeight: 800, fontSize: '1rem', margin: '0 0 0.5rem' }}>{s.titulo}</p>
                <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.875rem', margin: 0, lineHeight: 1.6 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ===== POR QUE USAR ===== */}
      <div style={{ backgroundColor: '#f8fafc', padding: '5rem 1.5rem' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <p style={{ color: '#16a34a', fontWeight: 800, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 1rem' }}>Por que o MeuBaba?</p>
            <h2 style={{ color: '#0f172a', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', fontWeight: 900, margin: 0, lineHeight: 1.15 }}>
              Muito além de um grupo de WhatsApp
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
            {[
              { emoji: '🎮', titulo: 'Torna o baba mais divertido', desc: 'Rankings, votações e notas transformam cada rodada em uma experiência competitiva e social.' },
              { emoji: '📊', titulo: 'Memória do grupo', desc: 'Estatísticas registradas permanentemente. Daqui a 5 anos você vai saber quem foi o artilheiro de 2026.' },
              { emoji: '🤝', titulo: 'Menos polêmica', desc: 'Dados objetivos para as discussões. Placar, gols e presenças registrados — sem achismo.' },
              { emoji: '🏅', titulo: 'Reconhece quem joga bem', desc: 'As notas anônimas e votações valorizam os bons jogadores de forma justa e divertida.' },
              { emoji: '📱', titulo: 'Funciona no celular', desc: 'Interface pensada para mobile. Funciona como um app mesmo no navegador.' },
              { emoji: '🆓', titulo: 'Gratuito de verdade', desc: 'Sem cobranças, sem limites de jogadores, sem anúncios. Feito para o futebol amador brasileiro.' },
            ].map(c => (
              <div key={c.titulo} style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '1rem', padding: '1.5rem' }}>
                <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.75rem' }}>{c.emoji}</span>
                <p style={{ color: '#0f172a', fontWeight: 800, fontSize: '0.95rem', margin: '0 0 0.5rem' }}>{c.titulo}</p>
                <p style={{ color: '#64748b', fontSize: '0.875rem', margin: 0, lineHeight: 1.6 }}>{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ===== CTA FINAL ===== */}
      <div style={{ background: 'linear-gradient(135deg, #052e16, #15803d)', padding: '6rem 1.5rem', textAlign: 'center' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>⚽</span>
          <h2 style={{ color: 'white', fontSize: 'clamp(1.75rem, 4vw, 2.75rem)', fontWeight: 900, margin: '0 0 1rem', lineHeight: 1.15 }}>
            Seu baba merece mais do que um grupo de WhatsApp
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '1.1rem', margin: '0 0 2.5rem', lineHeight: 1.6 }}>
            Crie agora, é grátis. Em 3 minutos seu grupo está organizado, com temporada, estatísticas e tudo mais.
          </p>
          <button onClick={() => router.push('/cadastro')}
            style={{ backgroundColor: 'white', border: 'none', borderRadius: '1rem', padding: '1rem 2.5rem', color: '#15803d', fontWeight: 900, fontSize: '1.1rem', cursor: 'pointer', boxShadow: '0 4px 24px rgba(0,0,0,0.25)' }}>
            Criar meu baba agora — grátis →
          </button>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.8rem', marginTop: '1rem' }}>Sem cartão de crédito. Sem pegadinha.</p>
        </div>
      </div>

      {/* Footer */}
      <div style={{ backgroundColor: '#052e16', padding: '2rem 1.5rem', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '1.1rem' }}>⚽</span>
          <span style={{ color: 'white', fontWeight: 800, fontSize: '1rem' }}>MeuBaba</span>
        </div>
        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.8rem', margin: 0 }}>Feito com ❤️ para o futebol amador brasileiro</p>
      </div>
    </div>
  )
}

function FeatureRow({ emoji, cor, corTexto, titulo, desc, items, reverse = false }: {
  emoji: string; cor: string; corTexto: string; titulo: string; desc: string; items: string[]; reverse?: boolean
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', padding: '3.5rem 0', borderBottom: '1px solid #f1f5f9', alignItems: 'center' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '3rem', width: '100%', alignItems: 'center' }}>
        {/* Ícone visual */}
        <div style={{ order: reverse ? 1 : 0, display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: '160px', height: '160px', backgroundColor: cor, borderRadius: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '5rem', boxShadow: `0 8px 32px ${cor}` }}>
            {emoji}
          </div>
        </div>
        {/* Texto */}
        <div style={{ order: reverse ? 0 : 1 }}>
          <h3 style={{ color: '#0f172a', fontSize: '1.5rem', fontWeight: 900, margin: '0 0 0.875rem' }}>{titulo}</h3>
          <p style={{ color: '#475569', fontSize: '1rem', lineHeight: 1.7, margin: '0 0 1.25rem' }}>{desc}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {items.map(item => (
              <div key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                <span style={{ color: corTexto, fontSize: '0.875rem', lineHeight: 1.6 }}>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
