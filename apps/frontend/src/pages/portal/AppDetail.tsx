import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Shield,
  Users,
} from 'lucide-react';
import { api, type AppDetailResponse } from '../../lib/api';
import { iconForSlug } from '../../lib/app-icons';
import Button from '../../design-system/components/Button';
import Badge from '../../design-system/components/Badge';
import Card from '../../design-system/components/Card';
import Spinner from '../../design-system/components/Spinner';

export default function AppDetail() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<AppDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    api.get<AppDetailResponse>(`/portal/apps/${id}`).then((r) => {
      setData(r);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size={32} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center gap-4 py-16">
        <p className="text-sm text-text-secondary">Application not found.</p>
        <Link to="/portal" className="text-sm text-info hover:underline">
          ← Back to apps
        </Link>
      </div>
    );
  }

  const { app, requirements, accessGroups, simulate } = data;
  const Icon = iconForSlug(app.slug);
  const isAllowed = simulate.allowed;

  const checks = [
    { label: 'Managed device', met: !requirements.managed || simulate.conditions_checked?.find(c => c.type === 'device_managed')?.passed !== false, required: requirements.managed },
    { label: 'Disk encryption', met: !requirements.encrypted || simulate.conditions_checked?.find(c => c.type === 'disk_encrypted')?.passed !== false, required: requirements.encrypted },
    { label: 'MFA verified', met: !requirements.mfa || simulate.conditions_checked?.find(c => c.type === 'mfa_verified')?.passed !== false, required: requirements.mfa },
  ].filter(c => c.required);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Back */}
      <Link
        to="/portal"
        className="inline-flex items-center gap-1.5 text-sm text-text-secondary transition-colors hover:text-text-primary"
      >
        <ArrowLeft className="h-4 w-4" /> Back to apps
      </Link>

      {/* Header */}
      <div className="flex items-start gap-5">
        <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl bg-surface-2">
          <Icon className="h-8 w-8 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-text-primary">{app.name}</h1>
          <p className="mt-1 text-sm text-text-secondary">{app.description}</p>
          <div className="mt-2 flex items-center gap-2">
            <Badge variant={isAllowed ? 'success' : 'danger'} dot>
              {isAllowed ? 'Access Granted' : 'Access Denied'}
            </Badge>
            {app.protocol && (
              <Badge variant="gray">{app.protocol.toUpperCase()}</Badge>
            )}
          </div>
        </div>
      </div>

      {/* Access Requirements */}
      {checks.length > 0 && (
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Shield className="h-4 w-4 text-text-secondary" />
            <h2 className="text-sm font-semibold text-text-primary">
              Access Requirements
            </h2>
          </div>
          <div className="space-y-3">
            {checks.map((check) => (
              <div key={check.label} className="flex items-center gap-3">
                {check.met ? (
                  <CheckCircle2 className="h-5 w-5 text-success" />
                ) : (
                  <XCircle className="h-5 w-5 text-danger" />
                )}
                <span
                  className={`text-sm ${
                    check.met ? 'text-text-primary' : 'text-danger font-medium'
                  }`}
                >
                  {check.label}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Access Groups */}
      {accessGroups.length > 0 && (
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-4 w-4 text-text-secondary" />
            <h2 className="text-sm font-semibold text-text-primary">
              Your Access
            </h2>
          </div>
          <p className="text-xs text-text-secondary mb-3">
            You have access through the following groups:
          </p>
          <div className="flex flex-wrap gap-2">
            {accessGroups.map((g) => (
              <Badge key={g.id} variant="primary">
                {g.name}
              </Badge>
            ))}
          </div>
        </Card>
      )}

      {/* Deny reason */}
      {!isAllowed && simulate.reason && (
        <Card>
          <div className="rounded-md bg-danger/5 border border-danger/10 px-4 py-3">
            <p className="text-sm font-medium text-danger">Access denied</p>
            <p className="mt-1 text-xs text-text-secondary">
              Reason: {simulate.reason.replace(/_/g, ' ')}
            </p>
          </div>
        </Card>
      )}

      {/* Launch */}
      <div className="flex justify-end">
        <Button
          id="app-launch"
          variant={isAllowed ? 'accent' : 'secondary'}
          size="lg"
          disabled={!isAllowed}
          rightIcon={<ExternalLink className="h-4 w-4" />}
          onClick={() => {
            if (app.url) window.open(app.url, '_blank');
          }}
        >
          {isAllowed ? 'Open Application' : 'Access Required'}
        </Button>
      </div>
    </div>
  );
}
