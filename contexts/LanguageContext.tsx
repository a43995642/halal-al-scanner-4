
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Language, TranslationDictionary } from '../types';
import ar from '../locales/ar';
import en from '../locales/en';
import fr from '../locales/fr';
import id from '../locales/id';
import tr from '../locales/tr';
import de from '../locales/de';
import ru from '../locales/ru';
import ur from '../locales/ur';
import ms from '../locales/ms';
import bn from '../locales/bn';
import zh from '../locales/zh';
import fa from '../locales/fa';
import es from '../locales/es';
import hi from '../locales/hi';
import uz from '../locales/uz';
import kk from '../locales/kk';
import ky from '../locales/ky';
import so from '../locales/so';
import ha from '../locales/ha';
import sw from '../locales/sw';
import ps from '../locales/ps';
import tl from '../locales/tl';
import ckb from '../locales/ckb';
import kmr from '../locales/kmr';
import ml from '../locales/ml';
import ja from '../locales/ja';
import ko from '../locales/ko';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: TranslationDictionary;
  isLoading: boolean;
  dir: 'rtl' | 'ltr';
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children?: ReactNode }) => {
  const [language, setLanguageState] = useState<Language>(() => {
     // 1. Check Local Storage first (User Preference)
     if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem('halalScannerLang');
        if (saved) return saved as Language;
     }
     
     // 2. Check Device Language
     if (typeof navigator !== 'undefined') {
        const browserLang = navigator.language.split('-')[0]; // e.g., 'en-US' -> 'en'
        const supportedLangs = ['ar', 'en', 'fr', 'id', 'tr', 'de', 'ru', 'ur', 'ms', 'bn', 'zh', 'fa', 'es', 'hi', 'uz', 'kk', 'ky', 'so', 'ha', 'sw', 'ps', 'tl', 'ku', 'ml', 'ja', 'ko', 'ckb', 'kmr'];
        
        if (supportedLangs.includes(browserLang)) {
            return browserLang as Language;
        }
     }

     // 3. Default Fallback
     return 'en';
  });
  
  // FIX: Use static dictionaries instead of dynamic imports to prevent WSOD on Android
  const t = language === 'ar' ? ar : (language === 'fr' ? fr : (language === 'id' ? id : (language === 'tr' ? tr : (language === 'de' ? de : (language === 'ru' ? ru : (language === 'ur' ? ur : (language === 'ms' ? ms : (language === 'bn' ? bn : (language === 'zh' ? zh : (language === 'fa' ? fa : (language === 'es' ? es : (language === 'hi' ? hi : (language === 'uz' ? uz : (language === 'kk' ? kk : (language === 'ky' ? ky : (language === 'so' ? so : (language === 'ha' ? ha : (language === 'sw' ? sw : (language === 'ps' ? ps : (language === 'tl' ? tl : (language === 'ku' ? ckb : (language === 'ckb' ? ckb : (language === 'kmr' ? kmr : (language === 'ml' ? ml : (language === 'ja' ? ja : (language === 'ko' ? ko : en))))))))))))))))))))))))));
  const dir = (language === 'ar' || language === 'ur' || language === 'fa' || language === 'ps' || language === 'ku' || language === 'ckb') ? 'rtl' : 'ltr';

  useEffect(() => {
      // Update DOM attributes for global styling
      document.documentElement.setAttribute('lang', language);
      document.documentElement.setAttribute('dir', dir);
      localStorage.setItem('halalScannerLang', language);
  }, [language, dir]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
  };

  // No loading state needed with static imports
  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, isLoading: false, dir }}>
      {children}
    </LanguageContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
};
