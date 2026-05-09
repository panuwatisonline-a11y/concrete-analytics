import React, { useState, useMemo, useCallback, useRef, useEffect, useContext } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell,
  LineChart, Line, LabelList,
} from 'recharts';
import {
  HardHat, FileCheck, AlertTriangle, Layers,
  ChevronRight, X, Filter, Activity, TrendingUp,
  Eye, FolderOpen, Folder,
} from 'lucide-react';
import ThemeContext from './ThemeContext';
import CustomTooltip from './CustomTooltip';
import StatusBadge from './StatusBadge';
import KPIBox from './KPIBox';
import ChartBox from './ChartBox';
import { STATUS_INFO, STATUS_ORDER, SUPPLIER_COLORS, MONTHS } from './constants';
import type { ConcreteRecord, Filters } from './types';

interface DashboardPageProps {
  filteredData: ConcreteRecord[];
  filters: Filters;
  toggleFilter: (key: keyof Filters, value: string) => void;
}

type Granularity = 'day' | 'week' | 'month' | 'year';

interface KeyInfo {
  key: string;
  ts: number;
  name: string;
}

interface LabelContentProps {
  x?: string | number;
  y?: string | number;
  width?: string | number;
  height?: string | number;
  value?: number | string | (string | number)[] | null;
}

function DashboardPage({ filteredData, filters, toggleFilter }: DashboardPageProps) {
  const isDark = useContext(ThemeContext);
  const cGrid  = isDark ? '#334155' : '#E2E8F0';
  const cAxis  = isDark ? '#94A3B8' : '#64748B';
  const cLabel = isDark ? '#E2E8F0' : '#1E293B';
  const cDim   = isDark ? '#334155' : '#CBD5E1';

  const [trendGranularity,       setTrendGranularity]       = useState<Granularity>('month');
  const [statusTrendGranularity, setStatusTrendGranularity] = useState<Granularity>('month');
  const [hiddenStructures,       setHiddenStructures]       = useState<Set<string>>(new Set());
  const [structureDropdownOpen,  setStructureDropdownOpen]  = useState<boolean>(false);
  const structureDropdownRef = useRef<HTMLDivElement>(null);
  const [expandedGroups,  setExpandedGroups]  = useState<Record<string, boolean>>({});
  const [selectedRow,     setSelectedRow]     = useState<ConcreteRecord | null>(null);
  const [windowWidth,     setWindowWidth]     = useState<number>(() => typeof window !== 'undefined' ? window.innerWidth : 1280);

  const isMobile  = windowWidth < 640;
  const isCompact = windowWidth >= 640;

  useEffect(() => {
    const handler = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (structureDropdownRef.current && !structureDropdownRef.current.contains(e.target as Node)) {
        setStructureDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (filters.status) {
      setExpandedGroups((prev) => ({ ...prev, [filters.status as string]: true }));
    }
  }, [filters.status]);

  const toggleGroup = useCallback((status: string) => {
    setExpandedGroups((prev) => ({ ...prev, [status]: !prev[status] }));
  }, []);

  const structureFilteredData = useMemo(() => {
    if (hiddenStructures.size === 0) return filteredData;
    return filteredData.filter(item => !hiddenStructures.has((String(item['Structure'] || '')).trim()));
  }, [filteredData, hiddenStructures]);

  const sortedData = useMemo(
    () => [...structureFilteredData].sort((a, b) => b.Timestamp - a.Timestamp),
    [structureFilteredData]
  );

  const groupedData = useMemo<Record<string, ConcreteRecord[]>>(() => {
    const groups: Record<string, ConcreteRecord[]> = {};
    sortedData.forEach((item) => {
      const s = item['Current Status'];
      if (!groups[s]) groups[s] = [];
      groups[s].push(item);
    });
    return groups;
  }, [sortedData]);

  const kpis = useMemo(() => {
    let totalReq = 0, totalDwg = 0, compConf = 0, compDwg = 0, lossConc = 0;
    structureFilteredData.forEach((item) => {
      const r = parseFloat(String(item['Request Volume'])) || 0;
      const d = parseFloat(String(item['DWG. Volume']))    || 0;
      const c = parseFloat(String(item['Confirm Volume'])) || 0;
      const l = parseFloat(String(item['Loss Concrete']))  || 0;
      totalReq += r;
      totalDwg += d;
      if (item['Current Status'] === '7') {
        compConf += c;
        compDwg  += d;
        lossConc += l;
      }
    });
    return {
      count:           structureFilteredData.length,
      totalDwgVol:     totalReq.toFixed(2),
      requestVol:      totalReq.toFixed(2),
      dwgVol:          totalDwg.toFixed(2),
      confirmVol:      compConf.toFixed(2),
      lossConcVol:     lossConc.toFixed(2),
      lossConcPercent: compDwg > 0 ? (lossConc / compDwg * 100).toFixed(2) : '0.00',
    };
  }, [structureFilteredData]);

  const chartStatusData = useMemo(() => {
    const counts: Record<string, number> = {};
    structureFilteredData.forEach((item) => {
      const k = item['Current Status'] || 'Unknown';
      counts[k] = (counts[k] || 0) + 1;
    });
    return STATUS_ORDER
      .filter((key) => counts[key] > 0)
      .map((name) => ({
        name,
        value:     counts[name],
        shortName: STATUS_INFO[name].short,
        legend:    STATUS_INFO[name].legend,
        color:     STATUS_INFO[name].color,
      }));
  }, [structureFilteredData]);

  const chartSupplierData = useMemo(() => {
    const res: Record<string, number> = {};
    structureFilteredData.forEach((item) => {
      const k = (String(item['Supplier'] || '')).trim();
      if (!k) return;
      res[k] = (res[k] || 0) + (parseFloat(String(item['DWG. Volume'])) || 0);
    });
    return Object.entries(res)
      .map(([name, vol]) => ({ name, value: +vol.toFixed(2) }))
      .sort((a, b) => b.value - a.value);
  }, [structureFilteredData]);

  const chartStrengthData = useMemo(() => {
    const res: Record<string, number> = {};
    structureFilteredData.forEach((item) => {
      const k = String(item['Strength'] ?? '').trim();
      if (!k) return;
      res[k] = (res[k] || 0) + (parseFloat(String(item['DWG. Volume'])) || 0);
    });
    return Object.entries(res)
      .map(([name, vol]) => ({ name, value: +vol.toFixed(2) }))
      .sort((a, b) => (parseInt(b.name) || 0) - (parseInt(a.name) || 0));
  }, [structureFilteredData]);

  const chartStructureData = useMemo(() => {
    const res: Record<string, { name: string; dwg: number; confirm: number }> = {};
    filteredData.forEach((item) => {
      const k = (String(item['Structure'] || '')).trim();
      if (!k) return;
      if (!res[k]) res[k] = { name: k, dwg: 0, confirm: 0 };
      res[k].dwg += parseFloat(String(item['DWG. Volume'])) || 0;
      if (item['Current Status'] === '7') {
        res[k].confirm += parseFloat(String(item['Confirm Volume'])) || 0;
      }
    });
    return Object.values(res)
      .map((o) => ({ name: o.name, 'DWG Vol': +o.dwg.toFixed(2), 'Confirm Vol': +o.confirm.toFixed(2) }))
      .sort((a, b) => b['DWG Vol'] - a['DWG Vol']);
  }, [filteredData]);

  const chartStaffData = useMemo(() => {
    const res: Record<string, { name: string; dwg: number; confirm: number }> = {};
    structureFilteredData.forEach((item) => {
      const k = (String(item['Request by'] || '')).trim();
      if (!k) return;
      if (!res[k]) res[k] = { name: k, dwg: 0, confirm: 0 };
      res[k].dwg += parseFloat(String(item['DWG. Volume'])) || 0;
      if (item['Current Status'] === '7') {
        res[k].confirm += parseFloat(String(item['Confirm Volume'])) || 0;
      }
    });
    return Object.values(res)
      .map((o) => ({ name: o.name, 'DWG Vol': +o.dwg.toFixed(2), 'Confirm Vol': +o.confirm.toFixed(2) }))
      .sort((a, b) => b['DWG Vol'] - a['DWG Vol']);
  }, [structureFilteredData]);

  const getKeyInfo = useCallback((item: ConcreteRecord, granularity: Granularity): KeyInfo | null => {
    const d = new Date(item.Timestamp);
    if (granularity === 'day') {
      const yyyy = d.getFullYear(), mm = String(d.getMonth() + 1).padStart(2,'0'), dd = String(d.getDate()).padStart(2,'0');
      return { key: `${yyyy}-${mm}-${dd}`, ts: new Date(yyyy, d.getMonth(), d.getDate()).getTime(), name: `${dd}/${mm}` };
    } else if (granularity === 'week') {
      const dow = d.getDay(), diff = dow === 0 ? -6 : 1 - dow;
      const ws = new Date(d); ws.setDate(d.getDate() + diff); ws.setHours(0,0,0,0);
      const wy = ws.getFullYear(), wm = String(ws.getMonth() + 1).padStart(2,'0'), wd = String(ws.getDate()).padStart(2,'0');
      return { key: `${wy}-${wm}-${wd}`, ts: ws.getTime(), name: `${wd}/${wm}` };
    } else if (granularity === 'month') {
      if (item.Month === 'Unknown') return null;
      const [mon, yr] = item.Month.split(' ');
      const monIdx = MONTHS.indexOf(mon);
      return { key: item.Month, ts: monIdx >= 0 ? new Date(+yr, monIdx, 1).getTime() : item.Timestamp, name: item.Month };
    } else {
      const yr = d.getFullYear();
      return { key: String(yr), ts: new Date(yr, 0, 1).getTime(), name: String(yr) };
    }
  }, []);

  const chartTimelineVol = useMemo(() => {
    const completedItems = structureFilteredData.filter(item => item['Current Status'] === '7' && item.Timestamp > 0);
    const planItems      = structureFilteredData.filter(item => item.Timestamp > 0);
    if (completedItems.length === 0 && planItems.length === 0) return [];

    const maxTs   = planItems.reduce((m, i) => Math.max(m, i.Timestamp), 0);
    const maxDate = new Date(maxTs);
    let cutoffTs  = 0;
    if (trendGranularity === 'day') {
      const c = new Date(maxDate); c.setDate(c.getDate() - 29); c.setHours(0,0,0,0); cutoffTs = c.getTime();
    } else if (trendGranularity === 'week') {
      const c = new Date(maxDate); c.setDate(c.getDate() - 83); c.setHours(0,0,0,0); cutoffTs = c.getTime();
    } else if (trendGranularity === 'month') {
      const c = new Date(maxDate); c.setMonth(c.getMonth() - 11); c.setDate(1); c.setHours(0,0,0,0); cutoffTs = c.getTime();
    }

    const res: Record<string, { name: string; Volume: number; PlanVolume: number; ts: number }> = {};
    planItems.forEach((item) => {
      if (item.Timestamp < cutoffTs) return;
      const info = getKeyInfo(item, trendGranularity);
      if (!info) return;
      const { key, ts, name } = info;
      if (!res[key]) res[key] = { name, Volume: 0, PlanVolume: 0, ts };
      res[key].PlanVolume += parseFloat(String(item['Request Volume'])) || 0;
    });
    completedItems.forEach((item) => {
      if (item.Timestamp < cutoffTs) return;
      const info = getKeyInfo(item, trendGranularity);
      if (!info) return;
      const { key, ts, name } = info;
      if (!res[key]) res[key] = { name, Volume: 0, PlanVolume: 0, ts };
      res[key].Volume += parseFloat(String(item['Confirm Volume'])) || 0;
    });
    return Object.values(res)
      .sort((a, b) => a.ts - b.ts)
      .map((o) => ({ ...o, Volume: +o.Volume.toFixed(2), PlanVolume: +o.PlanVolume.toFixed(2) }));
  }, [structureFilteredData, trendGranularity, getKeyInfo]);

  const chartTimelineStatus = useMemo(() => {
    const validItems = structureFilteredData.filter(item => item.Timestamp > 0);
    if (validItems.length === 0) return [];
    const maxTs   = validItems.reduce((m, i) => Math.max(m, i.Timestamp), 0);
    const maxDate = new Date(maxTs);
    let cutoffTs  = 0;
    if (statusTrendGranularity === 'day') {
      const c = new Date(maxDate); c.setDate(c.getDate() - 29); c.setHours(0,0,0,0); cutoffTs = c.getTime();
    } else if (statusTrendGranularity === 'week') {
      const c = new Date(maxDate); c.setDate(c.getDate() - 83); c.setHours(0,0,0,0); cutoffTs = c.getTime();
    } else if (statusTrendGranularity === 'month') {
      const c = new Date(maxDate); c.setMonth(c.getMonth() - 11); c.setDate(1); c.setHours(0,0,0,0); cutoffTs = c.getTime();
    }

    const res: Record<string, Record<string, number | string>> = {};
    validItems.forEach((item) => {
      if (item.Timestamp < cutoffTs) return;
      const d      = new Date(item.Timestamp);
      const sLabel = STATUS_INFO[item['Current Status']]?.legend ?? `S${item['Current Status']}`;
      let key = '', ts = 0, name = '';

      if (statusTrendGranularity === 'day') {
        const yyyy = d.getFullYear(), mm = String(d.getMonth() + 1).padStart(2,'0'), dd = String(d.getDate()).padStart(2,'0');
        key = `${yyyy}-${mm}-${dd}`; ts = new Date(yyyy, d.getMonth(), d.getDate()).getTime(); name = `${dd}/${mm}`;
      } else if (statusTrendGranularity === 'week') {
        const dow = d.getDay(), diff = dow === 0 ? -6 : 1 - dow;
        const ws = new Date(d); ws.setDate(d.getDate() + diff); ws.setHours(0,0,0,0);
        key = `${ws.getFullYear()}-${String(ws.getMonth()+1).padStart(2,'0')}-${String(ws.getDate()).padStart(2,'0')}`;
        ts = ws.getTime(); name = `${String(ws.getDate()).padStart(2,'0')}/${String(ws.getMonth()+1).padStart(2,'0')}`;
      } else if (statusTrendGranularity === 'month') {
        if (item.Month === 'Unknown') return;
        const [mon, yr] = item.Month.split(' ');
        const monIdx = MONTHS.indexOf(mon);
        key = item.Month; ts = monIdx >= 0 ? new Date(+yr, monIdx, 1).getTime() : item.Timestamp; name = item.Month;
      } else {
        const yr = d.getFullYear(); key = String(yr); ts = new Date(yr, 0, 1).getTime(); name = String(yr);
      }

      if (!res[key]) {
        res[key] = { name, ts };
        STATUS_ORDER.forEach((k) => { res[key][STATUS_INFO[k].legend] = 0; });
      }
      if (!(sLabel in res[key])) res[key][sLabel] = 0;
      res[key][sLabel] = (res[key][sLabel] as number) + 1;
    });
    return Object.values(res).sort((a, b) => (a.ts as number) - (b.ts as number));
  }, [structureFilteredData, statusTrendGranularity]);

  // Suppress unused warning - isMobile used for conditional logic
  void isMobile;

  return (
    <>
      {/* ── KPI CARDS ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
        <KPIBox title="Total Requests"    value={kpis.count}        unit="Items" icon={<FileCheck size={20}/>}    color="from-blue-600 to-cyan-500" />
        <KPIBox title="Request Volume"    value={kpis.requestVol}   unit="m³"    icon={<Layers size={20}/>}       color="from-indigo-600 to-violet-500" />
        <KPIBox title="DWG. Volume"       value={kpis.dwgVol}       unit="m³"    icon={<Activity size={20}/>}     color="from-slate-600 to-slate-400" />
        <KPIBox title="Confirm Volume"    value={kpis.confirmVol}   unit="m³"    icon={<HardHat size={20}/>}      color="from-emerald-600 to-teal-500" />
        <KPIBox
          title="Loss Concrete"
          value={kpis.lossConcVol}
          unit={`m³ (${kpis.lossConcPercent}%)`}
          icon={<AlertTriangle size={20}/>}
          color={parseFloat(kpis.lossConcVol) > 0 ? 'from-rose-600 to-pink-500' : 'from-slate-600 to-slate-400'}
          isAlert={parseFloat(kpis.lossConcVol) > 0}
        />
      </div>

      {/* ── TREND CHARTS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">

        <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 shadow-lg backdrop-blur-sm">
          <div className="flex flex-wrap justify-between items-center gap-3 mb-5">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Activity className="text-emerald-400" size={18} /> Completed Volume Trend
            </h3>
            <div className="flex gap-1 bg-slate-900/50 p-1 rounded-xl border border-slate-700/50">
              {([{ key: 'day', label: 'วัน' }, { key: 'week', label: 'สัปดาห์' }, { key: 'month', label: 'เดือน' }, { key: 'year', label: 'ปี' }] as { key: Granularity; label: string }[]).map(({ key, label }) => (
                <button key={key} onClick={() => setTrendGranularity(key)}
                  className={`text-[11px] font-bold px-3 py-1 rounded-lg transition-all ${trendGranularity === key ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20' : 'text-slate-400 hover:text-slate-200'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ height: 250 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartTimelineVol} margin={{ top: 28, right: 16, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradVol" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#10B981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0}   />
                  </linearGradient>
                  <linearGradient id="gradPlanVol" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#94A3B8" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#94A3B8" stopOpacity={0}   />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={true} stroke={cGrid} />
                <XAxis dataKey="name" stroke={cAxis} fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke={cAxis} fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip valueFormat="volume" />} cursor={{ stroke: '#475569', strokeWidth: 1, strokeDasharray: '4 4' }} wrapperStyle={{ pointerEvents: 'none', zIndex: 50 }} />
                <Area type="monotone" dataKey="PlanVolume" name="Plan Volume" stroke="#94A3B8" strokeWidth={2} strokeDasharray="5 3" fill="url(#gradPlanVol)" dot={{ r: 3, fill: '#94A3B8', strokeWidth: 0 }} activeDot={{ r: 5, fill: '#94A3B8', strokeWidth: 0 }}>
                  <LabelList dataKey="PlanVolume" position="top" style={{ fill: cAxis, fontSize: 10, fontWeight: 600, pointerEvents: 'none' }} formatter={(v) => typeof v === 'number' && v > 0 ? v.toFixed(2) : ''} />
                </Area>
                <Area type="monotone" dataKey="Volume" name="Completed Volume" stroke="#10B981" strokeWidth={3} fill="url(#gradVol)" dot={{ r: 3, fill: '#10B981', strokeWidth: 0 }} activeDot={{ r: 5, fill: '#10B981', strokeWidth: 0 }}>
                  <LabelList dataKey="Volume" position="top" style={{ fill: '#10B981', fontSize: 10, fontWeight: 600, pointerEvents: 'none' }} formatter={(v) => typeof v === 'number' && v > 0 ? v.toFixed(2) : ''} />
                </Area>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 shadow-lg backdrop-blur-sm">
          <div className="flex flex-wrap justify-between items-center gap-3 mb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <TrendingUp className="text-indigo-400" size={18} /> Requests Trend by Status
            </h3>
            <div className="flex gap-1 bg-slate-900/50 p-1 rounded-xl border border-slate-700/50">
              {([{ key: 'day', label: 'วัน' }, { key: 'week', label: 'สัปดาห์' }, { key: 'month', label: 'เดือน' }, { key: 'year', label: 'ปี' }] as { key: Granularity; label: string }[]).map(({ key, label }) => (
                <button key={key} onClick={() => setStatusTrendGranularity(key)}
                  className={`text-[11px] font-bold px-3 py-1 rounded-lg transition-all ${statusTrendGranularity === key ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/20' : 'text-slate-400 hover:text-slate-200'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3">
            {STATUS_ORDER.map((key) => (
              <div key={key} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: STATUS_INFO[key].color }} />
                <span className="text-[10px] text-slate-400">{STATUS_INFO[key].legend}</span>
              </div>
            ))}
          </div>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartTimelineStatus} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={cGrid} />
                <XAxis dataKey="name" stroke={cAxis} fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke={cAxis} fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#475569', strokeWidth: 1, strokeDasharray: '4 4' }} wrapperStyle={{ pointerEvents: 'none', zIndex: 50 }} />
                {STATUS_ORDER.map((key) => (
                  <Line key={key} type="monotone" dataKey={STATUS_INFO[key].legend}
                    stroke={STATUS_INFO[key].color} strokeWidth={2}
                    dot={{ r: 3, fill: STATUS_INFO[key].color, strokeWidth: 0 }}
                    activeDot={{ r: 5, strokeWidth: 0 }}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── FILTER CHARTS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 mb-8">

        {/* 1. Status */}
        <ChartBox title="Requests by Status (Items)" isActive={!!filters.status} onClear={() => toggleFilter('status', filters.status!)}>
          <BarChart data={chartStatusData} layout="vertical" margin={{ top: 5, right: 72, left: 4, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={cGrid} />
            <XAxis type="number" hide />
            <YAxis dataKey="legend" type="category" stroke={cAxis} fontSize={9} tickLine={false} axisLine={false} width={isCompact ? 92 : 120} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99,102,241,0.08)' }} wrapperStyle={{ pointerEvents: 'none', zIndex: 50 }} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} isAnimationActive={false}
              onClick={(entry: { name?: string }) => { if (entry?.name) toggleFilter('status', entry.name); }}
              style={{ cursor: 'pointer' }}>
              {chartStatusData.map((entry) => (
                <Cell key={entry.name} fill={filters.status ? (filters.status === entry.name ? entry.color : cDim) : entry.color} />
              ))}
              <LabelList dataKey="value" position="right" style={{ pointerEvents: 'none' }}
                content={(props) => {
                  const { x = 0, y = 0, width = 0, height = 0, value } = props as LabelContentProps;
                  const nx = +x, ny = +y, nw = +width, nh = +height;
                  const total = chartStatusData.reduce((s, d) => s + d.value, 0);
                  const pct   = total > 0 ? (((value as number) / total) * 100).toFixed(2) : '0.00';
                  return (
                    <text x={nx + nw + 5} y={ny + nh / 2} dominantBaseline="middle" style={{ pointerEvents: 'none' }}>
                      <tspan fill={cLabel} fontSize={10} fontWeight={600}>{value as number}</tspan>
                      <tspan fill="#64748B" fontSize={9}> | </tspan>
                      <tspan fill={cAxis} fontSize={10}>{pct}%</tspan>
                    </text>
                  );
                }}
              />
            </Bar>
          </BarChart>
        </ChartBox>

        {/* 2. Strength */}
        <ChartBox title="Volume by Strength (m³)" isActive={!!filters.strength} onClear={() => toggleFilter('strength', filters.strength!)}>
          <BarChart data={chartStrengthData} layout="vertical" margin={{ top: 5, right: 72, left: 4, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={cGrid} />
            <XAxis type="number" hide />
            <YAxis dataKey="name" type="category" stroke={cAxis} fontSize={isCompact ? 9 : 10} tickLine={false} axisLine={false} width={isCompact ? 62 : 78} />
            <Tooltip content={<CustomTooltip valueFormat="volume" />} cursor={{ fill: 'rgba(99,102,241,0.08)' }} wrapperStyle={{ pointerEvents: 'none', zIndex: 50 }} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} isAnimationActive={false}
              onClick={(entry: { name?: string }) => { if (entry?.name) toggleFilter('strength', entry.name); }}
              style={{ cursor: 'pointer' }}>
              {chartStrengthData.map((entry) => (
                <Cell key={entry.name} fill={filters.strength ? (filters.strength === entry.name ? '#F59E0B' : cDim) : '#D97706'} />
              ))}
              <LabelList dataKey="value" position="right" style={{ pointerEvents: 'none' }}
                content={(props) => {
                  const { x = 0, y = 0, width = 0, height = 0, value } = props as LabelContentProps;
                  const nx = +x, ny = +y, nw = +width, nh = +height;
                  const total = chartStrengthData.reduce((s, d) => s + d.value, 0);
                  const pct   = total > 0 ? (((value as number) / total) * 100).toFixed(2) : '0.00';
                  return (
                    <text x={nx + nw + 5} y={ny + nh / 2} dominantBaseline="middle" style={{ pointerEvents: 'none' }}>
                      <tspan fill={cLabel} fontSize={10} fontWeight={600}>{Number(value).toFixed(2)}</tspan>
                      <tspan fill="#64748B" fontSize={9}> | </tspan>
                      <tspan fill={cAxis} fontSize={10}>{pct}%</tspan>
                    </text>
                  );
                }}
              />
            </Bar>
          </BarChart>
        </ChartBox>

        {/* 3. Structure with visibility dropdown */}
        {(() => {
          const visibleStructureData = chartStructureData.filter(d => !hiddenStructures.has(d.name));
          const allNames  = chartStructureData.map(d => d.name);
          const allSelected    = hiddenStructures.size === 0;
          const selectedCount  = allNames.length - hiddenStructures.size;
          return (
            <div className={`bg-slate-800/40 border ${filters.structure ? 'border-indigo-500/50' : 'border-slate-700/50'} rounded-2xl p-5 flex flex-col transition-all duration-300 backdrop-blur-sm`}>
              <div className="flex justify-between items-center mb-3 flex-shrink-0">
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${filters.structure ? 'bg-indigo-400 animate-pulse' : 'bg-slate-600'}`} />
                  Volume by Structure (m³)
                </h2>
                <div className="flex items-center gap-2">
                  {filters.structure && (
                    <button onClick={() => toggleFilter('structure', filters.structure!)}
                      className="text-[10px] bg-slate-700/80 hover:bg-slate-600 text-slate-300 px-2 py-1 rounded flex items-center gap-1 transition-colors border border-slate-600 uppercase font-bold tracking-wider">
                      <X size={10} /> Clear
                    </button>
                  )}
                  <div className="relative" ref={structureDropdownRef}>
                    <button
                      onClick={() => setStructureDropdownOpen(o => !o)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                        !allSelected ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' : 'bg-slate-700/60 text-slate-400 border-slate-600/60 hover:border-slate-500 hover:text-slate-200'
                      }`}
                    >
                      <Filter size={11} />
                      {allSelected ? 'ทั้งหมด' : `${selectedCount} / ${allNames.length}`}
                      <span className="ml-0.5 text-[9px] opacity-60">▼</span>
                    </button>
                    {structureDropdownOpen && (
                      <div className="absolute right-0 top-full mt-1.5 z-50 min-w-[180px] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
                        <label className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-slate-800 border-b border-slate-700/60 select-none">
                          <input type="checkbox" checked={allSelected}
                            onChange={() => setHiddenStructures(allSelected ? new Set(allNames) : new Set())}
                            className="accent-indigo-500 w-3.5 h-3.5" />
                          <span className="text-[11px] font-bold text-slate-300">เลือกทั้งหมด</span>
                        </label>
                        <div className="max-h-52 overflow-y-auto">
                          {allNames.map(name => {
                            const checked = !hiddenStructures.has(name);
                            return (
                              <label key={name} className="flex items-center gap-2.5 px-3 py-1.5 cursor-pointer hover:bg-slate-800 select-none">
                                <input type="checkbox" checked={checked}
                                  onChange={() => setHiddenStructures(prev => {
                                    const next = new Set(prev);
                                    if (next.has(name)) next.delete(name); else next.add(name);
                                    return next;
                                  })}
                                  className="accent-indigo-500 w-3.5 h-3.5 flex-shrink-0" />
                                <span className="text-[11px] text-slate-300 leading-tight">{name}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div style={{ height: Math.max(100, visibleStructureData.length * 52), width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={visibleStructureData} layout="vertical" margin={{ top: 5, right: 72, left: 4, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={cGrid} />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" stroke={cAxis} fontSize={isCompact ? 9 : 11} tickLine={false} axisLine={false} width={isCompact ? 62 : 78} />
                    <Tooltip content={<CustomTooltip valueFormat="volume" />} cursor={{ fill: 'rgba(99,102,241,0.08)' }} wrapperStyle={{ pointerEvents: 'none', zIndex: 50 }} />
                    <Bar dataKey="DWG Vol" radius={[0, 4, 4, 0]} isAnimationActive={false}
                      onClick={(entry: { name?: string }) => { if (entry?.name) toggleFilter('structure', entry.name); }}
                      style={{ cursor: 'pointer' }}>
                      {visibleStructureData.map((entry) => (
                        <Cell key={entry.name} fill={filters.structure ? (filters.structure === entry.name ? '#0EA5E9' : (isDark ? '#334155' : '#CBD5E1')) : '#4F46E5'} />
                      ))}
                      <LabelList dataKey="DWG Vol" position="right" style={{ pointerEvents: 'none' }}
                        content={(props) => {
                          const { x = 0, y = 0, width = 0, height = 0, value } = props as LabelContentProps;
                          const nx = +x, ny = +y, nw = +width, nh = +height;
                          const total = visibleStructureData.reduce((s, d) => s + d['DWG Vol'], 0);
                          const pct   = total > 0 ? (((value as number) / total) * 100).toFixed(2) : '0.00';
                          return (
                            <text x={nx + nw + 5} y={ny + nh / 2} dominantBaseline="middle" style={{ pointerEvents: 'none' }}>
                              <tspan fill={cLabel} fontSize={10} fontWeight={600}>{Number(value).toFixed(2)}</tspan>
                              <tspan fill="#64748B" fontSize={9}> | </tspan>
                              <tspan fill={cAxis} fontSize={10}>{pct}%</tspan>
                            </text>
                          );
                        }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          );
        })()}

        {/* 4. Staff */}
        <ChartBox title="Volume by Staff (m³)" isActive={!!filters.staff} onClear={() => toggleFilter('staff', filters.staff!)}>
          <BarChart data={chartStaffData} layout="vertical" margin={{ top: 5, right: 72, left: 4, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={cGrid} />
            <XAxis type="number" hide />
            <YAxis dataKey="name" type="category" stroke={cAxis} fontSize={isCompact ? 9 : 11} tickLine={false} axisLine={false} width={isCompact ? 65 : 82} />
            <Tooltip content={<CustomTooltip valueFormat="volume" />} cursor={{ fill: 'rgba(99,102,241,0.08)' }} wrapperStyle={{ pointerEvents: 'none', zIndex: 50 }} />
            <Bar dataKey="DWG Vol" radius={[0, 4, 4, 0]} isAnimationActive={false}
              onClick={(entry: { name?: string }) => { if (entry?.name) toggleFilter('staff', entry.name); }}
              style={{ cursor: 'pointer' }}>
              {chartStaffData.map((entry) => (
                <Cell key={entry.name} fill={filters.staff ? (filters.staff === entry.name ? '#F59E0B' : cDim) : '#8B5CF6'} />
              ))}
              <LabelList dataKey="DWG Vol" position="right" style={{ pointerEvents: 'none' }}
                content={(props) => {
                  const { x = 0, y = 0, width = 0, height = 0, value } = props as LabelContentProps;
                  const nx = +x, ny = +y, nw = +width, nh = +height;
                  const total = chartStaffData.reduce((s, d) => s + d['DWG Vol'], 0);
                  const pct   = total > 0 ? (((value as number) / total) * 100).toFixed(2) : '0.00';
                  return (
                    <text x={nx + nw + 5} y={ny + nh / 2} dominantBaseline="middle" style={{ pointerEvents: 'none' }}>
                      <tspan fill={cLabel} fontSize={10} fontWeight={600}>{Number(value).toFixed(2)}</tspan>
                      <tspan fill="#64748B" fontSize={9}> | </tspan>
                      <tspan fill={cAxis} fontSize={10}>{pct}%</tspan>
                    </text>
                  );
                }}
              />
            </Bar>
          </BarChart>
        </ChartBox>

        {/* 5. Supplier Pie */}
        <ChartBox title="Supplier Volume (m³)" isActive={!!filters.supplier} onClear={() => toggleFilter('supplier', filters.supplier!)}>
          <PieChart>
            <Pie
              data={chartSupplierData}
              cx="50%" cy="50%"
              innerRadius={32} outerRadius={52}
              paddingAngle={3}
              dataKey="value"
              isAnimationActive={false}
              onClick={(entry: { name?: string }) => { if (entry?.name) toggleFilter('supplier', entry.name); }}
              style={{ cursor: 'pointer' }}
              label={({ cx, cy, midAngle, outerRadius: or, name, percent, value }: {
                cx?: number; cy?: number; midAngle?: number; outerRadius?: number;
                name?: string; percent?: number; value?: number;
              }) => {
                if (cx == null || cy == null || midAngle == null || or == null) return null;
                const RADIAN = Math.PI / 180;
                const r      = or + 22;
                const x      = cx + r * Math.cos(-midAngle * RADIAN);
                const y      = cy + r * Math.sin(-midAngle * RADIAN);
                const anchor = x > cx ? 'start' : 'end';
                if ((percent ?? 0) < 0.04) return null;
                return (
                  <text x={x} y={y} textAnchor={anchor} dominantBaseline="central" style={{ pointerEvents: 'none' }}>
                    <tspan x={x} dy="0"  fill={cLabel} fontSize={11} fontWeight={600}>{name}</tspan>
                    <tspan x={x} dy="14" fill={cAxis}  fontSize={10}>{Number(value ?? 0).toFixed(2)} cu.m</tspan>
                    <tspan x={x} dy="13" fill={cAxis}  fontSize={10}>{((percent ?? 0) * 100).toFixed(2)}%</tspan>
                  </text>
                );
              }}
              labelLine={{ stroke: cAxis, strokeWidth: 1 }}
            >
              {chartSupplierData.map((entry, i) => {
                const base = SUPPLIER_COLORS[i % SUPPLIER_COLORS.length];
                return (
                  <Cell
                    key={entry.name}
                    fill={filters.supplier ? (filters.supplier === entry.name ? base : cDim) : base}
                    stroke={filters.supplier === entry.name ? '#fff' : (isDark ? '#1E293B' : '#E2E8F0')}
                    strokeWidth={filters.supplier === entry.name ? 2 : 1}
                  />
                );
              })}
            </Pie>
            <Tooltip
              content={(props) => {
                const { active, payload } = props as unknown as { active?: boolean; payload?: ReadonlyArray<{ name?: string | number; value?: number }> };
                if (!active || !payload?.length) return null;
                const d = payload[0];
                const tipBg     = isDark ? 'rgba(15,23,42,0.97)' : 'rgba(255,255,255,0.97)';
                const tipBorder = isDark ? '#334155' : '#E2E8F0';
                const tipShadow = isDark ? 'none' : '0 4px 16px rgba(0,0,0,0.10)';
                const totalVol  = chartSupplierData.reduce((s, i) => s + i.value, 0);
                return (
                  <div style={{ background: tipBg, border: `1px solid ${tipBorder}`, borderRadius: 12, padding: '10px 14px', minWidth: 160, pointerEvents: 'none', boxShadow: tipShadow }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: cAxis, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, borderBottom: `1px solid ${tipBorder}`, paddingBottom: 6 }}>
                      {d.name}
                    </p>
                    <div style={{ fontSize: 13, fontWeight: 700, color: cLabel, marginBottom: 2 }}>
                      {Number(d.value).toFixed(2)} cu.m
                    </div>
                    <div style={{ fontSize: 12, color: cAxis }}>
                      {(((d.value ?? 0) / totalVol) * 100).toFixed(2)}%
                    </div>
                  </div>
                );
              }}
              wrapperStyle={{ pointerEvents: 'none', zIndex: 50 }}
            />
          </PieChart>
        </ChartBox>

      </div>

      {/* ── ACCORDION TABLE ── */}
      <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl shadow-xl overflow-hidden backdrop-blur-sm">
        <div className="p-5 border-b border-slate-700 flex justify-between items-center bg-slate-800/60">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Layers className="text-indigo-400" size={20} /> Detailed Records
          </h2>
          <div className="text-xs font-medium text-slate-400 bg-slate-900/50 px-3 py-1.5 rounded-lg border border-slate-700/50">
            Total <strong className="text-white">{filteredData.length}</strong> items
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="text-[11px] text-slate-400 uppercase bg-slate-900/50 border-b border-slate-700/80">
              <tr>
                <th className="px-6 py-4 font-bold tracking-wider">Date</th>
                <th className="px-6 py-4 font-bold tracking-wider">Request By</th>
                <th className="px-6 py-4 font-bold tracking-wider">Concrete Works</th>
                <th className="px-6 py-4 font-bold tracking-wider">Structure</th>
                <th className="px-6 py-4 font-bold tracking-wider">Location</th>
                <th className="px-6 py-4 font-bold tracking-wider">Strength</th>
                <th className="px-6 py-4 font-bold tracking-wider text-right">DWG Vol.</th>
                <th className="px-6 py-4 font-bold tracking-wider text-right">Confirm Vol.</th>
                <th className="px-6 py-4 font-bold tracking-wider text-right">Loss (m³)</th>
                <th className="px-6 py-4 font-bold tracking-wider text-right">Loss (%DWG)</th>
                <th className="px-6 py-4 font-bold tracking-wider">Supplier</th>
                <th className="px-6 py-4 font-bold tracking-wider text-center">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {Object.keys(groupedData).length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-6 py-16 text-center text-slate-500">
                    No matching records found
                  </td>
                </tr>
              ) : (
                STATUS_ORDER
                  .filter((k) => groupedData[k])
                  .map((statusKey) => {
                    const items      = groupedData[statusKey];
                    const isExpanded = expandedGroups[statusKey];
                    const statusColor = STATUS_INFO[statusKey]?.color || '#475569';

                    return (
                      <React.Fragment key={`group-${statusKey}`}>
                        <tr onClick={() => toggleGroup(statusKey)}
                          className="bg-slate-800/80 hover:bg-slate-700/80 transition-colors cursor-pointer">
                          <td colSpan={12} className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <span className={`transition-transform duration-200 text-slate-400 ${isExpanded ? 'rotate-90' : ''}`} style={{ display: 'inline-flex' }}>
                                <ChevronRight size={16} />
                              </span>
                              {isExpanded ? <FolderOpen size={18} className="text-indigo-400" /> : <Folder size={18} className="text-slate-500" />}
                              <StatusBadge status={statusKey} />
                              <span className="text-xs font-bold text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-full">
                                {items.length} {items.length === 1 ? 'Item' : 'Items'}
                              </span>
                            </div>
                          </td>
                        </tr>

                        {isExpanded && items.map((row) => (
                          <tr key={row.ID} onClick={() => setSelectedRow(row)}
                            className="bg-[#0B1120] hover:bg-slate-800/80 transition-colors cursor-pointer group"
                            style={{ borderLeft: `3px solid ${statusColor}` }}>
                            <td className="px-6 py-3 text-slate-300 font-medium">{row['Casting date']}</td>
                            <td className="px-6 py-3">
                              <span className={filters.staff === row['Request by'] ? 'text-amber-400 font-bold' : 'text-slate-200'}>
                                {row['Request by']}
                              </span>
                            </td>
                            <td className="px-6 py-3 text-slate-300">{row['Concrete Works']}</td>
                            <td className="px-6 py-3">
                              <span className={filters.structure === row.Structure ? 'text-emerald-400 font-bold' : 'text-slate-200'}>
                                {row.Structure}
                              </span>
                            </td>
                            <td className="px-6 py-3 text-slate-300">{row.Location}</td>
                            <td className="px-6 py-3 text-slate-300 font-medium">{row.Strength}</td>
                            <td className="px-6 py-3 text-right font-medium text-slate-400">{parseFloat(String(row['DWG. Volume'])).toFixed(2)}</td>
                            <td className="px-6 py-3 text-right font-bold text-white">
                              {row['Current Status'] === '7' ? parseFloat(String(row['Confirm Volume'])).toFixed(2) : <span className="text-slate-600">—</span>}
                            </td>
                            <td className="px-6 py-3 text-right font-bold">
                              {row['Current Status'] === '7' && row['Loss Concrete'] !== null ? (
                                <span className={parseFloat(String(row['Loss Concrete'])) < 0 ? 'text-rose-400' : 'text-slate-200'}>
                                  {parseFloat(String(row['Loss Concrete'])).toFixed(2)}
                                </span>
                              ) : <span className="text-slate-600">—</span>}
                            </td>
                            <td className="px-6 py-3 text-right font-bold">
                              {row['Current Status'] === '7' && row['Loss Concrete'] !== null ? (() => {
                                const lossNum = parseFloat(String(row['Loss Concrete']));
                                const dwgNum  = parseFloat(String(row['DWG. Volume']));
                                const pct     = dwgNum > 0 ? (lossNum / dwgNum * 100).toFixed(2) : '—';
                                return <span className={lossNum < 0 ? 'text-rose-400' : 'text-slate-200'}>{pct}%</span>;
                              })() : <span className="text-slate-600">—</span>}
                            </td>
                            <td className="px-6 py-3">
                              <span className={filters.supplier === row.Supplier ? 'text-blue-400 font-bold' : 'text-slate-300'}>
                                {row.Supplier}
                              </span>
                            </td>
                            <td className="px-6 py-3 text-center text-slate-600 group-hover:text-indigo-400 transition-colors">
                              <Eye size={16} className="inline" />
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── DETAIL MODAL ── */}
      {selectedRow && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedRow(null); }}
        >
          <div className={`${isDark ? 'bg-[#0F172A]' : 'bg-white'} rounded-2xl w-full max-w-2xl border border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]`}>
            <div className="p-5 border-b border-slate-700/80 flex justify-between items-center bg-slate-800/40 flex-shrink-0">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <FileCheck className="text-indigo-400" size={20} />
                Request Details
                <span className="text-indigo-500 font-mono text-sm ml-2 bg-indigo-500/10 px-2 py-0.5 rounded">
                  {selectedRow.ID}
                </span>
              </h2>
              <button onClick={() => setSelectedRow(null)} title="Close" aria-label="Close"
                className="text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-full p-1.5 transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <div className="mb-6 flex justify-between items-center bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
                <span className="text-sm font-semibold text-slate-300">Current Status</span>
                <StatusBadge status={selectedRow['Current Status']} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-y-5 gap-x-8">
                {[
                  { key: 'Casting date',               label: 'Date'                      },
                  { key: 'Request by',                 label: 'Request by'                },
                  { key: 'Concrete Works',             label: 'Concrete Works'            },
                  { key: 'Structure',                  label: 'Structure'                 },
                  { key: 'Location',                   label: 'Location'                  },
                  { key: 'Structure No. or Grid Line', label: 'Structure No. / Grid Line' },
                  { key: 'Strength',                   label: 'Strength'                  },
                  { key: 'DWG. Volume',                label: 'DWG. Volume (m³)'          },
                  { key: 'Confirm Volume',             label: 'Confirm Volume (m³)'       },
                  { key: 'Loss Concrete',              label: 'Loss Concrete (m³)'        },
                  { key: 'Supplier',                   label: 'Supplier'                  },
                  { key: 'Mix code',                   label: 'Mix Code'                  },
                  { key: 'Slump',                      label: 'Slump'                     },
                ].map(({ key, label }) => {
                  const isComplete = selectedRow['Current Status'] === '7';
                  if ((key === 'Confirm Volume' || key === 'Loss Concrete') && !isComplete) {
                    return (
                      <div key={key} className="border-b border-slate-700/50 pb-3">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">{label}</span>
                        <p className="text-sm text-slate-600 font-medium">— (Not completed)</p>
                      </div>
                    );
                  }
                  if (key === 'Loss Concrete' && isComplete) {
                    const lossNum = parseFloat(String(selectedRow[key]));
                    const isNeg   = lossNum < 0;
                    const color   = isNeg ? '#F43F5E' : (isDark ? '#E2E8F0' : '#475569');
                    const badge   = isNeg ? ' (Surplus)' : lossNum > 0 ? ' (Over)' : ' (Exact)';
                    return (
                      <div key={key} className="border-b border-slate-700/50 pb-3">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">{label}</span>
                        <p className="text-sm font-bold" style={{ color }}>
                          {String(selectedRow[key])} m³<span className="text-xs font-normal ml-1" style={{ color }}>{badge}</span>
                        </p>
                      </div>
                    );
                  }
                  const val = selectedRow[key] ?? '—';
                  return (
                    <div key={key} className="border-b border-slate-700/50 pb-3">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">{label}</span>
                      <p className="text-sm text-slate-200 font-medium">{String(val) || '—'}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-4 border-t border-slate-700/80 bg-slate-800/40 flex justify-end flex-shrink-0">
              <button onClick={() => setSelectedRow(null)}
                className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-bold rounded-lg transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default DashboardPage;
