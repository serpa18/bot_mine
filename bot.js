// ============================================================
// bot.js — BotZima: bot Mineflayer para servidor caseiro
// Servidor: Fabric 1.21.1 em 192.168.3.248:25565
// 20 comandos, digitados no chat do jogo (prefixo !)
// ============================================================

const mineflayer = require('mineflayer')
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder')
const collectBlock = require('mineflayer-collectblock').plugin
const { Vec3 } = require('vec3')

const HOST = process.env.MC_HOST || '192.168.3.248'
const PORT = parseInt(process.env.MC_PORT || '25565', 10)
const USER = process.env.MC_USER || 'BotZima'
const VERSION = process.env.MC_VERSION || '1.21.1'

let tempoReconexao = 5000

// ===== Funções auxiliares =====

// Ataca o alvo até ele morrer (máx. 30 golpes)
async function atacarAteMorrer (bot, alvo) {
  for (let i = 0; i < 30 && alvo.isValid; i++) {
    await bot.pathfinder.goto(new goals.GoalNear(alvo.position.x, alvo.position.y, alvo.position.z, 1.5))
    await bot.lookAt(alvo.position.offset(0, alvo.height, 0), true)
    bot.attack(alvo)
    await new Promise(r => setTimeout(r, 600))
  }
  return !alvo.isValid
}

// Anda até os itens caídos no chão dentro do raio
async function coletarDropsProximos (bot, raio = 24, maximo = 15) {
  const drops = Object.values(bot.entities)
    .filter(e => e.name === 'item' && bot.entity.position.distanceTo(e.position) < raio)
    .slice(0, maximo)
  for (const d of drops) {
    try { await bot.pathfinder.goto(new goals.GoalNear(d.position.x, d.position.y, d.position.z, 1)) } catch (e) {}
  }
  return drops.length
}

// ===== Bot =====

function criarBot () {
  const bot = mineflayer.createBot({
    host: HOST,
    port: PORT,
    username: USER,
    version: VERSION,
    auth: 'offline' // servidor caseiro (online-mode=false)
  })

  const mcData = require('minecraft-data')(VERSION)

  bot.loadPlugin(pathfinder)
  bot.loadPlugin(collectBlock)

  bot.once('spawn', () => {
    tempoReconexao = 5000
    bot.pathfinder.setMovements(new Movements(bot))
    console.log(`Bot "${bot.username}" conectado em ${HOST}:${PORT} (versão ${bot.version})`)
    bot.chat('Ola! Sou o BotZima. Basicos: !ola !status !vim !ir <x> <z> !siguir <nick> !parar')
    bot.chat('Trabalho: !minerar <bloco> !coletar !depositar !cacar <mob> [qtd] !farmar <plantacao> !madeira [qtd]')
    bot.chat('Extras: !cozinhar <item> [qtd] !craftar <item> [qtd] !comer !dormir !atacar !inventario !equipar <item> !diz <texto>')
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

      } else if (cmd === '!ir') {
        const x = parseInt(partes[0], 10)
        const z = parseInt(partes[1], 10)
        if (isNaN(x) || isNaN(z)) return bot.chat('Use: !ir <x> <z>')
        bot.pathfinder.setGoal(new goals.GoalXZ(x, z))
        bot.chat(`Indo ate ${x}, ${z}...`)

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
        if (!comida) return bot.chat('Nao tenho comida no inventario')
        await bot.equip(comida, 'hand')
        await bot.consume()
        bot.chat(`Comi ${comida.name.replace(/_/g, ' ')}.`)

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

      // ==================== UTILIDADES ====================

      } else if (cmd === '!inventario') {
        const itens = bot.inventory.items()
        if (!itens.length) return bot.chat('Inventario vazio')
        const resumo = {}
        for (const i of itens) resumo[i.name] = (resumo[i.name] || 0) + i.count
        bot.chat(Object.entries(resumo).map(([n, c]) => `${c}x ${n}`).join(', ').slice(0, 240))

      } else if (cmd === '!equipar') {
        const nome = (partes[0] || '').toLowerCase()
        const item = bot.inventory.items().find(i => i.name === nome)
        if (!item) return bot.chat(`Nao tenho "${nome}" no inventario`)
        await bot.equip(item, 'hand')
        bot.chat(`Segurando ${nome.replace(/_/g, ' ')}.`)

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
