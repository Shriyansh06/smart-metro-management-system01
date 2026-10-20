import { afterEach, expect, it, vi } from 'vitest';
import { api } from './api';
afterEach(() => vi.unstubAllGlobals());
it('sends the current session', async () => {
  vi.stubGlobal('sessionStorage', {getItem: () => 'test-token'});
  const fetch = vi.fn().mockResolvedValue({ok:true,json:async () => ({total:8})});
  vi.stubGlobal('fetch',fetch);
  expect(await api('/analytics/crowd')).toEqual({total:8});
  expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer test-token');
});
it('surfaces validation errors', async () => {
  vi.stubGlobal('sessionStorage', {getItem: () => null});
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false,json:async () => ({detail:[{msg:'Invalid date'}]})}));
  await expect(api('/analytics/crowd?day=bad')).rejects.toThrow('Invalid date');
});
