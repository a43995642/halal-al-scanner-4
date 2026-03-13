
import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
// Removed User import to fix TS error
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import packageJson from '../package.json'; // Fixed import path
import { useAlert } from '../contexts/AlertContext';

// Reusing URL logic from geminiService to ensure consistency
const VERCEL_PROJECT_URL = 'https://halal-al-scanner-4.vercel.app'; 
const getBaseUrl = () => {
  if (Capacitor.isNativePlatform()) return VERCEL_PROJECT_URL.replace(/\/$/, '');
  if (typeof window !== 'undefined') {
     const host = window.location.hostname;
     if (host === 'localhost' || host.startsWith('192.168') || host.startsWith('10.')) {
        return VERCEL_PROJECT_URL.replace(/\/$/, '');
     }
  }
  return '';
};

interface SettingsModalProps {
  onClose: () => void;
  onClearHistory: () => void;
  isPremium: boolean;
  onManageSubscription: () => void;
  onOpenAuth: () => void;
  onOpenPrivacy: () => void;
  onOpenTerms: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ 
  onClose, 
  onClearHistory, 
  isPremium, 
  onManageSubscription, 
  onOpenAuth,
  onOpenPrivacy,
  onOpenTerms
}) => {
  const { t, language, setLanguage } = useLanguage();

  const LANGUAGES = [
    { code: 'ar', label: 'العربية', flag: '🇸🇦' },
    { code: 'en', label: 'English', flag: '🇺🇸' },
    { code: 'fr', label: 'Français', flag: '🇫🇷' },
    { code: 'id', label: 'Indonesia', flag: '🇮🇩' },
    { code: 'tr', label: 'Türkçe', flag: '🇹🇷' },
    { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
    { code: 'ru', label: 'Русский', flag: '🇷🇺' },
    { code: 'ur', label: 'اردو', flag: '🇵🇰' },
    { code: 'ms', label: 'Melayu', flag: '🇲🇾' },
    { code: 'bn', label: 'বাংলা', flag: '🇧🇩' },
    { code: 'zh', label: '中文', flag: '🇨🇳' },
    { code: 'fa', label: 'فارسی', flag: '🇮🇷' },
    { code: 'es', label: 'Español', flag: '🇪🇸' },
    { code: 'hi', label: 'हिन्दी', flag: '🇮🇳' },
    { code: 'uz', label: "O'zbek", flag: '🇺🇿' },
    { code: 'kk', label: 'Қазақша', flag: '🇰🇿' },
    { code: 'ky', label: 'Кыргызча', flag: '🇰🇬' },
    { code: 'so', label: 'Soomaali', flag: '🇸🇴' },
    { code: 'ha', label: 'Hausa', flag: '🇳🇬' },
    { code: 'sw', label: 'Kiswahili', flag: '🇹🇿' },
    { code: 'ps', label: 'پښتو', flag: '🇦🇫' },
    { code: 'tl', label: 'Tagalog', flag: '🇵🇭' },
    { code: 'ckb', label: 'کوردی', flag: '🇹🇯' },
    { code: 'kmr', label: 'Kurdî', flag: '🇹🇯' },
    { code: 'ml', label: 'മലയാളം', flag: '🇮🇳' },
    { code: 'ja', label: '日本語', flag: '🇯🇵' },
    { code: 'ko', label: '한국어', flag: '🇰🇷' },
  ] as const;

  const { showAlert, showConfirm } = useAlert();
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);
  const [showDietarySelector, setShowDietarySelector] = useState(false);
  const currentLang = LANGUAGES.find(l => l.code === language) || LANGUAGES[1];
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    return localStorage.getItem('halalScannerSound') !== 'false';
  });
  const [hapticsEnabled, setHapticsEnabled] = useState(() => {
    return localStorage.getItem('halalScannerHaptics') !== 'false';
  });
  const [dietaryPreferences, setDietaryPreferences] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('dietaryPreferences');
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  });
  const [user, setUser] = useState<any | null>(null); // Changed User to any
  const [isSigningOut, setIsSigningOut] = useState(false); // New state for loading
  const [ingredientLang, setIngredientLang] = useState<'app' | 'original'>(() => {
      const saved = localStorage.getItem('ingredientLangPreference');
      return (saved === 'original') ? 'original' : 'app';
  });

  useEffect(() => {
     // 1. Get initial user
     const getInitialUser = async () => {
       const { data } = await supabase.auth.getUser();
       setUser(data.user);
     };
     getInitialUser();

     // 2. Listen for auth changes (Login/Logout) to update UI immediately
     const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
       setUser(session?.user || null);
     });

     return () => {
       subscription.unsubscribe();
     };
  }, []);

  const handleClearHistory = () => {
    showConfirm(
      t.clearHistory,
      t.clearHistoryDesc,
      () => {
        onClearHistory();
        showAlert(t.clearHistory, t.clearHistoryConfirm, 'success');
      },
      'error'
    );
  };

  const handleSignOut = async () => {
      if (isSigningOut) return;
      setIsSigningOut(true);

      try {
        // 1. Sign out from Supabase
        await supabase.auth.signOut();
        
        // 2. Also sign out from Google Plugin (Wrap in try/catch to avoid freezing if not initialized)
        try {
          await GoogleAuth.signOut();
        } catch (e) {
          console.log("Google SignOut Skipped/Failed:", e);
        }
        
        // 3. Force Reload to clear all states completely (Best for Hybrid Apps)
        window.location.reload();
      } catch (err) {
        console.error("Logout Error:", err);
        // Even if error, force reload to ensure clean state
        window.location.reload();
      }
  };

  const handleDeleteAccount = async () => {
    if (!user || user.role !== 'authenticated') return;

    showConfirm(
      t.deleteAccount,
      t.deleteAccountConfirm,
      async () => {
        setIsSigningOut(true);
        try {
            // 1. Send deletion request to dedicated API
            const baseUrl = getBaseUrl();
            const response = await fetch(`${baseUrl}/api/delete-account`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id })
            });

            if (!response.ok) {
              throw new Error("Deletion failed on server");
            }

            // 2. Clear local data
            onClearHistory();
            localStorage.clear();

            // 3. Sign Out locally
            await supabase.auth.signOut();
             try { await GoogleAuth.signOut(); } catch (e) { /* ignore */ }

            showAlert(t.deleteAccount, t.deleteAccountSuccess, 'success');
            setTimeout(() => {
                window.location.reload();
            }, 2000);

        } catch (e) {
            console.error("Delete Account Error", e);
            showAlert(t.errorTitle, t.connectionError, 'error');
            setIsSigningOut(false);
        }
      },
      'error'
    );
  };

  const handleExitApp = async () => {
      if (Capacitor.isNativePlatform()) {
          await App.exitApp();
      } else {
          // Fallback for PWA/Browser (Usually won't work due to browser security, but good to have)
          showAlert(t.exitApp, language === 'ar' ? "يرجى إغلاق المتصفح." : "Please close the browser tab.", 'info');
      }
  };

  const changeIngredientLang = (val: 'app' | 'original') => {
      setIngredientLang(val);
      localStorage.setItem('ingredientLangPreference', val);
  };

  const toggleSound = () => {
      const newVal = !soundEnabled;
      setSoundEnabled(newVal);
      localStorage.setItem('halalScannerSound', newVal.toString());
  };

  const toggleHaptics = () => {
      const newVal = !hapticsEnabled;
      setHapticsEnabled(newVal);
      localStorage.setItem('halalScannerHaptics', newVal.toString());
  };

  const toggleDietaryPreference = (pref: string) => {
      setDietaryPreferences(prev => {
          const newPrefs = prev.includes(pref) ? prev.filter(p => p !== pref) : [...prev, pref];
          localStorage.setItem('dietaryPreferences', JSON.stringify(newPrefs));
          return newPrefs;
      });
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
      <div className="bg-[#1e1e1e] rounded-t-3xl sm:rounded-3xl w-full max-w-md h-[85vh] sm:h-auto sm:max-h-[85vh] flex flex-col shadow-2xl border border-white/10 animate-slide-up relative">
        
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5 rounded-t-3xl">
          <style>{`
            .scrollbar-hide::-webkit-scrollbar { display: none; }
            .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
          `}</style>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
             <div className="p-2 bg-emerald-500/20 rounded-full text-emerald-400">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                   <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
             </div>
             {t.settingsTitle}
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-grow p-5 space-y-6 custom-scrollbar">
          
          {/* Profile Section */}
          <div>
             <h3 className="text-xs font-bold text-gray-500 mb-3 px-2 uppercase tracking-widest">{t.profile}</h3>
             <div className="bg-black/20 rounded-2xl overflow-hidden border border-white/5 p-4 flex justify-between items-center">
                 <div className="flex items-center gap-3">
                     <div className={`w-10 h-10 rounded-full flex items-center justify-center border ${user ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-gray-700/50 text-gray-400 border-white/5'}`}>
                         <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                         </svg>
                     </div>
                     <div className="max-w-[150px] sm:max-w-[200px]">
                         <p className="font-bold text-white text-sm truncate">
                            {user ? (user.email || t.guest) : t.guest}
                         </p>
                         <p className="text-xs text-gray-400 truncate">
                            {user ? (user.role === 'authenticated' ? t.registeredUser : 'ID: ' + user.id.slice(0,8)) : t.guest}
                         </p>
                     </div>
                 </div>
                 
                 {user && user.role === 'authenticated' ? (
                     <button 
                        onClick={handleSignOut}
                        disabled={isSigningOut}
                        className="text-xs font-bold bg-white/5 text-gray-400 px-3 py-2 rounded-xl hover:bg-white/10 hover:text-white transition border border-white/5 flex items-center justify-center min-w-[80px]"
                     >
                        {isSigningOut ? (
                           <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : (
                           t.signOut
                        )}
                     </button>
                 ) : (
                     <button 
                        onClick={() => { 
                           onOpenAuth(); 
                        }}
                        className="text-xs font-bold bg-emerald-600 text-white px-4 py-2 rounded-xl hover:bg-emerald-500 transition shadow-lg shadow-emerald-900/20"
                     >
                        {t.signIn}
                     </button>
                 )}
             </div>
          </div>

          {/* General Section */}
          <div>
            <h3 className="text-xs font-bold text-gray-500 mb-3 px-2 uppercase tracking-widest">{t.generalSettings}</h3>
            <div className="bg-black/20 rounded-2xl overflow-hidden border border-white/5">
                {/* Language */}
                <div className="flex flex-col p-4 border-b border-white/5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/10">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                   <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 21l5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 016-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 01-3.827-5.802" />
                                </svg>
                            </div>
                            <span className="font-medium text-white">{t.language}</span>
                        </div>
                        <button 
                          onClick={() => setShowLanguageSelector(true)}
                          className="flex items-center gap-2 bg-white/5 hover:bg-white/10 px-4 py-2 rounded-xl transition border border-white/5"
                        >
                            <span className="text-lg">{currentLang?.flag}</span>
                            <span className="text-sm font-medium text-gray-300">{currentLang?.label}</span>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={`w-4 h-4 text-gray-500 ${language === 'ar' ? 'rotate-180' : ''}`}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Ingredient Language (NEW) */}
                <div className="flex flex-col p-4 border-b border-white/5">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-9 h-9 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/10">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                               <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                            </svg>
                        </div>
                        <div>
                           <p className="font-medium text-white text-sm">{t.ingredientLangTitle}</p>
                           <p className="text-xs text-gray-400">{t.ingredientLangDesc}</p>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 mt-1">
                        <button 
                          onClick={() => changeIngredientLang('app')}
                          className={`px-3 py-2 text-xs font-bold rounded-xl border transition ${ingredientLang === 'app' ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300' : 'bg-black/40 border-white/5 text-gray-500 hover:bg-white/5'}`}
                        >
                          {t.ingredientLangApp}
                        </button>
                        <button 
                          onClick={() => changeIngredientLang('original')}
                          className={`px-3 py-2 text-xs font-bold rounded-xl border transition ${ingredientLang === 'original' ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300' : 'bg-black/40 border-white/5 text-gray-500 hover:bg-white/5'}`}
                        >
                          {t.ingredientLangOriginal}
                        </button>
                    </div>
                </div>

                {/* Notifications */}
                <div className="flex items-center justify-between p-4 border-b border-white/5">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/10">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                               <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                            </svg>
                        </div>
                        <div>
                           <p className="font-medium text-white text-sm">{t.notifications || "Notifications"}</p>
                           <p className="text-xs text-gray-400">{t.notificationsDesc || "Receive alerts."}</p>
                        </div>
                    </div>
                    <button 
                      onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                      className={`w-11 h-6 rounded-full transition-colors flex items-center px-0.5 ${notificationsEnabled ? 'bg-emerald-600' : 'bg-white/10'}`}
                    >
                        <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${notificationsEnabled ? 'translate-x-5 rtl:-translate-x-5' : 'translate-x-0'}`}></div>
                    </button>
                </div>

                {/* Sound */}
                <div className="flex items-center justify-between p-4 border-b border-white/5">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-pink-500/20 text-pink-400 flex items-center justify-center border border-pink-500/10">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                            </svg>
                        </div>
                        <div>
                           <p className="font-medium text-white text-sm">{t.sound || "Sound"}</p>
                           <p className="text-xs text-gray-400">{t.soundDesc || "Play sounds on scan result."}</p>
                        </div>
                    </div>
                    <button 
                      onClick={toggleSound}
                      className={`w-11 h-6 rounded-full transition-colors flex items-center px-0.5 ${soundEnabled ? 'bg-emerald-600' : 'bg-white/10'}`}
                    >
                        <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${soundEnabled ? 'translate-x-5 rtl:-translate-x-5' : 'translate-x-0'}`}></div>
                    </button>
                </div>

                {/* Haptics */}
                <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/10">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
                            </svg>
                        </div>
                        <div>
                           <p className="font-medium text-white text-sm">{t.haptics || "Vibration"}</p>
                           <p className="text-xs text-gray-400">{t.hapticsDesc || "Vibrate on interactions."}</p>
                        </div>
                    </div>
                    <button 
                      onClick={toggleHaptics}
                      className={`w-11 h-6 rounded-full transition-colors flex items-center px-0.5 ${hapticsEnabled ? 'bg-emerald-600' : 'bg-white/10'}`}
                    >
                        <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${hapticsEnabled ? 'translate-x-5 rtl:-translate-x-5' : 'translate-x-0'}`}></div>
                    </button>
                </div>
            </div>
          </div>

          {/* Dietary Preferences Section */}
          <div>
            <h3 className="text-xs font-bold text-gray-500 mb-3 px-2 uppercase tracking-widest">{t.dietaryPreferences}</h3>
            <div className="bg-black/20 rounded-2xl overflow-hidden border border-white/5">
                <button 
                  onClick={() => setShowDietarySelector(true)}
                  className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/10">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <div className="text-left rtl:text-right">
                           <p className="font-medium text-white text-sm">{t.dietaryPreferences}</p>
                           <p className="text-xs text-gray-400">
                               {dietaryPreferences.length > 0 
                                   ? `${dietaryPreferences.length} selected` 
                                   : t.dietaryPreferencesDesc}
                           </p>
                        </div>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-gray-500 rtl:rotate-180">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                </button>
            </div>
          </div>

          {/* Subscription Section */}
          <div>
            <h3 className="text-xs font-bold text-gray-500 mb-3 px-2 uppercase tracking-widest">{t.subscription}</h3>
            <div className="bg-black/20 rounded-2xl overflow-hidden border border-white/5 p-4 flex justify-between items-center">
               <div className="flex items-center gap-3">
                   <div className={`w-9 h-9 rounded-full flex items-center justify-center border ${isPremium ? 'bg-amber-500/20 text-amber-400 border-amber-500/10' : 'bg-gray-700/50 text-gray-400 border-white/5'}`}>
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                      </svg>
                   </div>
                   <div>
                      <p className="font-bold text-white text-sm">
                        {isPremium ? t.proBadge : t.freeScansLeft}
                      </p>
                      <p className="text-xs text-gray-400">
                        {isPremium ? t.lifetimePlan : t.subDesc}
                      </p>
                   </div>
               </div>
               <button 
                 onClick={onManageSubscription}
                 className="text-xs font-bold bg-white/10 text-white px-4 py-2 rounded-xl hover:bg-white/20 transition border border-white/5"
               >
                 {isPremium ? t.manageSubscription : t.subscribeNow}
               </button>
            </div>
          </div>

          {/* Storage Section */}
          <div>
            <h3 className="text-xs font-bold text-gray-500 mb-3 px-2 uppercase tracking-widest">{t.storage}</h3>
            <div className="bg-black/20 rounded-2xl overflow-hidden border border-white/5 p-4 flex justify-between items-center">
               <div className="flex items-center gap-3">
                   <div className="w-9 h-9 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center border border-red-500/10">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                   </div>
                   <div>
                      <p className="font-bold text-red-400 text-sm">{t.clearHistory}</p>
                      <p className="text-xs text-gray-400">{t.clearHistoryDesc}</p>
                   </div>
               </div>
               <button 
                 onClick={handleClearHistory}
                 className="text-xs font-bold text-red-400 bg-red-500/10 px-4 py-2 rounded-xl hover:bg-red-500/20 transition border border-red-500/20"
               >
                 {t.clearHistory}
               </button>
            </div>
          </div>

          {/* ABOUT & LEGAL */}
          <div>
            <h3 className="text-xs font-bold text-gray-500 mb-3 px-2 uppercase tracking-widest">{t.appVersion} & Legal</h3>
            <div className="bg-black/20 rounded-2xl overflow-hidden border border-white/5 divide-y divide-white/5">
                <button onClick={onOpenPrivacy} className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition">
                    <span className="text-sm font-medium text-white">{t.privacyPolicy}</span>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-4 h-4 text-gray-500 ${language === 'ar' ? 'rotate-180' : ''}`}>
                       <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                </button>
                <button onClick={onOpenTerms} className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition">
                    <span className="text-sm font-medium text-white">{t.termsOfUse}</span>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-4 h-4 text-gray-500 ${language === 'ar' ? 'rotate-180' : ''}`}>
                       <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                </button>
                <div className="p-4 flex items-center justify-between">
                   <span className="text-sm font-medium text-white">{t.appVersion}</span>
                   <span className="text-xs text-gray-400 font-mono">{packageJson.version}</span>
                </div>
            </div>
          </div>

          {/* DANGER ZONE - DELETE ACCOUNT (Google Play Requirement) */}
          {user && user.role === 'authenticated' && (
             <div>
                <h3 className="text-xs font-bold text-red-600 mb-3 px-2 uppercase tracking-widest">{t.dangerZone}</h3>
                <div className="bg-red-950/20 rounded-2xl overflow-hidden border border-red-900/30 p-4 flex justify-between items-center">
                   <div className="flex items-center gap-3">
                       <div className="w-9 h-9 rounded-full bg-red-600/20 text-red-500 flex items-center justify-center border border-red-600/10">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                             <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.008v.008H12v-.008z" />
                          </svg>
                       </div>
                       <div>
                          <p className="font-bold text-red-400 text-sm">{t.deleteAccount}</p>
                          <p className="text-xs text-gray-500">{t.deleteAccountDesc}</p>
                       </div>
                   </div>
                   <button 
                     onClick={handleDeleteAccount}
                     disabled={isSigningOut}
                     className="text-xs font-bold text-white bg-red-600 px-4 py-2 rounded-xl hover:bg-red-700 transition shadow-lg shadow-red-900/30"
                   >
                     {t.deleteAccount}
                   </button>
                </div>
             </div>
          )}

          {/* EXIT APP BUTTON */}
          <div className="pt-2 pb-4">
             <button 
               onClick={handleExitApp}
               className="w-full text-xs font-bold text-gray-500 hover:text-white bg-white/5 hover:bg-white/10 p-3 rounded-xl transition flex items-center justify-center gap-2 group"
             >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.636 5.636a9 9 0 1012.728 0M12 3v9" />
                </svg>
                {t.exitApp}
             </button>
          </div>

        </div>

        {/* Language Selector Overlay */}
        {showLanguageSelector && (
            <div className="absolute inset-0 z-50 bg-[#1e1e1e] rounded-t-3xl sm:rounded-3xl flex flex-col animate-fade-in">
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5 rounded-t-3xl">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <button onClick={() => setShowLanguageSelector(false)} className="mr-2 text-gray-400 hover:text-white">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={`w-6 h-6 ${language === 'ar' ? 'rotate-180' : ''}`}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                            </svg>
                        </button>
                        {t.language}
                    </h2>
                </div>
                <div className="overflow-y-auto p-4 custom-scrollbar flex-grow">
                    <div className="grid grid-cols-1 gap-2 pb-safe">
                        {LANGUAGES.map((lang) => (
                            <button 
                              key={lang.code}
                              onClick={() => { setLanguage(lang.code as any); setShowLanguageSelector(false); }}
                              className={`w-full px-4 py-4 rounded-xl border transition flex items-center justify-between ${language === lang.code ? 'bg-blue-600/20 border-blue-500/50 text-blue-300' : 'bg-black/20 border-white/5 text-gray-400 hover:bg-white/5'}`}
                            >
                              <div className="flex items-center gap-3">
                                  <span className="text-2xl">{lang.flag}</span>
                                  <span className="font-bold">{lang.label}</span>
                              </div>
                              {language === lang.code && (
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-blue-400">
                                      <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
                                  </svg>
                              )}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        )}

        {/* Dietary Preferences Overlay */}
        {showDietarySelector && (
            <div className="absolute inset-0 z-50 bg-[#1e1e1e] rounded-t-3xl sm:rounded-3xl flex flex-col animate-fade-in">
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5 rounded-t-3xl">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <button onClick={() => setShowDietarySelector(false)} className="mr-2 text-gray-400 hover:text-white">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={`w-6 h-6 ${language === 'ar' ? 'rotate-180' : ''}`}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                            </svg>
                        </button>
                        {t.dietaryPreferences}
                    </h2>
                </div>
                <div className="overflow-y-auto p-4 custom-scrollbar flex-grow">
                    <div className="p-4 mb-4 bg-white/5 rounded-xl border border-white/10">
                        <p className="text-sm text-gray-300">{t.dietaryPreferencesDesc}</p>
                    </div>
                    <div className="bg-black/20 rounded-2xl overflow-hidden border border-white/5">
                        {[
                            { id: 'dietVegan', label: t.dietVegan, icon: '🌱', color: 'text-green-400', bg: 'bg-green-500/20' },
                            { id: 'dietVegetarian', label: t.dietVegetarian, icon: '🥗', color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
                            { id: 'allergyGluten', label: t.allergyGluten, icon: '🌾', color: 'text-amber-400', bg: 'bg-amber-500/20' },
                            { id: 'allergyDairy', label: t.allergyDairy, icon: '🥛', color: 'text-blue-400', bg: 'bg-blue-500/20' },
                            { id: 'allergyNuts', label: t.allergyNuts, icon: '🥜', color: 'text-orange-400', bg: 'bg-orange-500/20' },
                            { id: 'allergyEggs', label: t.allergyEggs, icon: '🥚', color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
                            { id: 'allergySoy', label: t.allergySoy, icon: '🫘', color: 'text-stone-400', bg: 'bg-stone-500/20' },
                        ].map((pref, idx, arr) => (
                            <div key={pref.id} className={`flex items-center justify-between p-4 ${idx !== arr.length - 1 ? 'border-b border-white/5' : ''}`}>
                                <div className="flex items-center gap-3">
                                    <div className={`w-9 h-9 rounded-full ${pref.bg} ${pref.color} flex items-center justify-center border border-white/5 text-lg`}>
                                        {pref.icon}
                                    </div>
                                    <div>
                                       <p className="font-medium text-white text-sm">{pref.label}</p>
                                    </div>
                                </div>
                                <button 
                                  onClick={() => toggleDietaryPreference(pref.id)}
                                  className={`w-11 h-6 rounded-full transition-colors flex items-center px-0.5 ${dietaryPreferences.includes(pref.id) ? 'bg-emerald-600' : 'bg-white/10'}`}
                                >
                                    <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${dietaryPreferences.includes(pref.id) ? 'translate-x-5 rtl:-translate-x-5' : 'translate-x-0'}`}></div>
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default SettingsModal;
