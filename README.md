# BotZima 🤖

Bot de Minecraft baseado em **mineflayer** para o servidor caseiro **Fabric 1.21.1** (ZimaOS + Crafty). Executa comandos digitados no chat do jogo (prefixo `!`): movimento, mineração, coleta, farm, cozinha, craft, armadura e administração via servidor.

> Projeto de uso pessoal/doméstico. A instalação fica persistida em `~/AppData/bot-minecraft` e versionada no repositório Git.

## Visão geral

| Componente | Detalhe |
|---|---|
| Bot | BotZima — Node.js + mineflayer 4.39.0 |
| Servidor | Fabric 1.21.1 (modded), gerenciado pelo Crafty Controller |
| Endereço | `192.168.3.248:25565` (modo offline) |
| Container do bot | `bot-minecraft` (código em `/app`) |
| Código no host | `~/AppData/bot-minecraft` (`/DATA/AppData/bot-minecraft`) |
| Versão do protocolo | 1.21.1 (fixada no código) |

## Arquitetura

- **Container do bot** (`bot-minecraft`): roda o `bot.js` com Node.js. O Docker reinicia o processo em caso de crash; o bot mesmo reconecta com backoff exponencial (5s → 60s, zera após login bem-sucedido).
- **Container do Crafty** (`crafty-container`): gerencia o servidor "Meu Server" (Fabric 1.21.1, `-Xmx8G`), pasta `/DATA/AppData/crafty/servers/Meu Server`.
- **Plugins do bot**: `mineflayer-pathfinder` (movimento), `mineflayer-collectblock` (coleta), `mineflayer-armor-manager` (auto-equip de armadura vanilla, opcional).

## Requisitos

- ZimaOS com Docker
- Servidor Fabric 1.21.1 acessível em `192.168.3.248:25565`
- `online-mode=false` no servidor (o bot usa auth offline)
- Bot como **OP** para os comandos de armadura/admin: no console do Crafty, digite `op BotZima`

## Instalação

As dependências são instaladas dentro do container:

```bash
sudo docker exec -w /app bot-minecraft npm install
```

Pacotes utilizados: `mineflayer`, `mineflayer-pathfinder`, `mineflayer-collectblock`, `mineflayer-armor-manager`, `minecraft-data`, `minecraft-protocol`, `vec3`.

## Configuração

Variáveis de ambiente (com defaults no código):

| Variável | Default | Descrição |
|---|---|---|
| `MC_HOST` | `192.168.3.248` | IP do servidor |
| `MC_PORT` | `25565` | Porta |
| `MC_USER` | `BotZima` | Nick do bot |
| `MC_VERSION` | `1.21.1` | Versão do protocolo |

Flag interna no topo do `bot.js`:

- `MODO_SEGURO = false` (**recomendado**): tolerância ativa — tudo vanilla funciona; pacotes com itens modded são descartados sem derrubar a conexão.
- `MODO_SEGURO = true`: modo estável de emergência — ignora TODOS os pacotes de itens (o bot nunca cai, mas fica cego para inventário, containers e mobs).

## Compatibilidade com servidor modded (patches)

O servidor usa mods que anexam **data components** customizados aos itens (Simply Swords, Sophisticated Backpacks etc.). O parser de protocolo do mineflayer só conhece componentes vanilla e aborta a leitura do pacote — o que travava o bot e causava kick por timeout. Três camadas resolvem isso:

### Patch A — pacotes sempre modded
`packet_declare_recipes` e `packet_advancements` chegam quebrados em todo login (mods registram tipos de receita próprios). Suas definições são trocadas por um container vazio **antes** do `createBot`: o pacote chega, é lido como nada e descartado.

### Patch B — tolerância a pacotes ilegíveis
No parser original, um pacote ilegível chama `cb(e)` e mata o stream de processamento (bot fica mudo → servidor expulsa por timeout). O patch envolve o `_transform` do deserializador e do serializador: o erro é engolido, o pacote é descartado e a conexão continua viva. Cada descarte gera uma linha `[tolerado]` no log (máx. 1 a cada 10s por origem) — **ver essas linhas é normal**.

### Blindagem de processo
`uncaughtException` e `unhandledRejection` são capturados para o container não morrer em loop por erro não tratado.

### Verificação no log
```text
[patch] packet_declare_recipes -> será ignorado
[patch] packet_advancements -> será ignorado
[survival] tolerância ativa — vanilla funciona, modded é descartado sem cair
[patch] verificação: ATIVO ✅
```

Se aparecer `NÃO pegou ❌`, o registry não compartilhou o objeto do patch — nesse caso o plano B é editar o `protocol.json` direto no disco (se perde em reinstalação de `node_modules`).

## Comandos

Digitados no chat do jogo, prefixo `!`.

### Básicos e movimento

| Comando | Descrição |
|---|---|
| `!ola` | Saudação |
| `!status` | Posição, vida e fome |
| `!vim` | Anda até quem chamou |
| `!vimtp` | Teleporta até quem chamou (OP) |
| `!ir <x> <z>` | Anda até coordenadas |
| `!tp <x> <y> <z>` | Teleporta (OP) |
| `!siguir <nick>` | Segue um jogador |
| `!parar` | Para de andar/seguir |

### Trabalho e coleta

| Comando | Descrição |
|---|---|
| `!minerar <bloco>` | Minera o bloco mais próximo (nome em inglês, ex.: `iron_ore`) |
| `!coletar` | Coleta itens caídos num raio de 24 blocos |
| `!madeira [qtd]` | Derruba árvores próximas (máx. 10) |
| `!depositar` | Guarda o inventário num baú próximo (só baú e itens vanilla) |

### Comida

| Comando | Descrição |
|---|---|
| `!cacar <mob> [qtd]` | Caça e coleta drops (`chicken`, `cow`, `pig`, `sheep`, `rabbit`) |
| `!farmar <plantacao>` | Colhe e replanta (`wheat`, `carrots`, `potatoes`, `beetroot`) |
| `!cozinhar <item> [qtd]` | Assa no forno próximo (precisa de combustível) |
| `!craftar <item> [qtd]` | Crafta receitas vanilla (usa mesa próxima se houver) |
| `!comer` | Come; sem comida visível, usa saturação via servidor |

### Cuidados

| Comando | Descrição |
|---|---|
| `!dormir` | Dorme numa cama próxima |
| `!atacar` | Ataca o mob hostil mais próximo |

### Armadura (requer OP)

| Comando | Descrição |
|---|---|
| `!armadura <material>` | Veste set completo (`leather`, `chainmail`, `iron`, `golden`, `diamond`, `netherite`) |
| `!vestir <item>` | Veste o item no slot detectado pelo nome (funciona com itens modded) |
| `!tirar` | Remove toda a armadura |

Exemplos: `!armadura diamond` · `!vestir simplyswords:claymore` · `!vestir iron_helmet`

### Admin via servidor (requer OP)

Executam comandos do servidor (`/give`, `/clear`, `/tp`...) — funcionam **até com itens modded**, pois não dependem do parser:

| Comando | Descrição |
|---|---|
| `!dar <item> [qtd]` | Recebe item — ex.: `!dar simplyswords:claymore` |
| `!limpar` | Limpa o inventário — também destrava a sincronização |
| `!curar` | Vida instantânea |
| `!dia` | Acelera o tempo para dia |
| `!sol` | Limpa o clima |

### Utilidades

| Comando | Descrição |
|---|---|
| `!inventario` | Lista o inventário (só itens legíveis/vanilla) |
| `!equipar <item>` | Segura um item do inventário |
| `!diz <texto>` | Repete o texto no chat |
| `!comandos` | Lista todos os comandos |

## Limitações conhecidas

- **Itens modded são invisíveis para o bot**: componentes customizados não podem ser lidos pelo parser. O item existe de verdade (server-side), mas o bot não o enxerga.
- **"Inventário vazio" com itens na mão**: se o bot carrega um item modded, os pacotes de inventário são descartados e o modelo local fica vazio. Contorne com `!limpar` + `!dar`.
- **`!depositar`**: use apenas com baú vanilla e itens vanilla — baú com itens modded pode ser lido como vazio e causar sobreposição.
- **`!craftar`**: só receitas vanilla (o bot usa as receitas estáticas do `minecraft-data`, não as do servidor).
- **Auto-equip de armadura** (`mineflayer-armor-manager`): só funciona com armadura vanilla e inventário legível; para o resto, use `!armadura`/`!vestir`.

## Operação e manutenção

```bash
# Reiniciar o bot
sudo docker restart bot-minecraft

# Acompanhar os logs (Ctrl+C sai do log — o bot continua rodando)
sudo docker logs -f bot-minecraft

# Validar a sintaxe do bot.js sem executar
sudo docker exec -w /app bot-minecraft node --check bot.js && echo "SINTAXE OK"

# Atualizar dependências dentro do container
sudo docker exec -w /app bot-minecraft npm update

# Parar / iniciar
sudo docker stop bot-minecraft
sudo docker start bot-minecraft
```

**Backup e restauração** — antes de substituir o `bot.js`:

```bash
cd ~/AppData/bot-minecraft
cp bot.js bot.js.vN.bak        # backup da versão atual
# ... editar/substituir ...
cp bot.js.vN.bak bot.js        # restaurar se necessário
```

**Versionamento**: o projeto deve ser commitado no Git (incluindo `bot.js` e este README). Os arquivos `.bak` servem de histórico rápido entre commits.

## Ambiente do servidor (referência)

Servidor **"Meu Server"** — Fabric 1.21.1 via Crafty Controller, `-Xmx8G`.

**Mods principais**: fabric-api, sodium, lithium, modernfix, ferritecore, krypton, JEI, Xaero's Minimap e World Map, Farmers Delight, Simply Swords, Sophisticated Backpacks/Core, Powah, Refined Storage, Iron Chests, Carry On, Vein Miner, FallingTree, Jade, Appleskin, Open Parties and Claims, Iron Jetpacks Refabricated (base). Lista completa na pasta `mods` do servidor.

**Claims**: Open Parties and Claims **0.32.7** — os claims aparecem coloridos no Xaero's World Map (claim arrastando sobre os chunks) e no minimapa. Comandos: `/oclaims` e `/oparties` (a partir da 0.30.x os comandos mudaram de `/claim`/`/party`). O bot precisa estar na party para operar em áreas claimadas.

**Visual de LOD no cliente**: Distant Horizons (client-side, suporte oficial a 1.21.1). O Voxy não tem build para 1.21.1 — só para 1.20.4 e 1.21.6+.

**Removidos/quarentena (com motivo)**:

| Mod | Motivo |
|---|---|
| c2me | Crash de watchdog no carregamento de chunks |
| Chunk Loaders | Travamento no pipeline de chunks/tickets (watchdog "Watching Server") |
| Trinkets | Kick do bot: sincroniza componentes do Cardinal Components API que cliente vanilla não lê |
| iron-jetpacks-refabricated-trinkets | Dependia do Trinkets |
| immersive_armors | Dependia do Trinkets |
| better-slots 1.20.1 | Build para MC 1.20.1 (incompatível com 1.21.1) |
| supermartijn642corelib 1.1.24a | Duplicata da 1.1.25 (IDs duplicados bloqueiam o boot) |

**Substituição de jetpack**: Iron Jetpacks Refabricated — jar **base** (sem sufixo `-trinkets`), jetpack no slot de peitoral, carrega com a energia do Powah via Energy API do Fabric.

## Solução de problemas

| Sintoma | Causa provável | Solução |
|---|---|---|
| Kick na entrada: "This server requires Cardinal Components API" | Mod com CCA sincronizando componentes (ex.: Trinkets) | Remover o mod do servidor — não existe config que libere cliente vanilla |
| `array size is abnormally large` no login | Receitas/advancements modded | Patch A (já embutido no bot.js) |
| Bot conecta e cai em ~30s (Timed out) | Parser travou em pacote com item modded | Patch B (já embutido); se persistir, `MODO_SEGURO = true` |
| "Inventário vazio" com itens na mão | Item modded quebra a leitura do inventário | `!limpar` e usar `!dar` |
| Container reiniciando em loop | Erro não tratado no `bot.js` | Ver linha `[guard]` no log; `node --check`; restaurar `.bak` |
| Servidor crash "Watching Server" (watchdog) | c2me/Chunk Loaders ou corrupção de mundo | Remover os mods; restaurar mundo do backup |
| Linhas `[tolerado]` no log | Pacote com item modded descartado | Normal — não é erro |

## Notas

- O servidor roda **Java 25** (imagem do Crafty) enquanto o 1.21.1 foi feito para Java 21 — funciona, mas é uma instabilidade em potencial.
- Os erros `Translation File Error` do Crafty são traduções faltando no painel pt_BR — cosméticos, podem ser ignorados.
- O mineflayer não tem suporte oficial a servidores modded; os patches deste projeto são a ponte. Atualizações do `minecraft-data` podem corrigir novos casos — vale rodar `npm update` de vez em quando.
