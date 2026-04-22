import { useState, useEffect } from 'react';
import { X, Monitor, Laptop, Smartphone, Tablet } from 'lucide-react';
import { api, type Device } from '../../lib/api';
import Button from '../../design-system/components/Button';
import Input from '../../design-system/components/Input';
import { useToast } from '../../hooks/useToast';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  existing?: Device | null;
}

const OS_OPTIONS = [
  { label: 'macOS 15 Sequoia', value: 'macOS', version: '15.0', icon: Laptop },
  { label: 'macOS 14 Sonoma', value: 'macOS', version: '14.0', icon: Laptop },
  { label: 'Windows 11', value: 'Windows', version: '11', icon: Monitor },
  { label: 'Windows 10', value: 'Windows', version: '10', icon: Monitor },
  { label: 'Ubuntu 24.04', value: 'Linux', version: '24.04', icon: Monitor },
  { label: 'iOS 18', value: 'iOS', version: '18', icon: Smartphone },
  { label: 'Android 15', value: 'Android', version: '15', icon: Tablet },
];

export default function DeviceFormModal({ open, onClose, onSaved, existing }: Props) {
  const isEdit = !!existing;
  const { push } = useToast();
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [osIdx, setOsIdx] = useState(0);
  const [serial, setSerial] = useState('');
  const [managed, setManaged] = useState(false);
  const [diskEncrypted, setDiskEncrypted] = useState(false);
  const [firewallEnabled, setFirewallEnabled] = useState(false);

  useEffect(() => {
    if (existing) {
      setName(existing.name);
      const idx = OS_OPTIONS.findIndex((o) => o.value.toLowerCase() === existing.os?.toLowerCase());
      setOsIdx(idx >= 0 ? idx : 0);
      setSerial(existing.serial_number || '');
      setManaged(existing.managed);
      setDiskEncrypted(existing.disk_encrypted ?? existing.encrypted ?? false);
      setFirewallEnabled(existing.firewall_enabled ?? false);
    } else {
      setName(''); setOsIdx(0); setSerial(''); setManaged(false); setDiskEncrypted(false); setFirewallEnabled(false);
    }
  }, [existing, open]);

  const posturePreview = (managed ? 40 : 0) + (diskEncrypted ? 30 : 0) + (firewallEnabled ? 20 : 0) + 10;
  const postureColor = posturePreview >= 80 ? 'text-success' : posturePreview >= 60 ? 'text-warning' : 'text-danger';

  const submit = async () => {
    if (!name.trim()) { push('Device name is required.', 'error'); return; }
    setSaving(true);
    const os = OS_OPTIONS[osIdx];
    const body = {
      name, os: os.value, os_version: os.version,
      serial_number: serial || undefined,
      managed, disk_encrypted: diskEncrypted, firewall_enabled: firewallEnabled,
    };
    try {
      if (isEdit) {
        await api.put(`/portal/devices/${existing!.id}`, body);
        push('Device updated.', 'success');
      } else {
        await api.post('/portal/devices', body);
        push('Device registered! Enrollment is pending admin approval.', 'success');
      }
      onSaved();
      onClose();
    } catch (e: unknown) {
      push(e instanceof Error ? e.message : 'Failed.', 'error');
    } finally { setSaving(false); }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-border bg-white p-6 shadow-2xl animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-text-primary">{isEdit ? 'Update Device' : 'Register Device'}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-text-muted hover:bg-surface-2"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-4">
          <Input id="device-name" label="Device name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. MacBook Pro – Work" required />

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Operating System</label>
            <div className="grid grid-cols-2 gap-2">
              {OS_OPTIONS.map((os, i) => (
                <button key={i} onClick={() => setOsIdx(i)} type="button"
                  className={`flex items-center gap-2 rounded-lg border p-3 text-left text-sm transition-all ${osIdx === i ? 'border-primary bg-primary/5 text-text-primary font-medium' : 'border-border text-text-secondary hover:border-primary/50'}`}
                >
                  <os.icon className="h-4 w-4" />{os.label}
                </button>
              ))}
            </div>
          </div>

          <Input id="device-serial" label="Serial number (optional)" value={serial} onChange={(e) => setSerial(e.target.value)} placeholder="e.g. C02XL0RSJG5J" />

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">Security Posture</label>
            <div className="space-y-2">
              {[
                { label: 'MDM Managed', desc: 'Device is enrolled in mobile device management', checked: managed, set: setManaged, points: 40 },
                { label: 'Disk Encrypted', desc: 'Full disk encryption (FileVault, BitLocker, LUKS)', checked: diskEncrypted, set: setDiskEncrypted, points: 30 },
                { label: 'Firewall Enabled', desc: 'Host-based firewall is active', checked: firewallEnabled, set: setFirewallEnabled, points: 20 },
              ].map((item) => (
                <label key={item.label} className="flex items-center gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-surface-1 transition-colors">
                  <input type="checkbox" checked={item.checked} onChange={(e) => item.set(e.target.checked)} className="h-4 w-4 rounded border-border text-primary focus:ring-primary" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-text-primary">{item.label}</p>
                    <p className="text-xs text-text-muted">{item.desc}</p>
                  </div>
                  <span className="text-xs text-text-muted">+{item.points}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Posture preview */}
          <div className="rounded-lg bg-surface-1 p-4 flex items-center justify-between">
            <span className="text-sm text-text-secondary">Estimated Posture Score</span>
            <span className={`text-2xl font-bold ${postureColor}`}>{posturePreview}/100</span>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="accent" onClick={submit} loading={saving}>{isEdit ? 'Save Changes' : 'Register Device'}</Button>
        </div>
      </div>
    </div>
  );
}
