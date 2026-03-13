
import { HalalStatus } from '../types';

// Helper for ingredients style
export const getIngredientStyle = (status: HalalStatus, isOverlay: boolean = false) => {
  if (isOverlay) {
    switch(status) {
      case HalalStatus.HARAM: 
        // خلفية سوداء مع إطار أحمر قوي للنصوص المحرمة
        return "bg-black border-red-500 text-red-400 font-black ring-2 ring-red-600 shadow-[0_0_10px_rgba(220,38,38,0.5)]";
      case HalalStatus.DOUBTFUL: 
        // خلفية سوداء مع إطار أصفر قوي للمشبوه
        return "bg-black border-amber-400 text-amber-300 font-black ring-2 ring-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]";
      default: 
        // خلفية سوداء بالكامل *بدون* إطار أبيض (تم التعديل)
        return "bg-black text-white font-bold";
    }
  } else {
    // في القوائم العادية
    switch(status) {
      case HalalStatus.HARAM: 
        return "bg-red-950 text-white border-red-500 border-2 font-bold shadow-sm";
      case HalalStatus.DOUBTFUL: 
        return "bg-amber-950 text-amber-100 border-amber-500 border-2 font-bold";
      default: 
        return "bg-slate-900 text-white border-gray-400 border-2 font-bold";
    }
  }
};
