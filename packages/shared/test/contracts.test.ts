import { describe, expect, it } from 'vitest';
import {
  ENTRY_TYPES,
  isCaptureRequest,
  isPairRequest,
  type CaptureRequest,
  type PairRequest,
} from '../src/index.js';

describe('shared API contracts', () => {
  it('exposes the known entry types', () => {
    expect(ENTRY_TYPES).toEqual(['thought', 'idea', 'task']);
  });

  it('accepts a well-formed capture request', () => {
    const request: CaptureRequest = { text: 'buy milk', type: 'task' };
    expect(isCaptureRequest(request)).toBe(true);
  });

  it('rejects a capture request without text', () => {
    expect(isCaptureRequest({ type: 'task' })).toBe(false);
    expect(isCaptureRequest(null)).toBe(false);
  });

  it('accepts a well-formed pair request', () => {
    const request: PairRequest = { deviceName: 'phone', pairingCode: '123456' };
    expect(isPairRequest(request)).toBe(true);
  });

  it('rejects a pair request without a pairing code', () => {
    expect(isPairRequest({ deviceName: 'phone' })).toBe(false);
  });
});
