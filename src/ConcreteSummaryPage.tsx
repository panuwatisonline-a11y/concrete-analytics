import { useMemo, useContext, useState, useRef, useEffect } from 'react';
import { FileText, X, ChevronDown, Check, Download } from 'lucide-react';
import ThemeContext from './ThemeContext';
import type { ConcreteRecord } from './types';

interface Props {
  cstData:      Record<string, string>[];
  machineData:  Record<string, string>[];
  mixCodeData:  ConcreteRecord[];
  dashboardData: ConcreteRecord[];
  loading: boolean;
}

interface MachineCalib {
  K1: number;
  K2: number;
}

interface ReportFile {
  age:      number;
  reportNo: string;
  url:      string;
}

interface SummaryRow {
  item:            number;
  ref:             string;
  castingDate:     string;
  concreteWorks:   string;
  structure:       string;
  location:        string;
  structureNo:     string;
  supplier:        string;
  slump:           string;
  mixCode:         string;
  requireStrength: number | null;
  strengthUnit:    string;
  avg1Day:         number | null;
  avg7Days:        number | null;
  avg14Days:       number | null;
  avg28Days:       number | null;
  result:          'Pass' | 'Fail' | '-';
  files:           ReportFile[];
}

const G  = 9.80665;
const PI = 3.141592654; // matches AppSheet formula exactly

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Section area (cm²) — uses AppSheet's PI constant, rounded to 2 dp.
 * This matches the AppSheet IFS([Section]) formula.
 */
function getSection(sampleType: string, diameter?: number): number {
  const st = sampleType.trim();
  if (st === 'Cylinder 10x10 cm.' || st === 'Cylinder 6x10 cm.') {
    const d = diameter ?? 10;
    return round2(PI * d * d / 4);
  }
  if (st === 'Cylinder 15x30 cm.') return round2(PI * 15 * 15 / 4); // → 176.71
  if (st === 'Cube 15x15x15 cm.')  return 15 * 15;                   // 225 (exact)
  if (st === 'Cube 10x10x10 cm.')  return 10 * 10;                   // 100 (exact)
  if (st === 'Cube 5x5x5 cm.')     return 5 * 5;                     // 25  (exact)
  return round2(PI * 15 * 15 / 4);
}

/**
 * adj     = round(kN × K1 + K2, 2)   — AppSheet rounds adj before dividing
 * kgf/cm² = adj × (1000 / G) / section
 * MPa     = kgf/cm² × 0.0980665
 */
function calcStrength(
  kn:         number,
  calib:      MachineCalib,
  sampleType: string,
  isMPa:      boolean,
  diameter?:  number,
): number {
  const adj     = round2(kn * calib.K1 + calib.K2);
  const section = getSection(sampleType, diameter);
  const kgf     = adj * (1000 / G) / section;
  return isMPa ? kgf * 0.0980665 : kgf;
}

function mean(arr: number[]): number | null {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
}

export default function ConcreteSummaryPage({ cstData, machineData, mixCodeData, dashboardData, loading }: Props) {
  const isDark = useContext(ThemeContext);
  const [selectedStructures, setSelectedStructures] = useState<Set<string>>(new Set());
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggleStructure = (s: string) => {
    setSelectedStructures(prev => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s); else next.add(s);
      return next;
    });
  };

  const summaryRows = useMemo((): SummaryRow[] => {
    if (!cstData.length) return [];

    // ── Machine calibration map: id → { K1, K2 } ───────────────────────────
    const machineMap = new Map<string, MachineCalib>();
    machineData.forEach(row => {
      const id = (row['id'] ?? row['Id'] ?? row['ID'] ?? '').trim();
      const K1 = parseFloat(row['K1'] ?? '1');
      const K2 = parseFloat(row['K2'] ?? '0');
      if (id && !isNaN(K1) && !isNaN(K2)) machineMap.set(id, { K1, K2 });
    });
    const DEFAULT_CALIB: MachineCalib = { K1: 1, K2: 0 };

    // ── Mix Code → Strength type map ────────────────────────────────────────
    // Look for "Strength type" column in Mix Code sheet
    const mixCodeUnitMap = new Map<string, string>();
    mixCodeData.forEach(row => {
      const code = String(
        row['Mix code'] ?? row['Mix Code'] ?? row['Mix'] ?? ''
      ).trim();
      const stype = String(
        row['Strength type'] ?? row['Strength Type'] ?? row['strength type'] ??
        row['Unit'] ?? row['unit'] ?? 'MPa.'
      ).trim();
      if (code) mixCodeUnitMap.set(code, stype);
    });
    if (mixCodeData.length > 0) {
      console.log('[MixCode] Unit map sample:', [...mixCodeUnitMap.entries()].slice(0, 5));
    }

    // ── Dashboard lookup by ID ───────────────────────────────────────────────
    const dashMap = new Map<string, ConcreteRecord>();
    dashboardData.forEach(rec => {
      if (rec.ID) dashMap.set(String(rec.ID).trim(), rec);
    });

    // ── Group CST rows by ref ────────────────────────────────────────────────
    const groups = new Map<string, Record<string, string>[]>();
    cstData.forEach(row => {
      const ref = (row['ref'] ?? row['Ref'] ?? row['REF'] ?? '').trim();
      if (!ref) return;
      if (!groups.has(ref)) groups.set(ref, []);
      groups.get(ref)!.push(row);
    });

    const rows: SummaryRow[] = [];
    let item = 1;

    groups.forEach((cstRows, ref) => {
      const dashRec = dashMap.get(ref);
      if (!dashRec) return; // ref not in filtered dashboard data — skip

      // Mix code from Dashboard → look up strength unit in Mix Code sheet
      const mixCodeVal = dashRec ? String(dashRec['Mix code'] ?? '').trim() : '';
      const rawStype   = mixCodeUnitMap.get(mixCodeVal) ?? 'MPa.';
      const isMPa      = rawStype === 'MPa.';
      const strengthUnit = isMPa ? 'MPa' : 'ksc';

      // Collect strength values by age + file links per age
      const byAge = new Map<number, number[]>();
      const fileMap = new Map<number, ReportFile>();

      cstRows.forEach(row => {
        const age        = parseInt((row['Age'] ?? row['age'] ?? '0').trim(), 10);
        const sampleType = (row['Sample type'] ?? row['Sample Type'] ?? '').trim();
        const machineId  = (row['Test Machine'] ?? row['Test machine'] ?? '').trim();
        const calib      = machineMap.get(machineId) ?? DEFAULT_CALIB;
        const fileUrl    = (row['File'] ?? row['file'] ?? '').trim();
        const reportNo   = (row['Report No.'] ?? row['Report No'] ?? row['Report'] ?? '').trim();

        if (!age || age <= 0) return;
        if (!byAge.has(age)) byAge.set(age, []);

        // Store one file per age (first occurrence wins)
        if (fileUrl && !fileMap.has(age)) {
          fileMap.set(age, { age, reportNo, url: fileUrl });
        }

        for (let i = 1; i <= 15; i++) {
          const sampleVal = (row[`Sample${i}`] ?? '').trim();
          const knStr     = (row[`kN${i}`]     ?? '').trim();
          if (!sampleVal || !knStr) continue;
          const kn = parseFloat(knStr);
          if (isNaN(kn) || kn <= 0) continue;

          let diameter: number | undefined;
          if (i <= 6) {
            const d = parseFloat((row[`Diameter${i}`] ?? '').trim());
            if (!isNaN(d) && d > 0) diameter = d;
          }

          byAge.get(age)!.push(calcStrength(kn, calib, sampleType, isMPa, diameter));
        }
      });

      // Sort files by age
      const files = [...fileMap.values()].sort((a, b) => a.age - b.age);

      const avg1  = mean(byAge.get(1)  ?? []);
      const avg7  = mean(byAge.get(7)  ?? []);
      const avg14 = mean(byAge.get(14) ?? []);
      const avg28 = mean(byAge.get(28) ?? []);

      const requireStrength = (() => {
        const s = dashRec ? String(dashRec['Strength'] ?? '') : '';
        const n = parseFloat(s.replace(/[^\d.]/g, ''));
        return isNaN(n) ? null : n;
      })();

      let result: 'Pass' | 'Fail' | '-' = '-';
      if (avg28 !== null && requireStrength !== null) {
        result = avg28 >= requireStrength ? 'Pass' : 'Fail';
      }

      rows.push({
        item: item++,
        ref,
        castingDate:    dashRec ? dashRec['Casting date']                             : '-',
        concreteWorks:  dashRec ? String(dashRec['Concrete Works']             ?? '-') : '-',
        structure:      dashRec ? String(dashRec['Structure']                  ?? '-') : '-',
        location:       dashRec ? String(dashRec['Location']                   ?? '-') : '-',
        structureNo:    dashRec ? String(dashRec['Structure No. or Grid Line'] ?? '-') : '-',
        supplier:       dashRec ? String(dashRec['Supplier']                   ?? '-') : '-',
        slump:          dashRec ? String(dashRec['Slump']                      ?? '-') : '-',
        mixCode:        mixCodeVal || '-',
        requireStrength,
        strengthUnit,
        avg1Day:   avg1,
        avg7Days:  avg7,
        avg14Days: avg14,
        avg28Days: avg28,
        result,
        files,
      });
    });

    return rows;
  }, [cstData, machineData, mixCodeData, dashboardData]);

  const allStructures = useMemo(
    () => [...new Set(summaryRows.map(r => r.structure).filter(s => s && s !== '-'))].sort(),
    [summaryRows],
  );

  const visibleRows = useMemo(
    () => selectedStructures.size === 0
      ? summaryRows
      : summaryRows.filter(r => selectedStructures.has(r.structure)),
    [summaryRows, selectedStructures],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-teal-400 font-bold animate-pulse text-sm">
        Loading Concrete Summary...
      </div>
    );
  }

  const downloadCSV = (rows: SummaryRow[]) => {
    const headers = [
      'Item','Ref','Casting Date','Concrete Works','Structure','Location',
      'Structure No.','Supplier','Slump','Mix Code',
      'Req. Strength','Avg 1 Day','Avg 7 Days','Avg 14 Days','Avg 28 Days',
      'Result','Reports',
    ];
    const escape = (v: string | number | null | undefined) => {
      const s = v === null || v === undefined ? '' : String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const fmt = (val: number | null, unit: string) =>
      val !== null ? `${val.toFixed(2)} ${unit}` : '-';
    const csvRows = [
      headers.join(','),
      ...rows.map(r => {
        const reports = r.files.map(f => `${f.reportNo || `Age ${f.age}D`}: ${f.url}`).join(' | ');
        return [
          r.item, r.ref, r.castingDate, r.concreteWorks, r.structure,
          r.location, r.structureNo, r.supplier, r.slump, r.mixCode,
          r.requireStrength !== null ? `${r.requireStrength} ${r.strengthUnit}` : '-',
          fmt(r.avg1Day,   r.strengthUnit),
          fmt(r.avg7Days,  r.strengthUnit),
          fmt(r.avg14Days, r.strengthUnit),
          fmt(r.avg28Days, r.strengthUnit),
          r.result,
          reports,
        ].map(escape).join(',');
      }),
    ];
    const blob = new Blob(['﻿' + csvRows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `concrete-summary${selectedStructures.size > 0 ? '-filtered' : ''}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const td  = `px-3 py-2.5 text-xs ${isDark ? 'text-slate-300' : 'text-slate-700'}`;
  const tdC = `${td} text-center`;
  const unit = (u: string) => (
    <span className={`font-normal text-[10px] ml-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{u}</span>
  );

  return (
    <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-slate-800/50 border-slate-700/50' : 'bg-white border-slate-200'}`}>
      <div className={`px-6 py-4 border-b ${isDark ? 'border-slate-700/50' : 'border-slate-200'}`}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className={`text-base font-bold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
              Concrete Summary
            </h2>
            <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {visibleRows.length}{selectedStructures.size > 0 ? `/${summaryRows.length}` : ''} item{summaryRows.length !== 1 ? 's' : ''}
              {' · '}unit (MPa / ksc) from Mix Code sheet · calibrated via Compression Machine K1/K2
            </p>
          </div>
          <button
            type="button"
            disabled={visibleRows.length === 0}
            onClick={() => downloadCSV(visibleRows)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
              isDark
                ? 'bg-slate-700/40 border-slate-600/50 text-slate-300 hover:bg-slate-700/70 hover:border-slate-500'
                : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50 hover:border-slate-400'
            }`}
          >
            <Download size={13} strokeWidth={2.5} />
            Download CSV
          </button>
        </div>

        {/* Structure filter dropdown */}
        {allStructures.length > 0 && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className={`text-[11px] font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Structure:
            </span>

            <div ref={dropdownRef} className="relative">
              <button
                type="button"
                onClick={() => setDropdownOpen(o => !o)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  selectedStructures.size > 0
                    ? isDark
                      ? 'bg-teal-500/20 border-teal-500/40 text-teal-300'
                      : 'bg-teal-50 border-teal-400 text-teal-800'
                    : isDark
                      ? 'bg-slate-700/40 border-slate-600/50 text-slate-300 hover:border-slate-500'
                      : 'bg-white border-slate-300 text-slate-600 hover:border-slate-400'
                }`}
              >
                {selectedStructures.size > 0 ? `${selectedStructures.size} selected` : 'All structures'}
                <ChevronDown size={12} strokeWidth={2.5} className={`transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {dropdownOpen && (
                <div className={`absolute left-0 top-full mt-1 z-50 min-w-[200px] max-h-64 overflow-y-auto rounded-xl border shadow-xl ${
                  isDark ? 'bg-slate-800 border-slate-600' : 'bg-white border-slate-200'
                }`}>
                  {allStructures.map(s => {
                    const active = selectedStructures.has(s);
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => toggleStructure(s)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left transition-colors ${
                          active
                            ? isDark ? 'bg-teal-500/15 text-teal-300' : 'bg-teal-50 text-teal-800'
                            : isDark ? 'text-slate-300 hover:bg-slate-700/50' : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span className={`flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center ${
                          active
                            ? isDark ? 'bg-teal-500 border-teal-500' : 'bg-teal-500 border-teal-500'
                            : isDark ? 'border-slate-500' : 'border-slate-300'
                        }`}>
                          {active && <Check size={10} strokeWidth={3} className="text-white" />}
                        </span>
                        {s}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {selectedStructures.size > 0 && (
              <button
                type="button"
                onClick={() => setSelectedStructures(new Set())}
                className={`inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg border transition-all ${
                  isDark
                    ? 'border-slate-600/50 text-slate-500 hover:text-slate-300 hover:border-slate-500'
                    : 'border-slate-300 text-slate-400 hover:text-slate-600 hover:border-slate-400'
                }`}
              >
                <X size={10} strokeWidth={2.5} />
                Clear
              </button>
            )}
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1350px]">
          <thead>
            <tr className={isDark ? 'bg-slate-700/40' : 'bg-slate-50'}>
              {[
                { label: 'Item',           center: false },
                { label: 'Casting Date',    center: false },
                { label: 'Concrete Works',  center: false },
                { label: 'Structure',       center: false },
                { label: 'Location',        center: false },
                { label: 'Structure No.',   center: false },
                { label: 'Supplier',        center: false },
                { label: 'Slump',           center: true  },
                { label: 'Mix Code',        center: false },
                { label: 'Req. Strength',   center: true  },
                { label: 'Avg 1 Day',       center: true  },
                { label: 'Avg 7 Days',      center: true  },
                { label: 'Avg 14 Days',     center: true  },
                { label: 'Avg 28 Days',     center: true  },
                { label: 'Result',          center: true  },
                { label: 'Reports',         center: true  },
              ].map(({ label, center }) => (
                <th
                  key={label}
                  className={`px-3 py-3 text-${center ? 'center' : 'left'} text-xs font-semibold whitespace-nowrap border-b ${
                    isDark ? 'text-slate-300 border-slate-700/50' : 'text-slate-600 border-slate-200'
                  }`}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, idx) => (
              <tr
                key={row.ref}
                className={`border-t transition-colors ${
                  isDark
                    ? 'border-slate-700/30 hover:bg-slate-700/20'
                    : 'border-slate-100 hover:bg-teal-50/40'
                } ${idx % 2 !== 0 ? (isDark ? 'bg-slate-800/20' : 'bg-slate-50/50') : ''}`}
              >
                <td className={`px-3 py-2.5 text-xs font-bold ${isDark ? 'text-teal-300' : 'text-teal-700'}`}>
                  {row.item}
                </td>
                <td className={td}>{row.castingDate}</td>
                <td className={td}>{row.concreteWorks}</td>
                <td className={td}>{row.structure}</td>
                <td className={td}>{row.location}</td>
                <td className={td}>{row.structureNo}</td>
                <td className={td}>{row.supplier}</td>
                <td className={tdC}>{row.slump}</td>
                <td className={`px-3 py-2.5 text-xs font-mono ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>
                  {row.mixCode}
                </td>

                <td className={`${tdC} font-semibold`}>
                  {row.requireStrength !== null
                    ? <>{row.requireStrength}{unit(row.strengthUnit)}</>
                    : '-'}
                </td>

                <td className={tdC}>
                  {row.avg1Day !== null
                    ? <>{row.avg1Day.toFixed(2)}{unit(row.strengthUnit)}</>
                    : '-'}
                </td>

                <td className={tdC}>
                  {row.avg7Days !== null
                    ? <>{row.avg7Days.toFixed(2)}{unit(row.strengthUnit)}</>
                    : '-'}
                </td>

                <td className={tdC}>
                  {row.avg14Days !== null
                    ? <>{row.avg14Days.toFixed(2)}{unit(row.strengthUnit)}</>
                    : '-'}
                </td>

                <td className={`${tdC} font-semibold ${
                  row.avg28Days !== null ? (isDark ? 'text-emerald-300' : 'text-emerald-700') : ''
                }`}>
                  {row.avg28Days !== null
                    ? <>{row.avg28Days.toFixed(2)}<span className={`font-normal text-[10px] ml-0.5 ${isDark ? 'text-emerald-500' : 'text-emerald-600'}`}>{row.strengthUnit}</span></>
                    : '-'}
                </td>

                {/* Result */}
                <td className={tdC}>
                  {row.result === '-' ? (
                    <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>—</span>
                  ) : (
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                      row.result === 'Pass'
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        : 'bg-rose-500/20    text-rose-400    border-rose-500/30'
                    }`}>
                      {row.result}
                    </span>
                  )}
                </td>

                {/* Reports — one button per age */}
                <td className="px-3 py-2 text-center">
                  {row.files.length === 0 ? (
                    <span className={`text-xs ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>—</span>
                  ) : (
                    <div className="flex flex-wrap gap-1 justify-center">
                      {row.files.map(f => (
                        <a
                          key={f.age}
                          href={f.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={f.reportNo || `Age ${f.age} days`}
                          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold border transition-all hover:scale-105 active:scale-95 ${
                            isDark
                              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25'
                              : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                          }`}
                        >
                          <FileText size={11} strokeWidth={2.5} className="text-red-500 flex-shrink-0" />
                          <span>PDF</span>
                          <span className={`opacity-60`}>{f.age}D</span>
                        </a>
                      ))}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {visibleRows.length === 0 && (
          <div className={`text-center py-16 text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            No data found. Make sure the CST sheet has a{' '}
            <span className="font-mono font-bold">ref</span> column matching IDs in the Dashboard sheet.
          </div>
        )}
      </div>
    </div>
  );
}
