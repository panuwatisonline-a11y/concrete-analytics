import { MONTHS } from './constants';
import type { ConcreteRecord } from './types';

interface GSheetCell {
  v?: string | number | boolean | null;
  f?: string;
}

interface GSheetRow {
  c: (GSheetCell | null)[];
}

interface GSheetCol {
  label?: string;
}

interface GSheetTable {
  cols: GSheetCol[];
  rows: GSheetRow[];
}

export interface GSheetResponse {
  table: GSheetTable;
}

export function parseGSheetRows(jsonData: GSheetResponse): ConcreteRecord[] {
  let headers = jsonData.table.cols.map((col) => (col.label || '').trim());
  let dataRows = jsonData.table.rows || [];

  const hasColHeaders = headers.some(h => h !== '');
  if (!hasColHeaders && dataRows.length > 0) {
    const firstRow = dataRows[0];
    if (firstRow?.c) {
      const firstRowVals = firstRow.c.map(cell => {
        if (!cell) return '';
        const v = cell.v ?? cell.f ?? '';
        return String(v).trim();
      });
      const textCount = firstRowVals.filter(v => v && isNaN(Number(v))).length;
      if (textCount >= 3) {
        headers  = firstRowVals;
        dataRows = dataRows.slice(1);
        console.log('[Dashboard] QUERY sheet detected — using row 1 as headers');
      }
    }
  }

  if (!headers.some(h => h !== '')) {
    console.warn('[Dashboard] No headers found — sheet may be empty');
    return [];
  }

  return dataRows
    .filter((row) => {
      if (!row?.c) return false;
      return row.c.some(cell => cell && cell.v !== null && cell.v !== '' && cell.v !== undefined);
    })
    .map((row, index): ConcreteRecord => {
      const rowData: Record<string, string | number | boolean> = {};

      if (row?.c) {
        row.c.forEach((cell, i) => {
          if (!headers[i]) return;
          let val: string | number | boolean = '';
          if (cell) {
            if (typeof cell.v === 'string' && cell.v.startsWith('Date(')) {
              const m = cell.v.match(/Date\((\d+),\s*(\d+),\s*(\d+)/);
              if (m) {
                val = `${m[1]}-${String(+m[2] + 1).padStart(2,'0')}-${String(+m[3]).padStart(2,'0')}`;
              } else {
                val = cell.f || cell.v;
              }
            } else {
              val = (cell.v ?? cell.f ?? '') as string | number | boolean;
            }
            if (typeof val === 'string') val = val.trim();
          }
          rowData[headers[i]] = val;
        });
      }

      const findKey = (keys: string[]): string => {
        const found = Object.keys(rowData).find((k) =>
          keys.some((pk) => pk.toLowerCase() === k.toLowerCase())
        );
        return found ? String(rowData[found] ?? '') : '';
      };

      const rawDate =
        (findKey(['Postpone date','Postpone Date']) || '').trim() ||
        (findKey(['Casting date','Date','วันที่']) || '').trim() ||
        (findKey(['Request date','Request Date']) || '').trim();

      let dateObj: Date | null = null;
      if (rawDate) {
        const s = String(rawDate).trim();
        if (!isNaN(Number(s)) && s.length < 6) {
          dateObj = new Date(Math.round((Number(s) - 25569) * 86400 * 1000));
        } else {
          const parts = s.split(/[-/]/);
          if (parts.length === 3) {
            dateObj = parts[0].length === 4
              ? new Date(+parts[0], +parts[1] - 1, +parts[2])
              : new Date(+parts[2], +parts[1] - 1, +parts[0]);
          } else {
            dateObj = new Date(s);
          }
        }
      }

      const validDate   = dateObj !== null && !isNaN(dateObj.getTime());
      const yyyy        = validDate && dateObj ? dateObj.getFullYear() : null;
      const mm          = validDate && dateObj ? String(dateObj.getMonth() + 1).padStart(2,'0') : null;
      const dd          = validDate && dateObj ? String(dateObj.getDate()).padStart(2,'0') : null;
      const dateDisplay = validDate ? `${yyyy}-${mm}-${dd}` : 'Unknown Date';
      const month       = validDate && dateObj ? `${MONTHS[dateObj.getMonth()]} ${yyyy}` : 'Unknown';
      const ts          = validDate && dateObj ? dateObj.getTime() : 0;

      if (!validDate) dateObj = new Date();

      const cleanNum = (v: string): number => parseFloat(String(v).replace(/,/g, '')) || 0;
      const dwgVol    = cleanNum(findKey(['DWG. Volume','DWG Volume']));
      const confirmVol = cleanNum(findKey(['Confirm Volume','Confirm Vol']));
      const actualVol  = cleanNum(findKey(['Actual Volume','Actual Vol']));

      const rawStatus = findKey(['Current Status','Status','สถานะ','current status','CURRENT STATUS']);
      let status = String(rawStatus ?? '').replace(/[​-‍﻿]/g, '').trim();
      if (status === '' || status === 'null' || status === 'undefined') {
        status = '1';
      } else {
        const asNum = parseFloat(status);
        if (!isNaN(asNum)) {
          status = String(asNum);
        }
      }

      const rawLoss = findKey(['Loss Concrete','Loss']);
      const lossVol = status === '7' && rawLoss !== '' ? cleanNum(rawLoss) : null;

      return {
        ...rowData,
        ID:                          findKey(['id','ID']) || `REQ-${2000 + index}`,
        'Current Status':            status,
        'Casting date':              dateDisplay,
        Month:                       month,
        Timestamp:                   ts,
        'DWG. Volume':               dwgVol.toFixed(2),
        'Actual Volume':             actualVol.toFixed(2),
        'Confirm Volume':            confirmVol.toFixed(2),
        'Loss Concrete':             lossVol !== null ? lossVol.toFixed(2) : null,
        'Request by':                findKey(['Request by','Request By','Staff']),
        Structure:                   findKey(['Structure']),
        Supplier:                    findKey(['Supplier']),
        Location:                    findKey(['Location']),
        Strength:                    findKey(['Strength']),
        'Concrete Works':            findKey(['Concrete Works']),
        'Mix code':                  findKey(['Mix Code','Mix code','Mix']),
        Slump:                       findKey(['Slump']),
        'Structure No. or Grid Line':findKey(['Structure No. or Grid Line','Structure No','Grid Line']),
        'Request Volume':            findKey(['Request Volume']),
        'Amount of Sample':          findKey(['Amount of Sample']),
        Client:                      findKey(['Client']),
      } as ConcreteRecord;
    });
}
