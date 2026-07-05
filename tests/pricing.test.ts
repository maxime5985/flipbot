import { PricingService, nicheKey } from '../src/pricing';
import { Niche, VintedItem } from '../src/types';

function makeSupabaseMock(overrides = {}) {
  const base = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    upsert: jest.fn().mockResolvedValue({ error: null }),
    insert: jest.fn().mockResolvedValue({ error: null }),
    ...overrides,
  };
  return { from: jest.fn().mockReturnValue(base), _base: base };
}

const NICHE: Niche = { brand: 'Nike', category: 'Sneakers', condition: 'Bon etat' };

const ITEM: VintedItem = {
  id: 'item1', title: 'Nike AF1', price: 45, currency: 'EUR',
  url: 'https://vinted.fr/items/item1', photos: [],
  brand: 'Nike', category: 'Sneakers', condition: 'Bon etat',
  createdAt: new Date().toISOString(),
};

describe('PricingService', () => {
  describe('computeMedian()', () => {
    let svc: PricingService;
    beforeEach(() => { svc = new PricingService({} as never, 10); });
    it('returns median of odd array', () => { expect(svc.computeMedian([10, 30, 20])).toBe(20); });
    it('returns average of two middle values for even array', () => { expect(svc.computeMedian([10, 20, 30, 40])).toBe(25); });
    it('handles single element', () => { expect(svc.computeMedian([42])).toBe(42); });
  });

  describe('isAlreadySeen()', () => {
    it('returns true when listing exists', async () => {
      const mock = makeSupabaseMock({ maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'item1' }, error: null }) });
      expect(await new PricingService(mock as never, 10).isAlreadySeen('item1')).toBe(true);
    });
    it('returns false when listing does not exist', async () => {
      const mock = makeSupabaseMock({ maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }) });
      expect(await new PricingService(mock as never, 10).isAlreadySeen('item2')).toBe(false);
    });
    it('throws on Supabase error', async () => {
      const mock = makeSupabaseMock({ maybeSingle: jest.fn().mockResolvedValue({ data: null, error: { message: 'db error' } }) });
      await expect(new PricingService(mock as never, 10).isAlreadySeen('item1')).rejects.toThrow('Supabase isAlreadySeen error');
    });
  });

  describe('saveListing()', () => {
    it('calls upsert with correct data', async () => {
      const mock = makeSupabaseMock();
      await new PricingService(mock as never, 10).saveListing(ITEM, 'Nike', 'Sneakers', 'Bon etat');
      expect(mock._base.upsert).toHaveBeenCalledWith(expect.objectContaining({ id: 'item1', price: 45 }), { onConflict: 'id' });
    });
    it('throws on upsert error', async () => {
      const mock = makeSupabaseMock({ upsert: jest.fn().mockResolvedValue({ error: { message: 'constraint' } }) });
      await expect(new PricingService(mock as never, 10).saveListing(ITEM, null, null, null)).rejects.toThrow('Supabase saveListing error');
    });
  });

  describe('getMedian()', () => {
    it('returns null when no row found', async () => {
      const mock = makeSupabaseMock({ maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }) });
      expect(await new PricingService(mock as never, 10).getMedian(NICHE)).toBeNull();
    });
    it('returns PriceMedian when row found', async () => {
      const row = { brand: 'Nike', category: 'Sneakers', condition: 'Bon etat', median_price: 60, sample_size: 15, updated_at: '2024-01-01T00:00:00Z' };
      const mock = makeSupabaseMock({ maybeSingle: jest.fn().mockResolvedValue({ data: row, error: null }) });
      const result = await new PricingService(mock as never, 10).getMedian(NICHE);
      expect(result?.median).toBe(60);
      expect(result?.sampleSize).toBe(15);
    });
  });

  describe('updateMedian()', () => {
    function makeChainedQuery(resolvedValue: unknown, upsertMock = jest.fn().mockResolvedValue({ error: null })) {
      let eqCount = 0;
      const q: Record<string, unknown> = {};
      q["select"] = jest.fn().mockReturnValue(q);
      q["eq"] = jest.fn().mockImplementation(() => { eqCount++; return eqCount >= 3 ? Promise.resolve(resolvedValue) : q; });
      q["upsert"] = upsertMock;
      return { from: jest.fn().mockReturnValue(q) };
    }
    it('returns null when fewer than minSampleSize listings', async () => {
      const sb = makeChainedQuery({ data: [10,20,30,40,50].map(p => ({ price: p })), error: null });
      expect(await new PricingService(sb as never, 10).updateMedian(NICHE)).toBeNull();
    });
    it('computes and upserts median with enough data', async () => {
      const prices = Array.from({ length: 12 }, (_, i) => ({ price: (i + 1) * 10 }));
      const upsertMock = jest.fn().mockResolvedValue({ error: null });
      const sb = makeChainedQuery({ data: prices, error: null }, upsertMock);
      const result = await new PricingService(sb as never, 10).updateMedian(NICHE);
      expect(result).not.toBeNull();
      expect(result?.sampleSize).toBe(12);
      expect(upsertMock).toHaveBeenCalled();
    });
  });

  describe('nicheKey()', () => {
    it('returns expected key', () => {
      expect(nicheKey(NICHE)).toBe('Nike::Sneakers::Bon etat');
    });
  });
});
