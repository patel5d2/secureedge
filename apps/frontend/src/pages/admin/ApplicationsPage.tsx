import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, Globe, Terminal, Monitor } from 'lucide-react';
import { api, type Application, type ApplicationsResponse } from '../../lib/api';
import Button from '../../design-system/components/Button';
import Spinner from '../../design-system/components/Spinner';
import { useToast } from '../../hooks/useToast';
import ApplicationFormModal from './ApplicationFormModal';

const protoIcon = { https: Globe, ssh: Terminal, rdp: Monitor } as const;

export default function ApplicationsPage() {
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Application | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const { push } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get<ApplicationsResponse>('/admin/applications');
      setApps(r.applications);
    } catch {
      /* noop */
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };
  const openEdit = (app: Application) => {
    setEditing(app);
    setModalOpen(true);
  };

  const deleteApp = async (id: string) => {
    if (!confirm('Are you sure? This will remove the application and unlink all policy references.'))
      return;
    setDeleting(id);
    try {
      await api.del(`/admin/applications/${id}`);
      push('Application deleted.', 'success');
      load();
    } catch {
      push('Failed to delete application.', 'error');
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between border-b border-ink-100 pb-6">
        <div>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-400">
            {apps.length} application{apps.length !== 1 ? 's' : ''} registered
          </p>
          <h1 className="mt-1 font-display text-[44px] leading-[1.05] tracking-[-0.02em] text-ink-900">
            Applications
          </h1>
        </div>
        <Button
          variant="signal"
          leftIcon={<Plus className="h-4 w-4" strokeWidth={1.75} />}
          onClick={openCreate}
        >
          Register application
        </Button>
      </header>

      {apps.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-ink-200 py-16">
          <Globe className="mb-3 h-10 w-10 text-ink-400" strokeWidth={1.5} />
          <p className="font-display text-[24px] leading-tight text-ink-900">
            No applications yet
          </p>
          <p className="mb-4 mt-1 text-[13px] text-ink-400">
            Register your first app to start managing access.
          </p>
          <Button
            variant="signal"
            leftIcon={<Plus className="h-4 w-4" strokeWidth={1.75} />}
            onClick={openCreate}
          >
            Register application
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3">
          {apps.map((app) => {
            const Icon = protoIcon[app.protocol as keyof typeof protoIcon] || Globe;
            const mfa = app.mfa_required || app.required_mfa;
            return (
              <div
                key={app.id}
                className="group flex flex-col gap-4 rounded-lg border border-ink-100 bg-white p-5 transition-all duration-200 ease-out-soft hover:-translate-y-px hover:border-ink-200 hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-ink-900 text-ink-0">
                      <Icon className="h-5 w-5" strokeWidth={1.6} />
                    </div>
                    <div>
                      <h3 className="text-[14px] font-semibold text-ink-900">{app.name}</h3>
                      <p className="font-mono text-[10px] text-ink-400">{app.slug}</p>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={() => openEdit(app)}
                      className="rounded p-1.5 text-ink-500 hover:bg-ink-100 hover:text-ink-900"
                      title="Edit"
                    >
                      <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </button>
                    <button
                      onClick={() => deleteApp(app.id)}
                      disabled={deleting === app.id}
                      className="rounded p-1.5 text-ink-500 hover:bg-[#FBEAE7] hover:text-[#D1432B]"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </button>
                  </div>
                </div>

                <p className="line-clamp-2 text-[12px] leading-snug text-ink-500">
                  {app.description || 'No description'}
                </p>

                <div className="truncate rounded-md bg-ink-50 px-2 py-1.5 font-mono text-[11px] text-ink-700">
                  {app.app_url || app.url}
                </div>

                <div className="mt-auto flex items-center justify-between border-t border-ink-100 pt-3">
                  <span className="rounded-full bg-ink-50 px-2 py-[3px] font-mono text-[10px] uppercase tracking-[0.06em] text-ink-700">
                    {(app.protocol || 'https').toUpperCase()}
                  </span>
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2 py-[3px] text-[10px] font-medium"
                    style={{
                      background: mfa ? '#E8F5E7' : '#F0EFEB',
                      color: mfa ? '#1F6E20' : '#6A655D',
                    }}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: mfa ? '#3CB13A' : '#A9A49A' }}
                    />
                    {mfa ? 'MFA required' : 'MFA optional'}
                  </span>
                  {app.policy_count !== undefined && (
                    <span className="font-mono text-[10px] text-ink-400">
                      {app.policy_count} policies
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ApplicationFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={load}
        existing={editing}
      />
    </div>
  );
}
