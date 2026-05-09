import { MONTHS } from './constants';
import type { ConcreteRecord } from './types';

export function generateMockData(): ConcreteRecord[] {
  const suppliers  = ['CPAC','Namuang','TPI','Insee','Fasco'];
  const structures = ['Column','Beam','Slab','Foundation','Retaining Wall','Stair'];
  const works      = ['Structural Pouring','Road Works','Paving','Finishing','Pile Cap'];
  const strengths  = ['240 KSC','280 KSC','320 KSC','350 KSC','400 KSC'];
  const staff      = ['Eng. Nattapong','Eng. Somsak','Eng. Wichai','Eng. Supachai','Eng. Araya'];
  const locations  = ['Zone A','Zone B','Zone C','Tower 1','Tower 2'];

  const pick  = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
  const randStatus = (): string => {
    const r = Math.random();
    if (r > 0.40) return '7';
    if (r > 0.25) return '3.1';
    if (r > 0.15) return '3';
    if (r > 0.10) return '2';
    if (r > 0.05) return '1';
    if (r > 0.03) return '4';
    if (r > 0.01) return '5';
    return '6';
  };

  return Array.from({ length: 250 }, (_, i): ConcreteRecord => {
    const status      = randStatus();
    const isComplete  = status === '7';
    const dwgVol      = Math.floor(Math.random() * 80) + 10;
    const confirmVol  = isComplete ? dwgVol + (Math.random() * 10 - 2) : 0;
    const actualVol   = isComplete ? confirmVol : 0;
    const lossVol     = isComplete ? confirmVol - dwgVol : null;

    const date  = new Date();
    date.setDate(date.getDate() - Math.floor(Math.random() * 180));
    const yyyy  = date.getFullYear();
    const mm    = String(date.getMonth() + 1).padStart(2, '0');
    const dd    = String(date.getDate()).padStart(2, '0');

    return {
      ID:                          `REQ-${2000 + i}`,
      'Casting date':              `${yyyy}-${mm}-${dd}`,
      Month:                       `${MONTHS[date.getMonth()]} ${yyyy}`,
      'Current Status':            status,
      'Request by':                pick(staff),
      'Concrete Works':            pick(works),
      Structure:                   pick(structures),
      Location:                    pick(locations),
      'Structure No. or Grid Line':`GL-${String.fromCharCode(65 + Math.floor(Math.random() * 5))}/${Math.floor(Math.random() * 10) + 1}`,
      Supplier:                    pick(suppliers),
      'Mix code':                  `MIX-${Math.floor(Math.random() * 900) + 100}`,
      Slump:                       '10±2.5 cm',
      Strength:                    pick(strengths),
      'DWG. Volume':               dwgVol.toFixed(2),
      'Actual Volume':             actualVol.toFixed(2),
      'Confirm Volume':            confirmVol.toFixed(2),
      'Loss Concrete':             lossVol !== null ? lossVol.toFixed(2) : null,
      'Request Volume':            dwgVol.toFixed(2),
      'Amount of Sample':          '',
      Client:                      '',
      Timestamp:                   date.getTime(),
    };
  });
}
