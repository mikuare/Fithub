import type { ReactNode } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, Tooltip,
  XAxis, YAxis,
} from 'recharts';
import { formatDate } from '@/lib/date';
import { cn } from '@/lib/utils';

/* A single palette so every chart in the product reads as one system. */
export const SERIES = ['#B9F227', '#7C5CFF', '#38BDF8', '#34C77B', '#F5BE3E', '#F87171', '#22D3EE', '#F472B6'];

const axis = {
  stroke: 'rgb(var(--c-line-strong))',
  fontSize: 11,
  tickLine: false,
  axisLine: false,
  tick: { fill: 'rgb(var(--c-ink-3))' },
};

function ChartTooltip({ active, payload, label, formatter, labelFormatter }: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number | string; color?: string; dataKey?: string | number }>;
  label?: string | number;
  formatter?: (value: number | string, name: string) => string;
  labelFormatter?: (label: string | number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-surface shadow-lift px-3 py-2 text-xs">
      {label !== undefined && (
        <p className="font-semibold text-ink mb-1">{labelFormatter ? labelFormatter(label) : String(label)}</p>
      )}
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-2 text-ink-2 tabular">
          <span className="h-2 w-2 rounded-full shrink-0" style={{ background: p.color }} aria-hidden />
          <span>{p.name}</span>
          <span className="ml-auto font-semibold text-ink">
            {formatter && p.value !== undefined ? formatter(p.value, String(p.name)) : String(p.value)}
          </span>
        </p>
      ))}
    </div>
  );
}

export function ChartFrame({ height = 240, children, className }: { height?: number; children: ReactNode; className?: string }) {
  return (
    <div className={cn('w-full', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {children as never}
      </ResponsiveContainer>
    </div>
  );
}

export interface SeriesPoint { date: string; [key: string]: string | number | null }

export function TrendChart({
  data, dataKey, name, height = 240, color = SERIES[0], unit = '', domain, showGrid = true,
}: {
  data: SeriesPoint[];
  dataKey: string;
  name: string;
  height?: number;
  color?: string;
  unit?: string;
  domain?: [number | 'auto' | 'dataMin', number | 'auto' | 'dataMax'];
  showGrid?: boolean;
}) {
  return (
    <ChartFrame height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--c-line))" vertical={false} />}
        <XAxis dataKey="date" {...axis} tickFormatter={(v: string) => formatDate(v, 'short')} minTickGap={24} />
        <YAxis {...axis} width={46} domain={domain ?? ['auto', 'auto']} />
        <Tooltip
          content={<ChartTooltip formatter={(v) => `${v}${unit}`} labelFormatter={(l) => formatDate(String(l), 'medium')} />}
          cursor={{ stroke: 'rgb(var(--c-line-strong))', strokeDasharray: '3 3' }}
        />
        <Area type="monotone" dataKey={dataKey} name={name} stroke={color} strokeWidth={2.5}
          fill={`url(#grad-${dataKey})`} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} connectNulls />
      </AreaChart>
    </ChartFrame>
  );
}

export function MultiLineChart({
  data, series, height = 260, unit = '',
}: {
  data: SeriesPoint[];
  series: Array<{ key: string; name: string; color?: string }>;
  height?: number;
  unit?: string;
}) {
  return (
    <ChartFrame height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--c-line))" vertical={false} />
        <XAxis dataKey="date" {...axis} tickFormatter={(v: string) => formatDate(v, 'short')} minTickGap={24} />
        <YAxis {...axis} width={46} />
        <Tooltip content={<ChartTooltip formatter={(v) => `${v}${unit}`} labelFormatter={(l) => formatDate(String(l), 'medium')} />} />
        <Legend wrapperStyle={{ fontSize: 11, color: 'rgb(var(--c-ink-3))' }} iconType="circle" iconSize={7} />
        {series.map((s, i) => (
          <Line key={s.key} type="monotone" dataKey={s.key} name={s.name}
            stroke={s.color ?? SERIES[i % SERIES.length]} strokeWidth={2.4} dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }} connectNulls />
        ))}
      </LineChart>
    </ChartFrame>
  );
}

export function BarsChart({
  data, dataKey, name, height = 240, color = SERIES[0], unit = '', labelKey = 'date', formatLabel,
}: {
  data: Array<Record<string, string | number>>;
  dataKey: string;
  name: string;
  height?: number;
  color?: string;
  unit?: string;
  labelKey?: string;
  formatLabel?: (v: string) => string;
}) {
  return (
    <ChartFrame height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--c-line))" vertical={false} />
        <XAxis dataKey={labelKey} {...axis} tickFormatter={(v: string) => (formatLabel ? formatLabel(v) : v)} minTickGap={12} />
        <YAxis {...axis} width={46} />
        <Tooltip
          content={<ChartTooltip formatter={(v) => `${v}${unit}`} labelFormatter={(l) => (formatLabel ? formatLabel(String(l)) : String(l))} />}
          cursor={{ fill: 'rgb(var(--c-surface-2))' }}
        />
        <Bar dataKey={dataKey} name={name} fill={color} radius={[6, 6, 0, 0]} maxBarSize={44} />
      </BarChart>
    </ChartFrame>
  );
}

export function CategoryBars({
  data, height = 240, unit = '',
}: {
  data: Array<{ label: string; value: number; color?: string }>;
  height?: number;
  unit?: string;
}) {
  return (
    <ChartFrame height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--c-line))" horizontal={false} />
        <XAxis type="number" {...axis} />
        <YAxis type="category" dataKey="label" {...axis} width={92} />
        <Tooltip content={<ChartTooltip formatter={(v) => `${v}${unit}`} />} cursor={{ fill: 'rgb(var(--c-surface-2))' }} />
        <Bar dataKey="value" name="Sets" radius={[0, 6, 6, 0]} maxBarSize={20}>
          {data.map((d, i) => <Cell key={i} fill={d.color ?? SERIES[i % SERIES.length]} />)}
        </Bar>
      </BarChart>
    </ChartFrame>
  );
}

export function ScoreRadar({
  data, height = 260,
}: {
  data: Array<{ axis: string; value: number }>;
  height?: number;
}) {
  return (
    <ChartFrame height={height}>
      <RadarChart data={data} outerRadius="72%">
        <PolarGrid stroke="rgb(var(--c-line))" />
        <PolarAngleAxis dataKey="axis" tick={{ fill: 'rgb(var(--c-ink-3))', fontSize: 11 }} />
        <Radar name="Score" dataKey="value" stroke={SERIES[0]} fill={SERIES[0]} fillOpacity={0.28} strokeWidth={2} />
        <Tooltip content={<ChartTooltip formatter={(v) => `${v} / 100`} />} />
      </RadarChart>
    </ChartFrame>
  );
}
