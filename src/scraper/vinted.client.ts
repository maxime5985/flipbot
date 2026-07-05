import axios, { AxiosInstance, AxiosError } from 'axios';
import { VintedItem } from '../types';

export interface VintedSearchParams {
  query?: string;
  brandIds?: string[];
  categoryIds?: string[];
  perPage?: number;
  page?: number;
}

interface VintedPhoto {
  url: string;
  full_size_url?: string;
}

interface VintedRawItem {
  id: number;
  title: string;
  price: string;
  currency: string;
  url: string;
  photos: VintedPhoto[];
  brand_title?: string;
  category_title?: string;
  status?: string;
  created_at_ts: number;
}

interface VintedSearchResponse {
  items: VintedRawItem[];
  pagination: { current_page: number; total_pages: number; };
}

export class VintedClient {
  private readonly http: AxiosInstance;
  private readonly baseUrl: string;

  constructor(cookie: string, baseUrl = 'https://www.vinted.fr/api/v2') {
    this.baseUrl = baseUrl;
    this.http = axios.create({
      baseURL: baseUrl,
      timeout: 15_000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'application/json, text/plain, */*',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
        Referer: 'https://www.vinted.fr/',
        Cookie: cookie,
      },
    });
  }

  async search(params: VintedSearchParams = {}): Promise<VintedItem[]> {
    const queryParams: Record<string, string | number> = {
      per_page: params.perPage ?? 96,
      page: params.page ?? 1,
      order: 'newest_first',
    };
    if (params.query) queryParams['search_text'] = params.query;
    if (params.brandIds?.length) queryParams['brand_ids[]'] = params.brandIds.join(',');
    if (params.categoryIds?.length) queryParams['catalog_ids[]'] = params.categoryIds.join(',');
    try {
      const { data } = await this.http.get<VintedSearchResponse>('/items', { params: queryParams });
      return (data.items ?? []).map((raw) => this.mapItem(raw));
    } catch (err) {
      const error = err as AxiosError;
      if (error.response?.status === 429) throw new Error('RATE_LIMITED: Vinted rate limit hit');
      if (error.response?.status === 401 || error.response?.status === 403) throw new Error('AUTH_ERROR: Vinted session expired');
      throw new Error('Vinted API error: ' + error.message);
    }
  }

  async getItem(itemId: string): Promise<VintedItem | null> {
    try {
      const { data } = await this.http.get<{ item: VintedRawItem }>('/items/' + itemId);
      return this.mapItem(data.item);
    } catch (err) {
      const error = err as AxiosError;
      if (error.response?.status === 404) return null;
      throw new Error('Vinted getItem error: ' + error.message);
    }
  }

  private mapItem(raw: VintedRawItem): VintedItem {
    const photos = (raw.photos ?? []).map((p) => p.full_size_url ?? p.url).filter(Boolean) as string[];
    return {
      id: String(raw.id),
      title: raw.title,
      price: parseFloat(raw.price),
      currency: raw.currency ?? 'EUR',
      url: raw.url ?? 'https://www.vinted.fr/items/' + raw.id,
      photos,
      brand: raw.brand_title ?? null,
      category: raw.category_title ?? null,
      condition: raw.status ?? null,
      createdAt: new Date(raw.created_at_ts * 1000).toISOString(),
    };
  }
}
