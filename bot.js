// ============================================================
// bot.js — BotZima: bot Mineflayer para servidor caseiro
// Servidor: Fabric 1.21.1 em 192.168.3.248:25565
// v6 — comandos de armadura (via servidor + auto-equip)
// ============================================================

// ---- Blindagem: impede que o container morra por erro não tratado ----
process.on('uncaughtException', (err) => console.error('[guard] uncaughtException:', err.message))
process.on('unhandledRejection', (err) => console.error('[guard] unhandledRejection:', (err && err.message) || err))

// ---- REQUIRES DO BOT ----
const mineflayer = require('mineflayer')
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder')
const collectBlock = require('mineflayer-collectblock').plugin
const { Vec3 } = require('vec3')
// Auto-equipa armadura vanilla que entrar no inventário (opcional)
let armorManager = null
try { armorManager = require('mineflayer-armor-manager').plugin } catch (e) {
  console.log('[armor] plugin nao instalado — use !armadura / !vestir (via servidor)')
}

// ---- CONFIGURAÇÃO ----
const MODO_SEGURO = false

const HOST = process.env.MC_HOST || '192.168.3.248'
const PORT = parseInt(process.env.MC_PORT || '25565', 10)
const USER = process.env.MC_USER || 'BotZima'
const VERSION = process.env.MC_VERSION || '1.21.1'
let tempoReconexao = 5000

// ================================================================
// PATCH A — ignora pacotes SEMPRE modded (chegam quebrados a todo login)
// ================================================================
const mcDataPatch = require('minecraft-data')(VERSION)
const tiposPatch = mcDataPatch.protocol.play.toClient.types

const pacotesParaIgnorar = MODO_SEGURO
  ? [
      'packet_declare_recipes',
      'packet_advancements',
      'packet_entity_equipment',
      'packet_entity_metadata',
      'packet_set_slot',
      'packet_window_items',
      'packet_trade_list'
    ]
  : [
      'packet_declare_recipes',  // receitas (mods registram tipos próprios)
      'packet_advancements'      // advancements (ícones de itens modded)
    ]

for (const nome of pacotesParaIgnorar) {
  if (tiposPatch[nome]) {
    tiposPatch[nome] = ['container', []] // lê 0 bytes, descarta o pacote
    console.log(`[patch] ${nome} -> será ignorado`)
  } else {
    console.log(`[patch] AVISO: ${nome} não existe neste protocolo`)
  }
}

// ================================================================
// PATCH B — tolerância (só com MODO_SEGURO=false)
// ================================================================
if (!MODO_SEGURO) {
  const mc = require('minecraft-protocol')
  const ultimosLog = {}
  const logTolerado = (origem, err, extra) => {
    const agora = Date.now()
    if (!ultimosLog[origem] || agora - ultimosLog[origem] > 10000) {
      ultimosLog[origem] = agora
      console.log(`[tolerado] pacote ${origem} ilegível descartado${extra || ''}: ${err.message}`)
    }
  }
  try {
    const probeDesc = mc.createDeserializer({ version: VERSION })
    const protoDesc = Object.getPrototypeOf(probeDesc)
    const descOriginal = protoDesc._transform
    protoDesc._transform = function (chunk, enc, cb) {
      descOriginal.call(this, chunk, enc, (err) => {
        if (err) {
          logTolerado('recebido', err, ` (${chunk.length}B)`)
          return cb()
        }
        cb()
      })
    }
    if (typeof mc.createSerializer === 'function') {
      const probeSer = mc.createSerializer({ version: VERSION })
      const protoSer = Object.getPrototypeOf(probeSer)
      const serOriginal = protoSer._transform
      protoSer._transform = function (chunk, enc, cb) {
        serOriginal.call(this, chunk, enc, (err) => {
          if (err) {
            logTolerado('enviado', err, '')
            return cb()
          }
          cb()
        })
      }
    }
    console.log('[survival] tolerância ativa — vanilla funciona, modded é descartado sem cair')
  } catch (e) {
    console.error('[survival] FALHOU ao aplicar:', e.message)
    console.error('[survival] Se o bot voltar a cair, mude MODO_SEGURO para true')
  }
}

// ===== Funções auxiliares =====
async function atacarAteMorrer (bot, alvo) {
  for (let i = 0; i < 30 && alvo.isValid; i++) {
    await bot.pathfinder.goto(new goals.GoalNear(alvo.position.x, alvo.position.y, alvo.position.z, 1.5))
    await bot.lookAt(alvo.position.offset(0, alvo.height, 0), true)
    bot.attack(alvo)
    await new Promise(r => setTimeout(r, 600))
  }
  return !alvo.isValid
}

async function coletarDropsProximos (bot, raio = 24, maximo = 15) {
  const drops = Object.values(bot.entities)
    .filter(e => e.name === 'item' && bot.entity.position.distanceTo(e.position) < raio)
    .slice(0, maximo)
  for (const d of drops) {
    try { await bot.pathfinder.goto(new goals.GoalNear(d.position.x, d.position.y, d.position.z, 1)) } catch (e) {}
  }
  return drops.length
}

// Detecta o slot de equipamento pelo nome do item
function detectarSlot (nomeItem) {
  if (/helmet$/i.test(nomeItem)) return 'armor.head'
  if (/chestplate$/i.test(nomeItem)) return 'armor.chest'
  if (/leggings$/i.test(nomeItem)) return 'armor.legs'
  if (/boots$/i.test(nomeItem)) return 'armor.feet'
  if (/shield$/i.test(nomeItem)) return 'weapon.offhand'
  return 'weapon.mainhand'
}

// ===== Bot =====
function criarBot () {
  const bot = mineflayer.createBot({
    host: HOST,
    port: PORT,
    username: USER,
    version: VERSION,
    auth: 'offline'
  })
  const mcData = require('minecraft-data')(VERSION)
  bot.loadPlugin(pathfinder)
  bot.loadPlugin(collectBlock)
  if (armorManager) bot.loadPlugin(armorManager)
  bot.once('spawn', () => {
    tempoReconexao = 5000
    bot.pathfinder.setMovements(new Movements(bot))
    const def = bot.registry?.protocol?.play?.toClient?.types?.packet_declare_recipes
    const patchOk = Array.isArray(def) && def[0] === 'container' && def[1].length === 0
    console.log(`[patch] verificação: ${patchOk ? 'ATIVO ✅' : 'NÃO pegou ❌'}`)
    console.log(`Bot "${bot.username}" conectado em ${HOST}:${PORT} (versão ${bot.version})`)
    bot.chat(`Ola! Sou o ${bot.username}. Digite !comandos para ver a lista.`)
  })
  bot.on('chat', async (username, message) => {
    if (username === bot.username) return
    const partes = message.trim().split(/\s+/)
    const cmd = (partes.shift() || '').toLowerCase()
    try {
      // ==================== BÁSICO E MOVIMENTO ====================
      if (cmd === '!ola') {
        bot.chat(`Ola, ${username}!`)
      } else if (cmd === '!status') {
        const p = bot.entity.position
        bot.chat(`Posicao: ${p.x.toFixed(0)} ${p.y.toFixed(0)} ${p.z.toFixed(0)} | Vida: ${bot.health}/20 | Fome: ${bot.food}/20`)
      } else if (cmd === '!vim') {
        const autor = bot.players[username] && bot.players[username].entity
        if (!autor) return bot.chat('Nao consegui te localizar')
        const p = autor.position
        bot.pathfinder.setGoal(new goals.GoalNear(p.x, p.y, p.z, 2))
        bot.chat(`Indo ate voce, ${username}!`)
      } else if (cmd === '!vimtp') {
        bot.chat(`/tp ${bot.username} ${username}`)
        bot.chat(`Me teleportando ate voce, ${username}!`)
      } else if (cmd === '!ir') {
        const x = parseInt(partes[0], 10)
        const z = parseInt(partes[1], 10)
        if (isNaN(x) || isNaN(z)) return bot.chat('Use: !ir <x> <z>')
        bot.pathfinder.setGoal(new goals.GoalXZ(x, z))
        bot.chat(`Indo ate ${x}, ${z}...`)
      } else if (cmd === '!tp') {
        const x = parseInt(partes[0], 10)
        const y = parseInt(partes[1], 10)
        const z = parseInt(partes[2], 10)
        if (isNaN(x) || isNaN(y) || isNaN(z)) return bot.chat('Use: !tp <x> <y> <z>')
        bot.chat(`/tp ${bot.username} ${x} ${y} ${z}`)
        bot.chat(`Teleportado para ${x} ${y} ${z}!`)
      } else if (cmd === '!siguir') {
        const alvo = bot.players[partes[0]] && bot.players[partes[0]].entity
        if (!alvo) return bot.chat(`Nao encontrei o jogador ${partes[0]}`)
        bot.pathfinder.setGoal(new goals.GoalFollow(alvo, 3), true)
        bot.chat(`Seguindo ${partes[0]}!`)
      } else if (cmd === '!parar') {
        bot.pathfinder.setGoal(null)
        bot.chat('Parado.')
      // ==================== TRABALHO ====================
      } else if (cmd === '!minerar') {
        const nome = (partes[0] || '').toLowerCase()
        const info = mcData.blocksByName[nome]
        if (!info) return bot.chat(`Bloco "${nome}" nao existe. Nomes em ingles, ex: iron_ore`)
        const achados = bot.findBlocks({ matching: info.id, maxDistance: 48, count: 5 })
        if (!achados.length) return bot.chat(`Nao achei ${nome} num raio de 48 blocos`)
        bot.chat(`Minerando ${nome}...`)
        await bot.collectBlock.collect(bot.blockAt(achados[0]))
        bot.chat(`${nome} coletado!`)
      } else if (cmd === '!coletar') {
        const n = await coletarDropsProximos(bot)
        if (!n) return bot.chat('Nenhum item no chao por perto')
        bot.chat('Itens coletados!')
      } else if (cmd === '!depositar') {
        const bau = bot.findBlock({ matching: mcData.blocksByName.chest.id, maxDistance: 16 })
        if (!bau) return bot.chat('Nao achei um bau num raio de 16 blocos')
        const itens = bot.inventory.items()
        if (!itens.length) return bot.chat('Meu inventario ja esta vazio')
        const chest = await bot.openContainer(bau)
        for (const item of itens) {
          await chest.deposit(item.type, null, item.count)
        }
        chest.close()
        bot.chat(`Guardei ${itens.length} pilha(s) no bau!`)
      } else if (cmd === '!cacar') {
        const nome = (partes[0] || '').toLowerCase()
        const qtd = Math.min(parseInt(partes[1] || '1', 10) || 1, 10)
        const mobsComida = ['chicken', 'cow', 'pig', 'sheep', 'rabbit']
        if (!mobsComida.includes(nome)) return bot.chat(`So caco esses mobs: ${mobsComida.join(', ')}`)
        let mortos = 0
        for (let i = 0; i < qtd; i++) {
          const alvo = bot.nearestEntity(e => e.name === nome && bot.entity.position.distanceTo(e.position) < 32)
          if (!alvo) break
          bot.chat(`Cacando ${nome} (${i + 1}/${qtd})...`)
          if (await atacarAteMorrer(bot, alvo)) mortos++
        }
        if (!mortos) return bot.chat(`Nao encontrei nenhum ${nome} num raio de 32 blocos`)
        await coletarDropsProximos(bot)
        bot.chat(`Caca concluida: ${mortos} ${nome}(s) morto(s), drops coletados!`)
      } else if (cmd === '!farmar') {
        const nome = (partes[0] || '').toLowerCase()
        const plantacoes = {
          wheat: { bloco: 'wheat', maduro: 7, semente: 'wheat_seeds' },
          carrots: { bloco: 'carrots', maduro: 7, semente: 'carrot' },
          potatoes: { bloco: 'potatoes', maduro: 7, semente: 'potato' },
          beetroot: { bloco: 'beetroots', maduro: 3, semente: 'beetroot_seeds' }
        }
        const cfg = plantacoes[nome]
        if (!cfg) return bot.chat(`Planto: ${Object.keys(plantacoes).join(', ')}`)
        const info = mcData.blocksByName[cfg.bloco]
        const achados = bot.findBlocks({
          matching: b => b.type === info.id && b.getProperties().age === cfg.maduro,
          maxDistance: 32,
          count: 30
        })
        if (!achados.length) return bot.chat(`Nenhuma plantacao de ${nome} madura num raio de 32 blocos`)
        bot.chat(`Colhendo ${achados.length} ${nome}...`)
        let colhidos = 0
        for (const pos of achados) {
          const bloco = bot.blockAt(pos)
          if (!bloco || bloco.type !== info.id) continue
          await bot.dig(bloco)
          colhidos++
          const semente = bot.inventory.items().find(i => i.name === cfg.semente)
          const solo = bot.blockAt(pos.offset(0, -1, 0))
          if (semente && solo && solo.name === 'farmland') {
            await bot.equip(semente, 'hand')
            try { await bot.placeBlock(solo, new Vec3(0, 1, 0)) } catch (e) {}
          }
        }
        bot.chat(`Colheita concluida: ${colhidos} ${nome} coletado(s)!`)
      } else if (cmd === '!cozinhar') {
        const nome = (partes[0] || '').toLowerCase()
        const qtd = Math.min(parseInt(partes[1] || '1', 10) || 1, 16)
        const cru = bot.inventory.items().find(i => i.name === nome)
        if (!cru) return bot.chat(`Nao tenho "${nome}" no inventario`)
        const fornoBloco = bot.findBlock({ matching: b => b.name === 'furnace' || b.name === 'blast_furnace', maxDistance: 16 })
        if (!fornoBloco) return bot.chat('Nao achei forno num raio de 16 blocos')
        const combustiveis = ['coal', 'charcoal', 'oak_planks', 'birch_planks', 'spruce_planks', 'stick']
        const comb = bot.inventory.items().find(i => combustiveis.includes(i.name))
        if (!comb) return bot.chat('Nao tenho combustivel (carvao, tabuas ou graveto)')
        await bot.pathfinder.goto(new goals.GoalNear(fornoBloco.position.x, fornoBloco.position.y, fornoBloco.position.z, 2))
        const forno = await bot.openFurnace(fornoBloco)
        await forno.putFuel(comb.type, null, Math.min(qtd, comb.count))
        await forno.putInput(cru.type, null, Math.min(qtd, cru.count))
        bot.chat(`Cozinhando ${nome}... (cada item leva ~10s)`)
        const inicio = Date.now()
        while (Date.now() - inicio < qtd * 15000) {
          await new Promise(r => setTimeout(r, 3000))
          if (forno.outputItem()) await forno.takeOutput()
          if (!forno.inputItem()) break
        }
        await new Promise(r => setTimeout(r, 3000))
        if (forno.outputItem()) await forno.takeOutput()
        forno.close()
        bot.chat('Forno concluido! Itens cozidos no meu inventario.')
      } else if (cmd === '!craftar') {
        const nome = (partes[0] || '').toLowerCase()
        const qtd = Math.min(parseInt(partes[1] || '1', 10) || 1, 64)
        const item = mcData.itemsByName[nome]
        if (!item) return bot.chat(`Item "${nome}" nao existe (nomes em ingles)`)
        const mesa = bot.findBlock({ matching: mcData.blocksByName.crafting_table.id, maxDistance: 16 })
        const receitas = bot.recipesFor(item.id, null, 1, mesa)
        if (!receitas.length) {
          return bot.chat(`Nao consigo craftar ${nome} com meu inventario${mesa ? '' : ' e nao achei mesa de trabalho por perto'}`)
        }
        if (mesa) await bot.pathfinder.goto(new goals.GoalNear(mesa.position.x, mesa.position.y, mesa.position.z, 2))
        await bot.craft(receitas[0], qtd, mesa)
        bot.chat(`Craftado: ${qtd}x ${nome}!`)
      } else if (cmd === '!madeira') {
        const qtd = Math.min(parseInt(partes[0] || '1', 10) || 1, 10)
        const troncos = ['oak_log', 'birch_log', 'spruce_log', 'jungle_log', 'acacia_log', 'dark_oak_log', 'mangrove_log', 'cherry_log']
        const ids = troncos.map(t => mcData.blocksByName[t]?.id).filter(id => id !== undefined)
        const achados = bot.findBlocks({ matching: ids, maxDistance: 48, count: qtd })
        if (!achados.length) return bot.chat('Nenhuma arvore num raio de 48 blocos')
        bot.chat(`Derrubando ${achados.length} arvore(s)...`)
        for (const pos of achados) {
          const bloco = bot.blockAt(pos)
          if (!bloco || !ids.includes(bloco.type)) continue
          try { await bot.collectBlock.collect(bloco) } catch (e) {}
        }
        await coletarDropsProximos(bot)
        bot.chat('Madeira coletada!')
      // ==================== CUIDADOS PESSOAIS ====================
      } else if (cmd === '!comer') {
        const comida = bot.inventory.items().find(i => mcData.foodsByName[i.name])
        if (comida) {
          await bot.equip(comida, 'hand')
          await bot.consume()
          bot.chat(`Comi ${comida.name.replace(/_/g, ' ')}.`)
        } else {
          bot.chat(`/effect give ${bot.username} minecraft:saturation 1 25 true`)
          bot.chat('Sem comida visivel no inventario — usei saturacao via servidor.')
        }
      } else if (cmd === '!dormir') {
        const idsCamas = Object.values(mcData.blocksByName)
          .filter(b => b.name.endsWith('_bed')).map(b => b.id)
        const cama = bot.findBlock({ matching: idsCamas, maxDistance: 32 })
        if (!cama) return bot.chat('Nao achei cama num raio de 32 blocos')
        await bot.pathfinder.goto(new goals.GoalNear(cama.position.x, cama.position.y, cama.position.z, 2))
        await bot.sleep(cama)
        bot.chat('Boa noite!')
      } else if (cmd === '!atacar') {
        const alvo = bot.nearestEntity(e =>
          e.kind === 'hostile' && bot.entity.position.distanceTo(e.position) < 16)
        if (!alvo) return bot.chat('Nenhum mob hostil por perto')
        await bot.lookAt(alvo.position.offset(0, alvo.height, 0), true)
        bot.attack(alvo)
        bot.chat(`Atacando ${alvo.name}!`)
      // ==================== ARMADURA (via servidor, precisa ser OP) ====================
      } else if (cmd === '!armadura') {
        const mat = (partes[0] || '').toLowerCase()
        const mats = ['leather', 'chainmail', 'iron', 'golden', 'diamond', 'netherite']
        if (!mats.includes(mat)) return bot.chat(`Materiais: ${mats.join(', ')} — ex: !armadura diamond`)
        const slots = ['armor.head', 'armor.chest', 'armor.legs', 'armor.feet']
        const pecas = ['helmet', 'chestplate', 'leggings', 'boots']
        for (let i = 0; i < 4; i++) {
          bot.chat(`/item replace entity ${bot.username} ${slots[i]} with minecraft:${mat}_${pecas[i]} 1`)
        }
        bot.chat(`Vestindo set completo de ${mat}!`)
      } else if (cmd === '!vestir') {
        const nomeItem = partes.join(' ')
        if (!nomeItem) return bot.chat('Use: !vestir <item> — ex: !vestir diamond_helmet ou !vestir simplyswords:claymore')
        const slot = detectarSlot(nomeItem)
        bot.chat(`/item replace entity ${bot.username} ${slot} with ${nomeItem} 1`)
        bot.chat(`Equipando ${nomeItem} no slot ${slot}.`)
      } else if (cmd === '!tirar') {
        for (const s of ['armor.head', 'armor.chest', 'armor.legs', 'armor.feet']) {
          bot.chat(`/item replace entity ${bot.username} ${s} with minecraft:air`)
        }
        bot.chat('Armadura removida.')
      // ==================== ADMIN VIA SERVIDOR (precisa ser OP) ====================
      } else if (cmd === '!dar') {
        const item = partes[0]
        const qtd = Math.min(parseInt(partes[1] || '1', 10) || 1, 64)
        if (!item) return bot.chat('Use: !dar <item> [qtd] — ex: !dar simplyswords:claymore')
        bot.chat(`/give ${bot.username} ${item} ${qtd}`)
        bot.chat(`Pedindo ${qtd}x ${item} ao servidor...`)
      } else if (cmd === '!limpar') {
        bot.chat(`/clear ${bot.username}`)
        bot.chat('Limpando meu inventario pelo servidor...')
      } else if (cmd === '!curar') {
        bot.chat(`/effect give ${bot.username} minecraft:instant_health 1 9 true`)
        bot.chat('Me curando...')
      } else if (cmd === '!dia') {
        bot.chat('/time set day')
        bot.chat('Dia ativado!')
      } else if (cmd === '!sol') {
        bot.chat('/weather clear')
        bot.chat('Clima limpo!')
      // ==================== UTILIDADES ====================
      } else if (cmd === '!inventario') {
        const itens = bot.inventory.items()
        if (!itens.length) return bot.chat('Inventario vazio (ou com itens modded que nao consigo ler — use !dar/!limpar)')
        const resumo = {}
        for (const i of itens) resumo[i.name] = (resumo[i.name] || 0) + i.count
        bot.chat(Object.entries(resumo).map(([n, c]) => `${c}x ${n}`).join(', ').slice(0, 240))
      } else if (cmd === '!equipar') {
        const nome = (partes[0] || '').toLowerCase()
        const item = bot.inventory.items().find(i => i.name === nome)
        if (!item) return bot.chat(`Nao tenho "${nome}" no inventario`)
        await bot.equip(item, 'hand')
        bot.chat(`Segurando ${nome.replace(/_/g, ' ')}.`)
      } else if (cmd === '!comandos') {
        bot.chat('=== COMANDOS DO BOT ===')
        bot.chat('Basicos: !ola !status !vim !vimtp !ir <x> <z> !siguir <nick> !tp <x> <y> <z> !parar')
        bot.chat('Coleta: !minerar <bloco> !coletar !madeira [qtd] !depositar')
        bot.chat('Comida: !cacar <mob> [qtd] !farmar <plantacao> !cozinhar <item> [qtd] !craftar <item> [qtd] !comer')
        bot.chat('Armadura (OP): !armadura <material> !vestir <item> !tirar')
        bot.chat('Outros: !atacar !dormir !inventario !equipar <item> !diz <texto>')
        bot.chat('Admin (OP): !dar <item> [qtd] !limpar !curar !dia !sol')
      } else if (cmd === '!diz') {
        bot.chat(partes.join(' '))
      }
    } catch (e) {
      bot.chat(`Deu erro: ${e.message}`)
    }
  })
  bot.on('kicked', r => console.log('[kickado]', r))
  bot.on('error', e => console.log('[erro]', e.message))
  bot.on('end', () => {
    console.log(`[desconectado] reconectando em ${tempoReconexao / 1000}s...`)
    tempoReconexao = Math.min(tempoReconexao * 2, 60000)
    setTimeout(criarBot, tempoReconexao)
  })
}
criarBot()
