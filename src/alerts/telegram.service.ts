import axios, { AxiosError } from 'axios';
import { Deal } from '../types';
import { nicheKey } from '../pricing';

export class TelegramService {
  private readonly baseUrl: string;
  constructor(private readonly botToken: string, private readonly chatId: string) {
    this.baseUrl = 'https://api.telegram.org/bot' + botToken;
  }

  async sendDealAlert(deal: Deal): Promise<void> {
    const { item, niche, median, discountPct } = deal;
    const pct = Math.round((1 - discountPct) * 100);
    const text = [
      '\ud83d\udca5 *Bonne affaire d\u00e9tect\u00e9e !*',
      '',
      '\ud83d\udce6 *' + this.escape(item.title) + '*',
      '\ud83d\udd36 Prix : *' + item.price + ' \u20ac* _(m\u00e9diane niche : ' + median.toFixed(2) + ' \u20ac)_',
      '\ud83d\udcc9 R\u00e9duction : *-' + pct + '%* vs m\u00e9diane',
      '\ud83d\udf0f\ufe0f Niche : `' + this.escape(nicheKey(niche)) + '`',
      '\ud83d\udc17 [Voir l\'annonce](' + item.url + ')',
    ].join('\n');
    await this.sendMessage(text);
  }

  async sendMessage(text: string): Promise<void> {
    try {
      await axios.post(this.baseUrl + '/sendMessage', { chat_id: this.chatId, text, parse_mode: 'Markdown', disable_web_page_preview: false });
    } catch (err) {
      const error = err as AxiosError;
      if (error.response?.status === 429) {
        const retryAfter = (error.response.data as { parameters?: { retry_after?: number } })?.parameters?.retry_after ?? 5;
        await new Promise((r) => setTimeout(r, retryAfter * 1000));
        await this.sendMessage(text);
        return;
      }
      throw new Error('Telegram error: ' + error.message);
    }
  }

  private escape(text: string): string {
    return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
  }
}
