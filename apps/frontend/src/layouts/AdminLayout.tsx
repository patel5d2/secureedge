import { NavLink, Outlet, useNavigate, Navigate, useLocation } from 'react-router-dom';
import {
  BarChart3,
  FileText,
  Users,
  UsersRound,
  Box,
  ScrollText,
  LogOut,
  Settings,
  Search,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import Avatar from '../design-system/components/Avatar';

const navItems = [
  { to: '/admin', label: 'Overview', icon: BarChart3, end: true },
  { to: '/admin/policies', label: 'Policies', icon: FileText },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/groups', label: 'Groups', icon: UsersRound },
  { to: '/admin/applications', label: 'Applications', icon: Box },
  { to: '/admin/audit-log', label: 'Audit log', icon: ScrollText },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const onLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

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
      {/* Ink sidebar — editorial, high contrast */}
      <aside className="sticky top-0 hidden h-screen w-[240px] flex-shrink-0 flex-col bg-ink-900 text-ink-0/80 md:flex">
        <div className="flex h-14 items-center gap-2.5 border-b border-white/10 px-5">
          <LogoMark />
          <span className="font-display text-[20px] leading-none tracking-[-0.02em] text-ink-0">
            secureedge
          </span>
          <span className="ml-auto rounded-full bg-signal-500/20 px-2 py-[3px] text-[10px] font-semibold uppercase tracking-[0.08em] text-signal-300">
            Admin
          </span>
        </div>

        {/* Fake cmd+k search affordance */}
        <div className="px-3 pt-4">
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-[12px] text-ink-0/60 transition-colors hover:bg-white/10"
          >
            <Search className="h-3.5 w-3.5" strokeWidth={1.6} />
            Search…
            <span className="ml-auto rounded bg-white/10 px-1.5 py-[1px] font-mono text-[10px] text-ink-0/60">
              ⌘K
            </span>
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 px-3 py-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] transition-colors duration-200 ease-out-soft ${
                  isActive
                    ? 'bg-white/10 text-ink-0 font-semibold'
                    : 'text-ink-0/60 hover:bg-white/5 hover:text-ink-0 font-medium'
                }`
              }
            >
              <item.icon className="h-4 w-4" strokeWidth={1.6} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-white/10 px-3 py-3">
          <div className="flex items-center gap-2.5">
            <Avatar name={user?.name} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-medium text-ink-0">{user?.name}</div>
              <div className="truncate font-mono text-[10px] text-ink-0/50">{user?.email}</div>
            </div>
            <button
              onClick={onLogout}
              className="rounded-md p-1.5 text-ink-0/50 transition-colors hover:bg-white/10 hover:text-ink-0"
              title="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" strokeWidth={1.6} />
            </button>
          </div>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-7xl px-10 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function LogoMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 34 34" fill="none" aria-hidden>
      <circle cx="17" cy="6" r="3.4" fill="#FDFCF8" />
      <circle cx="6" cy="22" r="3.4" fill="#FDFCF8" />
      <circle cx="28" cy="22" r="3.4" fill="#7FCD7A" />
      <path d="M17 6 L6 22" stroke="#FDFCF8" strokeWidth="1.6" />
      <path d="M17 6 L28 22" stroke="#FDFCF8" strokeWidth="1.6" />
      <path d="M6 22 L28 22" stroke="#FDFCF8" strokeWidth="1.6" strokeDasharray="2 2" />
    </svg>
  );
}
