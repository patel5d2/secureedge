import { useState } from 'react';
import { Building2, Shield, Key, Bell, Globe, Clock } from 'lucide-react';
import Button from '../../design-system/components/Button';
import Card from '../../design-system/components/Card';
import Input from '../../design-system/components/Input';
import { useToast } from '../../hooks/useToast';

export default function SettingsPage() {
  const { push } = useToast();

  // General
  const [orgName, setOrgName] = useState('SecureEdge Demo Org');
  const [sessionTtl, setSessionTtl] = useState('86400');

  // Security
  const [mfaEnforced, setMfaEnforced] = useState(true);
  const [minPasswordLen, setMinPasswordLen] = useState('8');
  const [maxSessionDevices, setMaxSessionDevices] = useState('5');

  // IdP
  const [idpProvider, setIdpProvider] = useState('none');
  const [idpTenantId, setIdpTenantId] = useState('');

  // Notifications
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [slackWebhook, setSlackWebhook] = useState('');

  const save = () => { push('Settings saved (demo).', 'success'); };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Settings</h1>
        <p className="text-sm text-text-muted mt-1">Configure your SecureEdge deployment</p>
      </div>

      {/* General */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="h-5 w-5 text-primary" />
          <h2 className="text-base font-semibold text-text-primary">General</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input id="org-name" label="Organization name" value={orgName} onChange={(e) => setOrgName(e.target.value)} />
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Session TTL</label>
            <div className="flex items-center gap-2">
              <input value={sessionTtl} onChange={(e) => setSessionTtl(e.target.value)} className="w-24 rounded-lg border border-border px-3 py-2.5 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
              <span className="text-sm text-text-muted">seconds</span>
              <span className="text-xs text-text-muted">({Math.round(Number(sessionTtl) / 3600)}h)</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Security */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-5 w-5 text-primary" />
          <h2 className="text-base font-semibold text-text-primary">Security Policy</h2>
        </div>
        <div className="space-y-4">
          <label className="flex items-center gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-surface-1 transition-colors">
            <input type="checkbox" checked={mfaEnforced} onChange={(e) => setMfaEnforced(e.target.checked)} className="h-4 w-4 rounded border-border text-primary focus:ring-primary" />
            <div>
              <p className="text-sm font-medium text-text-primary">Enforce MFA for all users</p>
              <p className="text-xs text-text-muted">Require multi-factor authentication on every login</p>
            </div>
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input id="min-pw" label="Minimum password length" type="number" value={minPasswordLen} onChange={(e) => setMinPasswordLen(e.target.value)} />
            <Input id="max-dev" label="Max concurrent sessions per device" type="number" value={maxSessionDevices} onChange={(e) => setMaxSessionDevices(e.target.value)} />
          </div>
        </div>
      </Card>

      {/* Identity Provider */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Key className="h-5 w-5 text-primary" />
          <h2 className="text-base font-semibold text-text-primary">Identity Provider (IdP)</h2>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Provider</label>
            <select value={idpProvider} onChange={(e) => setIdpProvider(e.target.value)} className="w-full sm:w-64 rounded-lg border border-border bg-white px-3 py-2.5 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none">
              <option value="none">None (local auth only)</option>
              <option value="azure_ad">Azure Active Directory</option>
              <option value="okta">Okta</option>
              <option value="google">Google Workspace</option>
              <option value="jumpcloud">JumpCloud</option>
            </select>
          </div>
          {idpProvider !== 'none' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Input id="idp-tenant" label="Tenant ID / Domain" value={idpTenantId} onChange={(e) => setIdpTenantId(e.target.value)} placeholder="your-org.onmicrosoft.com" />
              <div className="flex items-end">
                <Button variant="secondary" size="sm">Test Connection</Button>
              </div>
            </div>
          )}
          {idpProvider === 'none' && (
            <p className="text-xs text-text-muted rounded-lg bg-surface-1 p-3">
              <Globe className="h-4 w-4 inline mr-1" /> Connect an Identity Provider to sync users, groups, and enable SSO. SecureEdge supports SCIM provisioning and SAML 2.0.
            </p>
          )}
        </div>
      </Card>

      {/* Notifications */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Bell className="h-5 w-5 text-primary" />
          <h2 className="text-base font-semibold text-text-primary">Notifications</h2>
        </div>
        <div className="space-y-4">
          <label className="flex items-center gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-surface-1 transition-colors">
            <input type="checkbox" checked={emailAlerts} onChange={(e) => setEmailAlerts(e.target.checked)} className="h-4 w-4 rounded border-border text-primary focus:ring-primary" />
            <div>
              <p className="text-sm font-medium text-text-primary">Email alerts for critical security events</p>
              <p className="text-xs text-text-muted">Admins will receive emails for critical/high severity alerts</p>
            </div>
          </label>
          <Input id="slack-hook" label="Slack webhook URL (optional)" value={slackWebhook} onChange={(e) => setSlackWebhook(e.target.value)} placeholder="https://hooks.slack.com/services/..." helperText="Receive real-time alerts in a Slack channel" />
        </div>
      </Card>

      {/* Save */}
      <div className="flex items-center justify-between rounded-xl border border-border bg-white p-4">
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <Clock className="h-3.5 w-3.5" /> Settings are applied immediately across all nodes
        </div>
        <Button variant="accent" onClick={save}>Save Settings</Button>
      </div>
    </div>
  );
}
