import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Grid3x3, Laptop, LogOut, ShieldCheck, User as UserIcon, Wifi } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import Avatar from '../design-system/components/Avatar';

const navItems = [
  { to: '/portal', label: 'Apps', icon: Grid3x3, end: true },
  { to: '/portal/sessions', label: 'My Sessions', icon: Wifi },
  { to: '/portal/devices', label: 'My Devices', icon: Laptop },
  { to: '/portal/profile', label: 'Profile', icon: UserIcon },
];

export default function PortalLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const onLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-surface-2">
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-surface px-6">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-accent">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <span className="text-sm font-semibold text-text-primary">SecureEdge</span>
          <span className="ml-3 rounded-full bg-surface-2 px-2 py-0.5 text-[10px] uppercase tracking-wider text-text-secondary">
            Portal
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <div className="text-sm font-medium text-text-primary">{user?.name || 'You'}</div>
            <div className="text-xs text-text-muted">{user?.email}</div>
          </div>
          <Avatar name={user?.name} size="sm" />
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-medium text-text-secondary hover:bg-surface-2"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-[1400px]">
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-[220px] flex-shrink-0 border-r border-border bg-surface px-3 py-6 md:block">
          <nav className="flex flex-col gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                    isActive
                      ? 'bg-primary/5 text-primary font-medium'
                      : 'text-text-secondary hover:bg-surface-2 hover:text-text-primary'
                  }`
                }
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>
        <main className="flex-1 p-8">
          <div className="mx-auto w-full max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
