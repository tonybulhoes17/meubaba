'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react'

type Perfil = 'admin' | 'jogador'

interface Secao {
  emoji: string
  titulo: string
  passos: { titulo: string; descricao: string }[]
}

const seccoesAdmin: Secao[] = [
  {
    emoji: '⚽',
    titulo: 'Criar um Baba',
    passos: [
      { titulo: 'Acesse a tela inicial', descricao: 'Na tela de Início, toque em "+ Criar Baba".' },
      { titulo: 'Preencha os dados', descricao: 'Informe o nome do baba, descrição (opcional) e cidade (opcional).' },
      { titulo: 'Compartilhe o código', descricao: 'Após criar, um código de convite é gerado automaticamente. Compartilhe com os jogadores para eles entrarem.' },
    ],
  },
  {
    emoji: '🗓️',
    titulo: 'Criar uma Temporada',
    passos: [
      { titulo: 'Acesse o baba', descricao: 'Toque no baba desejado na tela inicial.' },
      { titulo: 'Vá em Configurações', descricao: 'No dashboard do baba, acesse Configurações (ícone de engrenagem).' },
      { titulo: 'Crie a temporada', descricao: 'Toque em "Nova Temporada", informe o nome (ex: Temporada 2026.1) e confirme.' },
      { titulo: 'Encerramento', descricao: 'Ao encerrar a temporada, o sistema sugere criar as enquetes de Melhores antes de finalizar.' },
    ],
  },
  {
    emoji: '📅',
    titulo: 'Criar e Gerenciar Rodadas',
    passos: [
      { titulo: 'Acesse Rodadas', descricao: 'No dashboard do baba, toque em "Rodadas".' },
      { titulo: 'Nova rodada', descricao: 'Toque em "+ Nova Rodada", defina data, horário, formato (ex: 5x5) e duração dos jogos.' },
      { titulo: 'Check-in no dia', descricao: 'Na aba Presença da rodada, marque quem chegou. A ordem de chegada é registrada automaticamente (1º, 2º, 3º...).' },
      { titulo: 'Adicionar convidados', descricao: 'Na aba Presença, role até o final e adicione convidados pelo nome.' },
      { titulo: 'Editar ou excluir', descricao: 'Toque no ícone ⚙️ no canto superior direito da rodada para editar nome, data, horário ou excluir. Rodadas encerradas não podem ser excluídas.' },
    ],
  },
  {
    emoji: '👕',
    titulo: 'Montar Times',
    passos: [
      { titulo: 'Acesse a aba Times', descricao: 'Dentro da rodada, toque na aba "Times" e depois em "Montar Times".' },
      { titulo: 'Crie os times', descricao: 'Toque em "+ Novo Time" para cada time. Cada time recebe uma cor automaticamente (Verde, Vermelho, Azul...).' },
      { titulo: 'Distribua os jogadores', descricao: 'Na lista "Sem time", cada jogador tem botões coloridos (→ Verde, → Vermelho...). Toque no botão da cor do time desejado.' },
      { titulo: 'Sorteio automático', descricao: 'Crie os times e toque em "🎲 Sortear" para distribuir os jogadores automaticamente de forma equilibrada.' },
      { titulo: 'Salvar', descricao: 'Toque em "💾 Salvar Times" para confirmar. Os times ficam visíveis para todos os membros.' },
    ],
  },
  {
    emoji: '⚽',
    titulo: 'Registrar Jogos e Eventos',
    passos: [
      { titulo: 'Acesse a aba Jogos', descricao: 'Com os times montados, vá na aba "Jogos" e toque em "Gerenciar Jogos".' },
      { titulo: 'Placar', descricao: 'Use os botões + e − ao lado de cada time para registrar os gols em tempo real.' },
      { titulo: 'Gols e assistências', descricao: 'Toque em "⚽ Gol" ou "🅰️ Assist." e selecione o jogador responsável.' },
      { titulo: 'Cartões', descricao: 'Registre cartões amarelos 🟨 e vermelhos 🟥 por jogador.' },
      { titulo: 'Stats', descricao: 'A aba "Stats" mostra artilharia, assistências e cartões da rodada em tempo real.' },
    ],
  },
  {
    emoji: '🏁',
    titulo: 'Encerrar a Rodada',
    passos: [
      { titulo: 'Acesse a aba Encerrar', descricao: 'Toque na aba "Encerrar" (visível apenas para admins).' },
      { titulo: 'Confira o resumo', descricao: 'Veja o resumo: jogadores presentes, convidados, times e jogos.' },
      { titulo: 'Encerre', descricao: 'Toque em "Encerrar Rodada". Automaticamente serão abertas as enquetes de Craque da Rodada ⭐ e Bola Murcha 💩, com 4h para votação.' },
      { titulo: 'Notas', descricao: 'Após encerrar, todos os jogadores podem dar notas (0–100) para cada participante da rodada, também com janela de 4h.' },
    ],
  },
  {
    emoji: '🃏',
    titulo: 'Gerar Cards para Compartilhar',
    passos: [
      { titulo: 'Acesse Cards', descricao: 'Com a rodada encerrada, vá na aba "Jogos" e toque em "🃏 Gerar Cards para Compartilhar".' },
      { titulo: 'Tipos de cards', descricao: 'Estão disponíveis cards de: Craque da Rodada, Bola Murcha, Artilheiros, Assistências e Notas.' },
      { titulo: 'Compartilhar', descricao: 'Toque em qualquer card para gerar a imagem e compartilhar no WhatsApp, Instagram ou onde quiser.' },
    ],
  },
  {
    emoji: '🗳️',
    titulo: 'Enquetes',
    passos: [
      { titulo: 'Automáticas', descricao: 'Ao encerrar uma rodada, o sistema cria automaticamente as enquetes de Craque ⭐ e Bola Murcha 💩 com 4h de duração.' },
      { titulo: 'Criar enquete manual', descricao: 'No menu Enquetes do baba, toque em "+ Nova Enquete". Você pode criar enquetes gerais (título livre, múltipla escolha) ou Melhores da Temporada.' },
      { titulo: 'Melhores da Temporada', descricao: 'Enquete especial com 7 posições: Goleiro, Zagueiro, Lateral Esquerdo, Lateral Direito, Volante, Meia e Atacante. Todos os jogadores concorrem em todas as posições.' },
      { titulo: 'Resultado oculto', descricao: 'Os votos ficam ocultos durante a votação. O resultado só é revelado após o encerramento da enquete.' },
      { titulo: 'Campo visual', descricao: 'Após encerrada, a enquete Melhores da Temporada exibe um campo de futebol visual com os vencedores nas posições. Pode ser compartilhado como card Story 9:16.' },
    ],
  },
  {
    emoji: '📊',
    titulo: 'Rankings e Estatísticas',
    passos: [
      { titulo: 'Acesse Estatísticas', descricao: 'No dashboard do baba, toque em "Estatísticas".' },
      { titulo: 'Rankings da temporada', descricao: 'Veja artilharia, assistências, disciplina (cartões) e ranking de notas da temporada ativa.' },
      { titulo: 'Critério de notas', descricao: 'Para entrar no ranking de notas, o jogador precisa ter participado de pelo menos 40% das rodadas da temporada.' },
      { titulo: 'Temporadas anteriores', descricao: 'No histórico do baba, você acessa estatísticas de temporadas encerradas, incluindo craque, artilheiro e melhor nota de cada uma.' },
    ],
  },
  {
    emoji: '⚙️',
    titulo: 'Configurações do Baba',
    passos: [
      { titulo: 'Acesse Configurações', descricao: 'No dashboard do baba, toque no ícone de engrenagem.' },
      { titulo: 'Editar informações', descricao: 'Altere nome, descrição, cidade e foto do baba.' },
      { titulo: 'Gerenciar membros', descricao: 'Veja todos os membros, promova a admin ou remova do grupo.' },
      { titulo: 'Código de convite', descricao: 'O código de convite fica disponível aqui para compartilhar com novos jogadores.' },
    ],
  },
]

const seccoesJogador: Secao[] = [
  {
    emoji: '🔑',
    titulo: 'Entrar em um Baba',
    passos: [
      { titulo: 'Receba o código', descricao: 'Peça o código de convite ao admin do baba.' },
      { titulo: 'Toque em "Entrar"', descricao: 'Na tela inicial, toque em "→ Entrar" e digite o código recebido.' },
      { titulo: 'Pronto!', descricao: 'Você já faz parte do baba e pode ver todas as informações.' },
    ],
  },
  {
    emoji: '✅',
    titulo: 'Confirmar Presença na Rodada',
    passos: [
      { titulo: 'Acesse a rodada', descricao: 'No dashboard do baba, toque na rodada agendada.' },
      { titulo: 'Resposta antecipada', descricao: 'Na aba Presença, informe se vai (✅ Vou), talvez vai (❓ Talvez) ou não vai (❌ Não vou). Isso ajuda o admin a se planejar.' },
      { titulo: 'Check-in no dia', descricao: 'O check-in final é feito pelo admin no dia do baba. Você receberá uma notificação quando a rodada for criada.' },
    ],
  },
  {
    emoji: '🗳️',
    titulo: 'Votar nas Enquetes',
    passos: [
      { titulo: 'Notificação', descricao: 'Você recebe uma notificação quando uma enquete é aberta (ex: Craque da Rodada após o encerramento).' },
      { titulo: 'Acesse Enquetes', descricao: 'No dashboard do baba, toque em "Enquetes" ou acesse pelo sino de notificações.' },
      { titulo: 'Vote', descricao: 'Toque no jogador que você quer votar. Cada membro tem direito a 1 voto por enquete.' },
      { titulo: 'Resultado', descricao: 'O resultado fica oculto até a enquete encerrar. Após isso, o vencedor é revelado.' },
    ],
  },
  {
    emoji: '⭐',
    titulo: 'Dar Notas aos Jogadores',
    passos: [
      { titulo: 'Janela de notas', descricao: 'Após encerrar a rodada, você tem 4 horas para avaliar cada jogador.' },
      { titulo: 'Acesse Notas', descricao: 'Na rodada encerrada, toque em "⭐ Dar notas aos jogadores".' },
      { titulo: 'Avalie', descricao: 'Use o slider (0–100) para dar uma nota a cada jogador. As notas são anônimas.' },
      { titulo: 'Resultado', descricao: 'O ranking de notas só fica visível após encerrar a janela de votação.' },
    ],
  },
  {
    emoji: '📊',
    titulo: 'Ver Rankings e Estatísticas',
    passos: [
      { titulo: 'Acesse Estatísticas', descricao: 'No dashboard do baba, toque em "Estatísticas".' },
      { titulo: 'O que você vê', descricao: 'Artilharia, assistências, disciplina e ranking de notas da temporada atual.' },
      { titulo: 'Histórico', descricao: 'Em "Histórico" você vê os campeões de cada temporada encerrada: craque, artilheiro e melhor nota.' },
    ],
  },
  {
    emoji: '🃏',
    titulo: 'Gerar e Compartilhar Cards',
    passos: [
      { titulo: 'Acesse a rodada encerrada', descricao: 'Vá na aba "Jogos" da rodada finalizada.' },
      { titulo: 'Toque em Gerar Cards', descricao: 'Toque em "🃏 Gerar Cards para Compartilhar".' },
      { titulo: 'Escolha o card', descricao: 'Selecione Craque, Bola Murcha, Artilheiros, Assistências ou Notas.' },
      { titulo: 'Compartilhe', descricao: 'Compartilhe diretamente no WhatsApp, Instagram Stories ou salve na galeria.' },
    ],
  },
  {
    emoji: '💬',
    titulo: 'Chat do Grupo',
    passos: [
      { titulo: 'Acesse o Chat', descricao: 'Toque no ícone de Chat na barra inferior.' },
      { titulo: 'Mensagens', descricao: 'Envie textos, fotos e áudios para o grupo. As mensagens aparecem em tempo real.' },
      { titulo: 'Reações e respostas', descricao: 'Segure uma mensagem para reagir com emoji ou responder diretamente.' },
      { titulo: 'Menções', descricao: 'Use @ para mencionar um membro específico do grupo.' },
    ],
  },
  {
    emoji: '🔔',
    titulo: 'Notificações',
    passos: [
      { titulo: 'Notificações in-app', descricao: 'O sino 🔔 na barra inferior acende quando há avisos novos: rodada criada, enquete aberta, rodada encerrada.' },
      { titulo: 'Push notifications', descricao: 'Se você instalou o app, receberá notificações mesmo com o celular bloqueado.' },
      { titulo: 'Permissão', descricao: 'Ao acessar o app pela primeira vez, autorize as notificações para não perder nada.' },
    ],
  },
  {
    emoji: '👤',
    titulo: 'Seu Perfil',
    passos: [
      { titulo: 'Acesse Perfil', descricao: 'Toque em "Perfil" na barra inferior.' },
      { titulo: 'Edite seus dados', descricao: 'Atualize seu nome, foto, posição favorita e outras informações.' },
      { titulo: 'Sua nota no dashboard', descricao: 'No dashboard de cada baba, você vê sua nota média da temporada atual.' },
    ],
  },
]

function SecaoItem({ secao }: { secao: Secao }) {
  const [aberta, setAberta] = useState(false)
  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '1rem',
      overflow: 'hidden',
      border: '1px solid #f1f5f9',
      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
    }}>
      <button
        onClick={() => setAberta(a => !a)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '1rem', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.4rem' }}>{secao.emoji}</span>
          <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1e293b' }}>{secao.titulo}</span>
        </div>
        {aberta ? <ChevronUp size={18} color="#94a3b8" /> : <ChevronDown size={18} color="#94a3b8" />}
      </button>

      {aberta && (
        <div style={{ borderTop: '1px solid #f8fafc', padding: '0.75rem 1rem 1rem' }}>
          {secao.passos.map((passo, i) => (
            <div key={i} style={{ display: 'flex', gap: '0.875rem', marginBottom: i < secao.passos.length - 1 ? '1rem' : 0 }}>
              {/* Número + linha */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                <div style={{
                  width: '1.75rem', height: '1.75rem', borderRadius: '9999px',
                  backgroundColor: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'white' }}>{i + 1}</span>
                </div>
                {i < secao.passos.length - 1 && (
                  <div style={{ width: '2px', flex: 1, backgroundColor: '#dcfce7', marginTop: '4px', minHeight: '1rem' }} />
                )}
              </div>
              {/* Conteúdo */}
              <div style={{ flex: 1, paddingBottom: i < secao.passos.length - 1 ? '0.5rem' : 0 }}>
                <p style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1e293b', margin: '0 0 3px' }}>{passo.titulo}</p>
                <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0, lineHeight: 1.5 }}>{passo.descricao}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ManualPage() {
  const router = useRouter()
  const [perfil, setPerfil] = useState<Perfil>('admin')

  const seccoes = perfil === 'admin' ? seccoesAdmin : seccoesJogador

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', paddingBottom: '5rem' }}>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', paddingTop: '3rem', paddingBottom: '1.5rem', paddingLeft: '1rem', paddingRight: '1rem' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <button onClick={() => router.back()}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.8)', padding: '4px' }}>
              <ArrowLeft size={22} />
            </button>
            <div>
              <h1 style={{ color: 'white', fontWeight: 800, fontSize: '1.25rem', margin: 0 }}>📖 Manual de Uso</h1>
              <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.8rem', margin: '2px 0 0' }}>Aprenda a tirar o máximo do MeuBaba</p>
            </div>
          </div>

          {/* Toggle Admin / Jogador */}
          <div style={{ display: 'flex', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: '0.875rem', padding: '4px', gap: '4px' }}>
            {(['admin', 'jogador'] as Perfil[]).map(p => (
              <button key={p} onClick={() => setPerfil(p)}
                style={{
                  flex: 1, padding: '0.625rem', borderRadius: '0.625rem', border: 'none',
                  backgroundColor: perfil === p ? 'white' : 'transparent',
                  color: perfil === p ? '#16a34a' : 'rgba(255,255,255,0.85)',
                  fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', transition: 'all 0.2s',
                }}>
                {p === 'admin' ? '👑 Sou Admin' : '🎮 Sou Jogador'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Intro */}
      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '1rem' }}>
        <div style={{
          backgroundColor: perfil === 'admin' ? '#f0fdf4' : '#eff6ff',
          border: `1px solid ${perfil === 'admin' ? '#bbf7d0' : '#bfdbfe'}`,
          borderRadius: '1rem', padding: '1rem', marginBottom: '1rem',
        }}>
          <p style={{ fontSize: '0.875rem', color: perfil === 'admin' ? '#15803d' : '#1d4ed8', margin: 0, lineHeight: 1.6 }}>
            {perfil === 'admin'
              ? '👑 Como admin, você controla tudo: cria o baba, monta times, registra jogos e gerencia a temporada. Toque em cada seção para expandir o passo a passo.'
              : '🎮 Como jogador, você participa das rodadas, vota nas enquetes, dá notas e acompanha os rankings. Toque em cada seção para ver como fazer.'}
          </p>
        </div>

        {/* Seções */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {seccoes.map((secao, i) => (
            <SecaoItem key={i} secao={secao} />
          ))}
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: '2rem', padding: '1rem' }}>
          <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>MeuBaba ⚽ · Feito para o futebol brasileiro</p>
        </div>
      </div>
    </div>
  )
}
