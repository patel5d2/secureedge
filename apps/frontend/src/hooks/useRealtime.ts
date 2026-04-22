import { useEffect, useRef, useState } from 'react';

interface RealtimeState {
  connected: boolean;
  error: string | null;
}

const BASE_URL: string =
  (import.meta.env && (import.meta.env as { VITE_API_BASE_URL?: string }).VITE_API_BASE_URL) || '/api';

export function useRealtime<T>(
  path: string,
  onMessage: (ev: T) => void,
  enabled: boolean = true
): RealtimeState {
  const [state, setState] = useState<RealtimeState>({ connected: false, error: null });
  const handlerRef = useRef(onMessage);
  handlerRef.current = onMessage;

  useEffect(() => {
    if (!enabled) {
      setState({ connected: false, error: null });
      return;
    }
    let source: EventSource | null = null;
    let cancelled = false;
    try {
      source = new EventSource(`${BASE_URL}${path}`, { withCredentials: true });
    } catch (err) {
      setState({ connected: false, error: err instanceof Error ? err.message : 'Failed to connect' });
      return;
    }

    source.onopen = () => {
      if (!cancelled) setState({ connected: true, error: null });
    };
    source.onerror = () => {
      if (!cancelled) setState((s) => ({ connected: false, error: s.error ?? 'Stream disconnected' }));
    };

    const handle = (raw: MessageEvent) => {
      try {
        const parsed = JSON.parse(raw.data) as T;
        handlerRef.current(parsed);
      } catch {
        /* ignore malformed frame */
      }
    };

    source.addEventListener('access', handle as EventListener);
    source.addEventListener('message', handle as EventListener);

    return () => {
      cancelled = true;
      if (source) {
        source.removeEventListener('access', handle as EventListener);
        source.removeEventListener('message', handle as EventListener);
        source.close();
      }
    };
  }, [path, enabled]);

  return state;
}
