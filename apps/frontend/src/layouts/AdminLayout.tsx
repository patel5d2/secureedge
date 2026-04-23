import { NavLink, Outlet, useNavigate, Navigate, useLocation } from 'react-router-dom';
import { BarChart3, FileText, Users, UsersRound, Box, ScrollText, LogOut, ShieldCheck, Settings } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import Avatar from '../design-system/components/Avatar';

const navItems = [
  { to: '/admin', label: 'Overview', icon: BarChart3, end: true },
  { to: '/admin/policies', label: 'Policies', icon: FileText },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/groups', label: 'Groups', icon: UsersRound },
  { to: '/admin/applications', label: 'Applications', icon: Box },
  { to: '/admin/audit-log', label: 'Audit Log', icon: ScrollText },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const onLogout = async () => { await logout(); navigate('/login', { replace: true }); };

  if (user && user.role !== 'admin') {
    return (
      <Navigate
        to="/access-denied"
        replace
        state={{
          reason: 'The admin console is restricted to users with the admin role.',
          requiredRole: 'admin',
          attemptedPath: location.pathname,
        }}
      />
    );
  }

  return (
    <div className="flex min-h-screen bg-surface-2">
      {/* Nav rail */}
      <aside className="sticky top-0 hidden h-screen w-[240px] flex-shrink-0 flex-col border-r border-border bg-surface md:flex">
        <div className="flex h-14 items-center gap-2 border-b border-border px-5">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-accent"><ShieldCheck className="h-5 w-5" /></span>
          <span className="text-sm font-semibold text-text-primary">SecureEdge</span>
          <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-primary font-medium">Admin</span>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end}
              className={({ isActive }) => `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${isActive ? 'bg-primary/5 text-primary font-medium' : 'text-text-secondary hover:bg-surface-2 hover:text-text-primary'}`}
            >
              <item.icon className="h-4 w-4" />{item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-border px-3 py-3">
          <div className="flex items-center gap-3">
            <Avatar name={user?.name} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium text-text-primary">{user?.name}</div>
              <div className="truncate text-[10px] text-text-muted">{user?.email}</div>
            </div>
            <button onClick={onLogout} className="rounded p-1.5 text-text-muted hover:bg-surface-2 hover:text-text-secondary" title="Sign out"><LogOut className="h-4 w-4" /></button>
          </div>
        </div>
      </aside>
      {/* Content */}
      <main className="flex-1 overflow-auto"><div className="mx-auto max-w-7xl p-6 lg:p-8"><Outlet /></div></main>
    </div>
  );
}
