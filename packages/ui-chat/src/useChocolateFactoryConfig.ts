'use client';

import { useEffect, useState } from 'react';
import type { ChocolateFactoryConfig } from './backends';

/**
 * Fetches the browser-direct Chocolate Factory settings from the app's config
 * route (`ai-chat-routes` scaffolds `/api/ai-chat/config`), which reads them from
 * the server's environment at request time rather than baking them into the build.
 *
 * Returns null while loading, and when the route answers with an error (the chat
 * isn't configured), so `if (!config) return null` hides the chat in both cases.
 */
export function useChocolateFactoryConfig(url = '/api/ai-chat/config'): ChocolateFactoryConfig | null {
  const [config, setConfig] = useState<ChocolateFactoryConfig | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(url)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: Partial<ChocolateFactoryConfig> | null) => {
        if (cancelled) return;
        if (data?.baseUrl && data.agentId && data.apiKey) setConfig({ baseUrl: data.baseUrl, agentId: data.agentId, apiKey: data.apiKey });
      })
      .catch((error) => console.error('[ai-chat] Loading the chat settings failed.', error));
    return () => {
      cancelled = true;
    };
  }, [url]);

  return config;
}
