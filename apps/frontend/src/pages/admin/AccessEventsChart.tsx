import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { chartPalette, colors, shadows } from '../../design-system/tokens';

type Trend = { labels: string[]; allowed: number[]; denied: number[] };

interface Bucket {
  /** ISO YYYY-MM-DD HH:00 — kept for tooltip detail */
  iso: string;
  /** "HH:MM" tick label, with a "+1d" / date marker on day-change */
  time: string;
  Allowed: number;
  Denied: number;
}

/**
 * Two-series line chart for hourly Allowed vs. Denied access events over the
 * last 24h. Hardened for accessibility (role + aria-label + sr-only data
 * table), color-blind viewers (the Denied line is dashed in addition to red),
 * and day-rollover ambiguity (the first tick of a new day shows the date).
 */
export default function AccessEventsChart({ trend }: { trend: Trend }) {
  const data = useMemo<Bucket[]>(() => buildBuckets(trend), [trend]);

  return (
    <>
      <div
        className="h-72"
        role="img"
        aria-label={describeTrend(data)}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="2 4" stroke={chartPalette.grid} vertical={false} />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 11, fill: chartPalette.axis, fontFamily: '"Geist Mono", ui-monospace' }}
              axisLine={{ stroke: chartPalette.grid }}
              tickLine={false}
              minTickGap={24}
            />
            <YAxis
              width={36}
              allowDecimals={false}
              tick={{ fontSize: 11, fill: chartPalette.axis, fontFamily: '"Geist Mono", ui-monospace' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                fontSize: 12,
                borderRadius: 8,
                border: `1px solid ${colors.border}`,
                background: colors.surface,
                boxShadow: shadows.lg,
              }}
              labelStyle={{ fontFamily: '"Geist Mono", ui-monospace', color: colors.textMuted }}
              labelFormatter={(_label, payload) => {
                const iso = payload?.[0]?.payload?.iso as string | undefined;
                return iso ? formatTooltipLabel(iso) : '';
              }}
              formatter={(value: number) => value.toLocaleString()}
            />
            {data.length > 0 && (
              <ReferenceLine
                x={data[data.length - 1].time}
                stroke={chartPalette.axis}
                strokeOpacity={0.4}
                strokeDasharray="2 3"
                label={{ value: 'now', position: 'top', fontSize: 10, fill: chartPalette.axis }}
              />
            )}
            <Line
              type="linear"
              dataKey="Allowed"
              stroke={chartPalette.allowed}
              strokeWidth={1.75}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="linear"
              dataKey="Denied"
              stroke={chartPalette.denied}
              strokeWidth={1.75}
              strokeDasharray={chartPalette.deniedDash}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* sr-only tabular fallback so AT users get the full dataset */}
      <table className="sr-only">
        <caption>Hourly access events, last 24 hours</caption>
        <thead>
          <tr>
            <th scope="col">Hour</th>
            <th scope="col">Allowed</th>
            <th scope="col">Denied</th>
          </tr>
        </thead>
        <tbody>
          {data.map((b) => (
            <tr key={b.iso}>
              <th scope="row">{b.iso}</th>
              <td>{b.Allowed}</td>
              <td>{b.Denied}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function buildBuckets(trend: Trend): Bucket[] {
  const out: Bucket[] = [];
  let lastDate = '';
  for (let i = 0; i < trend.labels.length; i++) {
    const iso = trend.labels[i] ?? '';
    const dayPart = iso.slice(0, 10); // YYYY-MM-DD
    const hourPart = iso.slice(11, 16); // HH:MM
    // Show a small date marker on the first bucket of each new day so two
    // 00:00 ticks (yesterday → today) can't visually collapse into each other.
    const time = i === 0 || dayPart !== lastDate
      ? `${hourPart} · ${formatDayLabel(dayPart)}`
      : hourPart;
    lastDate = dayPart;
    out.push({
      iso,
      time,
      Allowed: trend.allowed[i] ?? 0,
      Denied: trend.denied[i] ?? 0,
    });
  }
  return out;
}

function formatDayLabel(yyyyMmDd: string): string {
  // 'YYYY-MM-DD' → 'MMM D' in user locale
  const [y, m, d] = yyyyMmDd.split('-').map((s) => parseInt(s, 10));
  if (!y || !m || !d) return '';
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatTooltipLabel(iso: string): string {
  // 'YYYY-MM-DD HH:00' → 'Mon, Apr 26 · 14:00'
  const [datePart, timePart] = iso.split(' ');
  if (!datePart) return iso;
  const [y, m, d] = datePart.split('-').map((s) => parseInt(s, 10));
  if (!y || !m || !d) return iso;
  const date = new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  return `${date} · ${timePart ?? ''}`.trim();
}

function describeTrend(buckets: Bucket[]): string {
  if (buckets.length === 0) return 'No access events recorded.';
  const totalAllowed = buckets.reduce((a, b) => a + b.Allowed, 0);
  const totalDenied = buckets.reduce((a, b) => a + b.Denied, 0);
  const peak = buckets.reduce((p, b) => (b.Allowed + b.Denied > p.Allowed + p.Denied ? b : p));
  return (
    `Hourly access events over the last 24 hours: ${totalAllowed.toLocaleString()} allowed, ` +
    `${totalDenied.toLocaleString()} denied. Peak hour ${peak.iso} with ` +
    `${(peak.Allowed + peak.Denied).toLocaleString()} events.`
  );
}
