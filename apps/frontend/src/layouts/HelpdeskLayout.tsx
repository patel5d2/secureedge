import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Activity, AlertTriangle, Search, Laptop, LogOut, ShieldCheck } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import Avatar from '../design-system/components/Avatar';

const navItems = [
  { to: '/helpdesk', label: 'Dashboard', icon: Activity, end: true },
  { to: '/helpdesk/alerts', label: 'Alerts', icon: AlertTriangle },
  { to: '/helpdesk/users', label: 'User Lookup', icon: Search },
  { to: '/helpdesk/devices', label: 'Device Fleet', icon: Laptop },
];

export default function HelpdeskLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const onLogout = async () => { await logout(); navigate('/login', { replace: true }); };

  if (user && user.role !== 'helpdesk' && user.role !== 'admin') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0D1117]">
        <div className="text-center text-white/80">
          <p className="text-lg font-semibold">Access Denied</p>
          <p className="mt-1 text-sm text-white/50">You need helpdesk or admin privileges.</p>
          <button onClick={() => navigate('/portal')} className="mt-4 text-sm text-info hover:underline">Go to Portal</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#0D1117] text-white scroll-dark">
      <aside className="sticky top-0 hidden h-screen w-[220px] flex-shrink-0 flex-col border-r border-[#30363D] bg-[#161B22] md:flex">
        <div className="flex h-14 items-center gap-2 border-b border-[#30363D] px-5">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-white/10"><ShieldCheck className="h-5 w-5 text-accent" /></span>
          <span className="text-sm font-semibold">SecureEdge</span>
          <span className="ml-auto rounded-full bg-danger/20 px-2 py-0.5 text-[10px] uppercase tracking-wider text-danger font-medium">SOC</span>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end}
              className={({ isActive }) => `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${isActive ? 'bg-white/10 text-white font-medium' : 'text-white/50 hover:bg-white/5 hover:text-white/80'}`}
            >
              <item.icon className="h-4 w-4" />{item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-[#30363D] px-3 py-3">
          <div className="flex items-center gap-3">
            <Avatar name={user?.name} size="sm" />
            <div className="min-w-0 flex-1"><div className="truncate text-xs font-medium">{user?.name}</div><div className="truncate text-[10px] text-white/40">{user?.email}</div></div>
            <button onClick={onLogout} className="rounded p-1.5 text-white/40 hover:bg-white/10 hover:text-white/70" title="Sign out"><LogOut className="h-4 w-4" /></button>
          </div>
        </div>
      </aside>
      <main className="flex-1 overflow-auto"><div className="mx-auto max-w-7xl p-6 lg:p-8"><Outlet /></div></main>
    </div>
  );
}
