// cadastrar-jogadores.mjs
// Coloque este arquivo na raiz do projeto (C:\Meubaba\meubaba\)
// Rodar com: node cadastrar-jogadores.mjs

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://cvtvwsmjdiprzvfwrgtw.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2dHZ3c21qZGlwcnp2ZndyZ3R3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzEwMzc2MywiZXhwIjoyMDg4Njc5NzYzfQ.ktgxAVx72I_pjJbz2Qzq7lZ_EI4m_eYe76kYty0_wrs' // Supabase → Settings → API → service_role

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const SENHA_PADRAO = 'babadomingo'

const jogadores = [
  ['Raimundo Mateus', 'mateusmalianca@gmail.com', 'meia'],
  ['Bruno Assis', 'brunoassisped@outlook.com', 'zagueiro'],
  ['Ygo', 'jorge_ygo@hotmail.com', 'lateral'],
  ['Fernando de Alencar Carvalho', 'fernandoalencarc@gmail.com', 'volante'],
  ['Luciano', 'lucianobarrosfsa@outlook.com', 'lateral'],
  ['Paulo Vinícius Carneiro Cordeiro', 'pv.carneirocordeiro@gmail.com', 'lateral'],
  ['Reniel Heringer', 'dr.rheringer@hotmail.com', 'lateral'],
  ['André Guimarães', 'andremed@bol.com.br', 'atacante'],
  ['Lucca Oliveira (Telê)', 'luca0w22@gmail.com', 'goleiro'],
  ['Venceslau', 'vencerqueira@gmail.com', 'lateral'],
  ['Gustavo Figueredo e Matos', 'matosg670@gmail.com', 'lateral'],
  ['Guilherme Pacheco', 'guilhermepacheco1988@gmail.com', 'lateral'],
  ['Gabriel Cotrim', 'gabrielproject@icloud.com', 'volante'],
  ['João', 'drjoaomarcelogastro@gmail.com', 'meia'],
  ['Alysson Aires', 'alyssonloi@hotmail.com', 'lateral'],
  ['Michel Yuri', 'michelyuri87@gmail.com', 'meia'],
  ['Silas Cerqueira', 'cerqueirasilas2@gmail.com', 'lateral'],
  ['Melquisedec Castro', 'melk.castro@hotmail.com', 'lateral'],
  ['Eduardo Andrade S. Junior', 'eduardo.asjr81@gmail.com', 'meia'],
  ['Jeerdson', 'dr.jeerdson@gmail.com', 'meia'],
  ['Tapioca', 'drthiagotapioca@gmail.com', 'lateral'],
  ['Erick Leal', 'premiumseg@outlook.com', 'lateral'],
  ['Jau', 'jc4523466@gmail.com', 'meia'],
  ['Kerson', 'kerson.alencar@gmail.com', 'lateral'],
  ['Rômulo Lage de Mendonça', 'rlmed_@hotmail.com', 'zagueiro'],
  ['Bruno Oliveira Freitas', 'brunoof1982@gmail.com', 'volante'],
  ['João Victor Brito do Vale', 'jvdovale@yahoo.com.br', 'lateral'],
  ['Ribas', 'fabio.ribas9@gmail.com', 'atacante'],
  ['Henrique', 'henriqueborgesribeiro@gmail.com', 'volante'],
  ['Vinicius Aguzzoli', 'viniaguzzoli@hotmail.com', 'volante'],
  ['Agenor', 'dragenorpaiva@hotmail.com', 'lateral'],
  ['Harley Fenômeno', 'harleyramos.med@gmail.com', 'lateral'],
  ['Allan Bastos', 'allan.bastos@hotmail.com', 'lateral'],
  ['Emerson dos Santos Neves', 'neves8416@outlook.com', 'goleiro'],
  ['Jean Carlos', 'jean.eng2016@gmail.com', 'meia'],
  ['Mateus', 'mateus_amorim@hotmail.com', 'volante'],
  ['Edivan de Souza Borges', 'desousaborgesedivan@gmail.com', 'goleiro'],
  ['Eric Marins', 'ericmarins@yahoo.com.br', 'meia'],
  ['Bruno Gama', 'bruno.gama@gruponobre.edu.br', 'volante'],
  ['Glauber', 'glauberchagas@yahoo.com.br', 'meia'],
  ['Bismarck', 'bismarcksilva27@gmail.com', 'lateral'],
  ['Vilson', 'vilsonalvesnutri@gmail.com', 'meia'],
  ['Matheus Martins Moitinho', 'moitinhojuiz@gmail.com', 'volante'],
  ['Mateus Gonzaga', 'mateusgonzaga95@gmail.com', 'lateral'],
  ['Tymas', 'tymadm@hotmail.com', 'volante'],
  ['Matheus Santos Trigo', 'theustrigo@hotmail.com', 'zagueiro'],
  ['Joaquim Alencar', 'jalencarprf@gmail.com', 'volante'],
  ['Deleon Silva Evangelista', 'deleonsilva3@gmail.com', 'volante'],
  ['Mauricio Cotrim Guimaraes Junior', 'cotrimebinha@hotmail.com', 'lateral'],
]

async function cadastrarTodos() {
  console.log(`\n Iniciando cadastro de ${jogadores.length} jogadores...\n`)
  let sucesso = 0, pulados = 0, falha = 0
  const erros = []

  for (const [nome, email, posicao] of jogadores) {
    try {
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: email.trim().toLowerCase(),
        password: SENHA_PADRAO,
        email_confirm: true,
        user_metadata: { full_name: nome }
      })

      if (authError) {
        if (authError.message.includes('already') || authError.status === 422) {
          console.log(`PULADO  ${nome} — já cadastrado`)
          pulados++
          continue
        }
        throw authError
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({ id: authData.user.id, full_name: nome, position_1: posicao })

      if (profileError) {
        console.log(`AVISO  ${nome} — Auth OK mas erro no perfil: ${profileError.message}`)
      } else {
        console.log(`OK  ${nome} (${email})`)
        sucesso++
      }
    } catch (err) {
      console.log(`ERRO  ${nome} (${email}) — ${err.message}`)
      falha++
      erros.push({ nome, email, erro: err.message })
    }
    await new Promise(r => setTimeout(r, 300))
  }

  console.log('\n========================================')
  console.log(`Cadastrados: ${sucesso}`)
  console.log(`Ja existiam: ${pulados}`)
  console.log(`Erros:       ${falha}`)
  if (erros.length > 0) {
    console.log('\nJogadores com erro:')
    erros.forEach(e => console.log(`  - ${e.nome} | ${e.email} | ${e.erro}`))
  }
  console.log('\nEnvie para os jogadores:')
  console.log('   https://meubaba-nine.vercel.app')
  console.log('   Email: o email cadastrado')
  console.log(`   Senha: ${SENHA_PADRAO}`)
  console.log('\nConcluido!')
}

cadastrarTodos()
