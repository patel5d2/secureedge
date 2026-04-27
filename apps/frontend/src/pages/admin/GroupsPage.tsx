import { useEffect, useState, useCallback } from 'react';
import { Plus, X, Users, Pencil, Trash2, Search, UserPlus } from 'lucide-react';
import {
  api,
  type Group,
  type GroupsResponse,
  type User,
  type UsersResponse,
} from '../../lib/api';
import Button from '../../design-system/components/Button';
import Input from '../../design-system/components/Input';
import Avatar from '../../design-system/components/Avatar';
import Spinner from '../../design-system/components/Spinner';
import { useToast } from '../../hooks/useToast';

interface GroupDetail extends Group {
  members?: {
    id: string;
    email: string;
    full_name: string;
    department?: string;
    role: string;
    status: string;
  }[];
}

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<GroupDetail | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Group | null>(null);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const { push } = useToast();

  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formSource, setFormSource] = useState<'local' | 'idp_synced'>('local');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get<GroupsResponse>('/admin/groups');
      setGroups(r.groups);
    } catch {
      /* noop */
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const selectGroup = async (g: Group) => {
    try {
      const r = await api.get<{ group: Group; members: GroupDetail['members'] }>(
        `/admin/groups/${g.id}`
      );
      setSelected({ ...r.group, members: r.members });
    } catch {
      push('Failed to load group.', 'error');
    }
  };

  const openCreate = () => {
    setEditing(null);
    setFormName('');
    setFormDesc('');
    setFormSource('local');
    setFormOpen(true);
  };
  const openEdit = (g: Group) => {
    setEditing(g);
    setFormName(g.name);
    setFormDesc(g.description || '');
    setFormSource(g.source || 'local');
    setFormOpen(true);
  };

  const saveGroup = async () => {
    if (!formName.trim()) {
      push('Name is required.', 'error');
      return;
    }
    setSaving(true);
    try {
      const body = { name: formName, description: formDesc || undefined, source: formSource };
      if (editing) {
        await api.put(`/admin/groups/${editing.id}`, body);
        push('Group updated.', 'success');
      } else {
        await api.post('/admin/groups', body);
        push('Group created.', 'success');
      }
      setFormOpen(false);
      load();
      if (selected && editing && editing.id === selected.id) selectGroup({ ...selected, ...body });
    } catch (e: unknown) {
      push(e instanceof Error ? e.message : 'Failed to save.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const deleteGroup = async (id: string) => {
    if (!confirm('Delete this group? Members will be removed from the group.')) return;
    try {
      await api.del(`/admin/groups/${id}`);
      push('Group deleted.', 'success');
      if (selected?.id === id) setSelected(null);
      load();
    } catch {
      push('Failed to delete.', 'error');
    }
  };

  const openAddMember = async () => {
    try {
      const r = await api.get<UsersResponse>('/admin/users');
      setAllUsers(r.users);
    } catch {
      /* noop */
    }
    setMemberSearch('');
    setAddMemberOpen(true);
  };

  const addMember = async (userId: string) => {
    if (!selected) return;
    try {
      await api.post(`/admin/groups/${selected.id}/members`, { userId });
      push('Member added.', 'success');
      selectGroup(selected);
    } catch {
      push('Failed to add member.', 'error');
    }
  };

  const removeMember = async (userId: string) => {
    if (!selected) return;
    try {
      await api.del(`/admin/groups/${selected.id}/members/${userId}`);
      push('Member removed.', 'success');
      selectGroup(selected);
    } catch {
      push('Failed to remove member.', 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size={32} />
      </div>
    );
  }

  const memberIds = new Set(selected?.members?.map((m) => m.id) || []);
  const filteredUsers = allUsers.filter((u) => {
    if (memberIds.has(u.id)) return false;
    if (!memberSearch) return true;
    const q = memberSearch.toLowerCase();
    return (
      (u.full_name || u.name || '').toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between border-b border-ink-100 pb-6">
        <div>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-400">
            {groups.length} group{groups.length !== 1 ? 's' : ''}
          </p>
          <h1 className="mt-1 font-display text-[44px] leading-[1.05] tracking-[-0.02em] text-ink-900">
            Groups
          </h1>
        </div>
        <Button
          variant="signal"
          leftIcon={<Plus className="h-4 w-4" strokeWidth={1.75} />}
          onClick={openCreate}
        >
          Create group
        </Button>
      </header>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        {/* Groups list */}
        <div className="space-y-2 xl:col-span-2">
          {groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-ink-200 py-12">
              <Users className="mb-3 h-8 w-8 text-ink-400" strokeWidth={1.5} />
              <p className="font-display text-[20px] leading-tight text-ink-900">No groups yet</p>
              <p className="mt-1 mb-3 text-[12px] text-ink-400">
                Create groups to manage access at scale
              </p>
              <Button variant="signal" size="sm" onClick={openCreate}>
                Create group
              </Button>
            </div>
          ) : (
            groups.map((g) => {
              const active = selected?.id === g.id;
              return (
                <div
                  key={g.id}
                  onClick={() => selectGroup(g)}
                  className={`group flex cursor-pointer items-center justify-between rounded-lg border p-4 transition-all ${
                    active
                      ? 'border-signal-500 bg-signal-500/[0.04]'
                      : 'border-ink-100 bg-white hover:border-ink-200'
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-md ${
                        active ? 'bg-signal-500 text-ink-0' : 'bg-ink-50 text-ink-700'
                      }`}
                    >
                      <Users className="h-4 w-4" strokeWidth={1.75} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-ink-900">{g.name}</p>
                      <p className="font-mono text-[10px] text-ink-400">
                        {g.member_count ?? 0} members
                        {g.source === 'idp_synced' ? ' · IdP synced' : ''}
                      </p>
                    </div>
                  </div>
                  <div
                    className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => openEdit(g)}
                      className="rounded p-1.5 text-ink-500 hover:bg-ink-100"
                    >
                      <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </button>
                    <button
                      onClick={() => deleteGroup(g.id)}
                      className="rounded p-1.5 text-ink-500 hover:bg-[#FBEAE7] hover:text-[#D1432B]"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Group detail */}
        <div className="xl:col-span-3">
          {!selected ? (
            <div className="flex items-center justify-center rounded-lg border border-dashed border-ink-200 py-24">
              <p className="font-display text-[22px] leading-tight text-ink-400">
                Select a group to view its members.
              </p>
            </div>
          ) : (
            <div className="space-y-5 rounded-lg border border-ink-100 bg-white p-6">
              <div className="flex items-start justify-between border-b border-ink-100 pb-5">
                <div>
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-400">
                    {selected.source === 'idp_synced' ? 'IdP synced' : 'Local group'} ·{' '}
                    {selected.members?.length ?? 0} members
                  </p>
                  <h2 className="mt-1 font-display text-[28px] leading-tight tracking-[-0.02em] text-ink-900">
                    {selected.name}
                  </h2>
                  {selected.description && (
                    <p className="mt-1 text-[13px] text-ink-500">{selected.description}</p>
                  )}
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<UserPlus className="h-3.5 w-3.5" strokeWidth={1.75} />}
                  onClick={openAddMember}
                >
                  Add member
                </Button>
              </div>

              <div className="space-y-1.5">
                {(selected.members || []).length === 0 ? (
                  <p className="py-6 text-center text-[13px] text-ink-400">
                    No members in this group.
                  </p>
                ) : (
                  (selected.members || []).map((m) => (
                    <div
                      key={m.id}
                      className="group flex items-center gap-3 rounded-md border border-ink-100 p-3"
                    >
                      <Avatar name={m.full_name} size="xs" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-ink-900">
                          {m.full_name}
                        </p>
                        <p className="truncate font-mono text-[10px] text-ink-400">
                          {m.email}
                          {m.department ? ` · ${m.department}` : ''}
                        </p>
                      </div>
                      <span className="rounded-full bg-ink-50 px-2 py-[2px] font-mono text-[9px] uppercase tracking-[0.06em] text-ink-500">
                        {m.role}
                      </span>
                      <button
                        onClick={() => removeMember(m.id)}
                        className="rounded p-1 text-ink-400 opacity-0 transition-all hover:text-[#D1432B] group-hover:opacity-100"
                        title="Remove"
                      >
                        <X className="h-4 w-4" strokeWidth={1.75} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create / Edit Group Modal */}
      {formOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 backdrop-blur-sm animate-fade-in"
          onClick={() => setFormOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-lg border border-ink-100 bg-white p-6 shadow-[0_24px_64px_-16px_rgba(14,13,10,0.3)] animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-display text-[24px] leading-tight tracking-[-0.02em] text-ink-900">
                {editing ? 'Edit group' : 'Create group'}
              </h2>
              <button
                onClick={() => setFormOpen(false)}
                className="rounded-md p-1.5 text-ink-500 hover:bg-ink-50"
              >
                <X className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </div>
            <div className="space-y-4">
              <Input
                id="group-name"
                label="Group name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Engineering"
                required
              />
              <Input
                id="group-desc"
                label="Description"
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                placeholder="What is this group for?"
              />
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-500">
                  Source
                </label>
                <select
                  value={formSource}
                  onChange={(e) =>
                    setFormSource(e.target.value as 'local' | 'idp_synced')
                  }
                  className="w-full rounded-md border border-ink-100 bg-white px-3 py-2 text-[13px] focus:border-signal-500 focus:outline-none"
                >
                  <option value="local">Local — managed manually</option>
                  <option value="idp_synced">IdP synced — Azure AD / Okta</option>
                </select>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3 border-t border-ink-100 pt-4">
              <Button variant="ghost" onClick={() => setFormOpen(false)}>
                Cancel
              </Button>
              <Button variant="signal" onClick={saveGroup} loading={saving}>
                {editing ? 'Save' : 'Create group'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {addMemberOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 backdrop-blur-sm animate-fade-in"
          onClick={() => setAddMemberOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-lg border border-ink-100 bg-white p-6 shadow-[0_24px_64px_-16px_rgba(14,13,10,0.3)] animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-[24px] leading-tight tracking-[-0.02em] text-ink-900">
                Add member
              </h2>
              <button
                onClick={() => setAddMemberOpen(false)}
                className="rounded-md p-1.5 text-ink-500 hover:bg-ink-50"
              >
                <X className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </div>
            <Input
              id="member-search"
              placeholder="Search users…"
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              leftIcon={<Search className="h-4 w-4" strokeWidth={1.75} />}
            />
            <div className="mt-3 max-h-64 space-y-1 overflow-y-auto">
              {filteredUsers.length === 0 ? (
                <p className="py-6 text-center text-[13px] text-ink-400">
                  No users available to add.
                </p>
              ) : (
                filteredUsers.slice(0, 20).map((u) => (
                  <button
                    key={u.id}
                    onClick={() => {
                      addMember(u.id);
                      setAddMemberOpen(false);
                    }}
                    className="flex w-full items-center gap-3 rounded-md p-2.5 text-left transition-colors hover:bg-ink-50"
                  >
                    <Avatar name={u.full_name || u.name} size="xs" />
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-ink-900">
                        {u.full_name || u.name}
                      </p>
                      <p className="truncate font-mono text-[10px] text-ink-400">{u.email}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
