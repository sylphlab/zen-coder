import { base64EncodeTool } from '../../tools/utils/base64Encode';
import { describe, it, expect, vi } from 'vitest';
import { Buffer } from 'buffer';

const mockOptions = {
  toolCallId: 'test-call-id',
  messages: []
};

describe('base64EncodeTool', () => {
  it('should encode a single string', async () => {
    const result = await base64EncodeTool.execute(
      { input: ['hello world'] },
      mockOptions
    );
    
    expect(result.success).toBe(true);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].encoded).toBe('aGVsbG8gd29ybGQ=');
  });

  it('should encode multiple strings', async () => {
    const result = await base64EncodeTool.execute(
      { input: ['hello', 'world', 'test'] },
      mockOptions
    );

    expect(result.success).toBe(true);
    expect(result.results).toHaveLength(3);
    expect(result.results[0].encoded).toBe('aGVsbG8=');
    expect(result.results[1].encoded).toBe('d29ybGQ=');
    expect(result.results[2].encoded).toBe('dGVzdA==');
  });

  it('should handle empty input', async () => {
    const result = await base64EncodeTool.execute(
      { input: [] },
      mockOptions
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('No input strings provided');
  });

  it('should handle encoding errors', async () => {
    // Mock Buffer.from to throw error for specific input
    const originalFrom = Buffer.from;
    Buffer.from = vi.fn((...args: any[]) => {
      if (typeof args[0] === 'string' && args[0] === 'invalid') {
        throw new Error('Invalid string');
      }
      return originalFrom.apply(Buffer, args as any);
    }) as any;
    
    const result = await base64EncodeTool.execute(
      { input: ['valid', 'invalid', 'another valid'] },
      mockOptions
    );

    // Restore original Buffer.from
    Buffer.from = originalFrom;

    expect(result.success).toBe(false);
    expect(result.results).toHaveLength(3);
    expect(result.results[0].success).toBe(true);
    expect(result.results[1].success).toBe(false);
    expect(result.results[2].success).toBe(true);
    expect(result.error).toContain('Some strings failed to encode');
  });
});