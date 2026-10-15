// bot.js — Bot Mineflayer para servidor caseiro (Fabric 1.21.1)
const mineflayer = require('mineflayer')
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder')
const collectBlock = require('mineflayer-collectblock').plugin

const HOST = process.env.MC_HOST || '192.168.1.200'
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
    auth: 'offline' // servidor caseiro, sem login Mojang
  })

  const mcData = require('minecraft-data')(VERSION)

  bot.loadPlugin(pathfinder)
  bot.loadPlugin(collectBlock)

  bot.once('spawn', () => {
    tempoReconexao = 5000
    bot.pathfinder.setMovements(new Movements(bot))
    console.log(`Bot "${bot.username}" conectado em ${HOST}:${PORT} (versão ${bot.version})`)
    bot.chat(`Ola! Sou o ${bot.username}. Comandos: !ola !status !ir <x> <z> !siguir <nick> !parar !minerar <bloco> !diz <texto>`)
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
        if (!info) return bot.chat(`Bloco "${nome}" nao existe. Use nomes em ingles, ex: iron_ore`)
        const achados = bot.findBlocks({ matching: info.id, maxDistance: 48, count: 5 })
        if (!achados.length) return bot.chat(`Nao achei ${nome} num raio de 48 blocos`)
        bot.chat(`Minerando ${nome}...`)
        await bot.collectBlock.collect(bot.blockAt(achados[0]))
        bot.chat(`${nome} coletado! Ficou no meu inventario.`)

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
