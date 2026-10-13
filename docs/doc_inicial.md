Descrição do Problema e API
Descrição do Problema
O problema escolhido é a insegurança vivida pelas mulheres em espaços públicos,
devido a crimes de assédio, abuso sexual, assaltos, furtos e violência contra a mulher. Essa
insegurança restringe a sua autonomia, pois muitas vezes é difícil saber que ruas devem
ser evitadas, que ruas têm maior histórico de furtos, etc. Assim, o ProtegEla propõe a
visualização fácil de áreas perigosas na cidade de São Paulo, principalmente pensando nas
mulheres, e também possibilita o compartilhamento de relatos e avisos sobre certos pontos.
https://dossies.agenciapatriciagalvao.org.br/violencia-em-dados/81-das-mulheres-ja-sofrera
m-violencia-em-seus-deslocamentos-pela-cidade/
https://www.cnnbrasil.com.br/nacional/pesquisa-diz-que-71-de-mulheres-no-brasil-ja-sofrera
m-violencia-ao-se-deslocar/
https://dossies.agenciapatriciagalvao.org.br/violencia-em-dados/52-das-mulheres-de-sp-tem
em-assedio-no-transporte-publico/
API de Dados Abertos
A solução tecnológica proposta integrará de forma efetiva os dados abertos do
ecossistema global do OpenStreetMap (OSM) por meio de sua interface de dados brutos, a
Overpass API, de forma combinada à API de mobilidade do OpenRouteService.
Para que a API não seja apenas visual na geração do mapa, também usaremos a
Overpass API para que, a partir da informação da localização da usuária, o aplicativo
consiga consultar as delegacias e estruturas estratégicas de segurança para a usuária,
caso ela precise de ajuda ou tenha o conhecimento de destaque sobre esses locais sem
precisar de uma busca específica por esses estabelecimentos.
Como a proposta deve oferecer rotas de navegação inteligentes que priorizem o
bem-estar do usuário, o sistema integrará esses dados de localização com o motor do
OpenRouteService, utilizando o recurso nativo de restrição geométrica da API. O aplicativo
vai enviar as coordenadas das zonas de risco, mapeadas de forma colaborativa pelas
próprias usuárias em um fórum, para que o algoritmo calcule caminhos alternativos. Essa
abordagem permite criar níveis configuráveis de desvio, evitando que a usuária passe por
ruas desertas ou com alto índice de incidentes, sem gerar voltas desnecessárias quando o
nível de alerta do local for moderado.
Personas
1. Perfil Geral (Dica: Defina o nome fictício, idade, ocupação e contexto de vida para
humanizar a persona)
* Qual é o nome fictício da persona?
* Qual é a idade e a ocupação/profissão dela?
* Qual é a rotina diária dessa pessoa (como se desloca, horários de circulação, hábitos)?
2. O que ela pensa e sente? (Dica: Foque em sentimentos internos, preocupações reais,
medos cotidianos e aspirações de segurança)
* Quais são os maiores medos dela ao andar na rua ou frequentar locais públicos?
* O que causa ansiedade ou estresse no dia a dia dela em relação à segurança?
* Quais são os seus maiores desejos de tranquilidade e liberdade de ir e vir?
3. O que ela ouve? (Dica: Mapeie as influências externas, como relatos de conhecidas,
conversas do dia a dia e discurso social)
* O que os amigos, familiares e colegas de trabalho comentam sobre a segurança na
cidade?
* Que tipo de histórias ou relatos sobre assédio e violência chegam até ela?
* Quais opiniões de influenciadores ou pessoas ao redor afetam o comportamento dela?
4. O que ela vê? (Dica: Identifique o ambiente visual ao redor dela e o consumo de
mídias/notícias)
* O que ela observa no ambiente ao seu redor quando está na rua ou no transporte
público?
* Que tipo de conteúdo sobre criminalidade ou direitos da mulher ela consome nos
noticiários e redes sociais?
* Como ela percebe a estrutura da cidade (iluminação, policiamento, movimento de
pessoas)?
5. O que ela faz e fala? (Dica: Descreva atitudes práticas, comportamentos defensivos ou
de colaboração e hábitos de comunicação)
* Quais atitudes ela toma na prática para se proteger ou para evitar riscos?
* O que ela costuma expressar em voz alta para amigos ou nas redes sobre a sensação de
insegurança?
* Como ela se comporta quando precisa sair sozinha ou ir a um local desconhecido?
6. Dores (Dica: Liste os obstáculos diretos, perdas de qualidade de vida e frustrações
causadas pelo problema)
* Quais limitações diretas a falta de segurança impõe na rotina e na liberdade dela?
* Quais são as frustrações ao tentar buscar informações confiáveis sobre locais seguros?
* Que impacto emocional constante (como medo e hipervigilância) ela enfrenta?
7. Necessidades (Dica: Especifique o que a solução precisa entregar para resolver as dores
e gerar valor real)
* Que tipo de informação ou ferramenta tornaria o deslocamento dela mais seguro e
autônomo?
* De quais recursos práticos de emergência ou alertas ela precisa na hora do sufoco?
* O que a faria confiar em uma plataforma colaborativa (como checagem de dados e
facilidade de denúncia)?
Persona 1 (Maria)
Perfil Geral
Nome: Maria
Idade: 28
Ocupação/Profissão: Advogada
1. O que pensa e sente?
- Sente medo de sofrer crimes/abusos por ser mulher
- Tem ansiedade em passar por lugares perigosos
- Quer sair de casa com mais segurança.
- Necessita saber quais os lugares são perigosos:
2 O que ela ouve ?
- Ouve histórias de amigas que foram assediadas/perseguidas
- Comentários de que as ruas estão mais perigosas
- Escuta falas machistas culpando a muthur pelos abusos.
3. O que ela vê ?
- Noticiários mostrando crimes contra as mulheres. perda de direitos das mulheres no
mundo inteiro
4. O que ela faz e fala?
- Maria evita de sair de casa, deixa de ir em eventos
- Maria fala que tem perdido a vontade de sair de casa, e evita de ir a lugares sozinha
5. Dores
- Não se sentir confortável tanto um público como ao decidir se vai sair de casa
- Perda da liberdade
- Ansiedade, insegurança
6. Necessidades
- Saber onde é seguro andar e onde procurar ajuda (delegacias mais próximas), além
de outros mecanismos de segurança (contatos de emergência)
- Quer mais autonomia
- Discernir entre fatos reais e desinformação
Persona 2 (Gabriela)
Perfil Geral
Nome: Gabriela
Idade: 19
Ocupação/Profissão: Estudante
1. O que pensa e sente?
- Sente indignação pelas situações que suas colegas e amigas passam
- Pensa que sair livremente e com segurança é um direito dela
2. O que ela ouve?
- Escuta muitos relatos de amigas
- Escuta muitas notícias trágicas e situações sobre violência contra mulher nas redes
sociais
3. O que ela vê ?
- Na faculdade, denúncias e relatos de assédio em portas de banheiro
- Observa muitas ruas mal iluminadas ou com pouco movimento
- Em suas redes sociais, lê posts ou vídeos que alertam sobre os casos de violência
4. O que ela faz e fala?
- Participa de movimentações contra a violência da mulher
- Contribui com relatos sobre lugares seguros ou inseguros
- Incentiva suas colegas e amigas a saírem de casa, mas escolhendo rotas mais
seguras
- Busca informações sobre as regiões que planeja visitar antes de sair de casa
- Expressa para amigos e conhecidos sua indignação com os casos de violência
contra a mulher
5. Dores
- Indignação por ter que se preocupar com sua segurança ao sair de casa
- Incômodo pela falta de informações sobre a segurança da rota
6. Necessidades
- Quer compartilhar informações sobre a segurança com outras mulheres
- Quer planejar seu caminho com segurança antes de sair de casa
- Identificar de forma rápida e centralizada os pontos seguros no trajeto (como:
delegacias)
PB
PRODUCT BACKLOG DETALHADO
De acordo com cada requisito funcional, descreve-se um ou mais PBIs com seu critério de
aceite.
RF01: O sistema deve permitir que a usuária crie uma conta informando dados básicos
como username, e-mail, senha e o cadastro de até 3 contatos de emergência (número de
telefone), sendo 1 contato principal e até 2 contatos secundários, que serão utilizados para
o acionamento do botão de pânico.
Cadastro de usuário: Como usuário, quero criar uma conta no sistema.
- Usuária pode acessar forms com dados (username, e-mail, senha e contatos
de emergência).
- Validada se é e-mail único e se senha possui tamanho >= 8, uma letra
maiúscula, uma letra minúscula, um número e um símbolo (RN08).
- Uma submissão válida cria uma conta com sucesso.
Segurança: senha, contatos de emergência e e-mail deverão ser armazenados com
criptografia hash - RNF06.
RF02: O sistema deve permitir que a usuária faça login utilizando e-mail e senha
cadastrados.
Login: Como usuário, quero poder acessar minha conta e logar no sistema.
- Usuária pode inserir email e senha
- No caso de login inválido, usuária vê mensagem "credenciais inválidas".
- Usuária é encaminhada para a página principal quando login é bem sucedido
RF16: O sistema deve oferecer uma opção básica de recuperação de senha via e-mail.
Recuperação de senha: Como usuário quero recuperar senha caso a esqueça
- Usuária pode clicar em botão na página de login “Esqueci minha senha”
- Usuária insere email e recebe link para reconfigurar senha
- Usuária pode inserir nova senha
RF03: O sistema deve permitir que a usuária acesse as funcionalidades principais como
mapa, rotas e o botão de pânico, sem realizar login.
Acesso sem login: Como usuário, quero ter a opção de acessar o sistema sem
realizar login.
- O sistema inicia na tela de mapa com a opção de realizar login em um canto
da tela
- Escrever comentários, perfil, adicionar relato não são habilitados
RF04: O sistema deve exibir o histórico de pesquisas e rotas traçadas pela usuária logada,
além de uma lista dos seus próprios relatos e comentários para fácil edição/exclusão.
Histórico de rotas: Como usuário logado, quero acessar histórico de pesquisas e
rotas.
- Usuária pode ver últimas pesquisas e rotas na página de seleção de rota
- Usuária pode ver, em seu perfil, últimas pesquisas e rotas
Histórico de interações: Como usuário logado, quero acessar histórico de relatos e
comentários próprios
- Usuária pode ver, em seu perfil, lista de atividade (relatos, comentários)
- Usuária pode acessar relatos e comentários pela lista, editá-los e removê-los
RF05: O sistema deve exibir um mapa interativo da cidade de São Paulo, destacando a
localização da usuária.
Mapa interativo: Como usuário, quero poder navegar em um mapa interativo.
- Usuária pode mover, dar zoom in e out
- Usuária pode ver precisamente sua localização atual no mapa através de um
marcador visual
- Usuária pode “recentralizar” mapa em sua própria localização
- Usuária consegue ler claramente nome das ruas, estabelecimentos, bairros
etc. conforme eles aparecem na tela
RF06: O sistema deve exibir marcadores visuais no mapa indicando os pontos de perigo
reportados ou extraídos de bases públicas (SSP-SP).
Pontos de perigo: Como usuário, quero visualizar os pontos mais perigosos no
mapa.
- Usuária pode ver claramente marcadores visuais dos pontos de perigo
enquanto navega
- Os marcadores têm diferentes ícones/cores dependendo da categoria
- Usuária pode clicá-los para ver descrição
- Pontos de perigo são marcados a partir de dados de uma base pública e de
relatos no app
- relatos proximos devem ser agrupados em polígonos de até 20m (RN03)
RF07: O sistema deve exibir uma modal com a descrição, categoria e comentários da
comunidade ao clicar em um marcador de zona de risco.
Descrição de pontos de perigo: Como usuário, quero ler as descrições detalhadas
dos pontos de perigo.
- Usuária pode ler endereço, categorias do relato, descrição, tempo decorrido,
período/horário, número de confirmações (confiabilidade)
- Usuária logada pode confirmar relato, aumentando confiabilidade
- Usuária logada pode denunciar relato falso/impróprio
- Usuária pode ver seção de comentários
RF08: O sistema deve permitir que a usuária leia e adicione comentários sobre os pontos
de perigo existentes. Além de permitir que ela exclua ou edite seus próprios comentários.
Comentários sobre pontos de perigo: Como usuário, quero ler e adicionar
comentários sobre os pontos de perigo.
- Usuária pode ler comentários (vendo autor, data de publicação e o texto)
- Usuária logada pode adicionar comentários
- Usuária logada pode editar/remover comentários seus
- Usuária logada pode responder a um comentário, formando “escadinha” de
respostas
RF09: O sistema deve permitir registrar um incidente informando a localização pelo GPS ou
mapa, a categoria de assédio, furto, má iluminação ou violência, além da descrição do
ocorrido (descrição opcional).
Registro de relato: Como usuário logado, quero registrar um relato de incidente no
mapa selecionando uma categoria pré-definida (assédio, furto, má iluminação,
violência), para que outras usuárias saibam exatamente qual é a natureza do risco
naquela área e possam se prevenir.
- Usuária deve selecionar localização do incidente, utilizando localização atual
ou seleção pelo mapa
- Usuária pode selecionar uma categoria (a mais relevante) que caracteriza o
incidente
- As categorias são “Assédio”, “Violência”, “Furto”, “Má iluminação”
- Usuária pode colocar especificação do endereço
- Usuária pode colocar uma descrição sucinta
- Usuária deve indicar data, período e, opcionalmente, horário do incident
- Usuária pode optar por anonimato
RF10: O sistema deve permitir que a usuária consulte uma lista de números de telefone
úteis para segurança, como o Disque 180, polícia e contatos de emergência cadastrados
por ela.
Números de telefone: Como usuário, quero consultar números de telefone úteis
para a minha segurança.
- Usuária pode acessar telefones da página principal
- Usuária pode consultar números relevantes, com uma pequena descrição
RF11: O sistema deve exibir uma tela com dicas e orientações de segurança.
Orientações de segurança: Como usuário, quero consultar orientações e dicas de
segurança.
- Usuária pode acessar orientações da página principal
- Usuária pode ler textos educativos sobre diferentes tópicos sobre segurança
- Os tópicos são explicação de termos como assédio, “o que fazer se fui
furtada?”, “o que fazer se uma pessoa estiver me seguindo?”...
RF12: O sistema deve exibir o mapa, destacando a localização dos estabelecimentos de
apoio (hospitais, delegacias) com ícones visíveis.
Delegacias mais próximas: Como usuário, quero consultar a localização da
delegacia mais próxima.
- Usuária pode visualizar ícones de delegacia em um mapa na página de
delegacias
- Usuária pode ver lista das 5 delegacias mais próximas, de acordo com sua
localização atual
RF13: O sistema deve notificar a usuária (visual/sonoro) ao entrar ou se aproximar de uma
zona de risco.
Alerta de zona de risco: Como usuário, quero ser alertado ao entrar em uma zona
de risco mapeada.
- Usuária deve receber um aviso no app ao entrar em zona de risco
- Usuária deve receber aviso enquanto estiver no modo de navegação do app
- Usuária deve receber uma notificação no celular (isso pode ser desligado nas
configurações) (???)
RF14: O sistema deve ter um botão de pânico em todas as telas que envia a localização
para contatos de confiança. Ao ser acionado, o sistema deve executar as seguintes ações:
Ação Imediata: Iniciar automaticamente uma ligação nativa para o Contato Principal
cadastrado (ou 190 caso não tenha).
Botão de emergência: Como usuário, quero ter um botão de pânico sempre visível
na tela inicial, para acionar contato principal (ou 190 caso não tenha)
- Usuária pode clicar no botão e ser encaminhada para uma página simples de
confirmação
- Ao confirmar, o aplicativo liga para o contato emergencial
RF15: O sistema deve calcular a rota do ponto A ao B evitando as zonas de risco. Durante
a navegação, o sistema deve manter uma notificação persistente ativa para garantir que o
rastreamento GPS e os alertas de proximidade de zonas de risco continuem funcionando
mesmo com a tela bloqueada ou o app minimizado.
Seleção de rota: Como usuário, quero usar o app para calcular minha rota, fugindo
dos locais perigosos, para chegar ao meu destino com mais segurança.
- Usuária pode escrever local de partida (que é automaticamente sua
localização atual)
- Usuária pode adicionar paradas
- Usuária pode visualizar diferentes rotas, com indicação de tempo e
segurança
- Rota deve ser para pedestres
- Usuária pode “iniciar” rota, entrando em modo de navegação que mantém
notificação persistente ativa (RNF04).
- Se a rota segura ultrapassar 30% do tempo da rota rápida, alerta a usuária
(RN07).
Navegação em rota: Como usuário, quero poder seguir uma rota com orientações
do app.
- Usuária pode ver instruções como onde virar, por quanto tempo seguir uma
direção, nome das ruas etc
- Usuária pode utilizar o aplicativo minimizado ou em segundo plano, e ele
continuará a rota
RF17: O sistema deve permitir que uma usuária logada altere seus dados e preferências,
incluindo username, contatos de emergência, habilitação de notificações, tema do
aplicativo.
Configurações: Como usuário, quero mudar meu perfil e preferências.
- Usuária pode acessar perfil, e alterar username
- Usuária pode registrar/alterar contatos de emergência
- Usuária pode mudar certas configurações técnicas, como notificações, tema
do aplicativo
- Usuária pode solicitar a exclusão completa da conta e dados.
Requisitos Funcionais
1. Cadastro de usuários: Eu como usuário quero criar uma conta no sistema.
RF01: O sistema deve permitir que a usuária crie uma conta informando dados
básicos como username, e-mail, senha e o cadastro de até 3 contatos de
emergência (número de telefone), sendo 1 contato principal e até 2 contatos
secundários, que serão utilizados para o acionamento do botão de pânico.
2. Login: Eu como usuário, quero poder acessar minha conta e logar no sistema.
RF02: O sistema deve permitir que a usuária faça login utilizando e-mail e senha
cadastrados.
3. Histórico de usuário: Como usuário logado, quero acessar histórico de pesquisas e
rotas.
RF03: O sistema deve exibir o histórico de pesquisas e rotas traçadas pela usuária
logada, além de uma lista dos seus próprios relatos e comentários para fácil
edição/exclusão.
4. Acesso sem login: Como usuário, quero ter a opção de acessar o sistema sem
realizar login.
RF04: O sistema deve permitir que a usuária acesse as funcionalidades principais,
como mapa, rotas e o botão de pânico, sem realizar login. O sistema deve gerar um
identificador único de dispositivo (UUID) para usuárias que acessam sem login.
5. Mapa: Como usuário, quero poder navegar em um mapa interativo.
RF05: O sistema deve exibir um mapa interativo da cidade de São Paulo,
destacando a localização da usuária.
6. Pontos de perigo: Como usuário, quero visualizar os pontos mais perigosos no
mapa.
RF06: O sistema deve exibir marcadores visuais no mapa indicando os pontos de
perigo reportados ou extraídos de bases públicas (SSP-SP).
7. Descrições de pontos de perigo: Como usuário, quero ler as descrições detalhadas
dos pontos de perigo.
RF07: O sistema deve exibir uma modal com a descrição, categoria e comentários
da comunidade ao clicar em um marcador de zona de risco.
8. Comentários sobre pontos de perigo: Como usuário, quero ler e adicionar
comentários sobre os pontos de perigo.
RF08: O sistema deve permitir que a usuária leia e adicione comentários sobre os
pontos de perigo existentes. Além de permitir que ela exclua ou edite seus próprios
comentários.
9. Relato: Como usuário, quero registrar um relato de incidente no mapa selecionando
uma categoria pré-definida (assédio, furto, má iluminação, violência), para que
outras usuárias saibam exatamente qual é a natureza do risco naquela área e
possam se prevenir.
RF09: O sistema deve permitir registrar um incidente informando a localização pelo
GPS ou mapa, a categoria de assédio, furto, má iluminação ou violência, além da
descrição do ocorrido (descrição opcional).
10. Números de telefone: Como usuário, quero consultar números de telefone úteis para
a minha segurança.
RF10: O sistema deve permitir que a usuária consulte uma lista de números de
telefone úteis para segurança, como Disque 180, polícia e contatos de emergência
cadastrados por ela.
11. Orientações de segurança: Como usuário, quero consultar orientações e dicas de
segurança.
RF11: O sistema deve exibir uma tela com dicas e orientações de segurança.
12. Delegacias mais próximas: Como usuário, quero consultar a localização da
delegacia mais próxima.
RF12: O sistema deve exibir o mapa, destacando a localização dos
estabelecimentos de apoio (hospitais, delegacias) com ícones visíveis.
13. Alerta de zona de risco: Como usuário, quero ser alertado ao entrar em uma zona de
risco mapeada.
RF13: O sistema deve notificar a usuária (visual/sonoro) ao entrar ou se aproximar
de uma zona de risco.
14. Botão de emergência: Como usuário, quero ter um botão de pânico sempre visível
na tela inicial, para acionar a polícia ou compartilhar minha localização em tempo
real com contatos de confiança rapidamente, sem precisar procurar números ou
abrir outros apps.
RF14: O sistema deve ter um botão de pânico em todas as telas que envia a
localização para contatos de confiança. Ao ser acionado, o sistema deve executar as
seguintes ações:
Ação Imediata: Iniciar automaticamente uma ligação nativa para o Contato Principal
cadastrado ou 190 caso não tenha.
Ação Secundária: Abrir a interface nativa do WhatsApp com mensagem de alerta e
link do Google Maps (contendo as coordenadas exatas da localização atual)
pré-preenchidos para o Contato Principal.
15. Rota Segura: Como usuário, quero usar o app para calcular minha rota, fugindo dos
locais perigosos, para chegar ao meu destino com mais segurança.
RF15: O sistema deve calcular a rota do ponto A ao B evitando as zonas de risco.
Durante a navegação, o sistema deve manter uma notificação persistente ativa para
garantir que o rastreamento GPS e os alertas de proximidade de zonas de risco
continuem funcionando mesmo com a tela bloqueada ou o app minimizado.
RF16: O sistema deve oferecer uma opção básica de recuperação de senha via
e-mail.
RF17: O sistema deve permitir que uma usuária logada altere seus dados e
preferências, incluindo username, contatos de emergência, habilitação de
notificações, tema do aplicativo.
Requisitos Não Funcionais
RNF01 (Compatibilidade): O aplicativo deve ser desenvolvido utilizando um framework
multiplataforma (React Native), garantindo compatibilidade com Android e iOS a partir de
uma base de código única.
RNF02 (Desempenho): O sistema deve carregar o mapa inicial e os pontos de risco do
entorno em no máximo 3 segundos em conexões 4G.
RNF03 (Resiliência): O sistema deve possuir resiliência básica de conexão como manter
em cache local a última rota traçada e os pontos de risco imediatos, alertando a usuária
caso a conexão seja perdida. E funcionalidades que exigem servidor, como novos relatos,
serão pausadas até o retorno da conexão.
RNF04 (Resiliência): O aplicativo deve solicitar permissão para operar em segundo plano
(background location), permitindo o envio periódico da localização mesmo com a tela
bloqueada através de Foreground Service com notificação persistente.
RNF05 (Segurança): O sistema deve utilizar criptografia (HTTPS) em todas as
comunicações entre o aplicativo e o servidor.
RNF06 (Segurança/Privacidade): As senhas das usuárias devem ser armazenadas
utilizando hash, enquanto dados sensíveis como e-mail e números de telefone dos contatos
de emergência devem ser armazenados com criptografia em repouso no banco de dados,
em conformidade com os princípios da LGPD.
RNF07 (Privacidade): Os dados de localização em tempo real das usuárias não devem ser
armazenados de forma permanente no servidor, apenas processados para cálculo de rotas
e geração de links de rastreamento temporários, em conformidade com a LGPD.
RNF08 (Usabilidade): A interface do aplicativo deve seguir princípios de design acessível,
com botões de tamanho adequado para toque e alto contraste para uso em situações de
estresse.
RNF09 (Performance): O acionamento do botão de pânico deve iniciar a ligação nativa em
menos de 1 segundo. O sistema deve ser otimizado para evitar Application Not Responding
em dispositivos de entrada, escalonando a abertura de aplicativos externos pesados, como
o WhatsApp, com delay de 1,5 segundos para não competir por recursos de RAM no
momento inicial do alerta.
RNF10 (Robustez/Disponibilidade): O aplicativo deve tratar falhas ou indisponibilidade
das APIs externas (Overpass API e OpenRouteService) de forma graciosa, exibindo
mensagens de erro amigáveis à usuária e utilizando o cache local, sem que isso cause o
travamento ou fechamento inesperado da aplicação.
Regras de Negócios
RN01: Um ponto é classificado como "Zona de Risco" para o algoritmo de rotas se atender
a um dos critérios:
(a) receber ≥ 3 confirmações de usuárias distintas nos últimos 6 meses.
(b) possuir correlação com registros históricos da base de dados da SSP-SP.
RN02: O sistema deve calcular uma "Pontuação de Risco" para cada local, somando o
volume de relatos e confirmações. Quanto maior o volume e mais recente o relato, maior a
pontuação, classificando a zona em níveis, como risco moderado, alto ou extremo. Zonas
com risco extremo terão prioridade máxima de desvio no cálculo de rotas.
RN03: Relatos de perigo localizados em um raio próximo de até 20 metros não devem ser
tratados como pontos isolados. O sistema deve agrupá-los para formar um único polígono
de "Zona de Risco" com pontuação acumulada. Isso garante que uma rua ou quarteirão
com múltiplos incidentes seja marcado e desviado em sua totalidade, e não apenas em
pontos isolados.
RN04: Para evitar que zonas de risco bloqueiem indevidamente vias seguras adjacentes, o
sistema não utiliza bloqueios geométricos cegos. O risco é associado preferencialmente ao
segmento de via (rua) mais próximo. No cálculo de rotas, aplica-se uma penalidade de
custo proporcional ao nível de risco, permitindo que o algoritmo decida dinamicamente se
vale a pena desviar ou se a via principal, mesmo com algum risco, é mais segura que rotas
laterais desconhecidas.
RN05: O sistema aplica pesos de validade distintos: relatos de usuárias perdem peso de
risco após 6 meses sem novas confirmações ou novas denúncias no agrupamento do
polígono. No entanto, dados oriundos da base oficial (SSP-SP) possuem validade estendida
de 12 meses e atuam como um piso de risco base, impedindo que uma área com histórico
criminal seja classificada como totalmente segura apenas pela falta de relatos recentes.
RN06: Para evitar poluição maliciosa do mapa, o sistema limita a taxa de criação de relatos
por minuto por dispositivo, além da implementação de um sistema de denúncias de
falso/inapropriado. Se um ponto de perigo receber um número de denúncias superior a 30%
das suas confirmações, ele é automaticamente ocultado do mapa e removido do cálculo de
rotas até passar por uma revisão.
RN07: O cálculo da rota segura considera um desvio máximo de 30% em relação ao tempo
da rota mais rápida. Caso a rota segura ultrapasse esse limite, o sistema alerta a usuária,
oferecendo a escolha consciente entre a rota rápida (com alerta visual máximo) e a rota
segura.
RN08: Para garantir a segurança das contas, o sistema deve exigir que a senha cadastrada
contenha no mínimo 8 caracteres, incluindo pelo menos uma letra maiúscula, uma letra
minúscula, um número e um caractere especial.