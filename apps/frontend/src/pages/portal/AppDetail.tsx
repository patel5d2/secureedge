import { useEffect, useState } from 'react';
import {
  X,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Shield,
  Users,
} from 'lucide-react';
import { api, type AppDetailResponse } from '../../lib/api';
import { iconForSlug } from '../../lib/app-icons';
import Button from '../../design-system/components/Button';
import Badge from '../../design-system/components/Badge';
import Spinner from '../../design-system/components/Spinner';

interface AppDetailProps {
  /** Application ID whose details to show. When null/undefined the sheet is closed. */
  appId: string | null;
  /** Called when the user dismisses the sheet (X, scrim, Esc). */
  onClose: () => void;
}

/**
 * App Detail — rendered as a right-side drawer ("side sheet") that overlays
 * the portal grid. Controlled by the parent via appId + onClose.
 */
export default function AppDetail({ appId, onClose }: AppDetailProps) {
  const [data, setData] = useState<AppDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  // Fetch detail when the appId changes.
  useEffect(() => {
    if (!appId) return;
    setLoading(true);
    setData(null);
    api
      .get<AppDetailResponse>(`/portal/apps/${appId}`)
      .then((r) => setData(r))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [appId]);

  // Trigger the slide-in whenever the sheet opens.
  useEffect(() => {
    if (!appId) {
      setOpen(false);
      return;
    }
    const t = window.setTimeout(() => setOpen(true), 10);
    return () => window.clearTimeout(t);
  }, [appId]);

  // Dismiss on Esc.
  useEffect(() => {
    if (!appId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appId]);

  // Lock body scroll while the sheet is open.
  useEffect(() => {
    if (!appId) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [appId]);

  if (!appId) return null;

  const close = () => {
    setOpen(false);
    // match the 200ms translate duration before notifying parent
    window.setTimeout(onClose, 180);
  };

  const isAllowed = data?.simulate.outcome === 'allowed';
  const Icon = data ? iconForSlug(data.app.slug) : null;

  const checks = data
    ? [
        {
          label: 'Managed device',
          met:
            !data.requirements.managed ||
            data.simulate.conditions_checked?.find((c) => c.type === 'device_managed')?.passed !==
              false,
          required: data.requirements.managed,
        },
        {
          label: 'Disk encryption',
          met:
            !data.requirements.encrypted ||
            data.simulate.conditions_checked?.find((c) => c.type === 'disk_encrypted')?.passed !==
              false,
          required: data.requirements.encrypted,
        },
        {
          label: 'MFA verified',
          met:
            !data.requirements.mfa ||
            data.simulate.conditions_checked?.find((c) => c.type === 'mfa_verified')?.passed !==
              false,
          required: data.requirements.mfa,
        },
      ].filter((c) => c.required)
    : [];

  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="app-detail-title"
    >
      {/* Scrim */}
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={close}
      />

      {/* Side sheet */}
      <aside
        className={`absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-border bg-surface shadow-2xl transition-transform duration-200 ease-out sm:w-[440px] ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 id="app-detail-title" className="text-sm font-semibold text-text-primary">
            Application details
          </h2>
          <button
            onClick={close}
            aria-label="Close"
            className="rounded-md p-1.5 text-text-secondary transition-colors hover:bg-surface-2 hover:text-text-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <Spinner size={32} />
          </div>
        ) : !data || !Icon ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <p className="text-sm text-text-secondary">Application not found.</p>
            <button onClick={close} className="text-sm text-info hover:underline">
              Back to apps
            </button>
          </div>
        ) : (
          <>
            {/* Scrollable body */}
            <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
              {/* App identity */}
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-surface-2">
                  <Icon className="h-7 w-7 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="text-lg font-bold text-text-primary">{data.app.name}</h1>
                  <p className="mt-1 text-xs text-text-secondary">{data.app.description}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge variant={isAllowed ? 'success' : 'danger'} dot>
                      {isAllowed ? 'Access granted' : 'Access denied'}
                    </Badge>
                    {data.app.protocol && (
                      <Badge variant="gray">{data.app.protocol.toUpperCase()}</Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Access requirements checklist */}
              {checks.length > 0 && (
                <section>
                  <div className="mb-3 flex items-center gap-2">
                    <Shield className="h-4 w-4 text-text-secondary" />
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                      Access requirements
                    </h3>
                  </div>
                  <ul className="space-y-2">
                    {checks.map((check) => (
                      <li
                        key={check.label}
                        className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${
                          check.met ? 'border-success/20 bg-success/5' : 'border-danger/20 bg-danger/5'
                        }`}
                      >
                        {check.met ? (
                          <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-success" />
                        ) : (
                          <XCircle className="h-4 w-4 flex-shrink-0 text-danger" />
                        )}
                        <span
                          className={`text-sm ${
                            check.met ? 'text-text-primary' : 'font-medium text-danger'
                          }`}
                        >
                          {check.label}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Access groups */}
              {data.accessGroups.length > 0 && (
                <section>
                  <div className="mb-3 flex items-center gap-2">
                    <Users className="h-4 w-4 text-text-secondary" />
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                      Your access
                    </h3>
                  </div>
                  <p className="mb-2 text-xs text-text-muted">
                    You have access through the following group{data.accessGroups.length === 1 ? '' : 's'}:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {data.accessGroups.map((g) => (
                      <Badge key={g.id} variant="primary">
                        {g.name}
                      </Badge>
                    ))}
                  </div>
                </section>
              )}

              {/* Deny reason */}
              {!isAllowed && data.simulate.reason && (
                <div className="rounded-lg border border-danger/20 bg-danger/5 px-4 py-3">
                  <p className="text-sm font-medium text-danger">Access blocked</p>
                  <p className="mt-1 text-xs text-text-secondary">
                    Reason: {data.simulate.reason.replace(/_/g, ' ')}
                  </p>
                  {data.simulate.policyName && (
                    <p className="mt-0.5 text-[11px] text-text-muted">
                      Policy: {data.simulate.policyName}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Sticky footer */}
            <div className="border-t border-border px-5 py-4">
              <Button
                id="app-launch"
                variant={isAllowed ? 'accent' : 'secondary'}
                size="lg"
                className="w-full"
                disabled={!isAllowed}
                rightIcon={<ExternalLink className="h-4 w-4" />}
                onClick={() => {
                  if (data.app.url && isAllowed) window.open(data.app.url, '_blank');
                }}
              >
                {isAllowed ? 'Open application' : 'Access required'}
              </Button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
