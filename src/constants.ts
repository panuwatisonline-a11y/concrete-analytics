export interface StatusInfo {
  label: string;
  short: string;
  legend: string;
  color: string;
  bg: string;
  text: string;
}

export const STATUS_INFO: Record<string, StatusInfo> = {
  '1':   { label: 'จองแล้ว/รอตรวจสอบ',              short: 'จองแล้ว/รอตรวจสอบ',              legend: 'S1 รอตรวจสอบ',   color: '#64748B', bg: 'bg-slate-500/20',  text: 'text-slate-300'  },
  '2':   { label: 'ตรวจสอบผ่านแล้ว/รออนุมัติ QC',   short: 'ตรวจสอบผ่านแล้ว/รออนุมัติ QC',   legend: 'S2 รออนุมัติ QC', color: '#3B82F6', bg: 'bg-blue-500/20',   text: 'text-blue-400'   },
  '3':   { label: 'อนุมัติแล้ว/รอสั่งโหลด',          short: 'อนุมัติแล้ว/รอสั่งโหลด',          legend: 'S3 รอสั่งโหลด',   color: '#6366F1', bg: 'bg-indigo-500/20', text: 'text-indigo-300'  },
  '3.1': { label: 'สั่งโหลดคอนกรีตแล้ว/รอ Confirm',  short: 'สั่งโหลดคอนกรีตแล้ว/รอ Confirm',  legend: 'S3.1 รอ Confirm',  color: '#06B6D4', bg: 'bg-cyan-500/20',   text: 'text-cyan-300'   },
  '4':   { label: 'เลื่อนวันเทคอนกรีต/รอสั่งโหลด',   short: 'เลื่อนวันเทคอนกรีต/รอสั่งโหลด',   legend: 'S4 เลื่อนวัน',    color: '#F59E0B', bg: 'bg-amber-500/20',  text: 'text-amber-400'  },
  '5':   { label: 'Reject/ตรวจสอบไม่ผ่าน',           short: 'Reject/ตรวจสอบไม่ผ่าน',           legend: 'S5 Reject',        color: '#F43F5E', bg: 'bg-rose-500/20',   text: 'text-rose-400'   },
  '6':   { label: 'Cancel/ยกเลิก',                   short: 'Cancel/ยกเลิก',                   legend: 'S6 Cancel',        color: '#9F1239', bg: 'bg-rose-900/40',   text: 'text-rose-500'   },
  '7':   { label: 'Complete/Confirm รายการ',          short: 'Complete/Confirm รายการ',          legend: 'S7 Complete',      color: '#10B981', bg: 'bg-emerald-500/20',text: 'text-emerald-400' },
};

export const STATUS_ORDER: string[] = ['1','2','3','3.1','4','5','6','7'];

export const MONTHS: string[] = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export const SUPPLIER_COLORS: string[] = ['#EC4899','#A855F7','#3B82F6','#14B8A6','#F59E0B','#F43F5E','#10B981'];

export const GOOGLE_SHEET_ID    = '1BrewymiKRqJaiVuR1hJv3xJaM4EJW967NzdbNJAQeA8';
export const SHEET_NAME         = 'Dashboard';
export const MIXCODE_SHEET_NAME = 'Mix Code';
export const USE_GOOGLE_SHEETS  = true;
