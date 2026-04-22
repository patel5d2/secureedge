import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, UserX, UserCheck } from 'lucide-react';
import { api, type User, type UsersResponse } from '../../lib/api';
import Badge from '../../design-system/components/Badge';
import Button from '../../design-system/components/Button';
import Input from '../../design-system/components/Input';
import Avatar from '../../design-system/components/Avatar';
import Spinner from '../../design-system/components/Spinner';
import { useToast } from '../../hooks/useToast';
import { formatRelative } from '../../lib/format';
import UserFormModal from './UserFormModal';

const roleVar = { admin: 'primary', helpdesk: 'accent', user: 'gray', employee: 'gray' } as const;
const statusVar = { active: 'success', suspended: 'warning', deactivated: 'danger', invited: 'info' } as const;

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const navigate = useNavigate();
  const { push } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await api.get<UsersResponse>('/admin/users'); setUsers(r.users); } catch { /* noop */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = search
    ? users.filter((u) => {
        const q = search.toLowerCase();
        return (u.full_name || u.name || '').toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.department || '').toLowerCase().includes(q);
      })
    : users;

  const toggleStatus = async (user: User) => {
    const newStatus = user.status === 'active' ? 'suspended' : 'active';
    try {
      await api.put(`/admin/users/${user.id}`, { status: newStatus });
      push(`User ${newStatus === 'suspended' ? 'suspended' : 'activated'}.`, 'success');
      load();
    } catch { push('Failed to update user.', 'error'); }
  };

  if (loading) return <div className="flex h-64 items-center justify-center"><Spinner size={32} /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Users</h1>
          <p className="text-sm text-text-muted mt-1">{users.length} total users</p>
        </div>
        <Button variant="accent" leftIcon={<Plus className="h-4 w-4" />} onClick={() => { setEditing(null); setModalOpen(true); }}>Create User</Button>
      </div>

      <div className="w-72">
        <Input id="user-search" placeholder="Search users…" value={search} onChange={(e) => setSearch(e.target.value)} leftIcon={<Search className="h-4 w-4" />} />
      </div>

      <div className="space-y-2">
        {filtered.map((u) => (
          <div key={u.id} className="flex items-center gap-4 rounded-xl border border-border bg-white p-4 hover:shadow-sm transition-shadow group cursor-pointer" onClick={() => navigate(`/admin/users/${u.id}`)}>
            <Avatar name={u.full_name || u.name} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-text-primary">{u.full_name || u.name}</p>
                <Badge variant={roleVar[u.role as keyof typeof roleVar] || 'gray'}>{u.role}</Badge>
                <Badge variant={statusVar[u.status as keyof typeof statusVar] || 'gray'} dot>{u.status}</Badge>
              </div>
              <p className="text-xs text-text-muted">{u.email} {u.department ? `· ${u.department}` : ''}</p>
            </div>
            <div className="text-xs text-text-muted text-right">
              {u.last_login_at ? `Last login ${formatRelative(u.last_login_at)}` : 'Never logged in'}
            </div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => { setEditing(u); setModalOpen(true); }} className="rounded-md p-2 text-text-muted hover:bg-surface-2 hover:text-text-primary text-xs font-medium">Edit</button>
              <button onClick={() => toggleStatus(u)} className="rounded-md p-2 text-text-muted hover:bg-surface-2 hover:text-text-primary" title={u.status === 'active' ? 'Suspend' : 'Activate'}>
                {u.status === 'active' ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="py-8 text-center text-sm text-text-muted">No users match your search.</p>}
      </div>

      <UserFormModal open={modalOpen} onClose={() => setModalOpen(false)} onSaved={load} existing={editing} />
    </div>
  );
}
