import React from 'react';
import { Plus, Trash2 } from 'lucide-react';

interface Slice {
  stage: string;
  percent: number;
}

interface PaymentSliderProps {
  plan: string;
  total: number;
  onChange: (plan: string) => void;
}

export const PaymentSlider: React.FC<PaymentSliderProps> = ({ plan, total, onChange }) => {
  // Parse incoming plan: "%40 Peşin (154.000 TL) - %60 İş Tesliminde (231.000 TL)"
  const parsePlan = (p: string): Slice[] => {
    if (!p) return [{ stage: 'Peşin', percent: 100 }];
    return p.split(' - ').map(s => {
      const match = s.match(/%(\d+)\s+([^(]+)/);
      return match ? { stage: match[2].trim(), percent: parseInt(match[1]) } : { stage: 'Diğer', percent: 0 };
    });
  };

  const [slices, setSlices] = React.useState<Slice[]>(() => parsePlan(plan));

  const updatePlan = (newSlices: Slice[]) => {
    const formatted = newSlices.map(s => {
      const amount = (total * s.percent) / 100;
      return `%${s.percent} ${s.stage} (${amount.toLocaleString('tr-TR')} TL)`;
    }).join(' - ');
    onChange(formatted);
    setSlices(newSlices);
  };

  const adjustPercent = (index: number, delta: number) => {
    const newSlices = [...slices];
    newSlices[index].percent = Math.max(0, newSlices[index].percent + delta);
    // Auto-adjust last slice to maintain 100%
    let totalPercent = newSlices.reduce((sum, s) => sum + s.percent, 0);
    const diff = 100 - totalPercent;
    newSlices[newSlices.length - 1].percent += diff;
    updatePlan(newSlices);
  };

  return (
    <div className="space-y-3">
      <div className="flex h-8 rounded-lg overflow-hidden border border-slate-200">
        {slices.map((slice, i) => (
          <div key={i} className="flex items-center justify-center text-[10px] font-bold text-white" 
               style={{ width: `${slice.percent}%`, backgroundColor: `hsl(${i * 60}, 60%, 50%)` }}>
            %{slice.percent}
          </div>
        ))}
      </div>
      
      <div className="space-y-2">
        {slices.map((slice, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <input value={slice.stage} onChange={(e) => {
              const ns = [...slices]; ns[i].stage = e.target.value; updatePlan(ns);
            }} className="w-24 border rounded p-1" />
            <button onClick={() => adjustPercent(i, -5)} className="px-2 bg-slate-100 rounded">-5%</button>
            <button onClick={() => adjustPercent(i, 5)} className="px-2 bg-slate-100 rounded">+5%</button>
            <span className="font-mono">%{slice.percent}</span>
            <span className="font-bold">({((total * slice.percent) / 100).toLocaleString('tr-TR')} TL)</span>
            {slices.length > 1 && <button onClick={() => updatePlan(slices.filter((_, idx) => idx !== i))}><Trash2 className="w-4 h-4 text-red-500"/></button>}
          </div>
        ))}
      </div>
      
      {slices.length < 4 && (
        <button onClick={() => updatePlan([...slices, { stage: 'Yeni', percent: 0 }])} className="text-xs text-amber-700 flex items-center gap-1">
          <Plus className="w-4 h-4" /> Dilim Ekle
        </button>
      )}
    </div>
  );
};
