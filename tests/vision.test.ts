import { ClaudeVisionClient } from '../src/vision';
import Anthropic from '@anthropic-ai/sdk';

jest.mock('@anthropic-ai/sdk');

const mockCreate = jest.fn();
(Anthropic as jest.MockedClass<typeof Anthropic>).mockImplementation(() => ({
  messages: { create: mockCreate },
}) as unknown as Anthropic);

function makeResponse(text: string) {
  return { content: [{ type: 'text', text }] };
}

describe('ClaudeVisionClient', () => {
  let client: ClaudeVisionClient;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new ClaudeVisionClient('sk-test');
  });

  it('returns empty result when no photos', async () => {
    const result = await client.identify([]);
    expect(result).toEqual({ brand: null, category: null, condition: null, model: null });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('parses valid JSON response', async () => {
    mockCreate.mockResolvedValueOnce(
      makeResponse('{"brand":"Nike","category":"Sneakers","condition":"Bon état","model":"Air Force 1"}'),
    );

    const result = await client.identify(['https://img/photo.jpg']);
    expect(result).toEqual({
      brand: 'Nike',
      category: 'Sneakers',
      condition: 'Bon état',
      model: 'Air Force 1',
    });
  });

  it('extracts JSON from markdown fences', async () => {
    mockCreate.mockResolvedValueOnce(
      makeResponse('```json\n{"brand":"Adidas","category":"T-shirt","condition":"Neuf","model":null}\n```'),
    );

    const result = await client.identify(['https://img/photo.jpg']);
    expect(result.brand).toBe('Adidas');
    expect(result.model).toBeNull();
  });

  it('returns null fields on invalid JSON', async () => {
    mockCreate.mockResolvedValueOnce(makeResponse('not valid json at all'));
    const result = await client.identify(['https://img/photo.jpg']);
    expect(result).toEqual({ brand: null, category: null, condition: null, model: null });
  });

  it('uses at most 4 photos', async () => {
    mockCreate.mockResolvedValueOnce(
      makeResponse('{"brand":"Nike","category":"Sneakers","condition":"Neuf","model":null}'),
    );

    const photos = ['a', 'b', 'c', 'd', 'e', 'f'].map((x) => `https://img/${x}.jpg`);
    await client.identify(photos);

    const call = mockCreate.mock.calls[0][0] as { messages: Array<{ content: unknown[] }> };
    const imageBlocks = (call.messages[0]?.content as Array<{ type: string }>).filter(
      (b) => b.type === 'image',
    );
    expect(imageBlocks).toHaveLength(4);
  });

  it('throws ANTHROPIC_OVERLOADED on 529 error', async () => {
    mockCreate.mockRejectedValueOnce(new Error('Service overloaded 529'));
    await expect(client.identify(['https://img/photo.jpg'])).rejects.toThrow('ANTHROPIC_OVERLOADED');
  });

  it('throws Vision error on other failures', async () => {
    mockCreate.mockRejectedValueOnce(new Error('network timeout'));
    await expect(client.identify(['https://img/photo.jpg'])).rejects.toThrow('Vision error');
  });
});
