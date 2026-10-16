/ bot.js — BotZima: bot Mineflayer para servidor caseiro (Fabric 1.21.1)
const mineflayer = require('mineflayer')
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder')
const collectBlock = require('mineflayer-collectblock').plugin

const HOST = process.env.MC_HOST || '192.168.3.248'
const PORT = parseInt(process.env.MC_PORT || '25565', 10)
const USER = process.env.MC_USER || 'BotZima'
const VERSION = process.env.MC_VERSION || '1.21.1'

let tempoReconexao = 5000

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

  bot.once('spawn', () => {
    tempoReconexao = 5000
    bot.pathfinder.setMovements(new Movements(bot))
    console.log(`Bot "${bot.username}" conectado em ${HOST}:${PORT} (versão ${bot.version})`)
    bot.chat('Ola! Comandos: !ola !status !vim !ir <x> <z> !siguir <nick> !parar !minerar <bloco> !coletar !depositar !comer !dormir !atacar !inventario !equipar <item> !diz <texto>')
  })

  bot.on('chat', async (username, message) => {
    if (username === bot.username) return
    const partes = message.trim().split(/\s+/)
    const cmd = (partes.shift() || '').toLowerCase()

    try {
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
        const drops = Object.values(bot.entities)
          .filter(e => e.name === 'item' && bot.entity.position.distanceTo(e.position) < 24)
          .slice(0, 10)
        if (!drops.length) return bot.chat('Nenhum item no chao por perto')
        bot.chat(`Coletando ${drops.length} item(ns)...`)
        for (const d of drops) {
          await bot.pathfinder.goto(new goals.GoalNear(d.position.x, d.position.y, d.position.z, 1))
        }
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
