import { X } from 'lucide-react';
import { ResponsiveContainer } from 'recharts';
import { ReactElement } from 'react';

interface ChartBoxProps {
  title: string;
  isActive: boolean;
  onClear: () => void;
  children: ReactElement;
}

// BUG FIX: เอา overflow-hidden ออก เพื่อให้ Tooltip ไม่ถูก clip
//           ใช้ isolate แทนเพื่อ stacking context
const ChartBox = ({ title, isActive, onClear, children }: ChartBoxProps) => (
  <div
    className={`bg-slate-800/40 border ${isActive ? 'border-indigo-500/50' : 'border-slate-700/50'} rounded-2xl p-5 flex flex-col transition-all duration-300 backdrop-blur-sm`}
  >
    <div className="flex justify-between items-center mb-4 flex-shrink-0">
      <h2 className="text-sm font-bold text-white flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-indigo-400 animate-pulse' : 'bg-slate-600'}`} />
        {title}
      </h2>
      {isActive && (
        <button
          onClick={onClear}
          className="text-[10px] bg-slate-700/80 hover:bg-slate-600 text-slate-300 px-2 py-1 rounded flex items-center gap-1 transition-colors border border-slate-600 uppercase font-bold tracking-wider"
        >
          <X size={10} /> Clear
        </button>
      )}
    </div>
    {/* ใช้ explicit height บน div แทน flex-1 เพื่อหนีปัญหา width(-1) height(-1) */}
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  </div>
);

export default ChartBox;
