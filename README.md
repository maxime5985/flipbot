# FlipBot 🤖

Bot de détection automatique de bonnes affaires sur Vinted.

## Comment ça marche

1. **Scraping** — Interroge l'API non-officielle de Vinted toutes les N minutes
2. **Vision IA** — Claude Haiku analyse les photos pour identifier marque, catégorie, état, modèle
3. **Pricing** — Calcule des médianes de prix par niche (brand + catégorie + état) stockées dans Supabase
4. **Détection** — Si le prix < seuil × médiane de la niche, c'est une bonne affaire
5. **Alerte** — Notification Telegram avec lien direct, prix, médiane et % de réduction

## Setup

### 1. Prérequis

- Node.js ≥ 18
- Un compte [Supabase](https://supabase.com) (gratuit)
- Un bot Telegram ([@BotFather](https://t.me/BotFather))
- Une clé API Anthropic

### 2. Installation

```bash
git clone https://github.com/maxime5985/flipbot.git
cd flipbot
npm install
cp .env.example .env
```

### 3. Configuration `.env`

```env
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
ANTHROPIC_API_KEY=sk-ant-...
TELEGRAM_BOT_TOKEN=123456:ABC-...
TELEGRAM_CHAT_ID=-100123456789
VINTED_COOKIE=_vinted_fr_session=abc123...
DEAL_THRESHOLD=0.70
POLL_INTERVAL_MINUTES=5
NICHES=Nike,Adidas,Jordan
```

#### Récupérer le cookie Vinted

1. Ouvrir Vinted dans Chrome, se connecter
2. Ouvrir DevTools → Network → chercher une requête vers `vinted.fr/api/v2`
3. Copier la valeur du header `Cookie` et la coller dans `VINTED_COOKIE`

#### Récupérer le TELEGRAM_CHAT_ID

1. Envoyer un message à votre bot
2. Visiter `https://api.telegram.org/bot<TOKEN>/getUpdates`
3. Trouver `chat.id` dans la réponse

### 4. Base de données Supabase

Dans le SQL Editor de Supabase, exécuter le contenu de `supabase/schema.sql`.

### 5. Lancer le bot

```bash
# Développement (ts-node)
npm run dev

# Production (compiler puis lancer)
npm run build
npm start
```

## Tests

```bash
npm test           # tous les tests avec couverture
npm run test:watch # mode watch
```

## Architecture

```
flipbot/
├── config/           # Chargement des variables d'environnement
├── src/
│   ├── types.ts      # Types TypeScript partagés
│   ├── scraper/      # Client API Vinted non-officielle
│   ├── vision/       # Identification via Claude Haiku (vision)
│   ├── pricing/      # Calcul de médianes, lecture/écriture Supabase
│   ├── alerts/       # Envoi d'alertes Telegram
│   ├── engine.ts     # Orchestration principale
│   └── scheduler.ts  # Boucle de polling (node-cron)
├── tests/            # Tests unitaires Jest
├── supabase/
│   └── schema.sql    # Schéma des tables Supabase
└── .env.example
```

## Variables d'environnement

| Variable | Description | Défaut |
|---|---|---|
| `SUPABASE_URL` | URL de votre projet Supabase | — |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé service role Supabase | — |
| `ANTHROPIC_API_KEY` | Clé API Anthropic | — |
| `TELEGRAM_BOT_TOKEN` | Token du bot Telegram | — |
| `TELEGRAM_CHAT_ID` | ID du chat/canal Telegram | — |
| `VINTED_COOKIE` | Cookie de session Vinted | — |
| `DEAL_THRESHOLD` | Seuil de bonne affaire (0.70 = -30%) | `0.70` |
| `POLL_INTERVAL_MINUTES` | Fréquence de scraping en minutes | `5` |
| `NICHES` | Marques à surveiller, séparées par virgule | tout scraper |

## Notes légales

Ce projet utilise l'API non-officielle de Vinted à des fins éducatives. Respectez les CGU de Vinted et ne surchargez pas leurs serveurs.
