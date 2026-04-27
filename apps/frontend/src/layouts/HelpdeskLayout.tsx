import { Fragment, useState } from 'react';
import { NavLink, Outlet, useNavigate, Navigate, useLocation } from 'react-router-dom';
import { Dialog, Transition } from '@headlessui/react';
import { Activity, AlertTriangle, Search, Laptop, LogOut, Menu, X } from 'lucide-react';
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
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const onLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  if (user && user.role !== 'helpdesk' && user.role !== 'admin') {
    return (
      <Navigate
        to="/access-denied"
        replace
        state={{
          reason: 'The Helpdesk / SOC console is restricted to helpdesk and admin users.',
          requiredRole: 'helpdesk',
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
        <span className="ml-auto rounded-full bg-[#FF7555]/20 px-2 py-[3px] text-[10px] font-semibold uppercase tracking-[0.08em] text-[#FF8A73]">
          SOC
        </span>
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
    <div className="flex min-h-screen flex-col md:flex-row bg-ink-900 text-ink-0 scroll-dark">
      {/* Mobile Header */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-white/10 bg-[#0A0906] px-4 md:hidden">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setSidebarOpen(true)}
            className="-ml-1 rounded-md p-2 text-ink-0/60 hover:bg-white/5 hover:text-ink-0"
          >
            <span className="sr-only">Open sidebar</span>
            <Menu className="h-5 w-5" strokeWidth={1.6} />
          </button>
          <span className="font-display text-[20px] leading-none tracking-[-0.02em] text-ink-0">
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
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
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
              <Dialog.Panel className="relative flex w-full max-w-xs flex-1 flex-col bg-[#0A0906] text-ink-0/80 border-r border-white/10">
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
      <aside className="sticky top-0 hidden h-screen w-[240px] flex-shrink-0 flex-col border-r border-white/10 bg-[#0A0906] md:flex">
        <SidebarContent />
      </aside>

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
