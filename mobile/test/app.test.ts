import { describe, expect, it } from 'vitest';
import { appName, buildCaptureDraft } from '../src';

describe('mobile placeholder', () => {
  it('exposes the app name', () => {
    expect(appName).toBe('Siegmund');
  });

  it('builds a capture draft from raw text', () => {
    expect(buildCaptureDraft('  buy milk  ')).toEqual({ text: 'buy milk', type: 'thought' });
  });
});
