import { useState, useMemo, useContext } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import { Layers, HardHat, Activity, TrendingUp } from 'lucide-react';
import ThemeContext from './ThemeContext';
import CustomTooltip from './CustomTooltip';
import KPIBox from './KPIBox';
import { MIXCODE_SHEET_NAME } from './constants';
import type { ConcreteRecord } from './types';

interface MixCodeBalancePageProps {
  mixCodeData: ConcreteRecord[];
  dashboardData: ConcreteRecord[];
  loading: boolean;
}

interface BalanceRow extends Record<string, string | number | null | undefined> {
  _key: string;
  poQty: number;
  used: number;
  pending: number;
  balance: number;
  usedPct: number;
}

function MixCodeBalancePage({ mixCodeData, dashboardData, loading }: MixCodeBalancePageProps) {
  const isDark = useContext(ThemeContext);
  const cGrid  = isDark ? '#334155' : '#E2E8F0';
  const cAxis  = isDark ? '#94A3B8' : '#64748B';
  const [supplierFilter, setSupplierFilter] = useState<string | null>(null);

  const mixCodeUsage = useMemo(() => {
    const usage: Record<string, { used: number; pending: number }> = {};
    dashboardData.forEach((item) => {
      const mc = (String(item['Mix code'] || '')).trim().toUpperCase();
      if (!mc) return;
      if (!usage[mc]) usage[mc] = { used: 0, pending: 0 };
      const status   = item['Current Status'];
      const reqVol   = parseFloat(String(item['Request Volume'])) || 0;
      const confVol  = parseFloat(String(item['Confirm Volume'])) || 0;
      if (status === '7') {
        usage[mc].used    += confVol;
      } else if (['1','2','3','3.1','4'].includes(status)) {
        usage[mc].pending += reqVol;
      }
    });
    return usage;
  }, [dashboardData]);

  const balanceRows = useMemo((): BalanceRow[] => {
    return mixCodeData.map((mc): BalanceRow => {
      const key     = (String(mc['Mix Code'] || '')).trim().toUpperCase();
      const poQty   = parseFloat(String(mc['Quantities (PO.)'] || '').replace(/,/g, '')) || 0;
      const used    = +(mixCodeUsage[key]?.used    || 0).toFixed(2);
      const pending = +(mixCodeUsage[key]?.pending || 0).toFixed(2);
      const balance = +(poQty - used - pending).toFixed(2);
      const usedPct = poQty > 0 ? +((used + pending) / poQty * 100).toFixed(2) : 0;
      return { ...mc, _key: key, poQty, used, pending, balance, usedPct };
    });
  }, [mixCodeData, mixCodeUsage]);

  const suppliers = useMemo(() =>
    [...new Set(balanceRows.map((r) => String(r['Supplier'] || '')).filter(Boolean))].sort(),
    [balanceRows]
  );

  const filtered = useMemo(() =>
    supplierFilter ? balanceRows.filter((r) => r['Supplier'] === supplierFilter) : balanceRows,
    [balanceRows, supplierFilter]
  );

  const totals = useMemo(() => filtered.reduce(
    (acc, r) => ({ poQty: acc.poQty + r.poQty, used: acc.used + r.used, pending: acc.pending + r.pending, balance: acc.balance + r.balance }),
    { poQty: 0, used: 0, pending: 0, balance: 0 }
  ), [filtered]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-indigo-400 font-bold animate-pulse text-lg">
        Loading Mix Code data...
      </div>
    );
  }

  return (
    <div>
      {/* Supplier filter chips */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setSupplierFilter(null)}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
            !supplierFilter ? 'bg-indigo-500 text-white border-indigo-500' : 'bg-slate-800/60 text-slate-400 border-slate-700/50 hover:border-slate-500 hover:text-white'
          }`}
        >
          All Suppliers
        </button>
        {suppliers.map((s) => (
          <button
            key={s}
            onClick={() => setSupplierFilter(supplierFilter === s ? null : s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
              supplierFilter === s ? 'bg-indigo-500 text-white border-indigo-500' : 'bg-slate-800/60 text-slate-400 border-slate-700/50 hover:border-slate-500 hover:text-white'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KPIBox title="Total PO Qty"      value={totals.poQty.toFixed(2)}    unit="m³" icon={<Layers size={20} />}    color="from-blue-600 to-cyan-500" />
        <KPIBox title="Used (Completed)"  value={totals.used.toFixed(2)}     unit="m³" icon={<HardHat size={20} />}   color="from-emerald-600 to-teal-500" />
        <KPIBox title="Pending (Active)"  value={totals.pending.toFixed(2)}  unit="m³" icon={<Activity size={20} />}  color="from-amber-600 to-orange-500" />
        <KPIBox
          title="Balance Remaining"
          value={totals.balance.toFixed(2)}
          unit="m³"
          icon={<TrendingUp size={20} />}
          color={totals.balance < 0 ? 'from-rose-600 to-pink-500' : 'from-slate-600 to-slate-400'}
          isAlert={totals.balance < 0}
          isSurplus={totals.balance > 0 && totals.poQty > 0}
        />
      </div>

      {/* Balance Chart */}
      {filtered.length > 0 && (
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5 mb-6 backdrop-blur-sm">
          <h2 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
            <span className="w-2 h-2 rounded-full bg-indigo-400" />
            Balance per Mix Code (m³)
          </h2>
          <div style={{ height: Math.max(180, filtered.length * 42) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={filtered.map((r) => ({
                  name:    String(r['Mix Code'] || r._key),
                  Used:    r.used,
                  Pending: r.pending,
                  Balance: Math.max(r.balance, 0),
                  Over:    r.balance < 0 ? Math.abs(r.balance) : 0,
                }))}
                layout="vertical"
                margin={{ top: 4, right: 60, left: 10, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={cGrid} horizontal={false} />
                <XAxis type="number" tick={{ fill: cAxis, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: cAxis, fontSize: 11, fontFamily: 'monospace' }} width={80} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: 'rgba(99,102,241,0.08)' }} content={<CustomTooltip valueFormat="volume" />} />
                <Legend wrapperStyle={{ fontSize: 11, color: cAxis, paddingTop: 8 }} />
                <Bar dataKey="Used"    stackId="a" fill="#10B981" radius={[0,0,0,0]} name="Used (m³)"    />
                <Bar dataKey="Pending" stackId="a" fill="#F59E0B" radius={[0,0,0,0]} name="Pending (m³)" />
                <Bar dataKey="Balance" stackId="a" fill={isDark ? '#334155' : '#94A3B8'} radius={[0,4,4,0]} name="Balance (m³)" />
                <Bar dataKey="Over"    stackId="a" fill="#F43F5E" radius={[0,4,4,0]} name="Over (m³)"    />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Balance Table */}
      <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl overflow-hidden backdrop-blur-sm">
        <div className="p-5 border-b border-slate-700/50 flex justify-between items-center">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-400" />
            Mix Code Balance Detail
          </h2>
          <span className="text-xs text-slate-500">{filtered.length} รายการ</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-900/60 border-b border-slate-700/50">
                {[
                  { label: 'Supplier',      align: 'left'  },
                  { label: 'Mix Code',      align: 'left'  },
                  { label: 'Strength',      align: 'left'  },
                  { label: 'Sample Type',   align: 'left'  },
                  { label: 'Slump',         align: 'left'  },
                  { label: 'PO Qty (m³)',   align: 'right' },
                  { label: 'Used (m³)',     align: 'right' },
                  { label: 'Pending (m³)',  align: 'right' },
                  { label: 'Balance (m³)',  align: 'right' },
                  { label: 'Usage %',       align: 'left'  },
                  { label: 'For Structure', align: 'left'  },
                ].map(({ label, align }) => (
                  <th key={label} className={`px-4 py-3 text-${align} text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap`}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => {
                const isOver = row.balance < 0;
                const isLow  = !isOver && row.usedPct >= 80;
                const balColor = isOver ? '#F43F5E' : isLow ? '#F59E0B' : (isDark ? '#E2E8F0' : '#1E293B');
                return (
                  <tr key={i} className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors">
                    <td className="px-4 py-3 text-slate-200 font-medium whitespace-nowrap">{String(row['Supplier'] || '')}</td>
                    <td className="px-4 py-3 font-mono text-indigo-300 font-bold whitespace-nowrap">{String(row['Mix Code'] || '')}</td>
                    <td className="px-4 py-3 text-slate-300 whitespace-nowrap">{String(row['Strength'] || '')} {String(row['Strength type'] || '')}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{String(row['Sample type'] || '')}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{String(row['Slump'] || '')}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-200 whitespace-nowrap">{row.poQty.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-emerald-400 whitespace-nowrap">{row.used.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-mono text-amber-400 whitespace-nowrap">{row.pending.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold whitespace-nowrap" style={{ color: balColor }}>
                      {row.balance.toFixed(2)}
                      {isOver && <span className="ml-1 text-[10px] font-normal text-rose-500">(Over)</span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ minWidth: 110 }}>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-700 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="h-1.5 rounded-full"
                            style={{
                              width: `${Math.min(row.usedPct, 100)}%`,
                              background: isOver ? '#F43F5E' : isLow ? '#F59E0B' : '#10B981',
                            }}
                          />
                        </div>
                        <span className="text-[11px] font-bold w-14 text-right" style={{ color: balColor }}>
                          {Number(row.usedPct).toFixed(2)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs max-w-xs truncate" title={String(row['For Structure'] || '')}>
                      {String(row['For Structure'] || '')}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={12} className="px-4 py-10 text-center text-slate-600 italic text-sm">
                    ไม่พบข้อมูล Mix Code — ตรวจสอบ Sheet &quot;{MIXCODE_SHEET_NAME}&quot; ว่ามีข้อมูลหรือไม่
                  </td>
                </tr>
              )}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr className="bg-slate-900/60 border-t border-slate-600/50">
                  <td colSpan={5} className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">รวมทั้งหมด</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-slate-200">{totals.poQty.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-emerald-400">{totals.used.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-amber-400">{totals.pending.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold" style={{ color: totals.balance < 0 ? '#F43F5E' : (isDark ? '#E2E8F0' : '#1E293B') }}>
                    {totals.balance.toFixed(2)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

export default MixCodeBalancePage;
