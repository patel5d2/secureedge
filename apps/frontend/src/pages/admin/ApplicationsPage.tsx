import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, Globe, Terminal, Monitor } from 'lucide-react';
import { api, type Application, type ApplicationsResponse } from '../../lib/api';
import Badge from '../../design-system/components/Badge';
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
    } catch { /* noop */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (app: Application) => { setEditing(app); setModalOpen(true); };

  const deleteApp = async (id: string) => {
    if (!confirm('Are you sure? This will remove the application and unlink all policy references.')) return;
    setDeleting(id);
    try {
      await api.del(`/admin/applications/${id}`);
      push('Application deleted.', 'success');
      load();
    } catch { push('Failed to delete application.', 'error'); }
    finally { setDeleting(null); }
  };

  if (loading) return <div className="flex h-64 items-center justify-center"><Spinner size={32} /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Applications</h1>
          <p className="text-sm text-text-muted mt-1">{apps.length} application{apps.length !== 1 ? 's' : ''} registered</p>
        </div>
        <Button variant="accent" leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>Register Application</Button>
      </div>

      {apps.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border py-16">
          <Globe className="h-12 w-12 text-text-muted mb-3" />
          <p className="text-lg font-semibold text-text-primary">No applications yet</p>
          <p className="text-sm text-text-muted mt-1 mb-4">Register your first application to start managing access</p>
          <Button variant="accent" leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>Register Application</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {apps.map((app) => {
            const Icon = protoIcon[(app.protocol as keyof typeof protoIcon)] || Globe;
            return (
              <div key={app.id} className="rounded-xl border border-border bg-white p-5 hover:shadow-md transition-shadow group">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-2">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-text-primary">{app.name}</h3>
                      <p className="text-xs text-text-muted font-mono">{app.slug}</p>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(app)} className="rounded-md p-1.5 text-text-muted hover:bg-surface-2 hover:text-text-primary" title="Edit"><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => deleteApp(app.id)} disabled={deleting === app.id} className="rounded-md p-1.5 text-text-muted hover:bg-danger/10 hover:text-danger" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
                <p className="mt-3 text-xs text-text-secondary line-clamp-2">{app.description || 'No description'}</p>
                <div className="mt-3 text-xs font-mono text-text-muted truncate">{app.app_url || app.url}</div>
                <div className="mt-3 flex items-center gap-2">
                  <Badge variant="gray">{(app.protocol || 'https').toUpperCase()}</Badge>
                  <Badge variant={app.mfa_required || app.required_mfa ? 'success' : 'gray'} dot>{app.mfa_required || app.required_mfa ? 'MFA Required' : 'MFA Optional'}</Badge>
                  {app.policy_count !== undefined && <span className="text-xs text-text-muted">{app.policy_count} policies</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ApplicationFormModal open={modalOpen} onClose={() => setModalOpen(false)} onSaved={load} existing={editing} />
    </div>
  );
}
