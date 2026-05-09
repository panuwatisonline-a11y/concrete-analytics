import { useState, useMemo, useContext } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LabelList,
} from 'recharts';
import { AlertTriangle, Activity } from 'lucide-react';
import ThemeContext from './ThemeContext';
import CustomTooltip from './CustomTooltip';
import { MONTHS } from './constants';
import type { ConcreteRecord } from './types';

interface LossCat {
  key: string;
  label: string;
  keyFn: (d: ConcreteRecord) => string | undefined;
  filter: ((d: ConcreteRecord) => boolean) | null;
}

const LOSS_CATS: LossCat[] = [
  { key: 'staff',     label: 'By Staff',          keyFn: (d) => String(d['Request by'] || ''), filter: null },
  { key: 'client',    label: 'By Sub Contractor', keyFn: (d) => String(d['Client'] || ''),      filter: null },
  { key: 'structure', label: 'By Structure',      keyFn: (d) => String(d['Structure'] || ''),   filter: (d) => !/lean|blinding/i.test(String(d['Structure'] || '')) && !/bored\s*pile/i.test(String(d['Structure'] || '')) },
  { key: 'lean',      label: 'Lean / Blinding',   keyFn: (d) => String(d['Structure'] || ''),   filter: (d) => /lean|blinding/i.test(String(d['Structure'] || '')) },
  { key: 'boredpile', label: 'Bored Pile',        keyFn: (d) => String(d['Structure'] || ''),   filter: (d) => /bored\s*pile/i.test(String(d['Structure'] || '')) },
];

interface LossItem {
  name: string;
  lossM3: number;
  dwgVol: number;
  confVol: number;
  lossPct: number;
  count: number;
}

interface CategoryGroup {
  key: string;
  label: string;
  items: LossItem[];
}

interface Selection {
  category: string;
  value: string | null;
}

type Granularity = 'day' | 'week' | 'month' | 'year';
type CmpMode = 'm3' | 'pct';

interface LossConcretePageProps {
  dashboardData: ConcreteRecord[];
}

interface KeyInfo {
  key: string;
  ts: number;
  name: string;
}

function LossConcretePage({ dashboardData }: LossConcretePageProps) {
  const isDark = useContext(ThemeContext);
  const cGrid  = isDark ? '#334155' : '#E2E8F0';
  const cAxis  = isDark ? '#94A3B8' : '#64748B';
  const [trendGranularity, setTrendGranularity] = useState<Granularity>('month');
  const [selection,        setSelection]        = useState<Selection | null>(null);
  const [cmpMode,          setCmpMode]          = useState<CmpMode>('m3');

  const lossItems = useMemo(() =>
    dashboardData.filter(
      (d) => d['Current Status'] === '7' && d['Loss Concrete'] !== null && parseFloat(String(d['DWG. Volume'])) > 0
    ),
    [dashboardData]
  );

  const activeItems = useMemo(() => {
    if (!selection) return lossItems;
    const cat = LOSS_CATS.find((c) => c.key === selection.category);
    if (!cat) return lossItems;
    let subset = cat.filter ? lossItems.filter(cat.filter) : lossItems;
    if (selection.value) subset = subset.filter((d) => (cat.keyFn(d) || 'Unknown') === selection.value);
    return subset;
  }, [lossItems, selection]);

  const categoryGroups = useMemo((): CategoryGroup[] =>
    LOSS_CATS.map((cat) => {
      const subset = cat.filter ? lossItems.filter(cat.filter) : lossItems;
      const map: Record<string, { name: string; lossM3: number; dwgVol: number; confVol: number; count: number }> = {};
      subset.forEach((d) => {
        const key = cat.keyFn(d) || 'Unknown';
        if (!map[key]) map[key] = { name: key, lossM3: 0, dwgVol: 0, confVol: 0, count: 0 };
        map[key].lossM3  += parseFloat(String(d['Loss Concrete']))  || 0;
        map[key].dwgVol  += parseFloat(String(d['DWG. Volume']))    || 0;
        map[key].confVol += parseFloat(String(d['Confirm Volume'])) || 0;
        map[key].count++;
      });
      const items: LossItem[] = Object.values(map)
        .map((o) => ({
          name:    o.name,
          lossM3:  +o.lossM3.toFixed(2),
          dwgVol:  +o.dwgVol.toFixed(2),
          confVol: +o.confVol.toFixed(2),
          lossPct: o.dwgVol > 0 ? +(o.lossM3 / o.dwgVol * 100).toFixed(2) : 0,
          count:   o.count,
        }))
        .sort((a, b) => b.lossM3 - a.lossM3);
      return { key: cat.key, label: cat.label, items };
    }),
    [lossItems]
  );

  const kpi = useMemo(() => {
    let totalLoss = 0, totalDwg = 0, totalConf = 0;
    activeItems.forEach((d) => {
      totalLoss += parseFloat(String(d['Loss Concrete']))  || 0;
      totalDwg  += parseFloat(String(d['DWG. Volume']))    || 0;
      totalConf += parseFloat(String(d['Confirm Volume'])) || 0;
    });
    return {
      count:   activeItems.length,
      lossM3:  totalLoss.toFixed(2),
      lossPct: totalDwg > 0 ? (totalLoss / totalDwg * 100).toFixed(2) : '0.00',
      dwgVol:  totalDwg.toFixed(2),
      confVol: totalConf.toFixed(2),
    };
  }, [activeItems]);

  const comparisonData = useMemo(() => {
    if (!selection) return null;
    const group = categoryGroups.find((g) => g.key === selection.category);
    if (!group || group.items.length === 0) return null;
    return group.items.map((item) => ({
      name:          item.name,
      'DWG Vol':     item.dwgVol,
      'Confirm Vol': item.confVol,
      'Loss (m³)':   item.lossM3,
    }));
  }, [selection, categoryGroups]);

  const comparisonLabel = selection
    ? LOSS_CATS.find((c) => c.key === selection.category)?.label || ''
    : '';

  const trendData = useMemo(() => {
    if (activeItems.length === 0) return [];
    const maxTs   = activeItems.reduce((m, i) => Math.max(m, i.Timestamp), 0);
    const maxDate = new Date(maxTs);
    let cutoffTs  = 0;
    if (trendGranularity === 'day') {
      const c = new Date(maxDate); c.setDate(c.getDate() - 29);        c.setHours(0,0,0,0); cutoffTs = c.getTime();
    } else if (trendGranularity === 'week') {
      const c = new Date(maxDate); c.setDate(c.getDate() - 83);        c.setHours(0,0,0,0); cutoffTs = c.getTime();
    } else if (trendGranularity === 'month') {
      const c = new Date(maxDate); c.setMonth(c.getMonth() - 11); c.setDate(1); c.setHours(0,0,0,0); cutoffTs = c.getTime();
    }

    const getKeyInfo = (item: ConcreteRecord): KeyInfo | null => {
      const d = new Date(item.Timestamp);
      if (trendGranularity === 'day') {
        const yyyy = d.getFullYear(), mm = String(d.getMonth()+1).padStart(2,'0'), dd = String(d.getDate()).padStart(2,'0');
        return { key: `${yyyy}-${mm}-${dd}`, ts: new Date(yyyy, d.getMonth(), d.getDate()).getTime(), name: `${dd}/${mm}` };
      } else if (trendGranularity === 'week') {
        const dow = d.getDay(), diff = dow === 0 ? -6 : 1 - dow;
        const ws = new Date(d); ws.setDate(d.getDate() + diff); ws.setHours(0,0,0,0);
        const wy = ws.getFullYear(), wm = String(ws.getMonth()+1).padStart(2,'0'), wd = String(ws.getDate()).padStart(2,'0');
        return { key: `${wy}-${wm}-${wd}`, ts: ws.getTime(), name: `${wd}/${wm}` };
      } else if (trendGranularity === 'month') {
        if (item.Month === 'Unknown') return null;
        const [mon, yr] = item.Month.split(' ');
        const monIdx = MONTHS.indexOf(mon);
        return { key: item.Month, ts: monIdx >= 0 ? new Date(+yr, monIdx, 1).getTime() : item.Timestamp, name: item.Month };
      } else {
        const yr = d.getFullYear();
        return { key: String(yr), ts: new Date(yr, 0, 1).getTime(), name: String(yr) };
      }
    };

    const res: Record<string, { name: string; ts: number; 'DWG Vol': number; 'Confirm Vol': number; 'Loss (m³)': number }> = {};
    activeItems.forEach((item) => {
      if (item.Timestamp < cutoffTs) return;
      const info = getKeyInfo(item);
      if (!info) return;
      const { key, ts, name } = info;
      if (!res[key]) res[key] = { name, ts, 'DWG Vol': 0, 'Confirm Vol': 0, 'Loss (m³)': 0 };
      res[key]['DWG Vol']     += parseFloat(String(item['DWG. Volume']))    || 0;
      res[key]['Confirm Vol'] += parseFloat(String(item['Confirm Volume'])) || 0;
      res[key]['Loss (m³)']   += parseFloat(String(item['Loss Concrete']))  || 0;
    });

    return Object.values(res)
      .sort((a, b) => a.ts - b.ts)
      .map((o) => ({
        name:          o.name,
        'DWG Vol':     +o['DWG Vol'].toFixed(2),
        'Confirm Vol': +o['Confirm Vol'].toFixed(2),
        'Loss (m³)':   +o['Loss (m³)'].toFixed(2),
      }));
  }, [activeItems, trendGranularity]);

  const chartLabel = selection
    ? selection.value || LOSS_CATS.find((c) => c.key === selection.category)?.label || ''
    : 'All Data';

  return (
    <div className="space-y-4">
      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Items',         value: kpi.count,   unit: '',   color: 'from-slate-600 to-slate-400' },
          { label: 'DWG Vol',       value: kpi.dwgVol,  unit: 'm³', color: 'from-slate-500 to-slate-400' },
          { label: 'Confirm Vol',   value: kpi.confVol, unit: 'm³', color: 'from-emerald-600 to-teal-500' },
          { label: 'Total Loss',    value: kpi.lossM3,  unit: 'm³', color: parseFloat(kpi.lossM3) > 0 ? 'from-rose-600 to-pink-500' : 'from-emerald-600 to-teal-500' },
          { label: 'Loss % of DWG', value: kpi.lossPct, unit: '%',  color: parseFloat(kpi.lossPct) > 0 ? 'from-orange-500 to-amber-500' : 'from-emerald-600 to-teal-500' },
        ].map(({ label, value, unit, color }) => (
          <div key={label} className={`bg-gradient-to-br ${color} p-px rounded-xl shadow-lg`}>
            <div className="bg-slate-900/80 rounded-xl p-4 h-full">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
              <p className="text-2xl font-extrabold text-white">{value}<span className="text-xs font-semibold text-slate-400 ml-1">{unit}</span></p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Trend chart */}
        <div className="flex-1 min-w-0 bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5 shadow-lg backdrop-blur-sm">
          <div className="flex flex-wrap justify-between items-start gap-3 mb-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <AlertTriangle className="text-rose-400" size={16} />
                Loss Concrete Trend
              </h3>
              <p className="text-xs text-rose-300/80 mt-0.5 ml-6 font-semibold">{chartLabel}</p>
            </div>
            <div className="flex gap-1 bg-slate-900/50 p-1 rounded-xl border border-slate-700/50">
              {([{ key:'day', label:'วัน' }, { key:'week', label:'สัปดาห์' }, { key:'month', label:'เดือน' }, { key:'year', label:'ปี' }] as { key: Granularity; label: string }[]).map(({ key, label }) => (
                <button key={key} onClick={() => setTrendGranularity(key)}
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all ${
                    trendGranularity === key ? 'bg-rose-500 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {trendData.length === 0 ? (
            <div className="flex items-center justify-center h-72 text-slate-600 text-sm italic">ไม่มีข้อมูล</div>
          ) : (
            <div style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 24, right: 12, left: -14, bottom: 0 }}>
                  <defs>
                    <linearGradient id="lgLossDwg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#94A3B8" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#94A3B8" stopOpacity={0}   />
                    </linearGradient>
                    <linearGradient id="lgLossConf" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#10B981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0}   />
                    </linearGradient>
                    <linearGradient id="lgLossRed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#F43F5E" stopOpacity={0.45} />
                      <stop offset="95%" stopColor="#F43F5E" stopOpacity={0}    />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={cGrid} />
                  <XAxis dataKey="name" stroke={cAxis} fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke={cAxis} fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip valueFormat="volume" />} cursor={{ stroke: '#475569', strokeWidth: 1, strokeDasharray: '4 4' }} wrapperStyle={{ pointerEvents: 'none', zIndex: 50 }} />
                  <Legend wrapperStyle={{ fontSize: 10, color: cAxis, paddingTop: 6 }} />
                  <Area type="monotone" dataKey="DWG Vol" name="DWG Volume" stroke="#94A3B8" strokeWidth={2} strokeDasharray="5 3" fill="url(#lgLossDwg)" dot={{ r: 3, fill: '#94A3B8', strokeWidth: 0 }} activeDot={{ r: 5, fill: '#94A3B8', strokeWidth: 0 }}>
                    <LabelList dataKey="DWG Vol"   position="top" style={{ fill: cAxis,     fontSize: 10, fontWeight: 600, pointerEvents: 'none' }} formatter={(v) => typeof v === 'number' && v > 0 ? v.toFixed(2) : ''} />
                  </Area>
                  <Area type="monotone" dataKey="Confirm Vol" name="Confirm Volume" stroke="#10B981" strokeWidth={2} fill="url(#lgLossConf)" dot={{ r: 3, fill: '#10B981', strokeWidth: 0 }} activeDot={{ r: 5, fill: '#10B981', strokeWidth: 0 }}>
                    <LabelList dataKey="Confirm Vol" position="top" style={{ fill: '#10B981', fontSize: 10, fontWeight: 600, pointerEvents: 'none' }} formatter={(v) => typeof v === 'number' && v > 0 ? v.toFixed(2) : ''} />
                  </Area>
                  <Area type="monotone" dataKey="Loss (m³)" name="Loss Concrete" stroke="#F43F5E" strokeWidth={3} fill="url(#lgLossRed)" dot={{ r: 3, fill: '#F43F5E', strokeWidth: 0 }} activeDot={{ r: 5, fill: '#F43F5E', strokeWidth: 0 }}>
                    <LabelList dataKey="Loss (m³)" position="top" style={{ fill: '#F43F5E', fontSize: 10, fontWeight: 600, pointerEvents: 'none' }} formatter={(v) => typeof v === 'number' && v > 0 ? v.toFixed(2) : ''} />
                  </Area>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Comparison chart */}
        {selection && comparisonData && (
          <div className="flex-1 min-w-0 bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5 shadow-lg backdrop-blur-sm">
            <div className="flex flex-wrap justify-between items-start gap-3 mb-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Activity className="text-amber-400" size={16} />
                  Comparison
                </h3>
                <p className="text-xs text-amber-300/80 mt-0.5 ml-6 font-semibold">{comparisonLabel}</p>
              </div>
              <div className="flex gap-1 bg-slate-900/50 p-1 rounded-xl border border-slate-700/50">
                <button onClick={() => setCmpMode('m3')}
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all ${cmpMode === 'm3' ? 'bg-amber-500 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
                  m³
                </button>
                <button onClick={() => setCmpMode('pct')}
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all ${cmpMode === 'pct' ? 'bg-amber-500 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
                  %
                </button>
              </div>
            </div>
            {(() => {
              const sourceData = cmpMode === 'pct'
                ? comparisonData.map((d) => ({
                    name:         d.name,
                    'DWG (100%)': 100,
                    'Confirm %':  d['DWG Vol'] > 0 ? +(d['Confirm Vol'] / d['DWG Vol'] * 100).toFixed(2) : 0,
                    'Loss %':     d['DWG Vol'] > 0 ? +(d['Loss (m³)']  / d['DWG Vol'] * 100).toFixed(2) : 0,
                  }))
                : comparisonData;
              const k1 = cmpMode === 'pct' ? 'DWG (100%)' : 'DWG Vol';
              const k2 = cmpMode === 'pct' ? 'Confirm %'  : 'Confirm Vol';
              const k3 = cmpMode === 'pct' ? 'Loss %'     : 'Loss (m³)';
              const zero: Record<string, number | string> = { _lbl: '', [k1]: 0, [k2]: 0, [k3]: 0 };
              const pyramidData: Record<string, number | string>[] = [{ ...zero }];
              sourceData.forEach((d) => {
                pyramidData.push({ ...d, _lbl: d.name });
                pyramidData.push({ ...zero });
              });
              const bottomPad = comparisonData.length > 3 ? 72 : 24;
              return (
                <div style={{ height: 320 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={pyramidData} margin={{ top: 24, right: 16, left: -14, bottom: bottomPad }}>
                      <defs>
                        <linearGradient id="cmpDwg" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%"   stopColor="#94A3B8" stopOpacity={0.55} />
                          <stop offset="100%" stopColor="#94A3B8" stopOpacity={0.05} />
                        </linearGradient>
                        <linearGradient id="cmpConf" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%"   stopColor="#10B981" stopOpacity={0.65} />
                          <stop offset="100%" stopColor="#10B981" stopOpacity={0.05} />
                        </linearGradient>
                        <linearGradient id="cmpLoss" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%"   stopColor="#F43F5E" stopOpacity={0.6} />
                          <stop offset="100%" stopColor="#F43F5E" stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={cGrid} />
                      <XAxis
                        dataKey="_lbl"
                        stroke={cAxis}
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        angle={comparisonData.length > 3 ? -35 : 0}
                        textAnchor={comparisonData.length > 3 ? 'end' : 'middle'}
                        interval={0}
                        tick={{ fill: cAxis, fontSize: 10 }}
                      />
                      <YAxis stroke={cAxis} fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v: number) => cmpMode === 'pct' ? `${v}%` : String(v)} />
                      <Tooltip content={<CustomTooltip valueFormat="volume" />} cursor={{ stroke: '#475569', strokeWidth: 1, strokeDasharray: '4 4' }} wrapperStyle={{ pointerEvents: 'none', zIndex: 50 }} />
                      <Legend wrapperStyle={{ fontSize: 10, color: cAxis, paddingTop: 6 }} />
                      {cmpMode === 'm3' && (
                        <Area type="linear" dataKey={k1} name="DWG Volume" stroke="#94A3B8" strokeWidth={2} strokeDasharray="5 3" fill="url(#cmpDwg)" dot={false} activeDot={{ r: 5 }}>
                          <LabelList dataKey={k1} position="top" style={{ fill: cAxis, fontSize: 9, fontWeight: 600 }} formatter={(v) => typeof v === 'number' && v > 0 ? v.toFixed(2) : ''} />
                        </Area>
                      )}
                      {cmpMode === 'm3' && (
                        <Area type="linear" dataKey={k2} name="Confirm Volume" stroke="#10B981" strokeWidth={2} fill="url(#cmpConf)" dot={false} activeDot={{ r: 5 }}>
                          <LabelList dataKey={k2} position="top" style={{ fill: '#10B981', fontSize: 9, fontWeight: 600 }} formatter={(v) => typeof v === 'number' && v > 0 ? v.toFixed(2) : ''} />
                        </Area>
                      )}
                      <Area type="linear" dataKey={k3} name={cmpMode === 'pct' ? 'Loss %' : 'Loss Concrete'} stroke="#F43F5E" strokeWidth={3} fill="url(#cmpLoss)" dot={false} activeDot={{ r: 6 }}>
                        <LabelList dataKey={k3} position="top" style={{ fill: '#F43F5E', fontSize: 9, fontWeight: 700 }} formatter={(v) => typeof v === 'number' && v !== 0 ? (cmpMode === 'pct' ? `${v.toFixed(2)}%` : v.toFixed(2)) : ''} />
                      </Area>
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Bottom: Group table with category tabs */}
      <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl shadow-lg overflow-hidden">
        <div className="flex items-center gap-1.5 px-4 py-3 border-b border-slate-700/50 flex-wrap bg-slate-900/30">
          <button
            onClick={() => setSelection(null)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              !selection
                ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
            }`}
          >
            <Activity size={12} /> All Data
            <span className="bg-white/20 px-1.5 py-0.5 rounded-full text-[10px]">{lossItems.length}</span>
          </button>
          {categoryGroups.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setSelection({ category: cat.key, value: null })}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selection?.category === cat.key
                  ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/25'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
              }`}
            >
              {cat.label}
              <span className="bg-white/20 px-1.5 py-0.5 rounded-full text-[10px]">{cat.items.length}</span>
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          {!selection ? (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-500 uppercase tracking-wider text-[10px] border-b border-slate-700/50">
                  <th className="text-left px-5 py-3 font-bold">Category</th>
                  <th className="text-right px-4 py-3 font-bold">Items</th>
                  <th className="text-right px-4 py-3 font-bold">DWG Vol (m³)</th>
                  <th className="text-right px-4 py-3 font-bold">Confirm Vol (m³)</th>
                  <th className="text-right px-4 py-3 font-bold">Loss (m³)</th>
                  <th className="text-right px-5 py-3 font-bold">Loss % DWG</th>
                </tr>
              </thead>
              <tbody>
                {categoryGroups.map((cat) => {
                  const totDwg  = cat.items.reduce((s, i) => s + i.dwgVol,  0);
                  const totConf = cat.items.reduce((s, i) => s + i.confVol, 0);
                  const totLoss = cat.items.reduce((s, i) => s + i.lossM3,  0);
                  const lossPct = totDwg > 0 ? (totLoss / totDwg * 100).toFixed(2) : '—';
                  return (
                    <tr
                      key={cat.key}
                      onClick={() => setSelection({ category: cat.key, value: null })}
                      className="border-b border-slate-700/30 last:border-b-0 hover:bg-slate-700/20 cursor-pointer transition-colors"
                    >
                      <td className="px-5 py-3 font-bold text-slate-200">{cat.label}</td>
                      <td className="px-4 py-3 text-right text-slate-400 tabular-nums">{cat.items.length}</td>
                      <td className="px-4 py-3 text-right text-slate-400 tabular-nums">{totDwg.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-emerald-400 tabular-nums">{totConf.toFixed(2)}</td>
                      <td className={`px-4 py-3 text-right font-bold tabular-nums ${totLoss > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>{totLoss.toFixed(2)}</td>
                      <td className={`px-5 py-3 text-right font-bold tabular-nums ${parseFloat(String(lossPct)) > 0 ? 'text-orange-400' : 'text-emerald-400'}`}>{lossPct}{lossPct !== '—' ? '%' : ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            (() => {
              const group = categoryGroups.find((g) => g.key === selection.category);
              if (!group || group.items.length === 0) {
                return <p className="px-5 py-8 text-center text-slate-600 text-sm italic">ไม่มีข้อมูล</p>;
              }
              return (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-500 uppercase tracking-wider text-[10px] border-b border-slate-700/50">
                      <th className="text-left px-5 py-3 font-bold">Name</th>
                      <th className="text-right px-4 py-3 font-bold">Items</th>
                      <th className="text-right px-4 py-3 font-bold">DWG Vol (m³)</th>
                      <th className="text-right px-4 py-3 font-bold">Confirm Vol (m³)</th>
                      <th className="text-right px-4 py-3 font-bold">Loss (m³)</th>
                      <th className="text-right px-5 py-3 font-bold">Loss % DWG</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.items.map((item) => (
                      <tr
                        key={item.name}
                        onClick={() => setSelection({ category: selection.category, value: item.name === selection.value ? null : item.name })}
                        className={`border-b border-slate-700/30 last:border-b-0 cursor-pointer transition-colors ${
                          selection.value === item.name
                            ? 'bg-rose-500/10 border-l-2 border-l-rose-400'
                            : 'hover:bg-slate-700/20'
                        }`}
                      >
                        <td className={`px-5 py-3 font-semibold ${selection.value === item.name ? 'text-rose-300' : 'text-slate-200'}`}>{item.name || '—'}</td>
                        <td className="px-4 py-3 text-right text-slate-400 tabular-nums">{item.count}</td>
                        <td className="px-4 py-3 text-right text-slate-400 tabular-nums">{item.dwgVol.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right text-emerald-400 tabular-nums">{item.confVol.toFixed(2)}</td>
                        <td className={`px-4 py-3 text-right font-bold tabular-nums ${item.lossM3 > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>{item.lossM3.toFixed(2)}</td>
                        <td className={`px-5 py-3 text-right font-bold tabular-nums ${item.lossPct > 0 ? 'text-orange-400' : 'text-emerald-400'}`}>{Number(item.lossPct).toFixed(2)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              );
            })()
          )}
        </div>
      </div>
    </div>
  );
}

export default LossConcretePage;
