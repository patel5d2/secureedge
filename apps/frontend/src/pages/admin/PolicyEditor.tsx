import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  X,
  FlaskConical,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  Plus,
  Shield,
  Lock,
  Smartphone,
  Clock,
  Globe,
} from 'lucide-react';
import {
  api,
  type Policy,
  type GroupsResponse,
  type ApplicationsResponse,
  type UsersResponse,
  type SimulateResult,
} from '../../lib/api';
import Button from '../../design-system/components/Button';
import Input from '../../design-system/components/Input';
import Spinner from '../../design-system/components/Spinner';
import { useToast } from '../../hooks/useToast';

type CondType = 'device_managed' | 'disk_encrypted' | 'mfa_verified' | 'time_range' | 'country';
interface Condition {
  type: CondType;
  value?: boolean;
  start?: string;
  end?: string;
  allowed?: string[];
}

const COND_META: Record<CondType, { label: string; icon: typeof Shield; blurb: string }> = {
  device_managed: { label: 'Device is managed', icon: Smartphone, blurb: 'Enrolled in MDM' },
  disk_encrypted: { label: 'Disk is encrypted', icon: Lock, blurb: 'FileVault / BitLocker on' },
  mfa_verified: { label: 'MFA verified', icon: Shield, blurb: 'Recent MFA in this session' },
  time_range: { label: 'Time range', icon: Clock, blurb: 'During business hours' },
  country: { label: 'Country allow-list', icon: Globe, blurb: 'From approved regions' },
};

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
  const [, setStatus] = useState<'draft' | 'active' | 'disabled'>('draft');
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [selectedApps, setSelectedApps] = useState<string[]>([]);
  const [conditions, setConditions] = useState<Condition[]>([]);

  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  const [apps, setApps] = useState<{ id: string; name: string }[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string; email: string }[]>([]);

  const [simUserId, setSimUserId] = useState('');
  const [simAppId, setSimAppId] = useState('');
  const [simResult, setSimResult] = useState<SimulateResult | null>(null);
  const [simulating, setSimulating] = useState(false);

  useEffect(() => {
    const promises: Promise<unknown>[] = [
      api
        .get<GroupsResponse>('/admin/groups')
        .then((r) => setGroups(r.groups.map((g) => ({ id: g.id, name: g.name })))),
      api
        .get<ApplicationsResponse>('/admin/applications')
        .then((r) => setApps(r.applications.map((a) => ({ id: a.id, name: a.name })))),
      api.get<UsersResponse>('/admin/users').then((r) =>
        setUsers(
          r.users.map((u) => ({
            id: u.id,
            name: u.full_name || u.name,
            email: u.email,
          }))
        )
      ),
    ];
    if (id) {
      promises.push(
        api.get<{ policy: Policy }>(`/admin/policies/${id}`).then((r) => {
          const p = r.policy;
          setName(p.name);
          setDescription(p.description || '');
          setPriority(p.priority);
          setStatus(p.status);
          setSelectedGroups(p.rules?.who?.groupIds || p.rules?.who?.groups || []);
          setSelectedApps(p.rules?.what?.appIds || p.rules?.what?.applications || []);
          setConditions((p.rules?.conditions || []) as Condition[]);
        })
      );
    }
    Promise.all(promises)
      .then(() => setLoading(false))
      .catch(() => setLoading(false));
  }, [id]);

  const addCondition = (type: CondType) => {
    if (conditions.some((c) => c.type === type)) return;
    const cond: Condition = { type };
    if (type === 'device_managed' || type === 'disk_encrypted' || type === 'mfa_verified')
      cond.value = true;
    if (type === 'time_range') {
      cond.start = '09:00';
      cond.end = '18:00';
    }
    if (type === 'country') cond.allowed = ['US'];
    setConditions([...conditions, cond]);
  };

  const removeCondition = (idx: number) =>
    setConditions(conditions.filter((_, i) => i !== idx));

  const save = async (asStatus: 'draft' | 'active') => {
    if (!name.trim()) {
      push('Give your policy a name first.', 'error');
      return;
    }
    setSaving(true);
    const body = {
      name,
      description,
      priority,
      status: asStatus,
      rules: {
        who: { groups: selectedGroups },
        what: { applications: selectedApps },
        conditions: conditions.map((c) => {
          if (c.type === 'time_range') return { type: c.type, start: c.start, end: c.end };
          if (c.type === 'country') return { type: c.type, allowed: c.allowed };
          return { type: c.type, value: c.value };
        }),
      },
    };
    try {
      if (isNew) {
        await api.post('/admin/policies', body);
        push('Policy created.', 'success');
      } else {
        await api.put(`/admin/policies/${id}`, body);
        push('Policy updated.', 'success');
      }
      navigate('/admin/policies');
    } catch {
      push('Failed to save policy.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const simulate = async () => {
    if (!simUserId || !simAppId) {
      push('Pick a user and an app to simulate.', 'warning');
      return;
    }
    setSimulating(true);
    setSimResult(null);
    try {
      const endpoint = id ? `/admin/policies/${id}/simulate` : '/admin/simulate';
      const r = await api.post<SimulateResult>(endpoint, { userId: simUserId, appId: simAppId });
      setSimResult(r);
    } catch {
      push('Simulation failed.', 'error');
    } finally {
      setSimulating(false);
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
    <div className="pb-28">
      {/* Back */}
      <button
        onClick={() => navigate('/admin/policies')}
        className="mb-4 inline-flex items-center gap-1.5 text-[12px] text-ink-500 transition-colors hover:text-ink-900"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} /> Back to policies
      </button>

      {/* Editorial header */}
      <header className="border-b border-ink-100 pb-8">
        <div className="flex items-baseline gap-3 text-[11px] uppercase tracking-[0.08em] text-ink-400">
          <span className="font-mono">{isNew ? 'New policy · draft' : `Policy · priority ${priority}`}</span>
        </div>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name this policy…"
          className="mt-2 block w-full font-display text-[48px] leading-[1.05] tracking-[-0.02em] text-ink-900 placeholder-ink-300 outline-none"
        />
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe what this policy does, in one line."
          className="mt-3 block w-full text-[15px] text-ink-500 placeholder-ink-300 outline-none"
        />
      </header>

      {/* 3-column rule builder */}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <RuleColumn
          eyebrow="01 · Who"
          title="Grants access to"
          helper="Groups of users this policy applies to."
          accent="signal"
          empty="Add at least one group."
        >
          <ChipList
            items={selectedGroups}
            resolve={(id) => groups.find((g) => g.id === id)?.name || id}
            onRemove={(id) => setSelectedGroups(selectedGroups.filter((x) => x !== id))}
          />
          <AddSelect
            placeholder="+ Add group"
            options={groups.filter((g) => !selectedGroups.includes(g.id))}
            onChoose={(id) => setSelectedGroups([...selectedGroups, id])}
          />
        </RuleColumn>

        <RuleColumn
          eyebrow="02 · What"
          title="For these applications"
          helper="Which apps the policy governs."
          accent="ink"
          empty="Add at least one application."
        >
          <ChipList
            items={selectedApps}
            resolve={(id) => apps.find((a) => a.id === id)?.name || id}
            onRemove={(id) => setSelectedApps(selectedApps.filter((x) => x !== id))}
          />
          <AddSelect
            placeholder="+ Add application"
            options={apps.filter((a) => !selectedApps.includes(a.id))}
            onChoose={(id) => setSelectedApps([...selectedApps, id])}
          />
        </RuleColumn>

        <RuleColumn
          eyebrow="03 · Conditions"
          title="When all of these are true"
          helper="Device and session requirements."
          accent="warn"
          empty="No conditions — access is granted immediately."
        >
          <div className="space-y-2">
            {conditions.map((c, idx) => {
              const meta = COND_META[c.type];
              const Icon = meta.icon;
              const detail =
                c.type === 'time_range'
                  ? `${c.start} – ${c.end}`
                  : c.type === 'country'
                    ? c.allowed?.join(', ')
                    : meta.blurb;
              return (
                <div
                  key={idx}
                  className="flex items-start gap-2.5 rounded-md border border-ink-100 bg-white p-3"
                >
                  <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-ink-500" strokeWidth={1.75} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-ink-900">{meta.label}</p>
                    <p className="mt-0.5 font-mono text-[10px] text-ink-400">{detail}</p>
                  </div>
                  <button
                    onClick={() => removeCondition(idx)}
                    className="text-ink-400 transition-colors hover:text-[#D1432B]"
                    aria-label="Remove condition"
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </button>
                </div>
              );
            })}
          </div>
          <AddSelect
            placeholder="+ Add condition"
            options={(Object.keys(COND_META) as CondType[])
              .filter((t) => !conditions.some((c) => c.type === t))
              .map((t) => ({ id: t, name: COND_META[t].label }))}
            onChoose={(id) => addCondition(id as CondType)}
          />
        </RuleColumn>
      </div>

      {/* Priority + Sandbox row */}
      <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-400">
            Priority
          </p>
          <h3 className="mt-1 font-display text-[22px] leading-tight tracking-[-0.02em] text-ink-900">
            Lower wins
          </h3>
          <p className="mt-1 text-[12px] text-ink-500">
            When multiple policies match, the lower number takes effect first.
          </p>
          <div className="mt-3 w-[160px]">
            <Input
              id="policy-priority"
              type="number"
              value={String(priority)}
              onChange={(e) => setPriority(Number(e.target.value))}
            />
          </div>
        </div>

        {/* Sandbox */}
        <div className="lg:col-span-2 rounded-lg border border-ink-100 bg-ink-50/60 p-6">
          <div className="mb-4 flex items-baseline justify-between">
            <div>
              <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-400">
                <FlaskConical className="h-3 w-3" strokeWidth={1.75} />
                Sandbox
              </p>
              <h3 className="mt-1 font-display text-[24px] leading-tight tracking-[-0.02em] text-ink-900">
                Try it before you ship it
              </h3>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <BareSelect
              label="User"
              value={simUserId}
              onChange={setSimUserId}
              placeholder="Select a user…"
              options={users.map((u) => ({ id: u.id, name: `${u.name} · ${u.email}` }))}
            />
            <BareSelect
              label="Application"
              value={simAppId}
              onChange={setSimAppId}
              placeholder="Select an app…"
              options={apps.map((a) => ({ id: a.id, name: a.name }))}
            />
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="mt-4"
            onClick={simulate}
            loading={simulating}
            leftIcon={<FlaskConical className="h-3.5 w-3.5" strokeWidth={1.75} />}
          >
            Simulate access
          </Button>

          {simResult && <SimulateResultPanel result={simResult} />}
        </div>
      </div>

      {/* Sticky publish bar */}
      <div className="fixed bottom-6 left-1/2 z-20 -translate-x-1/2 rounded-full border border-ink-100 bg-white px-2 py-2 shadow-[0_12px_40px_-12px_rgba(14,13,10,0.18)]">
        <div className="flex items-center gap-2 pl-4">
          <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-ink-500">
            <span className="h-1.5 w-1.5 rounded-full bg-[#D89422]" />
            Unsaved changes
          </span>
          <Button variant="ghost" size="sm" onClick={() => navigate('/admin/policies')}>
            Cancel
          </Button>
          <Button variant="secondary" size="sm" onClick={() => save('draft')} loading={saving}>
            Save draft
          </Button>
          <Button variant="signal" size="sm" onClick={() => save('active')} loading={saving}>
            Publish policy →
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ----- subcomponents ----- */

function RuleColumn({
  eyebrow,
  title,
  helper,
  accent,
  empty,
  children,
}: {
  eyebrow: string;
  title: string;
  helper: string;
  accent: 'signal' | 'ink' | 'warn';
  empty: string;
  children: React.ReactNode;
}) {
  const accentBar = {
    signal: 'bg-signal-500',
    ink: 'bg-ink-900',
    warn: 'bg-[#D89422]',
  }[accent];
  return (
    <section className="rounded-lg border border-ink-100 bg-white p-5">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${accentBar}`} />
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-500">
          {eyebrow}
        </p>
      </div>
      <h2 className="mt-2 font-display text-[26px] leading-[1.15] tracking-[-0.02em] text-ink-900">
        {title}
      </h2>
      <p className="mt-1 text-[12px] text-ink-500">{helper}</p>
      <div className="mt-5 space-y-3">
        {children}
        <p className="text-[11px] italic text-ink-400">{empty}</p>
      </div>
    </section>
  );
}

function ChipList({
  items,
  resolve,
  onRemove,
}: {
  items: string[];
  resolve: (id: string) => string;
  onRemove: (id: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((id) => (
        <span
          key={id}
          className="inline-flex items-center gap-1 rounded-full bg-ink-50 py-[3px] pl-3 pr-1 text-[12px] font-medium text-ink-900"
        >
          {resolve(id)}
          <button
            type="button"
            onClick={() => onRemove(id)}
            className="inline-flex h-4 w-4 items-center justify-center rounded-full text-ink-400 transition-colors hover:bg-ink-200 hover:text-ink-900"
            aria-label="Remove"
          >
            <X className="h-3 w-3" strokeWidth={2} />
          </button>
        </span>
      ))}
    </div>
  );
}

function AddSelect({
  placeholder,
  options,
  onChoose,
}: {
  placeholder: string;
  options: { id: string; name: string }[];
  onChoose: (id: string) => void;
}) {
  if (options.length === 0) return null;
  return (
    <div className="relative">
      <Plus
        className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400"
        strokeWidth={1.75}
      />
      <select
        className="w-full appearance-none rounded-md border border-dashed border-ink-200 bg-transparent py-2 pl-8 pr-3 text-[13px] text-ink-700 transition-colors hover:border-ink-300 hover:bg-ink-50/50 focus:border-signal-500 focus:bg-white focus:outline-none"
        value=""
        onChange={(e) => {
          if (e.target.value) onChoose(e.target.value);
        }}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function BareSelect({
  label,
  value,
  onChange,
  placeholder,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: { id: string; name: string }[];
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-500">
        {label}
      </span>
      <select
        className="w-full rounded-md border border-ink-100 bg-white px-3 py-2 text-[13px] text-ink-900 focus:border-signal-500 focus:outline-none"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function SimulateResultPanel({ result }: { result: SimulateResult }) {
  const allowed = result.outcome === 'allowed';
  return (
    <div
      className={`mt-5 rounded-lg border p-5 animate-fade-in ${
        allowed ? 'border-[#B5DEB1] bg-[#E8F5E7]' : 'border-[#F6C7BD] bg-[#FBEAE7]'
      }`}
    >
      <div className="flex items-center gap-2">
        {allowed ? (
          <CheckCircle2 className="h-5 w-5 text-[#1F6E20]" strokeWidth={1.75} />
        ) : (
          <XCircle className="h-5 w-5 text-[#8B2613]" strokeWidth={1.75} />
        )}
        <span
          className={`font-display text-[20px] leading-none tracking-[-0.02em] ${
            allowed ? 'text-[#1F6E20]' : 'text-[#8B2613]'
          }`}
        >
          {allowed ? 'Access granted' : 'Access denied'}
        </span>
      </div>
      {result.reason && (
        <p className="mt-2 text-[12px] text-ink-700">
          Reason: <span className="font-mono">{result.reason.replace(/_/g, ' ')}</span>
        </p>
      )}
      {result.policyName && (
        <p className="mt-0.5 font-mono text-[10px] text-ink-500">Matched by: {result.policyName}</p>
      )}
      {result.conditions_checked && result.conditions_checked.length > 0 && (
        <ul className="mt-4 space-y-1.5 border-t border-white/40 pt-3 text-[12px]">
          {result.conditions_checked.map((c, i) => (
            <li key={i} className="flex items-center gap-2">
              {c.passed ? (
                <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-[#1F6E20]" strokeWidth={1.75} />
              ) : (
                <XCircle className="h-3.5 w-3.5 flex-shrink-0 text-[#8B2613]" strokeWidth={1.75} />
              )}
              <span className="text-ink-700">{c.type.replace(/_/g, ' ')}</span>
              {c.detail && <span className="font-mono text-[10px] text-ink-500">— {c.detail}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
