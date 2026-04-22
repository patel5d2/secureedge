import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, Laptop, Shield, ShieldCheck, ShieldX, HardDrive } from 'lucide-react';
import { api, type Device, type DevicesResponse } from '../../lib/api';
import { formatRelative } from '../../lib/format';
import Badge from '../../design-system/components/Badge';
import Button from '../../design-system/components/Button';
import Spinner from '../../design-system/components/Spinner';
import { useToast } from '../../hooks/useToast';
import DeviceFormModal from './DeviceFormModal';

const enrollVar = { enrolled: 'success', pending: 'warning', quarantined: 'danger', revoked: 'gray', unenrolled: 'gray' } as const;

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Device | null>(null);
  const { push } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await api.get<DevicesResponse>('/portal/devices'); setDevices(r.devices); } catch { /* noop */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const remove = async (id: string) => {
    if (!confirm('Remove this device? You will need to re-register it.')) return;
    try {
      await api.del(`/portal/devices/${id}`);
      push('Device removed.', 'success');
      load();
    } catch { push('Failed to remove device.', 'error'); }
  };

  if (loading) return <div className="flex h-64 items-center justify-center"><Spinner size={32} /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">My Devices</h1>
          <p className="text-sm text-text-muted mt-1">{devices.length} registered device{devices.length !== 1 ? 's' : ''}</p>
        </div>
        <Button variant="accent" leftIcon={<Plus className="h-4 w-4" />} onClick={() => { setEditing(null); setModalOpen(true); }}>Register Device</Button>
      </div>

      {devices.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border py-16">
          <Laptop className="h-12 w-12 text-text-muted mb-3" />
          <p className="text-lg font-semibold text-text-primary">No devices registered</p>
          <p className="text-sm text-text-muted mt-1 mb-4">Register a device to access protected applications</p>
          <Button variant="accent" leftIcon={<Plus className="h-4 w-4" />} onClick={() => { setEditing(null); setModalOpen(true); }}>Register Device</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {devices.map((d) => {
            const sc = d.posture_score >= 80 ? 'text-success' : d.posture_score >= 60 ? 'text-warning' : 'text-danger';
            const ScoreIcon = d.posture_score >= 80 ? ShieldCheck : d.posture_score >= 60 ? Shield : ShieldX;
            return (
              <div key={d.id} className="rounded-xl border border-border bg-white p-5 group hover:shadow-sm transition-shadow">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-2">
                    <Laptop className="h-6 w-6 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-text-primary">{d.name}</h3>
                      <Badge variant={enrollVar[d.enrollment_status] || 'gray'} dot>{d.enrollment_status}</Badge>
                    </div>
                    <p className="text-xs text-text-muted">{d.os}{d.os_version ? ` ${d.os_version}` : ''}{d.serial_number ? ` · SN: ${d.serial_number}` : ''}</p>

                    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <div className="flex items-center gap-2 text-xs">
                        <ScoreIcon className={`h-4 w-4 ${sc}`} />
                        <span className={`font-semibold ${sc}`}>{d.posture_score}/100</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <HardDrive className="h-3.5 w-3.5 text-text-muted" />
                        <span className={d.disk_encrypted || d.encrypted ? 'text-success' : 'text-danger'}>{d.disk_encrypted || d.encrypted ? 'Encrypted' : 'Not encrypted'}</span>
                      </div>
                      <div className="text-xs">
                        <span className={d.managed ? 'text-success' : 'text-text-muted'}>{d.managed ? '✓ MDM Managed' : '✗ Unmanaged'}</span>
                      </div>
                      <div className="text-xs">
                        <span className={d.firewall_enabled ? 'text-success' : 'text-text-muted'}>{d.firewall_enabled ? '✓ Firewall' : '✗ No Firewall'}</span>
                      </div>
                    </div>

                    {d.last_posture_check && <p className="mt-2 text-[11px] text-text-muted">Last posture check: {formatRelative(d.last_posture_check)}</p>}
                  </div>

                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { setEditing(d); setModalOpen(true); }} className="rounded-md p-2 text-text-muted hover:bg-surface-2 hover:text-text-primary" title="Edit"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => remove(d.id)} className="rounded-md p-2 text-text-muted hover:bg-danger/10 hover:text-danger" title="Remove"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <DeviceFormModal open={modalOpen} onClose={() => setModalOpen(false)} onSaved={load} existing={editing} />
    </div>
  );
}
