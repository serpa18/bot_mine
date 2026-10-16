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
