import * as dotenv from 'dotenv';

dotenv.config();

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

export const config = {
  supabase: {
    url: requireEnv('SUPABASE_URL'),
    serviceRoleKey: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  },
  anthropic: {
    apiKey: requireEnv('ANTHROPIC_API_KEY'),
  },
  telegram: {
    botToken: requireEnv('TELEGRAM_BOT_TOKEN'),
    chatId: requireEnv('TELEGRAM_CHAT_ID'),
  },
  vinted: {
    cookie: process.env.VINTED_COOKIE ?? '',
    apiUrl: process.env.VINTED_API_URL ?? 'https://www.vinted.fr/api/v2',
  },
  dealThreshold: parseFloat(process.env.DEAL_THRESHOLD ?? '0.70'),
  pollIntervalMinutes: parseInt(process.env.POLL_INTERVAL_MINUTES ?? '5', 10),
  niches: process.env.NICHES
    ? process.env.NICHES.split(',').map((n) => n.trim()).filter(Boolean)
    : [],
  minSampleSize: 10,
} as const;
