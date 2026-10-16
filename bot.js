// ================================================================
// BotZima — bot mineflayer para o servidor Minecraft (Crafty/ZimaOS)
// Versão com PATCH EXPERIMENTAL para servidor modded (Fabric 1.21.1)
// ================================================================

// ================================================================
// PATCH EXPERIMENTAL — ignora pacotes de receitas/advancements
// O servidor modded envia esses pacotes com data components de mods
// que o parser do mineflayer não sabe ler (erro "array size is
// abnormally large"). Trocamos a definição por um container vazio:
// o pacote chega, é lido como nada e descartado, sem travar o bot.
// DEVE ficar ANTES do createBot. Experimental: se surgir Parse error
// novo, adicione o nome do pacote na lista abaixo e reinicie.
// ================================================================
const mcDataPatch = require('minecraft-data')('1.21.1');
const tiposPatch = mcDataPatch.protocol.play.toClient.types;
const pacotesParaIgnorar = [
  'packet_declare_recipes',  // receitas (mods registram tipos próprios)
  'packet_advancements',     // advancements (ícones de itens modded)
];
for (const nome of pacotesParaIgnorar) {
  if (tiposPatch[nome]) {
    tiposPatch[nome] = ['container', []]; // lê 0 bytes, retorna {}
    console.log(`[patch] ${nome} -> será ignorado`);
  } else {
    console.log(`[patch] AVISO: ${nome} não existe neste protocolo`);
  }
}
// ================================================================

const mineflayer = require('mineflayer');
const { pathfinder } = require('mineflayer-pathfinder');
const collectBlock = require('mineflayer-collectblock').plugin;

// ====== CONFIGURAÇÃO — confira com os valores do seu bot atual ======
const CONFIG = {
  host: process.env.MC_HOST || '192.168.3.248', // IP do Zima
  port: parseInt(process.env.MC_PORT || '25565', 10),
  username: process.env.MC_USER || 'BotZima',
  auth: 'offline',      // servidor local em modo offline
  version: '1.21.1',    // fixada = mesma versão do patch
  hideErrors: false,
};

// ====== RECONEXÃO COM BACKOFF ======
let tentativas = 0;

function conectar() {
  const bot = mineflayer.createBot(CONFIG);

  bot.loadPlugin(pathfinder);
  bot.loadPlugin(collectBlock);

  bot.once('login', () => {
    console.log(`[login] ${bot.username} conectado`);
    tentativas = 0; // login bem-sucedido: zera o backoff
  });

  bot.once('spawn', () => {
    // --- verificação de que o patch pegou no registry do bot ---
    const def = bot.registry?.protocol?.play?.toClient?.types?.packet_declare_recipes;
    const patchOk = Array.isArray(def) && def[0] === 'container' && def[1].length === 0;
    console.log(`[patch] verificação: ${patchOk ? 'ATIVO ✅' : 'NÃO pegou ❌ — me avise que aplico o plano B'}`);
    console.log('[spawn] bot pronto no mundo');
  });

  // ====== COMANDOS ======
  const comandos = {
    '!ola': () => 'Olá! Sou o BotZima 🤖',
    '!ping': () => 'pong!',
    '!pos': () => {
      const p = bot.entity.position;
      return `Estou em X:${Math.floor(p.x)} Y:${Math.floor(p.y)} Z:${Math.floor(p.z)}`;
    },
    '!health': () => `Vida: ${bot.health}/20 | Fome: ${bot.food}/20`,
    '!comandos': () => 'Comandos: ' + Object.keys(comandos).join(', '),
  };

  bot.on('chat', (username, message) => {
    try {
      if (username === bot.username) return;
      const cmd = message.trim().split(' ')[0].toLowerCase();
      const acao = comandos[cmd];
      if (acao) bot.chat(acao());
    } catch (err) {
      console.error('[erro] handler de chat:', err.message);
    }
  });

  // ====== EVENTOS DE ERRO/DESCONEXÃO ======
  bot.on('kicked', (reason) => console.log('[kicked]', reason));
  bot.on('error', (err) => console.error('[erro]', err.message));

  bot.on('end', (reason) => {
    tentativas++;
    const delay = Math.min(5 * 2 ** (tentativas - 1), 60); // 5s→10s→20s→40s→60s
    console.log(`[desconectado] motivo: ${reason} — reconectando em ${delay}s...`);
    setTimeout(conectar, delay * 1000);
  });
}

conectar();
