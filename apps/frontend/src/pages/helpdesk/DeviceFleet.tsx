import { useEffect, useState, useMemo } from 'react';
import { Search, Laptop, ShieldCheck, ShieldAlert, ShieldX } from 'lucide-react';
import { api, type Device, type DevicesResponse } from '../../lib/api';
import { formatRelative } from '../../lib/format';
import Badge from '../../design-system/components/Badge';
import Button from '../../design-system/components/Button';
import Input from '../../design-system/components/Input';
import Spinner from '../../design-system/components/Spinner';
import { useToast } from '../../hooks/useToast';

const enrollVar = { enrolled: 'success', pending: 'warning', quarantined: 'danger', revoked: 'gray', unenrolled: 'gray' } as const;

export default function DeviceFleet() {
  const [devices, setDevices] = useState<(Device & { owner_name?: string; owner_email?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<string>('all');
  const { push } = useToast();

  const load = () => {
    setLoading(true);
    api.get<DevicesResponse>('/helpdesk/devices').then((r) => { setDevices(r.devices); setLoading(false); }).catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let list = devices;
    if (search) { const q = search.toLowerCase(); list = list.filter((d) => d.name.toLowerCase().includes(q) || (d.owner_name || '').toLowerCase().includes(q) || d.os.toLowerCase().includes(q)); }
    if (filter === 'failing') list = list.filter((d) => d.posture_score < 80 || !d.managed || !(d.disk_encrypted ?? d.encrypted));
    if (filter === 'quarantined') list = list.filter((d) => d.enrollment_status === 'quarantined');
    if (filter === 'pending') list = list.filter((d) => d.enrollment_status === 'pending');
    return list;
  }, [devices, search, filter]);

  const updateDevice = async (id: string, update: Record<string, unknown>) => {
    try {
      await api.put(`/admin/devices/${id}`, update);
      push('Device updated.', 'success');
      load();
    } catch { push('Failed to update device.', 'error'); }
  };

  if (loading) return <div className="flex h-64 items-center justify-center"><Spinner size={32} /></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-white">Device Fleet</h1>
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-72"><Input id="device-search" placeholder="Search devices…" value={search} onChange={(e) => setSearch(e.target.value)} leftIcon={<Search className="h-4 w-4" />} className="!bg-[#161B22] !text-white !border-[#30363D] placeholder:!text-white/30" /></div>
        <div className="flex gap-2">
          {['all', 'pending', 'failing', 'quarantined'].map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${filter === f ? 'bg-white/20 text-white' : 'text-white/40 hover:text-white/70'}`}>{f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}</button>
          ))}
        </div>
        <span className="ml-auto text-xs text-white/30">{filtered.length} device{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-white/30">No devices match.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((d) => {
            const sc = d.posture_score >= 80 ? 'text-green-400' : d.posture_score >= 60 ? 'text-yellow-400' : 'text-red-400';
            const ScoreIcon = d.posture_score >= 80 ? ShieldCheck : d.posture_score >= 60 ? ShieldAlert : ShieldX;
            return (
              <div key={d.id} className="rounded-xl border border-[#30363D] bg-[#161B22] p-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/5"><Laptop className="h-5 w-5 text-white/50" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2"><p className="text-sm font-medium text-white">{d.name}</p><Badge variant={enrollVar[d.enrollment_status] || 'gray'} dot>{d.enrollment_status}</Badge></div>
                    <p className="text-xs text-white/40">{d.owner_name || '—'} · {d.os} · Last check {formatRelative(d.last_posture_check)}</p>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-1"><ScoreIcon className={`h-4 w-4 ${sc}`} /><span className={`font-semibold ${sc}`}>{d.posture_score}/100</span></div>
                    <span className={d.managed ? 'text-green-400' : 'text-red-400'}>{d.managed ? 'Managed' : 'Unmanaged'}</span>
                    <span className={(d.disk_encrypted ?? d.encrypted) ? 'text-green-400' : 'text-red-400'}>{(d.disk_encrypted ?? d.encrypted) ? 'Encrypted' : 'Unencrypted'}</span>
                  </div>
                  <div className="flex gap-2">
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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
