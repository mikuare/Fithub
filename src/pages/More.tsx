import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, LogOut } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/Icon';
import { Avatar } from '@/components/layout/AppShell';
import { useAuth } from '@/store/auth';
import { visibleSections } from '@/components/layout/nav';
import { ROLE_LABEL } from '@/types';
import { HEALTH_DISCLAIMER } from '@/lib/defaults';

/** Mobile overflow menu — every destination the bottom bar cannot fit. */
export default function More() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  if (!profile) return null;

  const sections = visibleSections(profile.role);

  return (
    <div className="space-y-5 max-w-2xl lg:hidden">
      <PageHeader title="More" />

      <Card>
        <Link to="/profile" className="flex items-center gap-3 p-4 hover:bg-surface-2 transition-colors">
          <Avatar profile={profile} size={46} />
          <div className="min-w-0 flex-1">
            <p className="font-semibold truncate">{profile.full_name}</p>
            <p className="text-2xs text-ink-3 truncate">{ROLE_LABEL[profile.role]} · {profile.email}</p>
          </div>
          <ChevronRight size={17} className="text-ink-3 shrink-0" />
        </Link>
      </Card>

      {sections.map((section) => (
        <div key={section.title}>
          <p className="px-1 mb-1.5 text-2xs font-semibold uppercase tracking-wider text-ink-3">{section.title}</p>
          <Card>
            <ul className="divide-y divide-line">
              {section.items.map((item) => (
                <li key={item.to}>
                  <Link to={item.to} className="flex items-center gap-3 px-4 h-13 py-3.5 hover:bg-surface-2 transition-colors">
                    <Icon name={item.icon} size={18} className="text-ink-3 shrink-0" />
                    <span className="flex-1 text-sm font-medium">{item.label}</span>
                    <ChevronRight size={16} className="text-ink-3 shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      ))}

      <Card>
        <button
          type="button"
          onClick={() => void signOut().then(() => navigate('/welcome'))}
          className="w-full flex items-center gap-3 px-4 py-3.5 text-danger hover:bg-danger-soft transition-colors"
        >
          <LogOut size={18} />
          <span className="text-sm font-medium">Sign out</span>
        </button>
      </Card>

      <p className="text-2xs text-ink-3 leading-relaxed px-1 pb-4">{HEALTH_DISCLAIMER}</p>
    </div>
  );
}
