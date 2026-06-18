import { describe, expect, it, vi } from 'vitest';

import { api } from './api-client.js';

describe('api-client', () => {
  it('rejects guild-scoped requests with an empty guild ID before fetching', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(api.getGuildPlugins('')).rejects.toThrow('Invalid request path');
    await expect(api.getGuildPluginStorage('', 'welcome', 'settings/welcome')).rejects.toThrow(
      'Invalid request path',
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('allows guild-scoped requests with a valid snowflake', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => ({ data: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await api.getGuildPlugins('1111111111111111111');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/guilds/1111111111111111111/plugins',
      expect.objectContaining({ credentials: 'include' }),
    );
  });
});
