import { ReactNode } from 'react';

interface KPIBoxProps {
  title: string;
  value: string | number;
  unit: string;
  icon: ReactNode;
  color: string;
  isAlert?: boolean;
  isSurplus?: boolean;
}

const KPIBox = ({ title, value, unit, icon, color, isAlert = false, isSurplus = false }: KPIBoxProps) => (
  <div className={`bg-slate-800/60 backdrop-blur-md rounded-2xl p-5 border ${
    isSurplus ? 'border-emerald-500/50' : isAlert ? 'border-rose-500/50' : 'border-slate-700/50'
  } relative overflow-hidden hover:border-slate-500 transition-colors`}>
    <div className={`absolute -right-6 -top-6 w-24 h-24 bg-gradient-to-br ${color} opacity-10 rounded-full blur-2xl pointer-events-none`} />
    <div className="flex justify-between items-start mb-2">
      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{title}</p>
      <div className={`p-2 rounded-xl bg-slate-900/50 ${
        isSurplus ? 'text-emerald-400' : isAlert ? 'text-rose-400' : 'text-slate-300'
      }`}>{icon}</div>
    </div>
    <div className="flex items-baseline gap-2">
      <h3 className={`text-3xl font-black ${
        isSurplus ? 'text-emerald-400' : isAlert ? 'text-rose-400' : 'text-white'
      }`}>{value}</h3>
      <span className="text-sm font-medium text-slate-500">{unit}</span>
    </div>
  </div>
);

export default KPIBox;
