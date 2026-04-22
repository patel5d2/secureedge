import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, UserX, UserCheck, Laptop, Clock } from 'lucide-react';
import { api, type User, type Group, type Device, type AccessEvent } from '../../lib/api';
import { formatRelative, formatDateTime } from '../../lib/format';
import Avatar from '../../design-system/components/Avatar';
import Badge from '../../design-system/components/Badge';
import Button from '../../design-system/components/Button';
import Card from '../../design-system/components/Card';
import Spinner from '../../design-system/components/Spinner';
import { useToast } from '../../hooks/useToast';

const statusVar = { active: 'success', suspended: 'warning', deactivated: 'danger' } as const;
const enrollVar = { enrolled: 'success', pending: 'warning', quarantined: 'danger', revoked: 'gray', unenrolled: 'gray' } as const;

export default function UserDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { push } = useToast();

  const [user, setUser] = useState<User | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [events, setEvents] = useState<AccessEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Inline edit
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editDept, setEditDept] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const r = await api.get<{ user: User; groups: Group[]; devices: Device[]; recent_events: AccessEvent[] }>(`/admin/users/${id}`);
      setUser(r.user);
      setGroups(r.groups);
      setDevices(r.devices);
      setEvents(r.recent_events);
      setEditName(r.user.full_name || r.user.name || '');
      setEditRole(r.user.role);
      setEditDept(r.user.department || '');
    } catch { push('Failed to load user.', 'error'); }
    setLoading(false);
  }, [id, push]);

  useEffect(() => { load(); }, [load]);

  const saveEdit = async () => {
    if (!id) return;
    setSaving(true);
    try {
      await api.put(`/admin/users/${id}`, { full_name: editName, role: editRole, department: editDept || undefined });
      push('User updated.', 'success');
      setEditMode(false);
      load();
    } catch { push('Failed to update.', 'error'); }
    finally { setSaving(false); }
  };

  const toggleStatus = async () => {
    if (!user || !id) return;
    const newStatus = user.status === 'active' ? 'suspended' : 'active';
    try {
      await api.put(`/admin/users/${id}`, { status: newStatus });
      push(`User ${newStatus}.`, 'success');
      load();
    } catch { push('Failed.', 'error'); }
  };

  const updateDevice = async (deviceId: string, update: Record<string, unknown>) => {
    try {
      await api.put(`/admin/devices/${deviceId}`, update);
      push('Device updated.', 'success');
      load();
    } catch { push('Failed to update device.', 'error'); }
  };

  if (loading) return <div className="flex h-64 items-center justify-center"><Spinner size={32} /></div>;
  if (!user) return <div className="py-10 text-center text-text-muted">User not found.</div>;

  return (
    <div className="space-y-6">
      <button onClick={() => navigate('/admin/users')} className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary">
        <ArrowLeft className="h-4 w-4" /> Back to users
      </button>

      {/* User header */}
      <Card>
        <div className="flex items-start gap-5">
          <Avatar name={user.full_name || user.name} size="xl" />
          <div className="flex-1">
            {editMode ? (
              <div className="space-y-3">
                <input value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full rounded-lg border border-border px-3 py-2 text-lg font-bold focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
                <div className="flex gap-3">
                  <select value={editRole} onChange={(e) => setEditRole(e.target.value)} className="rounded-lg border border-border px-3 py-2 text-sm">
                    <option value="user">User</option>
                    <option value="helpdesk">Helpdesk</option>
                    <option value="admin">Admin</option>
                  </select>
                  <input value={editDept} onChange={(e) => setEditDept(e.target.value)} placeholder="Department" className="flex-1 rounded-lg border border-border px-3 py-2 text-sm" />
                </div>
                <div className="flex gap-2">
                  <Button variant="accent" size="sm" onClick={saveEdit} loading={saving}>Save</Button>
                  <Button variant="ghost" size="sm" onClick={() => setEditMode(false)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <>
                <h1 className="text-xl font-bold text-text-primary">{user.full_name || user.name}</h1>
                <p className="text-sm text-text-muted">{user.email}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant={user.role === 'admin' ? 'primary' : user.role === 'helpdesk' ? 'accent' : 'gray'}>{user.role}</Badge>
                  <Badge variant={statusVar[user.status as keyof typeof statusVar] || 'gray'} dot>{user.status}</Badge>
                  {user.department && <Badge variant="gray">{user.department}</Badge>}
                </div>
                <p className="mt-2 text-xs text-text-muted">
                  {user.last_login_at ? `Last login: ${formatRelative(user.last_login_at)}` : 'Never logged in'}
                  {user.created_at ? ` · Created: ${formatRelative(user.created_at)}` : ''}
                </p>
              </>
            )}
          </div>
          {!editMode && (
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setEditMode(true)}>Edit</Button>
              <Button variant={user.status === 'active' ? 'danger' : 'accent'} size="sm" leftIcon={user.status === 'active' ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />} onClick={toggleStatus}>
                {user.status === 'active' ? 'Suspend' : 'Activate'}
              </Button>
            </div>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Groups */}
        <Card>
          <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2"><Shield className="h-4 w-4 text-primary" /> Groups ({groups.length})</h3>
          {groups.length === 0 ? <p className="text-xs text-text-muted py-3">Not in any groups.</p> : (
            <div className="space-y-2">
              {groups.map((g) => (
                <div key={g.id} className="flex items-center justify-between rounded-lg border border-border p-2.5">
                  <div>
                    <p className="text-sm font-medium">{g.name}</p>
                    {g.description && <p className="text-xs text-text-muted">{g.description}</p>}
                  </div>
                  <Badge variant={g.source === 'idp_synced' ? 'info' : 'gray'}>{g.source === 'idp_synced' ? 'IdP' : 'Local'}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Devices */}
        <Card>
          <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2"><Laptop className="h-4 w-4 text-primary" /> Devices ({devices.length})</h3>
          {devices.length === 0 ? <p className="text-xs text-text-muted py-3">No devices registered.</p> : (
            <div className="space-y-2">
              {devices.map((d) => {
                const sc = d.posture_score >= 80 ? 'text-success' : d.posture_score >= 60 ? 'text-warning' : 'text-danger';
                return (
                  <div key={d.id} className="rounded-lg border border-border p-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium">{d.name}</p>
                      <Badge variant={enrollVar[d.enrollment_status] || 'gray'} dot>{d.enrollment_status}</Badge>
                    </div>
                    <p className="text-xs text-text-muted">{d.os} · Score: <span className={sc}>{d.posture_score}/100</span></p>
                    <div className="mt-2 flex gap-1">
                      {d.enrollment_status === 'pending' && <Button variant="accent" size="sm" onClick={() => updateDevice(d.id, { enrollment_status: 'enrolled' })}>Approve</Button>}
                      {d.enrollment_status === 'enrolled' && <Button variant="danger" size="sm" onClick={() => updateDevice(d.id, { enrollment_status: 'quarantined' })}>Quarantine</Button>}
                      {d.enrollment_status === 'quarantined' && (
                        <>
                          <Button variant="accent" size="sm" onClick={() => updateDevice(d.id, { enrollment_status: 'enrolled' })}>Restore</Button>
                          <Button variant="danger" size="sm" onClick={() => updateDevice(d.id, { enrollment_status: 'revoked' })}>Revoke</Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Recent events */}
        <Card>
          <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /> Recent Access</h3>
          {events.length === 0 ? <p className="text-xs text-text-muted py-3">No access events.</p> : (
            <div className="space-y-1.5 max-h-80 overflow-y-auto">
              {events.map((ev) => (
                <div key={ev.id} className="flex items-center justify-between rounded-md bg-surface-1 px-3 py-2 text-xs">
                  <div className="flex items-center gap-2">
                    <Badge variant={ev.outcome === 'allowed' || ev.outcome === 'allow' ? 'success' : 'danger'} dot>{ev.outcome}</Badge>
                    <span>{ev.app_name || '—'}</span>
                  </div>
                  <span className="text-text-muted">{formatRelative(ev.timestamp)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
