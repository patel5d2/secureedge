import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Grid3x3, Laptop, LogOut, User as UserIcon, Wifi } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import Avatar from '../design-system/components/Avatar';

const navItems = [
  { to: '/portal', label: 'Apps', icon: Grid3x3, end: true },
  { to: '/portal/sessions', label: 'My sessions', icon: Wifi },
  { to: '/portal/devices', label: 'My devices', icon: Laptop },
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
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-ink-100 bg-white px-6">
        <div className="flex items-center gap-2.5">
          <LogoMark />
          <span className="font-display text-[22px] leading-none tracking-[-0.02em] text-ink-900">
            secureedge
          </span>
          <span className="ml-2 rounded-full bg-ink-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-ink-500">
            Portal
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <div className="text-[13px] font-medium text-ink-900">{user?.name || 'You'}</div>
            <div className="text-[11px] text-ink-400">{user?.email}</div>
          </div>
          <Avatar name={user?.name} size="sm" />
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-ink-100 bg-transparent px-3 text-xs font-medium text-ink-500 transition-colors hover:bg-ink-50 hover:text-ink-900"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-[1400px]">
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-[220px] flex-shrink-0 border-r border-ink-100 bg-white px-3 py-6 md:block">
          <nav className="flex flex-col gap-0.5">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] transition-colors duration-200 ease-out-soft ${
                    isActive
                      ? 'bg-signal-500/10 text-signal-700 font-semibold'
                      : 'text-ink-500 hover:bg-ink-50 hover:text-ink-900 font-medium'
                  }`
                }
              >
                <item.icon className="h-4 w-4" strokeWidth={1.6} />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>
        <main className="flex-1 px-10 py-8">
          <div className="mx-auto w-full max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

function LogoMark() {
  return (
    <svg width="26" height="26" viewBox="0 0 34 34" fill="none" aria-hidden>
      <circle cx="17" cy="6" r="3.4" fill="#0E0D0A" />
      <circle cx="6" cy="22" r="3.4" fill="#0E0D0A" />
      <circle cx="28" cy="22" r="3.4" fill="#3CB13A" />
      <path d="M17 6 L6 22" stroke="#0E0D0A" strokeWidth="1.6" />
      <path d="M17 6 L28 22" stroke="#0E0D0A" strokeWidth="1.6" />
      <path d="M6 22 L28 22" stroke="#0E0D0A" strokeWidth="1.6" strokeDasharray="2 2" />
    </svg>
  );
}
