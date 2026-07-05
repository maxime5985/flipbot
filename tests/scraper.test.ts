import axios from 'axios';
import { VintedClient } from '../src/scraper';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const mockAxiosInstance = {
  get: jest.fn(),
};

(mockedAxios.create as jest.Mock).mockReturnValue(mockAxiosInstance);

const RAW_ITEM = {
  id: 123,
  title: 'Nike Air Force 1',
  price: '45.00',
  currency: 'EUR',
  url: 'https://www.vinted.fr/items/123',
  photos: [{ url: 'https://img/photo1.jpg', full_size_url: 'https://img/photo1_full.jpg' }],
  brand_title: 'Nike',
  category_title: 'Sneakers',
  status: 'Bon état',
  created_at_ts: 1700000000,
};

describe('VintedClient', () => {
  let client: VintedClient;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new VintedClient('session=abc123');
  });

  describe('search()', () => {
    it('returns mapped items on success', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { items: [RAW_ITEM], pagination: { current_page: 1, total_pages: 1 } },
      });

      const items = await client.search({ query: 'Nike' });
      expect(items).toHaveLength(1);
      const [item] = items;
      expect(item?.id).toBe('123');
      expect(item?.price).toBe(45);
      expect(item?.brand).toBe('Nike');
      expect(item?.photos).toEqual(['https://img/photo1_full.jpg']);
    });

    it('returns empty array when items is missing', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({ data: {} });
      const items = await client.search();
      expect(items).toEqual([]);
    });

    it('throws RATE_LIMITED on 429', async () => {
      const err = Object.assign(new Error('rate limit'), { response: { status: 429 } });
      mockAxiosInstance.get.mockRejectedValueOnce(err);
      await expect(client.search()).rejects.toThrow('RATE_LIMITED');
    });

    it('throws AUTH_ERROR on 401', async () => {
      const err = Object.assign(new Error('unauthorized'), { response: { status: 401 } });
      mockAxiosInstance.get.mockRejectedValueOnce(err);
      await expect(client.search()).rejects.toThrow('AUTH_ERROR');
    });

    it('throws generic error on other failures', async () => {
      const err = Object.assign(new Error('network error'), { response: { status: 500 } });
      mockAxiosInstance.get.mockRejectedValueOnce(err);
      await expect(client.search()).rejects.toThrow('Vinted API error');
    });
  });

  describe('getItem()', () => {
    it('returns item on success', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({ data: { item: RAW_ITEM } });
      const item = await client.getItem('123');
      expect(item?.id).toBe('123');
    });

    it('returns null on 404', async () => {
      const err = Object.assign(new Error('not found'), { response: { status: 404 } });
      mockAxiosInstance.get.mockRejectedValueOnce(err);
      const item = await client.getItem('999');
      expect(item).toBeNull();
    });

    it('throws on other errors', async () => {
      const err = Object.assign(new Error('server error'), { response: { status: 500 } });
      mockAxiosInstance.get.mockRejectedValueOnce(err);
      await expect(client.getItem('123')).rejects.toThrow('Vinted getItem error');
    });
  });
});
