import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  LayoutDashboard, Layers, AlertTriangle, ClipboardList,
  X, Filter, Sparkles, Calendar, Sun, Moon, RefreshCw,
} from 'lucide-react';
import ThemeContext from './ThemeContext';
import DashboardPage from './DashboardPage';
import MixCodeBalancePage from './MixCodeBalancePage';
import LossConcretePage from './LossConcretePage';
import ConcreteSummaryPage from './ConcreteSummaryPage';
import { generateMockData } from './mockData';
import { parseGSheetRows, parseGSheetGeneric } from './parseGSheet';
import {
  STATUS_INFO,
  GOOGLE_SHEET_ID, SHEET_NAME, MIXCODE_SHEET_NAME, CST_SHEET_NAME, MACHINE_SHEET_NAME, USE_GOOGLE_SHEETS,
} from './constants';
import type { ConcreteRecord, Filters } from './types';
import steconLogo   from './assets/stecon-logo.svg';
import appsheetLogo from './assets/appsheet.png';
import claudeLogo   from './assets/claude-logo.png';
import netlifyLogo  from './assets/netlify-logo.png';
import reactLogo    from './assets/react-logo.png';

type PageKey = 'dashboard' | 'mixcode' | 'loss' | 'summary';

const PAGE_TITLES: Record<PageKey, string> = {
  mixcode:  'Concrete Works | Concrete Balance',
  loss:     'Concrete Works | Loss Concrete',
  dashboard:'Concrete Works | Dashboard',
  summary:  'Concrete Works | Concrete Summary',
};

function ConcreteDashboard() {
  const [isDark,         setIsDark]         = useState<boolean>(false);
  const [currentPage,    setCurrentPage]    = useState<PageKey>('dashboard');
  const [data,           setData]           = useState<ConcreteRecord[]>([]);
  const [loading,        setLoading]        = useState<boolean>(true);
  const [mixCodeData,    setMixCodeData]    = useState<ConcreteRecord[]>([]);
  const [mixCodeLoading, setMixCodeLoading] = useState<boolean>(false);
  const [mixCodeFetched, setMixCodeFetched] = useState<boolean>(false);
  const [cstData,        setCstData]        = useState<Record<string, string>[]>([]);
  const [machineData,    setMachineData]    = useState<Record<string, string>[]>([]);
  const [cstLoading,     setCstLoading]     = useState<boolean>(false);
  const [cstFetched,     setCstFetched]     = useState<boolean>(false);
  const [filters,        setFilters]        = useState<Filters>({ status: null, supplier: null, structure: null, staff: null, strength: null });
  const [dateRange,      setDateRange]      = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [showAboutModal, setShowAboutModal] = useState<boolean>(false);
  const [refreshKey,     setRefreshKey]     = useState<number>(0);
  const [isRefreshing,   setIsRefreshing]   = useState<boolean>(false);

  useEffect(() => {
    document.title = PAGE_TITLES[currentPage];
  }, [currentPage]);

  useEffect(() => {
    document.body.style.backgroundColor = isDark ? '#0F172A' : '#F1F5F9';
  }, [isDark]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!USE_GOOGLE_SHEETS) {
          if (!cancelled) setData(generateMockData());
          return;
        }
        const url  = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(SHEET_NAME)}`;
        const res  = await fetch(url);
        const text = await res.text();
        const json = text.match(/google\.visualization\.Query\.setResponse\(([\s\S\w]+)\);/)?.[1];
        if (!json) throw new Error('Cannot parse Google Sheets response');
        const rawJson = JSON.parse(json);

        const headers = rawJson.table.cols.map((c: { label?: string }) => (c.label || '').trim());
        console.log('[Dashboard] Sheet headers:', headers);

        const rawStatuses = rawJson.table.rows.map((row: { c?: Array<{ v?: unknown; f?: string } | null> }) => {
          if (!row?.c) return null;
          const statusColIdx = headers.findIndex((h: string) =>
            ['current status','status','สถานะ'].includes(h.toLowerCase())
          );
          return statusColIdx >= 0 ? (row.c[statusColIdx]?.v ?? row.c[statusColIdx]?.f ?? null) : null;
        });
        console.log('[Dashboard] Raw status values (first 20):', rawStatuses.slice(0,20));

        const parsed = parseGSheetRows(rawJson);
        const uniqueStatuses = [...new Set(parsed.map(r => r['Current Status']))].sort();
        console.log('[Dashboard] Normalized statuses:', uniqueStatuses);
        if (!cancelled) setData(parsed);
      } catch (err) {
        console.error('Google Sheets fetch error:', err);
        try {
          if (!cancelled) setData(generateMockData());
        } catch (mockErr) {
          console.error('Mock data error:', mockErr);
          if (!cancelled) setData([]);
        }
      } finally {
        if (!cancelled) { setLoading(false); setIsRefreshing(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [refreshKey]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    setMixCodeData([]);
    setMixCodeFetched(false);
    setCstData([]);
    setMachineData([]);
    setCstFetched(false);
    setRefreshKey(k => k + 1);
  }, []);

  useEffect(() => {
    if (currentPage !== 'summary' || cstFetched) return;
    setCstLoading(true);
    (async () => {
      const fetchGeneric = async (sheetName: string): Promise<Record<string, string>[]> => {
        const url  = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;
        const res  = await fetch(url);
        const text = await res.text();
        const json = text.match(/google\.visualization\.Query\.setResponse\(([\s\S\w]+)\);/)?.[1];
        if (!json) throw new Error(`Cannot parse sheet: ${sheetName}`);
        return parseGSheetGeneric(JSON.parse(json));
      };
      const fetchMixCode = async () => {
        const url  = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(MIXCODE_SHEET_NAME)}`;
        const res  = await fetch(url);
        const text = await res.text();
        const json = text.match(/google\.visualization\.Query\.setResponse\(([\s\S\w]+)\);/)?.[1];
        if (!json) throw new Error('Cannot parse Mix Code sheet');
        return parseGSheetRows(JSON.parse(json));
      };
      try {
        const fetches: Promise<unknown>[] = [
          fetchGeneric(CST_SHEET_NAME),
          fetchGeneric(MACHINE_SHEET_NAME),
        ];
        if (!mixCodeFetched) fetches.push(fetchMixCode());

        const results = await Promise.all(fetches);
        const cstParsed     = results[0] as Record<string, string>[];
        const machineParsed = results[1] as Record<string, string>[];
        console.log('[CST] Parsed rows:', cstParsed.length, '| Headers:', cstParsed[0] ? Object.keys(cstParsed[0]) : []);
        setCstData(cstParsed);
        setMachineData(machineParsed);
        if (!mixCodeFetched) {
          const mc = results[2] as typeof mixCodeData;
          console.log('[MixCode via Summary] Parsed rows:', mc.length);
          setMixCodeData(mc);
          setMixCodeFetched(true);
        }
      } catch (err) {
        console.error('CST/Machine/MixCode fetch error:', err);
        setCstData([]);
        setMachineData([]);
      } finally {
        setCstLoading(false);
        setCstFetched(true);
      }
    })();
  }, [currentPage, cstFetched, mixCodeFetched]);

  useEffect(() => {
    if (currentPage !== 'mixcode' || mixCodeFetched) return;
    setMixCodeLoading(true);
    (async () => {
      try {
        const url  = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(MIXCODE_SHEET_NAME)}`;
        const res  = await fetch(url);
        const text = await res.text();
        const json = text.match(/google\.visualization\.Query\.setResponse\(([\s\S\w]+)\);/)?.[1];
        if (!json) throw new Error('Cannot parse Mix Code sheet response');
        const rawJson = JSON.parse(json);
        console.log('[MixCode] Sheet headers:', rawJson.table.cols.map((c: { label?: string }) => c.label));
        const parsed = parseGSheetRows(rawJson);
        console.log('[MixCode] Parsed rows:', parsed.length);
        setMixCodeData(parsed);
      } catch (err) {
        console.error('Mix Code fetch error:', err);
        setMixCodeData([]);
      } finally {
        setMixCodeLoading(false);
        setMixCodeFetched(true);
      }
    })();
  }, [currentPage, mixCodeFetched]);

  const toggleFilter = useCallback((key: keyof Filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: prev[key] === value ? null : value }));
  }, []);

  const clearAllFilters = useCallback(() => {
    setFilters({ status: null, supplier: null, structure: null, staff: null, strength: null });
    setDateRange({ start: '', end: '' });
  }, []);

  const filteredData = useMemo((): ConcreteRecord[] => {
    const startTs = dateRange.start ? new Date(dateRange.start).getTime() : null;
    const endTs   = dateRange.end   ? (() => { const d = new Date(dateRange.end); d.setHours(23,59,59,999); return d.getTime(); })() : null;

    return data.filter((item) => {
      if (filters.status    && item['Current Status'] !== filters.status)                       return false;
      if (filters.supplier  && item['Supplier']        !== filters.supplier)                    return false;
      if (filters.structure && item['Structure']        !== filters.structure)                   return false;
      if (filters.staff     && item['Request by']       !== filters.staff)                      return false;
      if (filters.strength  && String(item['Strength'] ?? '') !== filters.strength)             return false;
      if (startTs !== null  && item.Timestamp > 0 && item.Timestamp < startTs)                  return false;
      if (endTs   !== null  && item.Timestamp > 0 && item.Timestamp > endTs)                    return false;
      return true;
    });
  }, [data, filters, dateRange]);

  const hasDateFilter     = Boolean(dateRange.start || dateRange.end);
  const activeFilterCount = Object.values(filters).filter(Boolean).length + (hasDateFilter ? 1 : 0);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-indigo-400 font-bold animate-pulse text-lg">
        Initializing Dashboard...
      </div>
    );
  }

  return (
    <ThemeContext.Provider value={isDark}>
    <div className={`min-h-screen ${isDark ? 'bg-[#0F172A] text-slate-200' : 'bg-slate-100 text-slate-800 light'} font-sans p-4 md:p-6 lg:p-8 selection:bg-indigo-500 selection:text-white`}>

      {/* ── HEADER ── */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-8 gap-6">
        <div>
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={() => setShowAboutModal(true)}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs font-bold tracking-wide uppercase hover:bg-indigo-500/20 hover:border-indigo-400/40 hover:text-indigo-300 transition-all duration-200 cursor-pointer"
            >
              <Sparkles size={14} /> Concrete Analytics
            </button>
            <button
              onClick={() => setIsDark(d => !d)}
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              className={`flex items-center justify-center w-8 h-8 rounded-full border transition-all duration-300 ${
                isDark
                  ? 'bg-slate-800 border-slate-600 text-amber-400 hover:bg-slate-700 hover:border-amber-400/50'
                  : 'bg-amber-50 border-amber-300 text-amber-600 hover:bg-amber-100'
              }`}
            >
              {isDark ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              title="Refresh Data"
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold transition-all duration-300 ${
                isDark
                  ? 'bg-slate-800 border-slate-600 text-emerald-400 hover:bg-slate-700 hover:border-emerald-400/50'
                  : 'bg-emerald-50 border-emerald-300 text-emerald-600 hover:bg-emerald-100'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <a href="https://www.stecon.co.th/home" target="_blank" rel="noopener noreferrer">
              <img src={steconLogo} alt="STECON" className="h-9 w-auto" />
            </a>
            {PAGE_TITLES[currentPage]}
          </h1>
          <p className="mt-2 text-sm font-semibold text-slate-400 tracking-wide pl-1">
            Quality Management and Innovation Section
          </p>
        </div>

        {/* Filter panel */}
        <div className="bg-slate-800/50 backdrop-blur-md border border-slate-700/50 p-4 rounded-2xl flex-grow xl:max-w-2xl w-full shadow-xl flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-700/50 pb-3">
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-indigo-400" />
              <span className="text-sm font-semibold text-slate-300">Date Range</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="date"
                aria-label="Start date"
                title="Start date"
                className="bg-slate-900/50 border border-slate-600 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert"
                value={dateRange.start}
                onChange={(e) => setDateRange((p) => ({ ...p, start: e.target.value }))}
              />
              <span className="text-slate-500 font-medium text-sm">to</span>
              <input
                type="date"
                aria-label="End date"
                title="End date"
                className="bg-slate-900/50 border border-slate-600 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert"
                value={dateRange.end}
                onChange={(e) => setDateRange((p) => ({ ...p, end: e.target.value }))}
              />
              {hasDateFilter && (
                <button
                  onClick={() => setDateRange({ start: '', end: '' })}
                  className="text-xs text-rose-400 hover:text-rose-300 font-semibold px-2 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 transition-colors"
                >
                  Clear Date
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                <Filter size={16} className="text-indigo-400" /> Active Filters
              </span>
              {activeFilterCount > 0 && (
                <button onClick={clearAllFilters} className="text-xs text-rose-400 hover:text-rose-300 font-semibold transition-colors">
                  Clear All
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2 min-h-[28px]">
              {activeFilterCount === 0 ? (
                <span className="text-xs text-slate-500 italic">No active filters — viewing all data.</span>
              ) : (
                (Object.entries(filters) as [keyof Filters, string | null][]).map(([key, val]) =>
                  val ? (
                    <div key={key} className="bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2">
                      <span className="capitalize opacity-70">{key}:</span>
                      <span className="font-bold text-white">
                        {key === 'status' ? STATUS_INFO[val]?.short || val : val}
                      </span>
                      <button onClick={() => toggleFilter(key, val)} title="Remove filter" aria-label="Remove filter" className="hover:bg-indigo-500/30 rounded-full p-0.5 transition-colors">
                        <X size={12} />
                      </button>
                    </div>
                  ) : null
                )
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── PAGE NAVIGATION TABS ── */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setCurrentPage('dashboard')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
            currentPage === 'dashboard'
              ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25'
              : 'bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-700/60 border border-slate-700/50'
          }`}
        >
          <LayoutDashboard size={16} />
          Dashboard
        </button>
        <button
          onClick={() => setCurrentPage('mixcode')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
            currentPage === 'mixcode'
              ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25'
              : 'bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-700/60 border border-slate-700/50'
          }`}
        >
          <Layers size={16} />
          Concrete Balance
        </button>
        <button
          onClick={() => setCurrentPage('loss')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
            currentPage === 'loss'
              ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/25'
              : 'bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-700/60 border border-slate-700/50'
          }`}
        >
          <AlertTriangle size={16} />
          Loss Concrete
        </button>
        <button
          onClick={() => setCurrentPage('summary')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
            currentPage === 'summary'
              ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/25'
              : 'bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-700/60 border border-slate-700/50'
          }`}
        >
          <ClipboardList size={16} />
          Concrete Summary
        </button>
      </div>

      {/* ── TAB CONTENT ── */}
      {currentPage === 'loss' && (
        <LossConcretePage dashboardData={filteredData} />
      )}

      {currentPage === 'mixcode' && (
        <MixCodeBalancePage
          mixCodeData={mixCodeData}
          dashboardData={filteredData}
          loading={mixCodeLoading}
        />
      )}

      {currentPage === 'dashboard' && (
        <DashboardPage
          filteredData={filteredData}
          filters={filters}
          toggleFilter={toggleFilter}
        />
      )}

      {currentPage === 'summary' && (
        <ConcreteSummaryPage
          cstData={cstData}
          machineData={machineData}
          mixCodeData={mixCodeData}
          dashboardData={filteredData}
          loading={cstLoading}
        />
      )}

      {/* ── ABOUT MODAL ── */}
      {showAboutModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={() => setShowAboutModal(false)}
        >
          <div
            className={`relative w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col overflow-hidden border ${isDark ? 'bg-slate-900 border-slate-700/80' : 'bg-white border-slate-200'}`}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-slate-700/50 bg-indigo-500/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
                  <Sparkles size={20} className="text-indigo-400" />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-white tracking-tight">Web Application For Concrete Works</h2>
                  <p className="text-xs text-indigo-400 font-semibold tracking-wide">Concrete Analytics Platform</p>
                </div>
              </div>
              <button
                onClick={() => setShowAboutModal(false)}
                className="w-8 h-8 rounded-full bg-slate-700/60 hover:bg-slate-600 text-slate-400 hover:text-white flex items-center justify-center transition-all"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 max-h-[60vh]">
              <p className={`text-sm leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                ระบบ Web Application สำหรับการบริหารจัดการงานคอนกรีตในโครงการก่อสร้าง ออกแบบมาเพื่อรองรับการติดตาม วิเคราะห์ และรายงานข้อมูลคอนกรีตแบบ Real-time ประกอบด้วยฟังก์ชั่นหลักดังนี้
              </p>

              <div className="space-y-3">
                {[
                  { icon: '📊', title: 'Dashboard Overview',           desc: 'แสดงภาพรวมของการเบิกจ่ายคอนกรีต ประกอบด้วย KPI สำคัญ เช่น จำนวน Request, ปริมาตรตาม DWG, ปริมาตรที่ยืนยันแล้ว และ Loss Concrete พร้อมกราฟแนวโน้มตามช่วงเวลา' },
                  { icon: '⚖️', title: 'Concrete Balance (Mix Code)',  desc: 'ติดตามยอดคงเหลือของคอนกรีตแต่ละ Mix Code เปรียบเทียบปริมาตรที่สั่งจองกับที่เบิกจ่ายจริง ช่วยให้ทีมงานวางแผนการสั่งซื้อได้อย่างมีประสิทธิภาพ' },
                  { icon: '📉', title: 'Loss Concrete Analysis',       desc: 'วิเคราะห์ความสูญเสียของคอนกรีตในแต่ละงาน แยกตามประเภทโครงสร้าง, ผู้รับผิดชอบ และ Supplier แสดงผลเป็นกราฟและตารางสรุปเพื่อง่ายต่อการตรวจสอบ' },
                  { icon: '🔍', title: 'Advanced Filtering',           desc: 'กรองข้อมูลตามช่วงวันที่, สถานะงาน, Supplier, ประเภทโครงสร้าง, ผู้รับผิดชอบ และกำลังอัดคอนกรีต ทำให้เข้าถึงข้อมูลที่ต้องการได้รวดเร็ว' },
                  { icon: '📋', title: 'Detailed Records',             desc: 'ตารางรายละเอียดแสดงข้อมูลทุก Request พร้อม Popup แสดงรายละเอียดเต็มของแต่ละรายการ สามารถดูสถานะ, ปริมาตร, Loss และข้อมูลผู้รับผิดชอบได้ครบถ้วน' },
                  { icon: '🌐', title: 'Google Sheets Integration',    desc: 'เชื่อมต่อกับ Google Sheets แบบ Real-time ข้อมูลจะอัปเดตอัตโนมัติเมื่อมีการแก้ไขข้อมูลในฝั่ง Google Sheets ลดขั้นตอนการนำเข้าข้อมูลด้วยตนเอง' },
                  { icon: '🌙', title: 'Dark / Light Mode',            desc: 'รองรับการแสดงผลทั้งโหมด Dark และ Light เพื่อความสะดวกในการใช้งานในสภาพแสงที่แตกต่างกัน' },
                ].map(({ icon, title, desc }) => (
                  <div key={title} className={`flex gap-3 p-3 rounded-xl border ${isDark ? 'bg-slate-800/60 border-slate-700/50' : 'bg-slate-50 border-slate-200'}`}>
                    <span className="text-2xl flex-shrink-0 mt-0.5">{icon}</span>
                    <div>
                      <p className={`text-sm font-bold mb-1 ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{title}</p>
                      <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className={`px-6 py-4 border-t flex flex-col items-center gap-1.5 ${isDark ? 'border-slate-700/50 bg-slate-800/40' : 'border-slate-200 bg-slate-50'}`}>
              <div className="flex items-center gap-2 flex-wrap justify-center">
                <span className={`text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Developed by</span>
                <span className={`text-xs font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Mr. Panuwat Sripan P04851</span>
              </div>
              <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Quality Management and Innovation Section</p>
              <p className={`text-[11px] text-center leading-relaxed ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                Sino-Thai Engineering &amp; Construction Public Company Limited
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── FOOTER ── */}
      <footer className={`mt-10 pt-5 pb-4 border-t ${isDark ? 'border-slate-700/50' : 'border-slate-200'}`}>
        <div className="flex flex-col items-center gap-3">
          <p className={`text-[11px] font-medium tracking-widest uppercase ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            Powered by
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6">
            {[
              { src: appsheetLogo, alt: 'AppSheet', href: 'https://www.appsheet.com' },
              { src: claudeLogo,   alt: 'Claude',   href: 'https://claude.ai' },
              { src: reactLogo,    alt: 'React',    href: 'https://react.dev' },
              { src: netlifyLogo,  alt: 'Netlify',  href: 'https://www.netlify.com' },
            ].map(({ src, alt, href }) => (
              <a
                key={alt}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                title={alt}
                className="flex items-center transition-all duration-200 opacity-60 hover:opacity-100 hover:scale-105 grayscale hover:grayscale-0"
              >
                <img src={src} alt={alt} className="h-5 w-auto object-contain" />
              </a>
            ))}
          </div>
          <p className={`text-[10px] ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>
            © {new Date().getFullYear()} Quality Management and Innovation Section · STECON
          </p>
        </div>
      </footer>

    </div>
    </ThemeContext.Provider>
  );
}

export default ConcreteDashboard;
