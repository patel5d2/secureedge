import { useEffect, useState, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
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
  appId: string | null;
  onClose: () => void;
}

export default function AppDetail({ appId, onClose }: AppDetailProps) {
  const [data, setData] = useState<AppDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);

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

  const close = () => {
    onClose();
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
    <Transition.Root show={!!appId} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={close}>
        <Transition.Child
          as={Fragment}
          enter="ease-in-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in-out duration-300"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-ink-900/40 backdrop-blur-sm transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10 sm:pl-16">
              <Transition.Child
                as={Fragment}
                enter="transform transition ease-in-out duration-300 sm:duration-500"
                enterFrom="translate-x-full"
                enterTo="translate-x-0"
                leave="transform transition ease-in-out duration-300 sm:duration-500"
                leaveFrom="translate-x-0"
                leaveTo="translate-x-full"
              >
                <Dialog.Panel className="pointer-events-auto w-screen max-w-md">
                  <div className="flex h-full flex-col overflow-y-scroll bg-white shadow-2xl border-l border-ink-100">
                    <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
                      <Dialog.Title className="text-sm font-semibold text-ink-900">
                        Application details
                      </Dialog.Title>
                      <button
                        type="button"
                        className="rounded-md p-1.5 text-ink-400 hover:bg-ink-50 hover:text-ink-900 focus:outline-none focus:ring-2 focus:ring-signal-500"
                        onClick={close}
                      >
                        <span className="sr-only">Close panel</span>
                        <X className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                    
                    {loading ? (
                      <div className="flex flex-1 items-center justify-center">
                        <Spinner size={32} />
                      </div>
                    ) : !data || !Icon ? (
                      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
                        <p className="text-sm text-ink-500">Application not found.</p>
                        <button onClick={close} className="text-sm text-signal-600 hover:underline">
                          Back to apps
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="relative mt-6 flex-1 px-4 sm:px-6 space-y-6">
                          {/* App identity */}
                          <div className="flex items-start gap-4">
                            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-ink-900">
                              <Icon className="h-7 w-7 text-ink-0" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <h1 className="text-lg font-bold text-ink-900">{data.app.name}</h1>
                              <p className="mt-1 text-xs text-ink-500">{data.app.description}</p>
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <Badge variant={isAllowed ? 'success' : 'danger'} dot>
                                  {isAllowed ? 'Access granted' : 'Access denied'}
                                </Badge>
                                {data.app.protocol && (
                                  <Badge variant="secondary">{data.app.protocol.toUpperCase()}</Badge>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Access requirements checklist */}
                          {checks.length > 0 && (
                            <section>
                              <div className="mb-3 flex items-center gap-2">
                                <Shield className="h-4 w-4 text-ink-500" />
                                <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                                  Access requirements
                                </h3>
                              </div>
                              <ul className="space-y-2">
                                {checks.map((check) => (
                                  <li
                                    key={check.label}
                                    className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${
                                      check.met ? 'border-signal-200 bg-signal-50' : 'border-danger-200 bg-danger-50'
                                    }`}
                                  >
                                    {check.met ? (
                                      <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-signal-600" />
                                    ) : (
                                      <XCircle className="h-4 w-4 flex-shrink-0 text-danger-600" />
                                    )}
                                    <span
                                      className={`text-sm ${
                                        check.met ? 'text-ink-900' : 'font-medium text-danger-700'
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
                                <Users className="h-4 w-4 text-ink-500" />
                                <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                                  Your access
                                </h3>
                              </div>
                              <p className="mb-2 text-xs text-ink-500">
                                You have access through the following group{data.accessGroups.length === 1 ? '' : 's'}:
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {data.accessGroups.map((g) => (
                                  <Badge key={g.id} variant="secondary">
                                    {g.name}
                                  </Badge>
                                ))}
                              </div>
                            </section>
                          )}

                          {/* Deny reason */}
                          {!isAllowed && data.simulate.reason && (
                            <div className="rounded-lg border border-danger-200 bg-danger-50 px-4 py-3">
                              <p className="text-sm font-medium text-danger-800">Access blocked</p>
                              <p className="mt-1 text-xs text-danger-700">
                                Reason: {data.simulate.reason.replace(/_/g, ' ')}
                              </p>
                              {data.simulate.policyName && (
                                <p className="mt-0.5 text-[11px] text-danger-600">
                                  Policy: {data.simulate.policyName}
                                </p>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Sticky footer */}
                        <div className="border-t border-ink-100 bg-white px-5 py-4">
                          <Button
                            id="app-launch"
                            variant={isAllowed ? 'primary' : 'secondary'}
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
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
