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

- O bot conecta em `192.168.3.248:25565` como jogador `BotZima`
- Você digita comandos no chat público do jogo (todos começam com `!`)
- O container reinicia sozinho se cair e volta após reboot do Zima
- Se o bot for desconectado do servidor, ele reconecta sozinho
  (espera dobrando: 5s → 10s → 20s... até 60s)
- **20 comandos** organizados em: movimento, coleta/mineração, comida,
  combate/descanso e utilidades

## 🗂️ Estrutura do projeto

```text
/DATA/AppData/bot-minecraft
├── bot.js              ← código do bot (20 comandos, reconexão automática)
├── package.json        ← dependências npm do projeto
├── docker-compose.yml  ← definição do container (imagem, IP, nome, versão)
├── .gitignore          ← exclui node_modules e logs do Git
└── README.md           ← este arquivo
```

O código é montado na pasta via volume: editar `bot.js` e rodar
`docker restart bot-minecraft` já aplica as mudanças (não precisa rebuild).

### package.json (versão atualizada)

```json
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
```

> ⚠️ **Correção importante**: o `bot.js` usa `require('minecraft-data')` diretamente.
> Nas versões anteriores ele vinha como dependência indireta do mineflayer
> (funcionava por sorte do npm). Agora está declarado explicitamente — use este
> package.json. Após trocar, rode `docker restart bot-minecraft`.

## 🧩 Dependências

| Pacote | Papel no bot |
|---|---|
| `mineflayer` | Núcleo: conecta ao servidor e traduz o protocolo do Minecraft em API JavaScript |
| `mineflayer-pathfinder` | Pathfinding A*: andar até coordenadas, seguir jogadores, desviar de obstáculos |
| `mineflayer-collectblock` | Coletar blocos e itens do chão (usado por `!minerar`, `!coletar` e `!madeira`) |
| `minecraft-data` | Nomes e IDs de blocos/itens/comidas/receitas da versão 1.21.1 |
| `vec3` | Coordenadas 3D (usado no replantio do `!farmar`) — já vem junto com o mineflayer |

> 💡 Se os logs mostrarem `Cannot find module 'vec3'`, adicione `"vec3": "^0.3.2"`
> nas dependências do package.json e rode `docker restart bot-minecraft`.

## ✅ Requisitos

- ZimaOS com Docker (já embutido no sistema)
- Servidor Minecraft Fabric 1.21.1 rodando no Zima
- No `server.properties` do servidor: `online-mode=false` e 1 slot livre
- Acesso ao Terminal do ZimaOS (para criar a pasta e versionar no Git)

## 🚀 Instalação (ZimaOS)

1. Abra o Terminal do ZimaOS e crie a pasta:

   ```bash
   mkdir -p /DATA/AppData/bot-minecraft && cd /DATA/AppData/bot-minecraft
   ```

2. Crie os arquivos do repositório dentro dela:
   `bot.js`, `package.json`, `docker-compose.yml`, `.gitignore`

3. Instale pelo instalador de apps do ZimaOS:
   - **Apps → + → Custom Install**
   - Importe o `docker-compose.yml` da pasta (ou cole o conteúdo)
   - Nome do app: `bot-minecraft` → Instalar

4. Confira os logs:

   ```bash
   docker logs -f bot-minecraft
   ```

   Deve aparecer: `Bot "BotZima" conectado em 192.168.3.248:25565`

## ⚙️ Configuração (docker-compose.yml)

```yaml
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
```

| Variável | Valor | Descrição |
|---|---|---|
| `MC_HOST` | `192.168.3.248` | IP do servidor Minecraft |
| `MC_PORT` | `25565` | Porta do servidor |
| `MC_USER` | `BotZima` | Nome do bot (deve ser único no servidor) |
| `MC_VERSION` | `1.21.1` | Versão exata do servidor |

Para mudar qualquer valor: edite o `docker-compose.yml` e reinstale/atualize o
app no instalador do ZimaOS, ou rode `docker compose up -d` dentro da pasta.

## 🎮 Comandos do bot (20 no total)

Digite no chat público do jogo. Nomes de blocos/itens/mobs são em **inglês**
com underline: `diamond_ore`, `oak_log`, `iron_sword`, `cow`, `wheat`.

### Básico e movimento

| Comando | O que faz |
|---|---|
| `!ola` | Responde uma saudação |
| `!status` | Mostra posição, vida e fome do bot |
| `!vim` | O bot anda até você |
| `!ir <x> <z>` | Anda até as coordenadas (ex.: `!ir 100 -200`) |
| `!siguir <nick>` | Segue um jogador mantendo distância de 3 blocos |
| `!parar` | Para qualquer tarefa em andamento |

### Coleta e mineração

| Comando | O que faz |
|---|---|
| `!minerar <bloco>` | Minera o bloco mais próximo num raio de 48 (ex.: `!minerar iron_ore`) |
| `!coletar` | Vai até e coleta itens caídos no chão por perto (24 blocos) |
| `!madeira [qtd]` | Derruba árvores próximas (raio 48) e coleta a madeira; qtd = nº de árvores (padrão 1, máx 10). Com FallingTree no servidor, 1 corte derruba a árvore inteira |
| `!depositar` | Guarda TODO o inventário no baú mais próximo (16 blocos) |

### Comida (caça, farm e cozinha)

| Comando | O que faz |
|---|---|
| `!cacar <mob> [qtd]` | Vai até o mob de comida mais próximo, mata e coleta os drops. Mobs: `chicken`, `cow`, `pig`, `sheep`, `rabbit`. Qtd padrão 1, máx 10 |
| `!farmar <plantacao>` | Colhe SÓ as plantações maduras num raio de 32 e replanta se tiver semente. Plantações: `wheat`, `carrots`, `potatoes`, `beetroot` |
| `!cozinhar <item> [qtd]` | Usa o forno mais próximo (furnace ou blast_furnace): coloca combustível, o item cru e retira quando pronto. Qtd padrão 1, máx 16 |
| `!craftar <item> [qtd]` | Crafta usando mesa de trabalho próxima (raio 16) ou na mão (grade 2x2). Precisa dos ingredientes no inventário do bot. Qtd padrão 1, máx 64 |
| `!comer` | Come o primeiro item de comida do inventário |

### Combate e descanso

| Comando | O que faz |
|---|---|
| `!atacar` | Ataca o mob hostil mais próximo (16 blocos) |
| `!dormir` | Dorme na cama mais próxima (32 blocos) |

### Utilidades

| Comando | O que faz |
|---|---|
| `!inventario` | Lista o que o bot está carregando |
| `!equipar <item>` | Segura um item na mão (ex.: `!equipar iron_sword`) |
| `!diz <texto>` | Repete a frase no chat |

## 🐳 Comandos Docker do dia a dia

```bash
docker logs -f bot-minecraft      # ver o que o bot está fazendo (Ctrl+C sai)
docker restart bot-minecraft      # reiniciar (aplica mudanças no bot.js)
docker stop bot-minecraft         # parar o bot
docker start bot-minecraft        # ligar de novo
docker compose up -d              # aplicar mudanças no docker-compose.yml
docker compose down               # remover o container (arquivos ficam)
```

## ➕ Como adicionar um novo comando

Abra o `bot.js`, localize o bloco de comandos (`} else if (cmd === ...)`) e
adicione o seu antes do `!diz`. Exemplo — comando `!pular`:

```js
} else if (cmd === '!pular') {
  bot.setControlState('jump', true)
  setTimeout(() => bot.setControlState('jump', false), 500)
  bot.chat('Pulei!')
}
```

Depois salve e reinicie:

```bash
nano bot.js
docker restart bot-minecraft
```

## 🔄 Atualizar o bot

```bash
cd /DATA/AppData/bot-minecraft
git pull
docker restart bot-minecraft
```

## 🔍 Diagnóstico

Qualquer comportamento estranho, comece por aqui — o motivo quase sempre
aparece nos logs:

```bash
docker logs -f bot-minecraft
```

Linhas úteis: `[kickado]` (motivo da expulsão), `[erro]` (falha de conexão)
e `[desconectado]` (reconexão automática em andamento).

## 🚨 Erros comuns

| Mensagem/sintoma | Causa provável | Solução |
|---|---|---|
| `ECONNREFUSED 192.168.3.248:25565` | Servidor não está rodando, ou IP/porta errados no compose | Confirme que o servidor está no ar e o IP correto (`hostname -I`); ajuste `MC_HOST`/`MC_PORT`; veja os logs |
| `Unsupported protocol version` | `MC_VERSION` do bot diferente da versão do servidor | Coloque em `MC_VERSION` a versão exata do servidor (ex.: `1.21.1`) |
| `Failed to obtain profile` / `Invalid session` | Servidor em `online-mode=true` e bot sem conta real | No `server.properties` do servidor use `online-mode=false` (caseiro) ou use conta Microsoft real (avançado) |
| Kick: `You are already connected` / nome duplicado | Outro jogador ou bot já usa o mesmo nome | Troque `MC_USER` por outro nome e reinicie |
| Conecta e cai em loop (reconecta sem parar) | Servidor cheio (`max-players`) ou plugin/mod barrando o bot | Veja o motivo na linha `[kickado]` dos logs; aumente `max-players` ou libere o bot |
| `command not found: docker` | Terminal sem acesso ao Docker do ZimaOS | Use o terminal da interface web do ZimaOS; se for permissão, anteceda os comandos com `sudo` |
| Erro `npm ERR!` nos logs na inicialização | Falta de internet no momento de instalar as dependências | Aguarde a conexão voltar e rode `docker restart bot-minecraft` |
| `Cannot find module 'vec3'` | Dependência não resolvida na instalação | Adicione `"vec3": "^0.3.2"` ao package.json e rode `docker restart bot-minecraft` |
| `!craftar` diz que não consegue craftar | Faltam ingredientes no inventário do bot, ou não há mesa por perto para receita 3x3 | Use `!inventario` para conferir; deixe os ingredientes com o bot; construa/posicione uma mesa a menos de 16 blocos |
| Bot não responde aos comandos | Comando sem `!` ou bot fora da lista de jogadores | Digite no chat público do jogo (ex.: `!ola`); confirme que o bot aparece na lista de jogadores (tecla Tab) |
| Bot anda em círculos ou "trava" parado | Pathfinder sem rota possível até o destino | Use `!parar`, reposicione o bot perto do destino e tente de novo |

## ⚠️ Limitações conhecidas

- **Crafta apenas receitas vanilla** com ingredientes no inventário do bot —
  autocrafting industrial e em escala fica por conta do AE2 do modpack
- **Não interage com máquinas modadas** (quarry, Powah, fornos do Create etc.) —
  só com mecânicas vanilla (forno comum e blast furnace funcionam)
- `!farmar` só colhe o que está **maduro** e replanta apenas se tiver a
  semente no inventário do bot
- `!cacar` só caça os 5 mobs de comida listados — não ataca aldeões, pets ou mobs hostis
- Pathfinder pode falhar em terreno muito difícil (use `!parar` e reposicione)
- Raios de busca fixos: mineração/árvores 48, farm 32, forno/baú/mesa 16, mobs 32
- Cada bot ocupa 1 slot de jogador e consome ~100–200 MB de RAM (estimativa)
- Versão fixa em `1.21.1` — atualizar o servidor exige atualizar `MC_VERSION`
- Sem conta Microsoft real, só funciona em servidor com `online-mode=false`

## 🔐 Segurança

⚠️ Este setup usa `online-mode=false` (contas offline). **Nunca exponha o
servidor para a internet** nesse modo — qualquer um entra com qualquer nome.
Use apenas na rede local. O repositório no GitHub deve ser **privado**.

## 💾 Backup e versionamento (Git)

Primeiro push (repositório privado já criado no GitHub):

```bash
cd /DATA/AppData/bot-minecraft
git init
git add .
git commit -m "Bot Mineflayer no Zima: 20 comandos, compose e README"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/bot-minecraft.git
git push -u origin main
```

No dia a dia, após qualquer mudança:

```bash
git add . && git commit -m "descrição da mudança" && git push
docker restart bot-minecraft
```

Para restaurar em outra máquina (ou recriar no Zima após perda):

```bash
git clone https://github.com/SEU_USUARIO/bot-minecraft.git /DATA/AppData/bot-minecraft
cd /DATA/AppData/bot-minecraft && docker compose up -d
```

O `.gitignore` mantém `node_modules/` e logs fora do repositório — quem clona
roda `docker compose up -d` e o `npm install` baixa tudo sozinho.

## 🧪 Fluxo de trabalho sugerido

**Ciclo de mineração:**

1. `!vim` → bot vem até você
2. `!minerar iron_ore` → coleta ferro
3. `!depositar` → guarda tudo no baú da base

**Ciclo de comida (do cru ao assado):**

1. `!cacar cow 3` → mata 3 vacas e coleta a carne crua
2. `!cozinhar beef 3` → assa no forno mais próximo
3. `!depositar` → guarda o assado no baú

**Ciclo de farm e madeira:**

1. `!farmar wheat` → colhe o trigo maduro e replanta sozinho
2. `!madeira 2` → derruba 2 árvores e coleta tudo
3. `!craftar oak_planks` → transforma tronco em tábuas

Deixe o bot perto da farm com `!coletar` — com o mod Chunk Loaders do
modpack, funciona até com você offline.

## ❓ FAQ

**O bot aparece para outros jogadores?**
Sim, como um jogador normal — aparece na lista (Tab), tem posição e inventário próprios.

**Posso ter mais de um bot?**
Sim. No `docker-compose.yml`, copie o serviço `bot` com outro `container_name`
e outro `MC_USER` (ex.: `bot2`, `BotZima2`) e suba de novo.

**O bot crafta itens? E usa o AE2?**
Crafta receitas **vanilla** com `!craftar`, desde que os ingredientes estejam
no inventário dele. Ele não se conecta ao AE2 nem a máquinas modadas — para
autocrafting em rede, use o próprio AE2 no jogo.

**O bot continua trabalhando se eu sair do servidor?**
Sim — ele é independente. Só depende do servidor estar no ar e do chunk
carregado (use o mod Chunk Loaders para manter a área ativa).

**O bot come ou perde fome sozinho?**
Ele tem barra de fome como qualquer jogador. Use `!comer` para alimentá-lo —
com fome baixa ele não regenera vida e pode morrer em combate.

**E se o bot morrer?**
Ele renasce no spawn do mundo. Use `!vim` para trazê-lo de volta e confira o
que perdeu com `!inventario` (itens caem no local da morte).

## 🔗 Referências

- [Mineflayer (GitHub)](https://github.com/PrismarineJS/mineflayer) — API e documentação
- [mineflayer-pathfinder (GitHub)](https://github.com/prismarinejs/mineflayer-pathfinder) — pathfinding
- [mineflayer-collectblock (GitHub)](https://github.com/PrismarineJS/mineflayer-collectblock) — coleta de blocos
- [Imagem node no Docker Hub](https://hub.docker.com/_/node) — base do container

## 📄 Licença

MIT — use, modifique e distribua livremente. Veja o arquivo `LICENSE` se quiser
formalizar (crie um com o texto padrão MIT se for compartilhar o repositório).

## 📌 Premissas e pontos a confirmar

| # | Premissa | Status |
|---|---|---|
| 1 | IP do servidor `192.168.3.248`, porta `25565` | ✅ Confirmado por você |
| 2 | Versão exata do servidor: `1.21.1` | ⚠️ Confirme com `/version` no servidor |
| 3 | Nome do bot `BotZima` | Ajustável em `MC_USER` |
| 4 | Caminho `/DATA/AppData/bot-minecraft` | Padrão do ZimaOS; ajuste se sua instalação difere |
| 5 | Servidor em `online-mode=false` | Necessário para bot offline; nunca exponha à internet |
| 6 | `minecraft-data` declarado no package.json | Correção aplicada |
| 7 | `vec3` resolvido via mineflayer | ⚠️ Se der `Cannot find module`, declare no package.json |
| 8 | Consumo de RAM de 100–200 MB por bot | Estimativa, não medido no seu Zima |
| 9 | FallingTree presente no modpack | Faz `!madeira` derrubar a árvore inteira num corte |
| 10 | Licença MIT | Sugestão padrão; troque se preferir |
