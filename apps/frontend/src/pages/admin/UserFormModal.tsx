import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { api, type User } from '../../lib/api';
import Button from '../../design-system/components/Button';
import Input from '../../design-system/components/Input';
import { useToast } from '../../hooks/useToast';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  existing?: User | null;
}

export default function UserFormModal({ open, onClose, onSaved, existing }: Props) {
  const isEdit = !!existing;
  const { push } = useToast();
  const [saving, setSaving] = useState(false);

  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'admin' | 'helpdesk' | 'user'>('user');
  const [department, setDepartment] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (existing) {
      setEmail(existing.email);
      setFullName(existing.full_name || existing.name || '');
      setRole((existing.role as 'admin' | 'helpdesk' | 'user') || 'user');
      setDepartment(existing.department || '');
      setPassword('');
    } else {
      setEmail(''); setFullName(''); setRole('user'); setDepartment(''); setPassword('');
    }
  }, [existing, open]);

  const submit = async () => {
    if (!email.trim() || !fullName.trim()) { push('Email and full name are required.', 'error'); return; }
    if (!isEdit && password.length > 0 && password.length < 6) { push('Password must be at least 6 characters.', 'error'); return; }
    setSaving(true);
    try {
      if (isEdit) {
        const body: Record<string, unknown> = { full_name: fullName, role, department: department || undefined };
        if (password) body.password = password;
        await api.put(`/admin/users/${existing!.id}`, body);
        push('User updated.', 'success');
      } else {
        await api.post('/admin/users', { email, full_name: fullName, role, department: department || undefined, password: password || undefined });
        push('User created.', 'success');
      }
      onSaved();
      onClose();
    } catch (e: unknown) {
      push(e instanceof Error ? e.message : 'Failed to save.', 'error');
    } finally { setSaving(false); }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-border bg-white p-6 shadow-2xl animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-text-primary">{isEdit ? 'Edit User' : 'Create User'}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-text-muted hover:bg-surface-2"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-4">
          <Input id="user-email" label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@company.com" required disabled={isEdit} />
          <Input id="user-name" label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Smith" required />

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value as 'admin' | 'helpdesk' | 'user')} className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors">
              <option value="user">User</option>
              <option value="helpdesk">Helpdesk / SOC Analyst</option>
              <option value="admin">Administrator</option>
            </select>
          </div>

          <Input id="user-dept" label="Department" value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="e.g. Engineering, Marketing" />

          <Input id="user-password" label={isEdit ? 'New password (leave blank to keep)' : 'Password'} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={isEdit ? '••••••••' : 'Minimum 6 characters'} />
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="accent" onClick={submit} loading={saving}>{isEdit ? 'Save Changes' : 'Create User'}</Button>
        </div>
      </div>
    </div>
  );
}
