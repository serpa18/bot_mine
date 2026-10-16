# 🤖 BotZima — Bot Mineflayer no ZimaOS

Bot para Minecraft que entra no servidor caseiro (Fabric 1.21.1) como um jogador
extra e obedece comandos digitados no chat do jogo. Roda em Docker no ZimaOS,
24 horas por dia, com reconexão automática.

## Como funciona

- O bot conecta em `192.168.3.248:25565` como jogador `BotZima`
- Você digita comandos no chat público do jogo (todos começam com `!`)
- O container Docker reinicia sozinho se cair e volta após reboot do Zima
- O código fica versionado neste repositório Git

## Requisitos

- ZimaOS com Docker (já embutido)
- Servidor Minecraft Fabric 1.21.1 rodando no Zima
- No `server.properties` do servidor: `online-mode=false` e 1 slot livre

## Instalação (ZimaOS)

1. Abra o Terminal do ZimaOS e crie a pasta:

   ```bash
   mkdir -p /DATA/AppData/bot-minecraft && cd /DATA/AppData/bot-minecraft
