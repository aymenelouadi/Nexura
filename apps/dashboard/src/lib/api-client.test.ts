import { describe, expect, it, vi } from 'vitest';

import { api, ApiError } from './api-client.js';

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

  it('uses structured backend plugin error messages', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        headers: { get: () => 'request-1' },
        url: '/api/v1/guilds/1111111111111111111/plugins/upload',
        json: () => ({
          type: 'https://nexura.dev/problems/conflict',
          title: 'Conflict',
          status: 409,
          detail: 'Plugin "welcome" is already installed.',
          instance: '/api/v1/guilds/1111111111111111111/plugins/upload',
          requestId: 'request-1',
          error: {
            code: 'PLUGIN_ALREADY_INSTALLED',
            message: 'Plugin "welcome" is already installed.',
            details: { pluginId: 'welcome' },
          },
        }),
      }),
    );

    try {
      await api.uploadGuildPlugin('1111111111111111111', new File(['x'], 'welcome.nexura'));
      throw new Error('Expected upload to fail.');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).message).toBe('Plugin "welcome" is already installed.');
      expect((error as ApiError).code).toBe('PLUGIN_ALREADY_INSTALLED');
    }
  });
});
