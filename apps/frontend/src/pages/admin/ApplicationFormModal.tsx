import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { api, type Application } from '../../lib/api';
import Button from '../../design-system/components/Button';
import Input from '../../design-system/components/Input';
import { useToast } from '../../hooks/useToast';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  existing?: Application | null;
}

export default function ApplicationFormModal({ open, onClose, onSaved, existing }: Props) {
  const isEdit = !!existing;
  const { push } = useToast();
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [appUrl, setAppUrl] = useState('');
  const [protocol, setProtocol] = useState<'https' | 'ssh' | 'rdp'>('https');
  const [mfaRequired, setMfaRequired] = useState(true);
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setSlug(existing.slug || '');
      setAppUrl(existing.app_url || existing.url || '');
      setProtocol((existing.protocol as 'https' | 'ssh' | 'rdp') || 'https');
      setMfaRequired(existing.required_mfa ?? existing.mfa_required ?? true);
      setDescription(existing.description || '');
    } else {
      setName(''); setSlug(''); setAppUrl(''); setProtocol('https'); setMfaRequired(true); setDescription('');
    }
  }, [existing, open]);

  // Auto-generate slug from name
  const onNameChange = (val: string) => {
    setName(val);
    if (!isEdit) {
      setSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
    }
  };

  const submit = async () => {
    if (!name.trim()) { push('Name is required.', 'error'); return; }
    if (!slug.trim()) { push('Slug is required.', 'error'); return; }
    if (!appUrl.trim()) { push('URL is required.', 'error'); return; }
    setSaving(true);
    const body = { name, slug, app_url: appUrl, protocol, required_mfa: mfaRequired, description: description || undefined };
    try {
      if (isEdit) {
        await api.put(`/admin/applications/${existing!.id}`, body);
        push('Application updated.', 'success');
      } else {
        await api.post('/admin/applications', body);
        push('Application registered.', 'success');
      }
      onSaved();
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to save.';
      push(msg, 'error');
    } finally { setSaving(false); }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-border bg-white p-6 shadow-2xl animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-text-primary">{isEdit ? 'Edit Application' : 'Register Application'}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-text-muted hover:bg-surface-2"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-4">
          <Input id="app-name" label="Application name" value={name} onChange={(e) => onNameChange(e.target.value)} placeholder="e.g. Jira, GitLab, Internal Wiki" required />
          <Input id="app-slug" label="Slug" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="e.g. jira" required helperText="Used in URLs and policy rules. Lowercase letters, numbers, hyphens only." />
          <Input id="app-url" label="Application URL" value={appUrl} onChange={(e) => setAppUrl(e.target.value)} placeholder="https://jira.company.com" required />

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Protocol</label>
            <select value={protocol} onChange={(e) => setProtocol(e.target.value as 'https' | 'ssh' | 'rdp')} className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors">
              <option value="https">HTTPS (Web Application)</option>
              <option value="ssh">SSH (Secure Shell)</option>
              <option value="rdp">RDP (Remote Desktop)</option>
            </select>
          </div>

          <Input id="app-desc" label="Description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description of this application" />

          <label className="flex items-center gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-surface-1 transition-colors">
            <input type="checkbox" checked={mfaRequired} onChange={(e) => setMfaRequired(e.target.checked)} className="h-4 w-4 rounded border-border text-primary focus:ring-primary" />
            <div>
              <p className="text-sm font-medium text-text-primary">Require MFA</p>
              <p className="text-xs text-text-muted">Users must complete multi-factor authentication to access this application</p>
            </div>
          </label>
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="accent" onClick={submit} loading={saving}>{isEdit ? 'Save Changes' : 'Register Application'}</Button>
        </div>
      </div>
    </div>
  );
}
