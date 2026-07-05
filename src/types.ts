export interface VintedItem {
  id: string;
  title: string;
  price: number;
  currency: string;
  url: string;
  photos: string[];
  brand: string | null;
  category: string | null;
  condition: string | null;
  createdAt: string;
}

export interface VisionResult {
  brand: string | null;
  category: string | null;
  condition: string | null;
  model: string | null;
}

export interface Niche {
  brand: string;
  category: string;
  condition: string;
}

export interface PriceMedian {
  niche: Niche;
  median: number;
  sampleSize: number;
  updatedAt: string;
}

export interface Deal {
  item: VintedItem;
  vision: VisionResult;
  niche: Niche;
  median: number;
  discountPct: number;
}

export interface AlertPayload {
  deal: Deal;
}
