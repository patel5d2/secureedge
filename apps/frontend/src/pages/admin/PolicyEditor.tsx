import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { X, Plus, FlaskConical, CheckCircle2, XCircle, ArrowLeft } from 'lucide-react';
import { api, type Policy, type GroupsResponse, type ApplicationsResponse, type UsersResponse, type SimulateResult } from '../../lib/api';
import Button from '../../design-system/components/Button';
import Input from '../../design-system/components/Input';
import Badge from '../../design-system/components/Badge';
import Card from '../../design-system/components/Card';
import Spinner from '../../design-system/components/Spinner';
import { useToast } from '../../hooks/useToast';

type CondType = 'device_managed' | 'disk_encrypted' | 'mfa_verified' | 'time_range' | 'country';
interface Condition { type: CondType; value?: boolean; start?: string; end?: string; allowed?: string[] }

const COND_LABELS: Record<CondType, string> = { device_managed: 'Device is managed', disk_encrypted: 'Disk is encrypted', mfa_verified: 'MFA verified', time_range: 'Time range', country: 'Country whitelist' };

export default function PolicyEditor() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id;
  const navigate = useNavigate();
  const { push } = useToast();

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState(100);
  const [status, setStatus] = useState<'draft' | 'active' | 'disabled'>('draft');
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [selectedApps, setSelectedApps] = useState<string[]>([]);
  const [conditions, setConditions] = useState<Condition[]>([]);

  // Lookups
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  const [apps, setApps] = useState<{ id: string; name: string }[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string; email: string }[]>([]);

  // Simulate
  const [simUserId, setSimUserId] = useState('');
  const [simAppId, setSimAppId] = useState('');
  const [simResult, setSimResult] = useState<SimulateResult | null>(null);
  const [simulating, setSimulating] = useState(false);

  useEffect(() => {
    const promises = [
      api.get<GroupsResponse>('/admin/groups').then((r) => setGroups(r.groups.map((g) => ({ id: g.id, name: g.name })))),
      api.get<ApplicationsResponse>('/admin/applications').then((r) => setApps(r.applications.map((a) => ({ id: a.id, name: a.name })))),
      api.get<UsersResponse>('/admin/users').then((r) => setUsers(r.users.map((u) => ({ id: u.id, name: u.full_name || u.name, email: u.email })))),
    ];
    if (id) {
      promises.push(
        api.get<{ policy: Policy }>(`/admin/policies/${id}`).then((r) => {
          const p = r.policy;
          setName(p.name); setDescription(p.description || ''); setPriority(p.priority); setStatus(p.status);
          setSelectedGroups(p.rules?.who?.groupIds || p.rules?.who?.groups || []);
          setSelectedApps(p.rules?.what?.appIds || p.rules?.what?.applications || []);
          setConditions((p.rules?.conditions || []) as Condition[]);
        })
      );
    }
    Promise.all(promises).then(() => setLoading(false)).catch(() => setLoading(false));
  }, [id]);

  const addCondition = (type: CondType) => {
    if (conditions.some((c) => c.type === type)) return;
    const cond: Condition = { type };
    if (type === 'device_managed' || type === 'disk_encrypted' || type === 'mfa_verified') cond.value = true;
    if (type === 'time_range') { cond.start = '09:00'; cond.end = '18:00'; }
    if (type === 'country') cond.allowed = ['US'];
    setConditions([...conditions, cond]);
  };

  const removeCondition = (idx: number) => setConditions(conditions.filter((_, i) => i !== idx));

  const save = async (asStatus: 'draft' | 'active') => {
    if (!name.trim()) { push('Policy name is required.', 'error'); return; }
    setSaving(true);
    const body = {
      name, description, priority, status: asStatus,
      rules: { who: { groups: selectedGroups }, what: { applications: selectedApps }, conditions: conditions.map((c) => {
        if (c.type === 'time_range') return { type: c.type, start: c.start, end: c.end };
        if (c.type === 'country') return { type: c.type, allowed: c.allowed };
        return { type: c.type, value: c.value };
      })},
    };
    try {
      if (isNew) { await api.post('/admin/policies', body); push('Policy created.', 'success'); }
      else { await api.put(`/admin/policies/${id}`, body); push('Policy updated.', 'success'); }
      navigate('/admin/policies');
    } catch { push('Failed to save policy.', 'error'); }
    finally { setSaving(false); }
  };

  const simulate = async () => {
    if (!simUserId || !simAppId) { push('Select a user and app to simulate.', 'warning'); return; }
    setSimulating(true); setSimResult(null);
    try {
      const endpoint = id ? `/admin/policies/${id}/simulate` : '/admin/simulate';
      const r = await api.post<SimulateResult>(endpoint, { userId: simUserId, appId: simAppId });
      setSimResult(r);
    } catch { push('Simulation failed.', 'error'); }
    finally { setSimulating(false); }
  };

  if (loading) return <div className="flex h-64 items-center justify-center"><Spinner size={32} /></div>;

  return (
    <div className="space-y-6">
      <button onClick={() => navigate('/admin/policies')} className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary"><ArrowLeft className="h-4 w-4" /> Back to policies</button>
      <h1 className="text-2xl font-bold text-text-primary">{isNew ? 'New Policy' : 'Edit Policy'}</h1>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        {/* Builder */}
        <div className="xl:col-span-3 space-y-5">
          <Card>
            <div className="space-y-4">
              <Input id="policy-name" label="Policy name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Engineering Full Access" required />
              <Input id="policy-desc" label="Description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe what this policy does" />
              <Input id="policy-priority" label="Priority (lower = higher priority)" type="number" value={String(priority)} onChange={(e) => setPriority(Number(e.target.value))} />
            </div>
          </Card>

          {/* WHO */}
          <Card>
            <h3 className="mb-3 text-sm font-semibold text-text-primary">WHO — Groups</h3>
            <div className="flex flex-wrap gap-2 mb-3">
              {selectedGroups.map((gid) => { const g = groups.find((x) => x.id === gid); return (
                <Badge key={gid} variant="primary">{g?.name || gid}<button onClick={() => setSelectedGroups(selectedGroups.filter((x) => x !== gid))} className="ml-1"><X className="h-3 w-3" /></button></Badge>
              ); })}
            </div>
            <select className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm" value="" onChange={(e) => { if (e.target.value && !selectedGroups.includes(e.target.value)) setSelectedGroups([...selectedGroups, e.target.value]); }}>
              <option value="">Add group…</option>
              {groups.filter((g) => !selectedGroups.includes(g.id)).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </Card>

          {/* WHAT */}
          <Card>
            <h3 className="mb-3 text-sm font-semibold text-text-primary">WHAT — Applications</h3>
            <div className="flex flex-wrap gap-2 mb-3">
              {selectedApps.map((aid) => { const a = apps.find((x) => x.id === aid); return (
                <Badge key={aid} variant="info">{a?.name || aid}<button onClick={() => setSelectedApps(selectedApps.filter((x) => x !== aid))} className="ml-1"><X className="h-3 w-3" /></button></Badge>
              ); })}
            </div>
            <select className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm" value="" onChange={(e) => { if (e.target.value && !selectedApps.includes(e.target.value)) setSelectedApps([...selectedApps, e.target.value]); }}>
              <option value="">Add application…</option>
              {apps.filter((a) => !selectedApps.includes(a.id)).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Card>

          {/* CONDITIONS */}
          <Card>
            <h3 className="mb-3 text-sm font-semibold text-text-primary">CONDITIONS</h3>
            <div className="space-y-2 mb-3">
              {conditions.map((c, idx) => (
                <div key={idx} className="flex items-center justify-between rounded-md border border-border bg-surface-2 px-3 py-2 text-sm">
                  <span>{COND_LABELS[c.type]}{c.type === 'time_range' ? ` (${c.start} – ${c.end})` : c.type === 'country' ? ` (${c.allowed?.join(', ')})` : ''}</span>
                  <button onClick={() => removeCondition(idx)} className="text-text-muted hover:text-danger"><X className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
            <select className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm" value="" onChange={(e) => { if (e.target.value) addCondition(e.target.value as CondType); }}>
              <option value="">Add condition…</option>
              {(Object.keys(COND_LABELS) as CondType[]).filter((t) => !conditions.some((c) => c.type === t)).map((t) => <option key={t} value={t}>{COND_LABELS[t]}</option>)}
            </select>
          </Card>
        </div>

        {/* Test sandbox */}
        <div className="xl:col-span-2">
          <Card className="sticky top-6">
            <div className="flex items-center gap-2 mb-4"><FlaskConical className="h-4 w-4 text-accent" /><h3 className="text-sm font-semibold text-text-primary">Test Sandbox</h3></div>
            <div className="space-y-3">
              <select className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm" value={simUserId} onChange={(e) => setSimUserId(e.target.value)}>
                <option value="">Select user…</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
              </select>
              <select className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm" value={simAppId} onChange={(e) => setSimAppId(e.target.value)}>
                <option value="">Select application…</option>
                {apps.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <Button variant="secondary" size="sm" className="w-full" onClick={simulate} loading={simulating} leftIcon={<FlaskConical className="h-3.5 w-3.5" />}>Simulate</Button>
              {simResult && (
                <div className={`rounded-lg border p-4 animate-fade-in ${simResult.allowed ? 'border-success/20 bg-success/5' : 'border-danger/20 bg-danger/5'}`}>
                  <div className="flex items-center gap-2">
                    {simResult.allowed ? <CheckCircle2 className="h-5 w-5 text-success" /> : <XCircle className="h-5 w-5 text-danger" />}
                    <span className={`text-sm font-semibold ${simResult.allowed ? 'text-success' : 'text-danger'}`}>{simResult.allowed ? 'ALLOWED' : 'DENIED'}</span>
                  </div>
                  {simResult.reason && <p className="mt-2 text-xs text-text-secondary">Reason: {simResult.reason.replace(/_/g, ' ')}</p>}
                  {simResult.policyName && <p className="mt-1 text-xs text-text-muted">Policy: {simResult.policyName}</p>}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-border pt-5">
        <Button variant="ghost" onClick={() => navigate('/admin/policies')}>Cancel</Button>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => save('draft')} loading={saving}>Save as Draft</Button>
          <Button variant="accent" onClick={() => save('active')} loading={saving}>Publish Policy</Button>
        </div>
      </div>
    </div>
  );
}
