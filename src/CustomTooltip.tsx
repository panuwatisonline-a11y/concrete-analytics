import { useContext } from 'react';
import ThemeContext from './ThemeContext';

interface PayloadEntry {
  name: string;
  value: number | string;
  color?: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: PayloadEntry[];
  label?: string;
  valueFormat?: 'auto' | 'volume' | 'count';
}

const CustomTooltip = ({ active, payload, label, valueFormat = 'auto' }: CustomTooltipProps) => {
  const isDark = useContext(ThemeContext);
  if (!active || !payload?.length) return null;
  const bg     = isDark ? 'rgba(15,23,42,0.97)'   : 'rgba(255,255,255,0.97)';
  const border = isDark ? '#334155'                : '#E2E8F0';
  const muted  = isDark ? '#94A3B8'                : '#64748B';
  const strong = isDark ? '#fff'                   : '#0F172A';
  const fmtVal = (v: number | string) => {
    if (typeof v !== 'number') return v;
    if (valueFormat === 'volume') return v.toFixed(2);
    if (valueFormat === 'count')  return v;
    return Number.isInteger(v) ? v : v.toFixed(2);
  };
  return (
    <div style={{
      background: bg,
      border: `1px solid ${border}`,
      borderRadius: 12,
      padding: '10px 14px',
      minWidth: 140,
      pointerEvents: 'none',
      boxShadow: isDark ? 'none' : '0 4px 16px rgba(0,0,0,0.10)',
    }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, borderBottom: `1px solid ${border}`, paddingBottom: 6 }}>
        {label}
      </p>
      {payload.map((entry, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, fontSize: 13, fontWeight: 500, marginBottom: 2 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: muted }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: entry.color, flexShrink: 0 }} />
            {entry.name}
          </span>
          <span style={{ fontWeight: 700, color: strong }}>{fmtVal(entry.value)}</span>
        </div>
      ))}
    </div>
  );
};

export default CustomTooltip;
