import { createClient } from '@supabase/supabase-js';
import { VintedClient } from './scraper';
import { ClaudeVisionClient } from './vision';
import { PricingService, nicheKey } from './pricing';
import { TelegramService } from './alerts';
import { Niche, VintedItem, Deal } from './types';

export interface EngineConfig {
  supabaseUrl: string;
  supabaseKey: string;
  anthropicApiKey: string;
  telegramBotToken: string;
  telegramChatId: string;
  vintedCookie: string;
  vintedApiUrl?: string;
  dealThreshold: number;
  niches: string[];
  minSampleSize?: number;
}

export class FlipBotEngine {
  private readonly vinted: VintedClient;
  private readonly vision: ClaudeVisionClient;
  private readonly pricing: PricingService;
  private readonly telegram: TelegramService;
  private readonly threshold: number;
  private readonly nicheBrands: string[];

  constructor(cfg: EngineConfig) {
    this.vinted = new VintedClient(cfg.vintedCookie, cfg.vintedApiUrl);
    this.vision = new ClaudeVisionClient(cfg.anthropicApiKey);
    const supabase = createClient(cfg.supabaseUrl, cfg.supabaseKey);
    this.pricing = new PricingService(supabase, cfg.minSampleSize ?? 10);
    this.telegram = new TelegramService(cfg.telegramBotToken, cfg.telegramChatId);
    this.threshold = cfg.dealThreshold;
    this.nicheBrands = cfg.niches;
  }

  async run(): Promise<void> {
    console.log(`[Engine] Starting scan — threshold: ${this.threshold * 100}%`);

    await this.vinted.init();
    const items = await this.scrapeItems();
    console.log(`[Engine] Fetched ${items.length} items`);

    for (const item of items) {
      try {
        await this.processItem(item);
      } catch (err) {
        console.error(`[Engine] Error processing item ${item.id}:`, (err as Error).message);
      }
    }

    console.log('[Engine] Scan complete');
  }

  private async scrapeItems(): Promise<VintedItem[]> {
    if (this.nicheBrands.length === 0) {
      return this.vinted.search({ perPage: 96 });
    }

    const results: VintedItem[] = [];
    for (const brand of this.nicheBrands) {
      try {
        const items = await this.vinted.search({ query: brand, perPage: 48 });
        results.push(...items);
        await this.sleep(1000);
      } catch (err) {
        console.error(`[Engine] Scrape error for brand "${brand}":`, (err as Error).message);
      }
    }
    return results;
  }

  private async processItem(item: VintedItem): Promise<void> {
    const seen = await this.pricing.isAlreadySeen(item.id);
    if (seen) return;

    const vision = await this.vision.identify(item.photos);

    const brand = vision.brand ?? item.brand;
    const category = vision.category ?? item.category;
    const condition = vision.condition ?? item.condition;

    await this.pricing.saveListing(item, brand, category, condition);

    if (!brand || !category || !condition) return;
    const niche: Niche = { brand, category, condition };

    const priceMedian = await this.pricing.updateMedian(niche);
    if (!priceMedian) {
      console.log(`[Engine] Not enough data for niche "${nicheKey(niche)}" — skipping`);
      return;
    }

    const ratio = item.price / priceMedian.median;
    if (ratio > this.threshold) return;

    const deal: Deal = { item, vision, niche, median: priceMedian.median, discountPct: ratio };

    await this.telegram.sendDealAlert(deal);
    await this.pricing.logAlert(item.id, nicheKey(niche), item.price, priceMedian.median, ratio);

    console.log(`[Engine] Deal found: ${item.title} at ${item.price}EUR (median: ${priceMedian.median.toFixed(2)}EUR, -${Math.round((1 - ratio) * 100)}%)`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}