import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { CheckCircle2, Info, AlertTriangle, XCircle, X } from 'lucide-react';

export type ToastType = 'success' | 'info' | 'warning' | 'error';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
}

interface ToastCtx {
  toasts: Toast[];
  push: (message: string, type?: ToastType, duration?: number) => string;
  remove: (id: string) => void;
}

const ToastContext = createContext<ToastCtx | undefined>(undefined);

let counter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, number>>(new Map());

  const remove = useCallback((id: string) => {
    setToasts((cur) => cur.filter((t) => t.id !== id));
    const tid = timers.current.get(id);
    if (tid !== undefined) {
      window.clearTimeout(tid);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback<ToastCtx['push']>(
    (message, type = 'info', duration = 4000) => {
      const id = `t_${++counter}_${Date.now()}`;
      const toast: Toast = { id, message, type, duration };
      setToasts((cur) => [...cur, toast]);
      if (duration > 0) {
        const tid = window.setTimeout(() => remove(id), duration);
        timers.current.set(id, tid);
      }
      return id;
    },
    [remove]
  );

  useEffect(() => {
    return () => {
      timers.current.forEach((tid) => window.clearTimeout(tid));
      timers.current.clear();
    };
  }, []);

  const value = useMemo(() => ({ toasts, push, remove }), [toasts, push, remove]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastCtx {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

const iconForType = {
  success: CheckCircle2,
  info: Info,
  warning: AlertTriangle,
  error: XCircle,
} as const;

const accentForType: Record<ToastType, string> = {
  success: 'border-l-success',
  info: 'border-l-info',
  warning: 'border-l-warning',
  error: 'border-l-danger',
};

const iconColorForType: Record<ToastType, string> = {
  success: 'text-success',
  info: 'text-info',
  warning: 'text-warning',
  error: 'text-danger',
};

export function ToastViewport() {
  const { toasts, remove } = useToast();
  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-[100] flex w-full max-w-sm flex-col gap-3">
      {toasts.map((t) => {
        const Icon = iconForType[t.type];
        return (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-3 rounded-md border border-border border-l-4 ${accentForType[t.type]} bg-surface px-4 py-3 shadow-lg animate-fade-in`}
          >
            <Icon className={`mt-0.5 h-5 w-5 flex-shrink-0 ${iconColorForType[t.type]}`} />
            <div className="flex-1 text-sm text-text-primary">{t.message}</div>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => remove(t.id)}
              className="rounded p-0.5 text-text-muted hover:bg-surface-2 hover:text-text-secondary"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
