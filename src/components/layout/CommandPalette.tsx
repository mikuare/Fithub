import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { CornerDownLeft, Search } from 'lucide-react';
import { EXERCISES } from '@/data/exercises';
import { useAuth } from '@/store/auth';
import { visibleSections } from './nav';
import { Icon } from '@/components/Icon';
import { cn, matches } from '@/lib/utils';

interface Result {
  id: string;
  label: string;
  hint: string;
  icon: string;
  to: string;
  group: string;
}

/** ⌘K search across navigation and the exercise library. */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const navigate = useNavigate();
  const { profile } = useAuth();

  const results = useMemo<Result[]>(() => {
    if (!profile) return [];
    const pages: Result[] = visibleSections(profile.role).flatMap((section) =>
      section.items.map((item) => ({
        id: `nav-${item.to}`, label: item.label, hint: section.title,
        icon: item.icon, to: item.to, group: 'Pages',
      })),
    );
    const exercises: Result[] = EXERCISES.map((e) => ({
      id: `ex-${e.slug}`,
      label: e.name,
      hint: `${e.primary.join(', ')} · ${e.equipment.join(', ')}`,
      icon: 'Dumbbell',
      to: `/exercises/${e.slug}`,
      group: 'Exercises',
    }));

    const all = [...pages, ...exercises];
    if (!query.trim()) return pages.slice(0, 8);
    return all.filter((r) => matches(r.label, query) || matches(r.hint, query)).slice(0, 24);
  }, [query, profile]);

  useEffect(() => { setCursor(0); }, [query]);
  useEffect(() => { if (open) { setQuery(''); setTimeout(() => inputRef.current?.focus(), 40); } }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, results.length - 1)); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
      if (e.key === 'Enter' && results[cursor]) { e.preventDefault(); navigate(results[cursor].to); onClose(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, results, cursor, navigate, onClose]);

  useEffect(() => {
    listRef.current?.querySelectorAll('li')[cursor]?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  if (!open) return null;

  let lastGroup = '';

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-start justify-center pt-[10vh] px-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search FitHub"
        className="relative w-full max-w-xl card shadow-lift animate-scale-in overflow-hidden"
      >
        <div className="flex items-center gap-3 px-4 h-14 border-b border-line">
          <Search size={18} className="text-ink-3 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages and exercises…"
            aria-label="Search"
            className="flex-1 bg-transparent outline-none text-base placeholder:text-ink-3"
          />
          <kbd className="text-2xs px-1.5 py-1 rounded border border-line bg-surface-2 text-ink-3">esc</kbd>
        </div>

        {results.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-ink-3">No matches for "{query}".</p>
        ) : (
          <ul ref={listRef} className="max-h-[52vh] overflow-y-auto py-2">
            {results.map((r, i) => {
              const showGroup = r.group !== lastGroup;
              lastGroup = r.group;
              return (
                <li key={r.id}>
                  {showGroup && (
                    <p className="px-4 pt-3 pb-1 text-2xs font-semibold uppercase tracking-wider text-ink-3">{r.group}</p>
                  )}
                  <button
                    type="button"
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => { navigate(r.to); onClose(); }}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 h-11 text-left transition-colors',
                      i === cursor ? 'bg-surface-2' : 'hover:bg-surface-2/60',
                    )}
                  >
                    <Icon name={r.icon} size={16} className="shrink-0 text-ink-3" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium truncate">{r.label}</span>
                      <span className="block text-2xs text-ink-3 truncate">{r.hint}</span>
                    </span>
                    {i === cursor && <CornerDownLeft size={14} className="text-ink-3 shrink-0" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>,
    document.body,
  );
}
