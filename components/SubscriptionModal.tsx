import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { PurchaseService } from '../services/purchaseService';
import { Capacitor } from '@capacitor/core';
import { useAlert } from '../contexts/AlertContext';

interface SubscriptionModalProps {
  onSubscribe: () => void;
  onClose: () => void;
  isLimitReached: boolean;
  onOpenPrivacy: () => void;
  onOpenTerms: () => void;
}

export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({ 
  onSubscribe, 
  onClose, 
  isLimitReached: _isLimitReached,
  onOpenPrivacy,
  onOpenTerms
}) => {
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual'>('annual');
  const [offerings, setOfferings] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isProductsLoaded, setIsProductsLoaded] = useState(false);
  const { t, language: lang } = useLanguage();
  const { showAlert } = useAlert();

  useEffect(() => {
    const loadProducts = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          const offs = await PurchaseService.getOfferings();
          if (offs && offs.current) {
            setOfferings(offs);
            setIsProductsLoaded(true);
          } else {
             console.warn("No offerings found. Ensure Google Play Merchant Account is active.");
          }
        } catch (e) {
          console.error("Failed to load products", e);
        }
      } else {
         // Mock for Web Testing
         setIsProductsLoaded(true);
      }
    };
    loadProducts();
  }, []);

  const handlePurchase = async () => {
    if (!isProductsLoaded && Capacitor.isNativePlatform()) {
        showAlert(t.errorTitle, lang === 'ar' 
          ? "عذراً، المتجر غير متاح حالياً. يرجى المحاولة لاحقاً." 
          : "Store is currently unavailable. Please try again later.", 'error');
        return;
    }

    setIsLoading(true);
    try {
      if (Capacitor.isNativePlatform()) {
        if (!offerings || !offerings.current) {
            showAlert(t.errorTitle, lang === 'ar' ? "لا توجد منتجات متاحة للشراء." : "No products available.", 'error');
            setIsLoading(false);
            return;
        }

        // Determine Package
        const pkg = selectedPlan === 'annual' ? offerings.current.annual : offerings.current.monthly;

        if (pkg) {
           const success = await PurchaseService.purchasePackage(pkg);
           if (success) {
               onSubscribe();
               onClose();
               const alertType = selectedPlan === 'annual' ? 'success-gold' : 'success';
               showAlert(t.activated, lang === 'ar' ? "تم تفعيل النسخة الكاملة بنجاح!" : "Full version activated successfully!", alertType);
           }
        } else {
           showAlert("Error", "Selected package not found in configuration.", 'error');
        }
      } else {
        // Fallback for Web Testing logic
        const fakePkg = { identifier: selectedPlan === 'annual' ? '$rc_annual' : '$rc_monthly' };
        await PurchaseService.purchasePackage(fakePkg as any);
        
        onSubscribe();
        onClose();
        const alertType = selectedPlan === 'annual' ? 'success-gold' : 'success';
        showAlert(t.activated, lang === 'ar' ? "تم تفعيل النسخة التجريبية (محاكاة)" : "Simulation: Purchase Successful", alertType);
      }
    } catch (e: any) {
      if (!e.userCancelled) {
         console.error(e);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async () => {
    setIsLoading(true);
    try {
      const restored = await PurchaseService.restorePurchases();
      if (restored) {
        onSubscribe();
        onClose();
        // Since we don't know the exact plan type easily from restore without deeper check, we use generic success or check storage
        // But 'success' is safe here.
        showAlert(t.activated, lang === 'ar' ? "تم استعادة مشترياتك بنجاح!" : "Purchases restored successfully!", 'success');
      } else {
        showAlert(t.errorTitle, lang === 'ar' ? "لم يتم العثور على اشتراكات سابقة." : "No active subscription found.", 'warning');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  // Dynamic Prices (or fallback to static text)
  const monthlyPrice = offerings?.current?.monthly?.product?.priceString || t.monthlyPrice;
  const annualPrice = offerings?.current?.annual?.product?.priceString || t.annualPrice;

  return (
    <div className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-md flex items-center justify-center p-0 sm:p-4 animate-fade-in">
      <div className="bg-[#1e1e1e] rounded-t-3xl sm:rounded-3xl max-w-md w-full overflow-hidden shadow-2xl animate-slide-up relative flex flex-col h-full sm:h-auto max-h-[100vh] sm:max-h-[90vh] border border-white/10">
        
        {/* Hero Header - Dynamic Background based on Plan */}
        <div className={`p-8 pb-10 text-center relative overflow-hidden shrink-0 transition-colors duration-500 ${
            selectedPlan === 'annual' 
            ? 'bg-gradient-to-b from-amber-600 to-amber-800' 
            : 'bg-gradient-to-b from-emerald-600 to-emerald-800'
        }`}>
           <button 
             onClick={onClose}
             className={`absolute top-6 ${lang === 'ar' ? 'right-6' : 'left-6'} p-2 bg-black/20 hover:bg-black/40 text-white rounded-full transition z-20 backdrop-blur-md`}
           >
             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
               <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
             </svg>
           </button>

           <div className="relative z-10 flex flex-col items-center">
             <div className="w-20 h-20 bg-white/10 rounded-3xl flex items-center justify-center mb-4 backdrop-blur-md border border-white/20 shadow-xl">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner transition-colors duration-500 ${
                    selectedPlan === 'annual'
                    ? 'bg-gradient-to-br from-amber-300 to-amber-500'
                    : 'bg-gradient-to-br from-emerald-400 to-emerald-600'
                }`}>
                  {/* REPLACED ICON WITH TEXT */}
                  <span className="font-black text-lg tracking-wider drop-shadow-md text-white">
                    Halal
                  </span>
                </div>
             </div>
             <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">
               {t.subTitlePro}
             </h2>
             <p className={`text-sm font-medium opacity-90 max-w-xs mx-auto transition-colors duration-500 ${
                 selectedPlan === 'annual' ? 'text-amber-100' : 'text-emerald-100'
             }`}>
               {t.subDesc}
             </p>
           </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-grow bg-[#1e1e1e] custom-scrollbar">
          <div className="p-6 space-y-6">
            
            {/* Features */}
            <div className="space-y-3">
              {/* Feature 1: Speed/Accuracy (Now uses Star/Sparkle Icon) */}
              <div className="flex items-center gap-4 bg-black/20 p-4 rounded-2xl border border-white/5">
                <div className="w-10 h-10 rounded-full bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20 shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 00-1.423 1.423z" />
                  </svg>
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">{t.featureSpeed}</h4>
                  <p className="text-xs text-gray-400">{t.featureSpeedDesc}</p>
                </div>
              </div>
              
              {/* Feature 2: Unlimited (Unchanged) */}
              <div className="flex items-center gap-4 bg-black/20 p-4 rounded-2xl border border-white/5">
                 <div className="w-10 h-10 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20 shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">{t.featureUnlimited}</h4>
                  <p className="text-xs text-gray-400">{t.featureUnlimitedDesc}</p>
                </div>
              </div>

              {/* Feature 3: Experience (Now uses Lightning Icon) */}
              <div className="flex items-center gap-4 bg-black/20 p-4 rounded-2xl border border-white/5">
                 <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20 shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                  </svg>
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">{t.featureExperience}</h4>
                  <p className="text-xs text-gray-400">{t.featureExperienceDesc}</p>
                </div>
              </div>
            </div>

            {/* Plans */}
            <div>
              <h3 className="font-bold text-white text-sm mb-3 px-1">{t.choosePlan}</h3>
              {!isProductsLoaded && Capacitor.isNativePlatform() ? (
                  <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-center">
                      <p className="text-yellow-400 text-xs font-bold">
                          {lang === 'ar' ? "جاري الاتصال بالمتجر... يرجى الانتظار" : "Connecting to store..."}
                      </p>
                  </div>
              ) : (
                <div className="space-y-3">
                    
                    {/* Annual - GOLD / AMBER THEME */}
                    <div 
                    onClick={() => setSelectedPlan('annual')}
                    className={`relative p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${selectedPlan === 'annual' ? 'border-amber-400 bg-amber-500/10 ring-1 ring-amber-400/50 shadow-lg shadow-amber-500/10' : 'border-white/10 bg-black/20 hover:bg-black/30'}`}
                    >
                      {/* Best Value Badge */}
                      <div className={`absolute -top-3 ${lang === 'ar' ? 'left-4' : 'right-4'} bg-amber-400 text-black text-[10px] font-extrabold px-3 py-1 rounded-full shadow-lg`}>
                         {t.bestValue}
                      </div>

                      <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedPlan === 'annual' ? 'border-amber-400 bg-amber-400' : 'border-gray-500'}`}>
                              {selectedPlan === 'annual' && <div className="w-2 h-2 bg-black rounded-full"></div>}
                          </div>
                          <div>
                            <span className={`font-bold block text-sm ${selectedPlan === 'annual' ? 'text-amber-100' : 'text-white'}`}>{t.annualPlan}</span>
                            <span className={`text-xs font-bold ${selectedPlan === 'annual' ? 'text-amber-400' : 'text-emerald-400'}`}>{t.savePercent}</span>
                          </div>
                      </div>
                      <div className="text-end">
                          <span className={`font-bold text-lg ${selectedPlan === 'annual' ? 'text-amber-400' : 'text-emerald-400'}`}>{annualPrice}</span>
                          <span className="text-[10px] text-gray-500 block">/ {t.year}</span>
                      </div>
                    </div>

                    {/* Monthly - STANDARD EMERALD */}
                    <div 
                    onClick={() => setSelectedPlan('monthly')}
                    className={`relative p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${selectedPlan === 'monthly' ? 'border-emerald-500 bg-emerald-500/10' : 'border-white/10 bg-black/20 hover:bg-black/30'}`}
                    >
                    <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedPlan === 'monthly' ? 'border-emerald-500 bg-emerald-500' : 'border-gray-500'}`}>
                            {selectedPlan === 'monthly' && <div className="w-2 h-2 bg-white rounded-full"></div>}
                        </div>
                        <div>
                        <span className="font-bold text-white block text-sm">{t.monthlyPlan}</span>
                        <span className="text-xs text-gray-400">{t.monthlyDesc}</span>
                        </div>
                    </div>
                    <div className="text-end">
                        <span className="font-bold text-white text-lg">{monthlyPrice}</span>
                        <span className="text-[10px] text-gray-500 block">/ {t.month}</span>
                    </div>
                    </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Button */}
        <div className="p-6 bg-[#1e1e1e] border-t border-white/5 shrink-0 z-20 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
           <button 
              onClick={handlePurchase}
              disabled={isLoading || (!isProductsLoaded && Capacitor.isNativePlatform())}
              className={`w-full py-4 font-bold text-lg rounded-xl shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-white ${
                  selectedPlan === 'annual' 
                  ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-amber-900/20' 
                  : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/20'
              } ${isLoading || (!isProductsLoaded && Capacitor.isNativePlatform()) ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isLoading ? (
                  <div className={`w-6 h-6 border-2 border-white/30 ${selectedPlan === 'annual' ? 'border-t-black' : 'border-t-white'} rounded-full animate-spin`}></div>
              ) : (
                <>
                  <span>{t.subscribeNow}</span>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={`w-5 h-5 ${lang === 'ar' ? 'rotate-180' : ''}`}>
                     <path fillRule="evenodd" d="M12.97 3.97a.75.75 0 011.06 0l7.5 7.5a.75.75 0 010 1.06l-7.5 7.5a.75.75 0 11-1.06-1.06l6.22-6.22H3a.75.75 0 010-1.5h16.19l-6.22-6.22a.75.75 0 010-1.06z" clipRule="evenodd" />
                  </svg>
                </>
              )}
            </button>
            
            <div className="flex justify-center items-center mt-4 text-[10px] text-gray-500 gap-4 font-medium">
              <button onClick={handleRestore} disabled={isLoading} className="hover:text-gray-300 transition">{t.restorePurchases}</button>
              <span className="w-px h-3 bg-white/10"></span>
              <button onClick={onOpenTerms} className="hover:text-gray-300 transition">{t.termsOfUse}</button>
              <span className="w-px h-3 bg-white/10"></span>
              <button onClick={onOpenPrivacy} className="hover:text-gray-300 transition">{t.privacyPolicy}</button>
            </div>
        </div>
      </div>
    </div>
  );
};