import { useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { formatJoinCode } from '@/lib/gym/tenant';
import { toast } from '@/store/toast';

/** Copy-to-clipboard for the join code, used on the settings page too. */
export function JoinCodeChip({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(formatJoinCode(code));
          setCopied(true);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => setCopied(false), 1800);
        } catch {
          toast.info('Copy it by hand', formatJoinCode(code));
        }
      }}
      className="inline-flex items-center gap-2 rounded-xl border border-brand/40 bg-brand-soft/30 px-3 py-2 font-mono text-sm font-bold tracking-widest text-brand-text transition-colors hover:bg-brand-soft/50"
      aria-label={`Copy join code ${formatJoinCode(code)}`}
    >
      {formatJoinCode(code)}
      {copied ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}
    </button>
  );
}
