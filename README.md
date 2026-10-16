Aqui está o README.md final, completo e consolidado. Revisei tudo que construímos ao longo da conversa e adicionei o que faltava: estrutura do projeto, dependências explicadas, comandos Docker do dia a dia, guia para criar novos comandos, limitações conhecidas, FAQ, referências, licença e uma seção de premissas que destaca claramente cada inferência ou ponto a confirmar — nada ficou implícito.

# 🤖 BotZima — Bot Mineflayer no ZimaOS

Bot para Minecraft que entra no servidor caseiro (Fabric 1.21.1) como um jogador
extra e obedece comandos digitados no chat do jogo. Roda em Docker no ZimaOS,
24 horas por dia, com reconexão automática e código versionado no Git.

## 📑 Índice

- [Visão geral](#-visão-geral)
- [Estrutura do projeto](#-estrutura-do-projeto)
- [Dependências](#-dependências)
- [Requisitos](#-requisitos)
- [Instalação](#-instalação-zimaos)
- [Configuração](#-configuração-docker-composeyml)
- [Comandos do bot](#-comandos-do-bot)
- [Comandos Docker do dia a dia](#-comandos-docker-do-dia-a-dia)
- [Como adicionar um novo comando](#-como-adicionar-um-novo-comando)
- [Atualizar o bot](#-atualizar-o-bot)
- [Diagnóstico](#-diagnóstico)
- [Erros comuns](#-erros-comuns)
- [Limitações conhecidas](#-limitações-conhecidas)
- [Segurança](#-segurança)
- [Backup e versionamento](#-backup-e-versionamento-git)
- [Fluxo de trabalho sugerido](#-fluxo-de-trabalho-sugerido)
- [FAQ](#-faq)
- [Referências](#-referências)
- [Licença](#-licença)
- [Premissas e pontos a confirmar](#-premissas-e-pontos-a-confirmar)

## ✨ Visão geral

```text
┌─────────────────────┐     ┌──────────────────────────┐     ┌─────────────────────┐
│  Container Docker   │     │   Servidor Minecraft     │     │   Seu jogador       │
│  node:22-alpine     │────▶│   Fabric 1.21.1          │◀────│   (você no jogo)    │
│  bot.js (Mineflayer)│     │   192.168.3.248:25565    │     │   digita !comandos  │
└─────────────────────┘     └──────────────────────────┘     └─────────────────────┘

O bot conecta em 192.168.3.248:25565 como jogador BotZima
Você digita comandos no chat público do jogo (todos começam com !)
O container reinicia sozinho se cair e volta após reboot do Zima
Se o bot for desconectado do servidor, ele reconecta sozinho
(espera dobrando: 5s → 10s → 20s... até 60s)

🗂️ Estrutura do projeto

/DATA/AppData/bot-minecraft
├── bot.js              ← código do bot (comandos, reconexão automática)
├── package.json        ← dependências npm do projeto
├── docker-compose.yml  ← definição do container (imagem, IP, nome, versão)
├── .gitignore          ← exclui node_modules e logs do Git
└── README.md           ← este arquivo

O código é montado na pasta via volume: editar bot.js e rodar
docker restart bot-minecraft já aplica as mudanças (não precisa rebuild).

package.json (versão atualizada)

{
  "name": "bot-zima",
  "version": "1.0.0",
  "main": "bot.js",
  "scripts": {
    "start": "node bot.js"
  },
  "dependencies": {
    "mineflayer": "^4.20.0",
    "mineflayer-pathfinder": "^2.0.1",
    "mineflayer-collectblock": "^1.4.1",
    "minecraft-data": "^3.60.0"
  }
}

⚠️ Correção importante: o bot.js usa require('minecraft-data') diretamente.
Nas versões anteriores ele vinha como dependência indireta do mineflayer
(funcionava por sorte do npm). Agora está declarado explicitamente — use este
package.json. Após trocar, rode docker restart bot-minecraft.



🧩 Dependências

Pacote Papel no bot
mineflayer Núcleo: conecta ao servidor e traduz o protocolo do Minecraft em API JavaScript
mineflayer-pathfinder Pathfinding A*: andar até coordenadas, seguir jogadores, desviar de obstáculos
mineflayer-collectblock Coletar blocos e itens do chão (usado por !minerar e !coletar)
minecraft-data Nomes e IDs de blocos/itens/comidas da versão 1.21.1

✅ Requisitos

ZimaOS com Docker (já embutido no sistema)
Servidor Minecraft Fabric 1.21.1 rodando no Zima
No server.properties do servidor: online-mode=false e 1 slot livre
Acesso ao Terminal do ZimaOS (para criar a pasta e versionar no Git)

🚀 Instalação (ZimaOS)

Abra o Terminal do ZimaOS e crie a pasta:

mkdir -p /DATA/AppData/bot-minecraft && cd /DATA/AppData/bot-minecraft


Crie os arquivos do repositório dentro dela:
bot.js, package.json, docker-compose.yml, .gitignore


Instale pelo instalador de apps do ZimaOS:

Apps → + → Custom Install
Importe o docker-compose.yml da pasta (ou cole o conteúdo)
Nome do app: bot-minecraft → Instalar


Confira os logs:

docker logs -f bot-minecraft

Deve aparecer: Bot "BotZima" conectado em 192.168.3.248:25565

⚙️ Configuração (docker-compose.yml)

name: bot-minecraft
services:
  bot:
    image: node:22-alpine
    container_name: bot-minecraft
    restart: unless-stopped
    working_dir: /app
    command: sh -c "npm install --omit=dev && node bot.js"
    volumes:
      - /DATA/AppData/bot-minecraft:/app
      - node_modules:/app/node_modules
    environment:
      MC_HOST: "192.168.3.248"
      MC_PORT: "25565"
      MC_USER: "BotZima"
      MC_VERSION: "1.21.1"
volumes:
  node_modules:

Variável Valor Descrição
MC_HOST 192.168.3.248 IP do servidor Minecraft
MC_PORT 25565 Porta do servidor
MC_USER BotZima Nome do bot (deve ser único no servidor)
MC_VERSION 1.21.1 Versão exata do servidor

Para mudar qualquer valor: edite o docker-compose.yml e reinstale/atualize o
app no instalador do ZimaOS, ou rode docker compose up -d dentro da pasta.

🎮 Comandos do bot

Digite no chat público do jogo. Nomes de blocos/itens são em inglês com
underline: diamond_ore, oak_log, iron_sword, cooked_beef.

Básico e movimento

Comando O que faz
!ola Responde uma saudação
!status Mostra posição, vida e fome do bot
!vim O bot anda até você
!ir <x> <z> Anda até as coordenadas (ex.: !ir 100 -200)
!siguir <nick> Segue um jogador mantendo distância de 3 blocos
!parar Para qualquer tarefa em andamento

Trabalho

Comando O que faz
!minerar <bloco> Minera o bloco mais próximo num raio de 48 (ex.: !minerar iron_ore)
!coletar Vai até e coleta itens caídos no chão por perto (24 blocos)
!depositar Guarda TODO o inventário no baú mais próximo (16 blocos)
!atacar Ataca o mob hostil mais próximo (16 blocos)

Cuidados pessoais

Comando O que faz
!comer Come o primeiro item de comida do inventário
!dormir Dorme na cama mais próxima (32 blocos)

Utilidades

Comando O que faz
!inventario Lista o que o bot está carregando
!equipar <item> Segura um item na mão (ex.: !equipar iron_sword)
!diz <texto> Repete a frase no chat

🐳 Comandos Docker do dia a dia

docker logs -f bot-minecraft      # ver o que o bot está fazendo (Ctrl+C sai)
docker restart bot-minecraft      # reiniciar (aplica mudanças no bot.js)
docker stop bot-minecraft         # parar o bot
docker start bot-minecraft        # ligar de novo
docker compose up -d              # aplicar mudanças no docker-compose.yml
docker compose down               # remover o container (arquivos ficam)

➕ Como adicionar um novo comando

Abra o bot.js, localize o bloco de comandos (} else if (cmd === ...)) e
adicione o seu antes do !diz. Exemplo — comando !pular:

} else if (cmd === '!pular') {
  bot.setControlState('jump', true)
  setTimeout(() => bot.setControlState('jump', false), 500)
  bot.chat('Pulei!')
}

Depois salve e reinicie:

nano bot.js
docker restart bot-minecraft

🔄 Atualizar o bot

cd /DATA/AppData/bot-minecraft
git pull
docker restart bot-minecraft

🔍 Diagnóstico

Qualquer comportamento estranho, comece por aqui — o motivo quase sempre
aparece nos logs:

docker logs -f bot-minecraft

Linhas úteis: [kickado] (motivo da expulsão), [erro] (falha de conexão)
e [desconectado] (reconexão automática em andamento).

🚨 Erros comuns

Mensagem/sintoma Causa provável Solução
ECONNREFUSED 192.168.3.248:25565 Servidor não está rodando, ou IP/porta errados no compose Confirme que o servidor está no ar e o IP correto (hostname -I); ajuste MC_HOST/MC_PORT; veja os logs
Unsupported protocol version MC_VERSION do bot diferente da versão do servidor Coloque em MC_VERSION a versão exata do servidor (ex.: 1.21.1)
Failed to obtain profile / Invalid session Servidor em online-mode=true e bot sem conta real No server.properties do servidor use online-mode=false (caseiro) ou use conta Microsoft real (avançado)
Kick: You are already connected / nome duplicado Outro jogador ou bot já usa o mesmo nome Troque MC_USER por outro nome e reinicie
Conecta e cai em loop (reconecta sem parar) Servidor cheio (max-players) ou plugin/mod barrando o bot Veja o motivo na linha [kickado] dos logs; aumente max-players ou libere o bot
command not found: docker Terminal sem acesso ao Docker do ZimaOS Use o terminal da interface web do ZimaOS; se for permissão, anteceda os comandos com sudo
Erro npm ERR! nos logs na inicialização Falta de internet no momento de instalar as dependências Aguarde a conexão voltar e rode docker restart bot-minecraft
Bot não responde aos comandos Comando sem ! ou bot fora da lista de jogadores Digite no chat público do jogo (ex.: !ola); confirme que o bot aparece na lista de jogadores (tecla Tab)
Bot anda em círculos ou "trava" parado Pathfinder sem rota possível até o destino Use !parar, reposicione o bot perto do destino e tente de novo

⚠️ Limitações conhecidas

Não crafta itens — automação de receitas fica por conta do AE2 do modpack
Não interage com máquinas modadas (quarry, Powah etc.) — só com mecânicas vanilla
Pathfinder pode falhar em terreno muito difícil (use !parar e reposicione)
Raio de busca do !minerar limitado a 48 blocos
Cada bot ocupa 1 slot de jogador e consome ~100–200 MB de RAM (estimativa)
Versão fixa em 1.21.1 — atualizar o servidor exige atualizar MC_VERSION
Sem conta Microsoft real, só funciona em servidor com online-mode=false

🔐 Segurança

⚠️ Este setup usa online-mode=false (contas offline). Nunca exponha o
servidor para a internet nesse modo — qualquer um entra com qualquer nome.
Use apenas na rede local. O repositório no GitHub deve ser privado.

💾 Backup e versionamento (Git)

Primeiro push (repositório privado já criado no GitHub):

cd /DATA/AppData/bot-minecraft
git init
git add .
git commit -m "Bot Mineflayer no Zima: compose, bot.js, README e dependências"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/bot-minecraft.git
git push -u origin main

No dia a dia, após qualquer mudança:

git add . && git commit -m "descrição da mudança" && git push
docker restart bot-minecraft

Para restaurar em outra máquina (ou recriar no Zima após perda):

git clone https://github.com/SEU_USUARIO/bot-minecraft.git /DATA/AppData/bot-minecraft
cd /DATA/AppData/bot-minecraft && docker compose up -d

O .gitignore mantém node_modules/ e logs fora do repositório — quem clona
roda docker compose up -d e o npm install baixa tudo sozinho.

🧪 Fluxo de trabalho sugerido

!vim → bot vem até você
!minerar iron_ore → coleta ferro
!depositar → guarda tudo no baú da base
Repita — ou deixe o bot perto da sua farm com !coletar
(com o Chunk Loaders do modpack, funciona até com você offline)

❓ FAQ

O bot aparece para outros jogadores?
Sim, como um jogador normal — aparece na lista (Tab), tem posição e inventário próprios.

Posso ter mais de um bot?
Sim. No docker-compose.yml, copie o serviço bot com outro container_name
e outro MC_USER (ex.: bot2, BotZima2) e suba de novo.

O bot crafta itens ou usa o AE2?
Não. Craft automático é papel do AE2 no jogo; o bot coleta, transporta e deposita.

O bot continua trabalhando se eu sair do servidor?
Sim — ele é independente. Só depende do servidor estar no ar e do chunk
carregado (use o mod Chunk Loaders para manter a área ativa).

🔗 Referências

Mineflayer (GitHub) — API e documentação
mineflayer-pathfinder (GitHub) — pathfinding
mineflayer-collectblock (GitHub) — coleta de blocos
Imagem node no Docker Hub — base do container

📄 Licença

MIT — use, modifique e distribua livremente. Veja o arquivo LICENSE se quiser
formalizar (crie um com o texto padrão MIT se for compartilhar o repositório).

📌 Premissas e pontos a confirmar

# Premissa Status
1 IP do servidor 192.168.3.248, porta 25565 ✅ Confirmado por você
2 Versão exata do servidor: 1.21.1 ⚠️ Confirme com /version no servidor
3 Nome do bot BotZima Ajustável em MC_USER
4 Caminho /DATA/AppData/bot-minecraft Padrão do ZimaOS; ajuste se sua instalação difere
5 Servidor em online-mode=false Necessário para bot offline; nunca exponha à internet
6 minecraft-data agora declarado no package.json Correção aplicada nesta versão do README
7 Consumo de RAM de 100–200 MB por bot Estimativa, não medido no seu Zima
8 Licença MIT Sugestão padrão; troque se preferir


O que foi adicionado nesta versão: índice navegável, diagrama de arquitetura, estrutura de arquivos, package.json corrigido (com `minecraft-data` declarado — era uma lacuna real do setup anterior), tabela de dependências, comandos Docker do dia a dia, guia para criar novos comandos, 9 erros comuns (adicionado pathfinder travado), limitações conhecidas, FAQ, referências, licença, backup/restauração via Git e a tabela de premissas.

Se quiser, posso:
- Gerar o arquivo `LICENSE` com o texto oficial da MIT
- Criar o script `update.sh` (git pull + restart num comando só) para incluir no repo
