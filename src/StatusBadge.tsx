import { STATUS_INFO } from './constants';

interface StatusBadgeProps {
  status: string;
}

const StatusBadge = ({ status }: StatusBadgeProps) => {
  const info = STATUS_INFO[status] || { short: status, color: '#94A3B8', bg: 'bg-slate-700', text: 'text-slate-300' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold ${info.bg} ${info.text} border border-white/5 rounded-full whitespace-nowrap`}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: info.color }} />
      {info.short}
    </span>
  );
};

export default StatusBadge;
