import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Bell, LogOut, Menu, Search, X, Plus, MoreHorizontal } from 'lucide-react';
import { useAuth } from '@/store/auth';
import { selectActiveSession, selectUnreadCount, useData } from '@/store/data';
import { visibleSections } from './nav';
import { Icon } from '@/components/Icon';
import { cn, initials } from '@/lib/utils';
import { greeting } from '@/lib/date';
import { ActiveWorkoutBar } from './ActiveWorkoutBar';
import { NotificationPanel } from './NotificationPanel';
import { CommandPalette } from './CommandPalette';
import { ROLE_LABEL } from '@/types';

export function AppShell() {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileNav, setMobileNav] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const unread = useData(selectUnreadCount);
  const activeSession = useData(selectActiveSession);

  useEffect(() => { setMobileNav(false); setNotifOpen(false); }, [location.pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setPaletteOpen(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!profile) return null;
  const sections = visibleSections(profile.role);

  return (
    <div className="min-h-screen bg-bg">
      <a href="#main" className="skip-link">Skip to main content</a>

      {/* ---------- Desktop sidebar ---------- */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col border-r border-line bg-bg-elev z-30">
        <Link to="/" className="flex items-center gap-2.5 h-16 px-5 shrink-0 border-b border-line">
          <Logo />
          <span className="font-bold text-lg tracking-tight">FitHub</span>
        </Link>
        <nav className="flex-1 overflow-y-auto py-4 px-3 no-scrollbar" aria-label="Main navigation">
          {sections.map((section) => (
            <div key={section.title} className="mb-5">
              <p className="px-3 mb-1.5 text-2xs font-semibold uppercase tracking-wider text-ink-3">{section.title}</p>
              <ul className="space-y-0.5">
                {section.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.exact}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-3 px-3 h-9 rounded-xl text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-brand-soft text-brand-text'
                            : 'text-ink-2 hover:text-ink hover:bg-surface-2',
                        )
                      }
                    >
                      <Icon name={item.icon} size={17} className="shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <div className="shrink-0 border-t border-line p-3">
          <Link to="/profile" className="flex items-center gap-3 p-2 rounded-xl hover:bg-surface-2 transition-colors">
            <Avatar profile={profile} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">{profile.full_name}</p>
              <p className="text-2xs text-ink-3 truncate">{ROLE_LABEL[profile.role]}</p>
            </div>
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); void signOut().then(() => navigate('/welcome')); }}
              aria-label="Sign out"
              className="shrink-0 h-8 w-8 grid place-items-center rounded-lg text-ink-3 hover:text-danger hover:bg-danger-soft transition-colors"
            >
              <LogOut size={15} />
            </button>
          </Link>
        </div>
      </aside>

      {/* ---------- Mobile drawer ---------- */}
      {mobileNav && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setMobileNav(false)} />
          <div className="relative h-full w-[86%] max-w-xs bg-bg-elev border-r border-line flex flex-col animate-fade-in">
            <div className="flex items-center justify-between h-16 px-4 border-b border-line shrink-0">
              <Link to="/" className="flex items-center gap-2.5"><Logo /><span className="font-bold text-lg">FitHub</span></Link>
              <button type="button" onClick={() => setMobileNav(false)} aria-label="Close menu" className="h-9 w-9 grid place-items-center rounded-xl text-ink-3 hover:bg-surface-2">
                <X size={18} />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto py-4 px-3" aria-label="Main navigation">
              {sections.map((section) => (
                <div key={section.title} className="mb-5">
                  <p className="px-3 mb-1.5 text-2xs font-semibold uppercase tracking-wider text-ink-3">{section.title}</p>
                  <ul className="space-y-0.5">
                    {section.items.map((item) => (
                      <li key={item.to}>
                        <NavLink
                          to={item.to}
                          end={item.exact}
                          className={({ isActive }) =>
                            cn('flex items-center gap-3 px-3 h-11 rounded-xl text-sm font-medium',
                              isActive ? 'bg-brand-soft text-brand-text' : 'text-ink-2 hover:bg-surface-2')
                          }
                        >
                          <Icon name={item.icon} size={18} />
                          {item.label}
                        </NavLink>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
            <div className="shrink-0 border-t border-line p-3">
              <button
                type="button"
                onClick={() => void signOut().then(() => navigate('/welcome'))}
                className="flex items-center gap-3 w-full px-3 h-11 rounded-xl text-sm font-medium text-ink-2 hover:bg-surface-2"
              >
                <LogOut size={18} /> Sign out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- Main column ---------- */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 glass border-b border-line">
          <div className="flex items-center gap-3 h-16 px-4 sm:px-6">
            <button
              type="button"
              onClick={() => setMobileNav(true)}
              aria-label="Open menu"
              className="lg:hidden h-10 w-10 -ml-1 grid place-items-center rounded-xl text-ink-2 hover:bg-surface-2"
            >
              <Menu size={20} />
            </button>

            <div className="lg:hidden flex items-center gap-2"><Logo size={26} /></div>

            <div className="hidden lg:block min-w-0">
              <p className="text-sm text-ink-3 leading-tight">{greeting()}, {profile.full_name.split(' ')[0]}.</p>
              <p className="font-semibold leading-tight">Ready to get stronger?</p>
            </div>

            <div className="flex-1" />

            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="hidden sm:flex items-center gap-2 h-9 pl-3 pr-2 rounded-xl border border-line bg-surface-2 text-sm text-ink-3 hover:text-ink-2 hover:border-line-strong transition-colors"
            >
              <Search size={15} />
              <span>Search…</span>
              <kbd className="ml-2 text-2xs px-1.5 py-0.5 rounded border border-line bg-surface font-sans">⌘K</kbd>
            </button>

            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              aria-label="Search"
              className="sm:hidden h-10 w-10 grid place-items-center rounded-xl text-ink-2 hover:bg-surface-2"
            >
              <Search size={19} />
            </button>

            <button
              type="button"
              onClick={() => setNotifOpen((v) => !v)}
              aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
              aria-expanded={notifOpen}
              className="relative h-10 w-10 grid place-items-center rounded-xl text-ink-2 hover:bg-surface-2"
            >
              <Bell size={19} />
              {unread > 0 && (
                <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-danger text-white text-[10px] font-bold grid place-items-center tabular">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </button>

            <Link to="/profile" className="lg:hidden shrink-0"><Avatar profile={profile} size={34} /></Link>
          </div>
          {notifOpen && <NotificationPanel onClose={() => setNotifOpen(false)} />}
        </header>

        {activeSession && <ActiveWorkoutBar session={activeSession} />}

        <main id="main" className="px-4 sm:px-6 py-5 sm:py-7 pb-28 lg:pb-10 max-w-[1400px] mx-auto">
          <Outlet />
        </main>
      </div>

      <MobileTabBar />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}

function MobileTabBar() {
  const items = [
    { to: '/', label: 'Home', icon: 'LayoutDashboard', exact: true },
    { to: '/program', label: 'Program', icon: 'CalendarRange' },
    { to: '/workout', label: 'Train', icon: 'Dumbbell', primary: true },
    { to: '/progress', label: 'Progress', icon: 'TrendingUp' },
    { to: '/more', label: 'More', icon: 'MoreHorizontal' },
  ];
  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-30 glass border-t border-line pb-safe"
      aria-label="Primary"
    >
      <ul className="flex items-stretch">
        {items.map((item) => (
          <li key={item.to} className="flex-1">
            <NavLink
              to={item.to}
              end={item.exact}
              className={({ isActive }) =>
                cn('flex flex-col items-center justify-center gap-1 h-16 text-2xs font-medium transition-colors',
                  isActive ? 'text-brand-text' : 'text-ink-3')
              }
            >
              {item.primary ? (
                <span className="h-9 w-12 rounded-xl bg-brand text-brand-contrast grid place-items-center -mt-1">
                  <Plus size={20} strokeWidth={2.5} />
                </span>
              ) : item.icon === 'MoreHorizontal' ? (
                <MoreHorizontal size={20} />
              ) : (
                <Icon name={item.icon} size={20} />
              )}
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function Avatar({ profile, size = 36 }: { profile: { full_name: string; avatar_color: string }; size?: number }) {
  return (
    <span
      className="shrink-0 grid place-items-center rounded-full font-bold text-bg"
      style={{
        width: size, height: size, fontSize: size * 0.38,
        background: `linear-gradient(135deg, ${profile.avatar_color}, ${profile.avatar_color}bb)`,
        color: '#0B0F14',
      }}
      aria-hidden
    >
      {initials(profile.full_name)}
    </span>
  );
}

export function Logo({ size = 30 }: { size?: number }) {
  return (
    <span
      className="grid place-items-center rounded-xl bg-brand shrink-0"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill="none" stroke="rgb(var(--c-brand-contrast))" strokeWidth="2.6" strokeLinecap="round">
        <path d="M6.5 6.5v11M17.5 6.5v11M3 9.5v5M21 9.5v5M6.5 12h11" />
      </svg>
    </span>
  );
}
