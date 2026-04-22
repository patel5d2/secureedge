import { useEffect, useState, useCallback } from 'react';
import { Plus, X, Users, Pencil, Trash2, Search, UserPlus } from 'lucide-react';
import { api, type Group, type GroupsResponse, type User, type UsersResponse } from '../../lib/api';
import Badge from '../../design-system/components/Badge';
import Button from '../../design-system/components/Button';
import Input from '../../design-system/components/Input';
import Avatar from '../../design-system/components/Avatar';
import Spinner from '../../design-system/components/Spinner';
import { useToast } from '../../hooks/useToast';

interface GroupDetail extends Group {
  members?: { id: string; email: string; full_name: string; department?: string; role: string; status: string }[];
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

  // Form state
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formSource, setFormSource] = useState<'local' | 'idp_synced'>('local');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await api.get<GroupsResponse>('/admin/groups'); setGroups(r.groups); } catch { /* noop */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const selectGroup = async (g: Group) => {
    try {
      const r = await api.get<{ group: Group; members: GroupDetail['members'] }>(`/admin/groups/${g.id}`);
      setSelected({ ...r.group, members: r.members });
    } catch { push('Failed to load group.', 'error'); }
  };

  const openCreate = () => { setEditing(null); setFormName(''); setFormDesc(''); setFormSource('local'); setFormOpen(true); };
  const openEdit = (g: Group) => { setEditing(g); setFormName(g.name); setFormDesc(g.description || ''); setFormSource(g.source || 'local'); setFormOpen(true); };

  const saveGroup = async () => {
    if (!formName.trim()) { push('Name is required.', 'error'); return; }
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
    } catch (e: unknown) { push(e instanceof Error ? e.message : 'Failed to save.', 'error'); }
    finally { setSaving(false); }
  };

  const deleteGroup = async (id: string) => {
    if (!confirm('Delete this group? Members will be removed from the group.')) return;
    try {
      await api.del(`/admin/groups/${id}`);
      push('Group deleted.', 'success');
      if (selected?.id === id) setSelected(null);
      load();
    } catch { push('Failed to delete.', 'error'); }
  };

  const openAddMember = async () => {
    try {
      const r = await api.get<UsersResponse>('/admin/users');
      setAllUsers(r.users);
    } catch { /* noop */ }
    setMemberSearch('');
    setAddMemberOpen(true);
  };

  const addMember = async (userId: string) => {
    if (!selected) return;
    try {
      await api.post(`/admin/groups/${selected.id}/members`, { userId });
      push('Member added.', 'success');
      selectGroup(selected);
    } catch { push('Failed to add member.', 'error'); }
  };

  const removeMember = async (userId: string) => {
    if (!selected) return;
    try {
      await api.del(`/admin/groups/${selected.id}/members/${userId}`);
      push('Member removed.', 'success');
      selectGroup(selected);
    } catch { push('Failed to remove member.', 'error'); }
  };

  if (loading) return <div className="flex h-64 items-center justify-center"><Spinner size={32} /></div>;

  const memberIds = new Set(selected?.members?.map((m) => m.id) || []);
  const filteredUsers = allUsers.filter((u) => {
    if (memberIds.has(u.id)) return false;
    if (!memberSearch) return true;
    const q = memberSearch.toLowerCase();
    return (u.full_name || u.name || '').toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Groups</h1>
          <p className="text-sm text-text-muted mt-1">{groups.length} group{groups.length !== 1 ? 's' : ''}</p>
        </div>
        <Button variant="accent" leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>Create Group</Button>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        {/* Groups list */}
        <div className="xl:col-span-2 space-y-2">
          {groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border py-12">
              <Users className="h-10 w-10 text-text-muted mb-2" />
              <p className="text-sm font-medium text-text-primary">No groups yet</p>
              <p className="text-xs text-text-muted mt-1 mb-3">Create groups to manage user access</p>
              <Button variant="accent" size="sm" onClick={openCreate}>Create Group</Button>
            </div>
          ) : groups.map((g) => (
            <div key={g.id} onClick={() => selectGroup(g)} className={`flex items-center justify-between rounded-xl border p-4 cursor-pointer transition-all group ${selected?.id === g.id ? 'border-primary bg-primary/5 shadow-sm' : 'border-border bg-white hover:shadow-sm'}`}>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-2"><Users className="h-4 w-4 text-primary" /></div>
                <div>
                  <p className="text-sm font-medium text-text-primary">{g.name}</p>
                  <p className="text-xs text-text-muted">{g.member_count ?? 0} members {g.source === 'idp_synced' ? '· IdP Synced' : ''}</p>
                </div>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => openEdit(g)} className="rounded p-1.5 text-text-muted hover:bg-surface-2"><Pencil className="h-3.5 w-3.5" /></button>
                <button onClick={() => deleteGroup(g.id)} className="rounded p-1.5 text-text-muted hover:bg-danger/10 hover:text-danger"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          ))}
        </div>

        {/* Group detail */}
        <div className="xl:col-span-3">
          {!selected ? (
            <div className="flex items-center justify-center rounded-2xl border border-border bg-surface-1 py-20">
              <p className="text-sm text-text-muted">Select a group to view members</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-white p-6 space-y-5">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold text-text-primary">{selected.name}</h2>
                  {selected.description && <p className="text-sm text-text-muted mt-1">{selected.description}</p>}
                  <div className="flex gap-2 mt-2">
                    <Badge variant={selected.source === 'idp_synced' ? 'info' : 'gray'}>{selected.source === 'idp_synced' ? 'IdP Synced' : 'Local'}</Badge>
                    <span className="text-xs text-text-muted">{selected.members?.length ?? 0} members</span>
                  </div>
                </div>
                <Button variant="secondary" size="sm" leftIcon={<UserPlus className="h-3.5 w-3.5" />} onClick={openAddMember}>Add Member</Button>
              </div>

              <div className="space-y-2">
                {(selected.members || []).length === 0 ? (
                  <p className="py-6 text-center text-sm text-text-muted">No members in this group.</p>
                ) : (selected.members || []).map((m) => (
                  <div key={m.id} className="flex items-center gap-3 rounded-lg border border-border p-3 group">
                    <Avatar name={m.full_name} size="xs" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-text-primary">{m.full_name}</p>
                      <p className="text-xs text-text-muted">{m.email} {m.department ? `· ${m.department}` : ''}</p>
                    </div>
                    <Badge variant={m.role === 'admin' ? 'primary' : 'gray'}>{m.role}</Badge>
                    <button onClick={() => removeMember(m.id)} className="rounded p-1 text-text-muted opacity-0 group-hover:opacity-100 hover:text-danger transition-all" title="Remove"><X className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Group Modal */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setFormOpen(false)}>
          <div className="w-full max-w-md rounded-2xl border border-border bg-white p-6 shadow-2xl animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-text-primary">{editing ? 'Edit Group' : 'Create Group'}</h2>
              <button onClick={() => setFormOpen(false)} className="rounded-lg p-1.5 text-text-muted hover:bg-surface-2"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4">
              <Input id="group-name" label="Group name" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Engineering" required />
              <Input id="group-desc" label="Description" value={formDesc} onChange={(e) => setFormDesc(e.target.value)} placeholder="What is this group for?" />
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Source</label>
                <select value={formSource} onChange={(e) => setFormSource(e.target.value as 'local' | 'idp_synced')} className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none">
                  <option value="local">Local (managed manually)</option>
                  <option value="idp_synced">IdP Synced (Azure AD / Okta)</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border">
              <Button variant="ghost" onClick={() => setFormOpen(false)}>Cancel</Button>
              <Button variant="accent" onClick={saveGroup} loading={saving}>{editing ? 'Save' : 'Create Group'}</Button>
            </div>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {addMemberOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setAddMemberOpen(false)}>
          <div className="w-full max-w-md rounded-2xl border border-border bg-white p-6 shadow-2xl animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-text-primary">Add Member</h2>
              <button onClick={() => setAddMemberOpen(false)} className="rounded-lg p-1.5 text-text-muted hover:bg-surface-2"><X className="h-5 w-5" /></button>
            </div>
            <Input id="member-search" placeholder="Search users…" value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)} leftIcon={<Search className="h-4 w-4" />} />
            <div className="mt-3 max-h-64 space-y-1 overflow-y-auto">
              {filteredUsers.length === 0 ? (
                <p className="py-6 text-center text-sm text-text-muted">No users available to add.</p>
              ) : filteredUsers.slice(0, 20).map((u) => (
                <button key={u.id} onClick={() => { addMember(u.id); setAddMemberOpen(false); }} className="flex w-full items-center gap-3 rounded-lg p-2.5 text-left hover:bg-surface-1 transition-colors">
                  <Avatar name={u.full_name || u.name} size="xs" />
                  <div>
                    <p className="text-sm font-medium text-text-primary">{u.full_name || u.name}</p>
                    <p className="text-xs text-text-muted">{u.email}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
