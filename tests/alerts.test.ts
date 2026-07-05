import axios from 'axios';
import { TelegramService } from '../src/alerts';
import { Deal } from '../src/types';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const DEAL: Deal = {
  item: {
    id: 'item1',
    title: 'Nike Air Force 1',
    price: 40,
    currency: 'EUR',
    url: 'https://www.vinted.fr/items/item1',
    photos: [],
    brand: 'Nike',
    category: 'Sneakers',
    condition: 'Bon état',
    createdAt: new Date().toISOString(),
  },
  vision: { brand: 'Nike', category: 'Sneakers', condition: 'Bon état', model: 'Air Force 1' },
  niche: { brand: 'Nike', category: 'Sneakers', condition: 'Bon état' },
  median: 70,
  discountPct: 40 / 70,
};

describe('TelegramService', () => {
  let svc: TelegramService;

  beforeEach(() => {
    jest.clearAllMocks();
    svc = new TelegramService('bot123:TOKEN', '-100123456');
  });

  it('sends message on sendDealAlert', async () => {
    mockedAxios.post = jest.fn().mockResolvedValueOnce({ data: { ok: true } });
    await svc.sendDealAlert(DEAL);
    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringContaining('/sendMessage'),
      expect.objectContaining({ chat_id: '-100123456', parse_mode: 'Markdown' }),
    );
  });

  it('retries once on 429 then succeeds', async () => {
    jest.useFakeTimers();
    const retryError = Object.assign(new Error('too many requests'), {
      response: { status: 429, data: { parameters: { retry_after: 1 } } },
    });
    mockedAxios.post = jest.fn()
      .mockRejectedValueOnce(retryError)
      .mockResolvedValueOnce({ data: { ok: true } });

    const promise = svc.sendMessage('test');
    await jest.runAllTimersAsync();
    await promise;

    expect(mockedAxios.post).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });

  it('throws on non-429 error', async () => {
    mockedAxios.post = jest.fn().mockRejectedValueOnce(
      Object.assign(new Error('forbidden'), { response: { status: 403 } }),
    );
    await expect(svc.sendMessage('test')).rejects.toThrow('Telegram error');
  });

  it('message text contains price and percentage', async () => {
    let sentText = '';
    mockedAxios.post = jest.fn().mockImplementation((_url, body) => {
      sentText = (body as { text: string }).text;
      return Promise.resolve({ data: { ok: true } });
    });
    await svc.sendDealAlert(DEAL);
    expect(sentText).toContain('40');
    expect(sentText).toContain('70.00');
  });
});
