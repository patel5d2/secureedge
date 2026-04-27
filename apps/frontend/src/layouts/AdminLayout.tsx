import { Fragment, useState } from 'react';
import { NavLink, Outlet, useNavigate, Navigate, useLocation } from 'react-router-dom';
import { Dialog, Transition } from '@headlessui/react';
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
  Menu,
  X,
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
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  const SidebarContent = () => (
    <>
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
            onClick={() => setSidebarOpen(false)}
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
    </>
  );

  return (
    <div className="flex min-h-screen flex-col md:flex-row bg-surface-2">
      {/* Mobile Header */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-ink-100 bg-white px-4 md:hidden">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setSidebarOpen(true)}
            className="-ml-1 rounded-md p-2 text-ink-500 hover:bg-ink-50 hover:text-ink-900"
          >
            <span className="sr-only">Open sidebar</span>
            <Menu className="h-5 w-5" strokeWidth={1.6} />
          </button>
          <span className="font-display text-[20px] leading-none tracking-[-0.02em] text-ink-900">
            secureedge
          </span>
        </div>
        <Avatar name={user?.name} size="sm" />
      </header>

      {/* Mobile Off-canvas Sidebar */}
      <Transition.Root show={sidebarOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50 md:hidden" onClose={setSidebarOpen}>
          <Transition.Child
            as={Fragment}
            enter="transition-opacity ease-linear duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="transition-opacity ease-linear duration-300"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-ink-900/80 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-0 flex">
            <Transition.Child
              as={Fragment}
              enter="transition ease-in-out duration-300 transform"
              enterFrom="-translate-x-full"
              enterTo="translate-x-0"
              leave="transition ease-in-out duration-300 transform"
              leaveFrom="translate-x-0"
              leaveTo="-translate-x-full"
            >
              <Dialog.Panel className="relative flex w-full max-w-xs flex-1 flex-col bg-ink-900 text-ink-0/80">
                <Transition.Child
                  as={Fragment}
                  enter="ease-in-out duration-300"
                  enterFrom="opacity-0"
                  enterTo="opacity-100"
                  leave="ease-in-out duration-300"
                  leaveFrom="opacity-100"
                  leaveTo="opacity-0"
                >
                  <div className="absolute right-0 top-0 -mr-12 pt-2">
                    <button
                      type="button"
                      className="ml-1 flex h-10 w-10 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                      onClick={() => setSidebarOpen(false)}
                    >
                      <span className="sr-only">Close sidebar</span>
                      <X className="h-6 w-6 text-white" aria-hidden="true" />
                    </button>
                  </div>
                </Transition.Child>
                <SidebarContent />
              </Dialog.Panel>
            </Transition.Child>
            <div className="w-14 flex-shrink-0" aria-hidden="true">
              {/* Force sidebar to shrink to fit close icon */}
            </div>
          </div>
        </Dialog>
      </Transition.Root>

      {/* Desktop Sidebar */}
      <aside className="sticky top-0 hidden h-screen w-[240px] flex-shrink-0 flex-col bg-ink-900 text-ink-0/80 md:flex">
        <SidebarContent />
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 md:px-10 md:py-8">
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
