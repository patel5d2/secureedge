import { useEffect, useState } from 'react';
import { User as UserIcon, Shield, Mail, Building2, Calendar, Users } from 'lucide-react';
import { api, type ProfileResponse } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import Badge from '../../design-system/components/Badge';
import Card from '../../design-system/components/Card';
import Spinner from '../../design-system/components/Spinner';

export default function ProfilePage() {
  const [data, setData] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<ProfileResponse>('/portal/profile').then((r) => { setData(r); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex h-64 items-center justify-center"><Spinner size={32} /></div>;
  if (!data) return <p className="py-10 text-center text-sm text-text-muted">Unable to load profile.</p>;

  const { user, groups, device } = data;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-text-primary">Profile & Settings</h1>

      {/* User info */}
      <Card>
        <div className="flex items-start gap-5">
          <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl bg-primary/10">
            <UserIcon className="h-8 w-8 text-primary" />
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">{user.full_name}</h2>
              <Badge variant={user.status === 'active' ? 'success' : 'warning'} dot>{user.status}</Badge>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <InfoRow icon={Mail} label="Email" value={user.email} />
              <InfoRow icon={Building2} label="Department" value={user.department || '—'} />
              <InfoRow icon={Shield} label="Role" value={user.role} />
              <InfoRow icon={Calendar} label="Last login" value={formatDateTime(user.last_login_at as string)} />
            </div>
          </div>
        </div>
      </Card>

      {/* Groups */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Users className="h-4 w-4 text-text-secondary" />
          <h2 className="text-sm font-semibold text-text-primary">Group Memberships</h2>
        </div>
        {groups.length === 0 ? (
          <p className="text-sm text-text-muted">Not a member of any groups.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {groups.map((g) => <Badge key={g.id} variant="primary">{g.name}</Badge>)}
          </div>
        )}
      </Card>

      {/* Primary device */}
      {device && (
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Shield className="h-4 w-4 text-text-secondary" />
            <h2 className="text-sm font-semibold text-text-primary">Primary Device</h2>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-text-secondary">Name:</span> <span className="font-medium">{device.name}</span></div>
            <div><span className="text-text-secondary">OS:</span> <span className="font-medium">{device.os}</span></div>
            <div><span className="text-text-secondary">Status:</span> <Badge variant={device.enrollment_status === 'enrolled' ? 'success' : 'warning'} dot>{device.enrollment_status}</Badge></div>
            <div><span className="text-text-secondary">Posture:</span> <span className="font-semibold">{device.posture_score}/100</span></div>
          </div>
        </Card>
      )}
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <Icon className="h-3.5 w-3.5 text-text-muted" />
      <span className="text-text-secondary">{label}:</span>
      <span className="font-medium text-text-primary">{value}</span>
    </div>
  );
}
