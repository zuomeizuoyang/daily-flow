import { createClient, type SupabaseClient, type RealtimeChannel } from '@supabase/supabase-js';
import { validateStore, type Store } from './model';

export type SupabaseConfig = {
  url: string;
  anonKey: string;
  syncKey: string;
  enabled: boolean;
};

const CONFIG_KEY = 'daily-flow-supabase';

export const sessionClientId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export function loadSupabaseConfig(): SupabaseConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        url: typeof parsed.url === 'string' ? parsed.url.trim() : '',
        anonKey: typeof parsed.anonKey === 'string' ? parsed.anonKey.trim() : '',
        syncKey: typeof parsed.syncKey === 'string' && parsed.syncKey.trim() ? parsed.syncKey.trim() : 'default',
        enabled: Boolean(parsed.enabled),
      };
    }
  } catch {
    // ignore parse error
  }

  const envUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || '';
  const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() || '';
  const envSync = (import.meta.env.VITE_SUPABASE_SYNC_KEY as string | undefined)?.trim() || 'default';

  return {
    url: envUrl,
    anonKey: envKey,
    syncKey: envSync,
    enabled: Boolean(envUrl && envKey),
  };
}

export function cleanSupabaseUrl(raw: string): string {
  return raw.trim().replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
}

export function saveSupabaseConfig(cfg: SupabaseConfig) {
  const normalized = { ...cfg, url: cleanSupabaseUrl(cfg.url) };
  localStorage.setItem(CONFIG_KEY, JSON.stringify(normalized));
}

let cachedClient: { key: string; client: SupabaseClient } | null = null;

export function getSupabaseClient(cfg: SupabaseConfig): SupabaseClient | null {
  const url = cleanSupabaseUrl(cfg.url);
  if (!cfg.enabled || !url || !cfg.anonKey) {
    return null;
  }
  const key = `${url}::${cfg.anonKey}`;
  if (cachedClient && cachedClient.key === key) {
    return cachedClient.client;
  }
  try {
    const client = createClient(url, cfg.anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    cachedClient = { key, client };
    return client;
  } catch {
    return null;
  }
}

export async function fetchRemoteStore(
  cfg: SupabaseConfig
): Promise<{ store: Store | null; updatedAt?: string; error?: string }> {
  const client = getSupabaseClient(cfg);
  if (!client) return { store: null };

  const syncKey = cfg.syncKey || 'default';
  try {
    const { data, error } = await client
      .from('daily_flow_store')
      .select('data, updated_at')
      .eq('id', syncKey)
      .maybeSingle();

    if (error) {
      return { store: null, error: error.message };
    }
    if (!data || !data.data) {
      return { store: null };
    }
    const validated = validateStore(data.data);
    return { store: validated, updatedAt: data.updated_at };
  } catch (err) {
    return { store: null, error: (err as Error).message };
  }
}

export async function pushRemoteStore(
  cfg: SupabaseConfig,
  store: Store,
  clientId: string
): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseClient(cfg);
  if (!client) return { success: false };

  const syncKey = cfg.syncKey || 'default';
  try {
    const { error } = await client.from('daily_flow_store').upsert({
      id: syncKey,
      data: store,
      client_id: clientId,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export function subscribeRemoteStore(
  cfg: SupabaseConfig,
  clientId: string,
  onRemoteUpdate: (store: Store) => void,
  onStatusChange: (status: 'connected' | 'connecting' | 'disconnected' | 'error', err?: string) => void
): () => void {
  const client = getSupabaseClient(cfg);
  if (!client) {
    onStatusChange('disconnected');
    return () => {};
  }

  const syncKey = cfg.syncKey || 'default';
  let channel: RealtimeChannel | null = null;
  onStatusChange('connecting');

  try {
    channel = client
      .channel(`sync-channel-${syncKey}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'daily_flow_store',
          filter: `id=eq.${syncKey}`,
        },
        (payload) => {
          const newRow = payload.new as { data?: unknown; client_id?: string } | undefined;
          if (!newRow || !newRow.data) return;
          // Ignore updates initiated by this device
          if (newRow.client_id === clientId) return;

          try {
            const validated = validateStore(newRow.data);
            onRemoteUpdate(validated);
          } catch (e) {
            console.error('Remote sync validation failed:', e);
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          onStatusChange('connected');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          onStatusChange('error', err?.message || status);
        } else if (status === 'CLOSED') {
          onStatusChange('disconnected');
        }
      });
  } catch (err) {
    onStatusChange('error', (err as Error).message);
  }

  return () => {
    if (channel && client) {
      client.removeChannel(channel);
    }
  };
}

export async function deriveSyncKey(password: string): Promise<string> {
  const enc = new TextEncoder().encode('daily-flow-v2-salt::' + password.trim());
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32);
}

const AUTH_KEY = 'daily-flow-auth-password';

export function getSavedAuthPassword(): string | null {
  return localStorage.getItem(AUTH_KEY) || sessionStorage.getItem(AUTH_KEY);
}

export function saveAuthPassword(pwd: string, remember: boolean) {
  if (remember) {
    localStorage.setItem(AUTH_KEY, pwd);
    sessionStorage.removeItem(AUTH_KEY);
  } else {
    sessionStorage.setItem(AUTH_KEY, pwd);
    localStorage.removeItem(AUTH_KEY);
  }
}

export function clearAuthPassword() {
  localStorage.removeItem(AUTH_KEY);
  sessionStorage.removeItem(AUTH_KEY);
}

