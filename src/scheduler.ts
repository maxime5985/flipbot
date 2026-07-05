import cron from 'node-cron';
import { FlipBotEngine } from './engine';
import { config } from '../config';

async function main(): Promise<void> {
  console.log('[FlipBot] Starting...');
  const engine = new FlipBotEngine({
    supabaseUrl: config.supabase.url,
    supabaseKey: config.supabase.serviceRoleKey,
    anthropicApiKey: config.anthropic.apiKey,
    telegramBotToken: config.telegram.botToken,
    telegramChatId: config.telegram.chatId,
    vintedCookie: config.vinted.cookie,
    vintedApiUrl: config.vinted.apiUrl,
    dealThreshold: config.dealThreshold,
    niches: config.niches,
    minSampleSize: config.minSampleSize,
  });
  const intervalMinutes = config.pollIntervalMinutes;
  const cronExpr = `*/${intervalMinutes} * * * *`;
  console.log(`[FlipBot] Polling every ${intervalMinutes} minute(s) — cron: ${cronExpr}`);
  await engine.run().catch((err: Error) => console.error('[FlipBot] Run error:', err.message));
  cron.schedule(cronExpr, async () => {
    console.log(`[FlipBot] [${new Date().toISOString()}] Running scheduled scan...`);
    await engine.run().catch((err: Error) => console.error('[FlipBot] Run error:', err.message));
  });
}

main().catch((err: Error) => {
  console.error('[FlipBot] Fatal error:', err.message);
  process.exit(1);
});
