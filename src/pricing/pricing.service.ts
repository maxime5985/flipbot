import { SupabaseClient } from '@supabase/supabase-js';
import { Niche, PriceMedian, VintedItem } from '../types';

interface ListingRow { id: string; title: string; price: number; brand: string | null; category: string | null; condition: string | null; url: string; seen_at: string; }
interface MedianRow { brand: string; category: string; condition: string; median_price: number; sample_size: number; updated_at: string; }

export class PricingService {
  constructor(private readonly supabase: SupabaseClient, private readonly minSampleSize = 10) {}

  async isAlreadySeen(itemId: string): Promise<boolean> {
    const { data, error } = await this.supabase.from('listings').select('id').eq('id', itemId).maybeSingle();
    if (error) throw new Error('Supabase isAlreadySeen error: ' + error.message);
    return data !== null;
  }

  async saveListing(item: VintedItem, brand: string | null, category: string | null, condition: string | null): Promise<void> {
    const row: ListingRow = { id: item.id, title: item.title, price: item.price, brand, category, condition, url: item.url, seen_at: new Date().toISOString() };
    const { error } = await this.supabase.from('listings').upsert(row, { onConflict: 'id' });
    if (error) throw new Error('Supabase saveListing error: ' + error.message);
  }

  async getMedian(niche: Niche): Promise<PriceMedian | null> {
    const { data, error } = await this.supabase.from('price_medians').select('*').eq('brand', niche.brand).eq('category', niche.category).eq('condition', niche.condition).maybeSingle();
    if (error) throw new Error('Supabase getMedian error: ' + error.message);
    if (!data) return null;
    const row = data as MedianRow;
    return { niche, median: row.median_price, sampleSize: row.sample_size, updatedAt: row.updated_at };
  }

  async updateMedian(niche: Niche): Promise<PriceMedian | null> {
    const { data, error } = await this.supabase.from('listings').select('price').eq('brand', niche.brand).eq('category', niche.category).eq('condition', niche.condition);
    if (error) throw new Error('Supabase updateMedian fetch error: ' + error.message);
    const prices = (data ?? []).map((row) => (row as { price: number }).price).filter((p) => p > 0);
    if (prices.length < this.minSampleSize) return null;
    const median = this.computeMedian(prices);
    const upsertRow = { brand: niche.brand, category: niche.category, condition: niche.condition, median_price: median, sample_size: prices.length, updated_at: new Date().toISOString() };
    const { error: upsertError } = await this.supabase.from('price_medians').upsert(upsertRow, { onConflict: 'brand,category,condition' });
    if (upsertError) throw new Error('Supabase updateMedian upsert error: ' + upsertError.message);
    return { niche, median, sampleSize: prices.length, updatedAt: upsertRow.updated_at };
  }

  computeMedian(prices: number[]): number {
    const sorted = [...prices].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2 : (sorted[mid] ?? 0);
  }

  async logAlert(itemId: string, nicheKey: string, price: number, median: number, discountPct: number): Promise<void> {
    const { error } = await this.supabase.from('alerts_log').insert({ item_id: itemId, niche_key: nicheKey, price, median, discount_pct: discountPct, alerted_at: new Date().toISOString() });
    if (error) throw new Error('Supabase logAlert error: ' + error.message);
  }
}

export function nicheKey(niche: Niche): string {
  return niche.brand + '::' + niche.category + '::' + niche.condition;
}
