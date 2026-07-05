import Anthropic from '@anthropic-ai/sdk';
import { VisionResult } from '../types';

const SYSTEM_PROMPT = `Tu es un expert en mode et en articles de seconde main.
A partir des photos d'une annonce Vinted, identifie precisement :
- brand: la marque de l'article (ex: "Nike", "Adidas", null si inconnue)
- category: la categorie principale (ex: "Sneakers", "T-shirt", "Veste", etc.)
- condition: l'etat apparent (ex: "Neuf", "Tres bon etat", "Bon etat", "Satisfaisant")
- model: le modele precis si detectable (ex: "Air Force 1", null si inconnu)

Reponds UNIQUEMENT en JSON valide sans markdown, exemple :
{"brand":"Nike","category":"Sneakers","condition":"Bon etat","model":"Air Force 1"}`;

export class ClaudeVisionClient {
  private readonly client: Anthropic;
  private readonly model = 'claude-haiku-4-5-20251001';

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async identify(photoUrls: string[]): Promise<VisionResult> {
    if (photoUrls.length === 0) return { brand: null, category: null, condition: null, model: null };
    const urls = photoUrls.slice(0, 4);
    const imageContent = urls.map((url) => ({ type: 'image' as const, source: { type: 'url' as const, url } })) as any as Anthropic.ImageBlockParam[];
    try {
      const response = await this.client.messages.create({
        model: this.model, max_tokens: 256, system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: [...imageContent, { type: 'text', text: 'Identifie cet article Vinted en JSON.' }] }],
      });
      const text = response.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map((b) => b.text).join('');
      return this.parseResponse(text);
    } catch (err) {
      const error = err as Error;
      if (error.message.includes('overloaded') || error.message.includes('529')) throw new Error('ANTHROPIC_OVERLOADED: Retry later');
      throw new Error('Vision error: ' + error.message);
    }
  }

  private parseResponse(text: string): VisionResult {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return { brand: null, category: null, condition: null, model: null };
      const parsed = JSON.parse(jsonMatch[0]) as Partial<VisionResult>;
      return { brand: parsed.brand ?? null, category: parsed.category ?? null, condition: parsed.condition ?? null, model: parsed.model ?? null };
    } catch (_e) { return { brand: null, category: null, condition: null, model: null }; }
  }
}
