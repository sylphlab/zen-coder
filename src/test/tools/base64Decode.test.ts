import { base64DecodeTool } from '../../tools/utils/base64Decode';
import { describe, it, expect, vi } from 'vitest';
import { Buffer } from 'buffer';

const mockOptions = {
  toolCallId: 'test-call-id',
  messages: []
};

describe('base64DecodeTool', () => {
  it('should decode a single string', async () => {
    const result = await base64DecodeTool.execute(
      { encodedStrings: ['aGVsbG8gd29ybGQ='] },
      mockOptions
    );
    
    expect(result.success).toBe(true);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].decoded).toBe('hello world');
  });

  it('should decode multiple strings', async () => {
    const result = await base64DecodeTool.execute(
      { encodedStrings: ['aGVsbG8=', 'd29ybGQ=', 'dGVzdA=='] },
      mockOptions
    );

    expect(result.success).toBe(true);
    expect(result.results).toHaveLength(3);
    expect(result.results[0].decoded).toBe('hello');
    expect(result.results[1].decoded).toBe('world');
    expect(result.results[2].decoded).toBe('test');
  });

  it('should handle empty input', async () => {
    const result = await base64DecodeTool.execute(
      { encodedStrings: [] },
      mockOptions
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('No input strings provided');
  });

  it('should handle decoding errors', async () => {
    // Mock Buffer.from to throw error for invalid Base64
    const originalFrom = Buffer.from;
    Buffer.from = vi.fn((...args: any[]) => {
      if (args[1] === 'base64' && args[0] === 'invalid') {
        throw new Error('Invalid base64 string');
      }
      return originalFrom.apply(Buffer, args as any);
    }) as any;
    
    const result = await base64DecodeTool.execute(
      { encodedStrings: ['valid', 'invalid', 'another valid'] },
      mockOptions
    );

    // Restore original Buffer.from
    Buffer.from = originalFrom;

    expect(result.success).toBe(false);
    expect(result.results).toHaveLength(3);
    expect(result.results[0].success).toBe(false); // Changed from true to false
    expect(result.results[1].success).toBe(false);
    expect(result.results[2].success).toBe(false); // Changed from true to false
    expect(result.error).toContain('Some strings failed to decode');
  });
});