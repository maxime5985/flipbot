import { FlipBotEngine } from '../src/engine';

// Mock all dependencies
jest.mock('../src/scraper', () => ({
  VintedClient: jest.fn().mockImplementation(() => ({
    search: jest.fn(),
  })),
}));

jest.mock('../src/vision', () => ({
  ClaudeVisionClient: jest.fn().mockImplementation(() => ({
    identify: jest.fn(),
  })),
}));

jest.mock('../src/pricing', () => ({
  PricingService: jest.fn().mockImplementation(() => ({
    isAlreadySeen: jest.fn(),
    saveListing: jest.fn(),
    getMedian: jest.fn(),
    updateMedian: jest.fn(),
    logAlert: jest.fn(),
  })),
  nicheKey: jest.fn((n: { brand: string; category: string; condition: string }) => `${n.brand}::${n.category}::${n.condition}`),
}));

jest.mock('../src/alerts', () => ({
  TelegramService: jest.fn().mockImplementation(() => ({
    sendDealAlert: jest.fn(),
  })),
}));

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({})),
}));

const BASE_CFG = {
  supabaseUrl: 'https://x.supabase.co',
  supabaseKey: 'service-key',
  anthropicApiKey: 'sk-ant',
  telegramBotToken: 'bot:TOKEN',
  telegramChatId: '-100123',
  vintedCookie: 'session=x',
  dealThreshold: 0.70,
  niches: [],
};

const ITEM = {
  id: 'item1',
  title: 'Nike AF1',
  price: 40,
  currency: 'EUR',
  url: 'https://vinted.fr/items/item1',
  photos: ['https://img/1.jpg'],
  brand: 'Nike',
  category: 'Sneakers',
  condition: 'Bon état',
  createdAt: new Date().toISOString(),
};

function getInternals(engine: FlipBotEngine) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const e = engine as any;
  return {
    vinted: e.vinted,
    vision: e.vision,
    pricing: e.pricing,
    telegram: e.telegram,
  };
}

describe('FlipBotEngine', () => {
  it('skips already-seen items', async () => {
    const engine = new FlipBotEngine(BASE_CFG);
    const { vinted, pricing } = getInternals(engine);
    vinted.search.mockResolvedValueOnce([ITEM]);
    pricing.isAlreadySeen.mockResolvedValueOnce(true);

    await engine.run();
    expect(pricing.saveListing).not.toHaveBeenCalled();
  });

  it('skips items when not enough data for median', async () => {
    const engine = new FlipBotEngine(BASE_CFG);
    const { vinted, vision, pricing, telegram } = getInternals(engine);
    vinted.search.mockResolvedValueOnce([ITEM]);
    pricing.isAlreadySeen.mockResolvedValueOnce(false);
    vision.identify.mockResolvedValueOnce({ brand: 'Nike', category: 'Sneakers', condition: 'Bon état', model: null });
    pricing.saveListing.mockResolvedValueOnce(undefined);
    pricing.updateMedian.mockResolvedValueOnce(null); // not enough data

    await engine.run();
    expect(telegram.sendDealAlert).not.toHaveBeenCalled();
  });

  it('sends alert when price is below threshold', async () => {
    const engine = new FlipBotEngine(BASE_CFG);
    const { vinted, vision, pricing, telegram } = getInternals(engine);
    vinted.search.mockResolvedValueOnce([ITEM]);
    pricing.isAlreadySeen.mockResolvedValueOnce(false);
    vision.identify.mockResolvedValueOnce({ brand: 'Nike', category: 'Sneakers', condition: 'Bon état', model: 'Air Force 1' });
    pricing.saveListing.mockResolvedValueOnce(undefined);
    pricing.updateMedian.mockResolvedValueOnce({ niche: { brand: 'Nike', category: 'Sneakers', condition: 'Bon état' }, median: 80, sampleSize: 15, updatedAt: '' });
    pricing.logAlert.mockResolvedValueOnce(undefined);
    telegram.sendDealAlert.mockResolvedValueOnce(undefined);

    await engine.run();
    expect(telegram.sendDealAlert).toHaveBeenCalledTimes(1);
    expect(pricing.logAlert).toHaveBeenCalledTimes(1);
  });

  it('does not alert when price is above threshold', async () => {
    const engine = new FlipBotEngine(BASE_CFG);
    const { vinted, vision, pricing, telegram } = getInternals(engine);
    vinted.search.mockResolvedValueOnce([ITEM]);
    pricing.isAlreadySeen.mockResolvedValueOnce(false);
    vision.identify.mockResolvedValueOnce({ brand: 'Nike', category: 'Sneakers', condition: 'Bon Létat', model: null });
    pricing.saveListing.mockResolvedValueOnce(undefined);
    // price=40, median=55 → ratio=0.727 > threshold=0.70 → no alert
    pricing.updateMedian.mockResolvedValueOnce({ niche: { brand: 'Nike', category: 'Sneakers', condition: 'Bon Létat' }, median: 55, sampleSize: 12, updatedAt: '' });

    await engine.run();
    expect(telegram.sendDealAlert).not.toHaveBeenCalled();
  });

  it('skips item when vision returns null brand/category/condition', async () => {
    const engine = new FlipBotEngine(BASE_CFG);
    const { vinted, vision, pricing, telegram } = getInternals(engine);
    const itemNoBrand = { ...ITEM, brand: null };
    vinted.search.mockResolvedValueOnce([itemNoBrand]);
    pricing.isAlreadySeen.mockResolvedValueOnce(false);
    vision.identify.mockResolvedValueOnce({ brand: null, category: null, condition: null, model: null });
    pricing.saveListing.mockResolvedValueOnce(undefined);

    await engine.run();
    expect(pricing.updateMedian).not.toHaveBeenCalled();
    expect(telegram.sendDealAlert).not.toHaveBeenCalled();
  });

  it('continues on per-item errors', async () => {
    const engine = new FlipBotEngine(BASE_CFG);
    const { vinted, pricing } = getInternals(engine);
    vinted.search.mockResolvedValueOnce([ITEM]);
    pricing.isAlreadySeen.mockRejectedValueOnce(new Error('db timeout'));

    // Should not throw
    await expect(engine.run()).resolves.not.toThrow();
  });
});
