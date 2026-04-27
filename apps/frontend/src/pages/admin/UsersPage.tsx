import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, UserX, UserCheck, Pencil } from 'lucide-react';
import { api, type User, type UsersResponse } from '../../lib/api';
import Button from '../../design-system/components/Button';
import Input from '../../design-system/components/Input';
import Avatar from '../../design-system/components/Avatar';
import Spinner from '../../design-system/components/Spinner';
import { useToast } from '../../hooks/useToast';
import { formatRelative } from '../../lib/format';
import UserFormModal from './UserFormModal';

const roleConfig: Record<string, { label: string; tint: string; fg: string }> = {
  admin: { label: 'Admin', tint: '#F0EFEB', fg: '#0E0D0A' },
  helpdesk: { label: 'Helpdesk', tint: '#FDF2DC', fg: '#8C5A0D' },
  user: { label: 'User', tint: '#F0EFEB', fg: '#6A655D' },
  employee: { label: 'User', tint: '#F0EFEB', fg: '#6A655D' },
};

const statusConfig: Record<string, { label: string; bg: string; fg: string; dot: string }> = {
  active: { label: 'Active', bg: '#E8F5E7', fg: '#1F6E20', dot: '#3CB13A' },
  suspended: { label: 'Suspended', bg: '#FDF2DC', fg: '#8C5A0D', dot: '#D89422' },
  deactivated: { label: 'Deactivated', bg: '#FBEAE7', fg: '#8B2613', dot: '#D1432B' },
  invited: { label: 'Invited', bg: '#EAF1F9', fg: '#1F4B7D', dot: '#3B7CC7' },
};

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
    try {
      const r = await api.get<UsersResponse>('/admin/users');
      setUsers(r.users);
    } catch {
      /* noop */
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = search
    ? users.filter((u) => {
        const q = search.toLowerCase();
        return (
          (u.full_name || u.name || '').toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.department || '').toLowerCase().includes(q)
        );
      })
    : users;

  const toggleStatus = async (user: User) => {
    const newStatus = user.status === 'active' ? 'suspended' : 'active';
    try {
      await api.put(`/admin/users/${user.id}`, { status: newStatus });
      push(`User ${newStatus === 'suspended' ? 'suspended' : 'activated'}.`, 'success');
      load();
    } catch {
      push('Failed to update user.', 'error');
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
            {users.length} total · {users.filter((u) => u.status === 'active').length} active
          </p>
          <h1 className="mt-1 font-display text-[44px] leading-[1.05] tracking-[-0.02em] text-ink-900">
            Users
          </h1>
        </div>
        <Button
          variant="signal"
          leftIcon={<Plus className="h-4 w-4" strokeWidth={1.75} />}
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
        >
          Create user
        </Button>
      </header>

      <div className="w-[280px]">
        <Input
          id="user-search"
          placeholder="Search users…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftIcon={<Search className="h-4 w-4" strokeWidth={1.75} />}
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-ink-100 bg-white">
        {filtered.length === 0 ? (
          <p className="py-12 text-center text-[13px] text-ink-400">No users match your search.</p>
        ) : (
          filtered.map((u) => {
            const role = roleConfig[u.role as string] || roleConfig.user;
            const status = statusConfig[u.status as string] || statusConfig.active;
            return (
              <div
                key={u.id}
                className="group flex cursor-pointer items-center gap-4 border-b border-ink-100/70 px-5 py-3.5 transition-colors last:border-b-0 hover:bg-ink-50/60"
                onClick={() => navigate(`/admin/users/${u.id}`)}
              >
                <Avatar name={u.full_name || u.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[13px] font-semibold text-ink-900">
                      {u.full_name || u.name}
                    </p>
                    <span
                      className="rounded-full px-1.5 py-[1px] font-mono text-[9px] uppercase tracking-[0.06em]"
                      style={{ background: role.tint, color: role.fg }}
                    >
                      {role.label}
                    </span>
                  </div>
                  <p className="truncate font-mono text-[11px] text-ink-500">
                    {u.email}
                    {u.department ? ` · ${u.department}` : ''}
                  </p>
                </div>

                <span
                  className="hidden items-center gap-1.5 rounded-full px-2 py-[3px] text-[10px] font-medium md:inline-flex"
                  style={{ background: status.bg, color: status.fg }}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: status.dot }}
                  />
                  {status.label}
                </span>

                <div className="hidden text-right font-mono text-[10px] text-ink-400 lg:block">
                  {u.last_login_at ? formatRelative(u.last_login_at) : 'Never signed in'}
                </div>

                <div
                  className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => {
                      setEditing(u);
                      setModalOpen(true);
                    }}
                    className="rounded-md p-2 text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-900"
                    title="Edit"
                  >
                    <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </button>
                  <button
                    onClick={() => toggleStatus(u)}
                    className="rounded-md p-2 text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-900"
                    title={u.status === 'active' ? 'Suspend' : 'Activate'}
                  >
                    {u.status === 'active' ? (
                      <UserX className="h-3.5 w-3.5" strokeWidth={1.75} />
                    ) : (
                      <UserCheck className="h-3.5 w-3.5" strokeWidth={1.75} />
                    )}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <UserFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={load}
        existing={editing}
      />
    </div>
  );
}
