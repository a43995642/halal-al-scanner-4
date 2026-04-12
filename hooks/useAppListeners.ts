import { useEffect } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { auth } from '../lib/firebase';
import { isSignInWithEmailLink, signInWithEmailLink } from 'firebase/auth';

interface UseAppListenersProps {
  stateRef: React.MutableRefObject<any>;
  setShowSubscriptionModal: (val: boolean) => void;
  setShowSettings: (val: boolean) => void;
  setShowHistory: (val: boolean) => void;
  setShowAuthModal: (val: boolean) => void;
  setShowPrivacy: (val: boolean) => void;
  setShowTerms: (val: boolean) => void;
  setShowCorrectionModal: (val: boolean) => void;
  setShowBarcodeModal: (val: boolean) => void;
  setShowTextModal: (val: boolean) => void;
  setShowPreviewModal: (val: boolean) => void;
  setShowENumbersModal?: (val: boolean) => void;
  setShowQueueModal?: (val: boolean) => void;
  setResult: (val: any) => void;
  setAnalyzedTextContent: (val: any) => void;
  setError: (val: any) => void;
  setIsLoading: (val: boolean) => void;
  setImages: (val: any) => void;
  setShowAuthSuccess: (val: boolean) => void;
}

export const useAppListeners = ({
  stateRef,
  setShowSubscriptionModal,
  setShowSettings,
  setShowHistory,
  setShowAuthModal,
  setShowPrivacy,
  setShowTerms,
  setShowCorrectionModal,
  setShowBarcodeModal,
  setShowTextModal,
  setShowPreviewModal,
  setShowENumbersModal,
  setShowQueueModal,
  setResult,
  setAnalyzedTextContent,
  setError,
  setIsLoading,
  setImages,
  setShowAuthSuccess
}: UseAppListenersProps) => {
  useEffect(() => {
    let backButtonListener: any;
    let urlListener: any;

    const setupListeners = async () => {
      backButtonListener = await CapacitorApp.addListener('backButton', () => {
        const s = stateRef.current;
        if (s.showOnboarding) { CapacitorApp.exitApp(); return; }
        if (s.showSubscriptionModal) { setShowSubscriptionModal(false); return; }
        if (s.showSettings) { setShowSettings(false); return; }
        if (s.showHistory) { setShowHistory(false); return; }
        if (s.showAuthModal) { setShowAuthModal(false); return; }
        if (s.showPrivacy) { setShowPrivacy(false); return; }
        if (s.showTerms) { setShowTerms(false); return; }
        if (s.showCorrectionModal) { setShowCorrectionModal(false); return; }
        if (s.showBarcodeModal) { setShowBarcodeModal(false); return; }
        if (s.showTextModal) { setShowTextModal(false); return; }
        if (s.showPreviewModal) { setShowPreviewModal(false); return; }
        if (s.showQueueModal && setShowQueueModal) { setShowQueueModal(false); return; }
        if (s.showENumbersModal && setShowENumbersModal) { setShowENumbersModal(false); return; }
        if (s.result && !s.isLoading) {
          setResult(null); setAnalyzedTextContent(null); setError(null); setIsLoading(false); setImages([]); return;
        }
        if (s.images.length > 0 && !s.isLoading) { setImages([]); return; }
        CapacitorApp.exitApp();
      });

      // Handle Deep Link from OAuth (for fallback flow in Chrome Custom Tabs)
      urlListener = await CapacitorApp.addListener('appUrlOpen', async ({ url }) => {
         try {
             if (isSignInWithEmailLink(auth, url)) {
                 let email = window.localStorage.getItem('emailForSignIn');
                 if (!email) {
                     email = window.prompt('Please provide your email for confirmation');
                 }
                 if (email) {
                     await signInWithEmailLink(auth, email, url);
                     window.localStorage.removeItem('emailForSignIn');
                     setShowAuthModal(false);
                     setShowAuthSuccess(true);
                     setTimeout(() => setShowAuthSuccess(false), 4000);
                 }
             }
         } catch (e) {
             console.error("Deep Link Auth Error:", e);
         }
      });
    };

    setupListeners();
    return () => { 
        if (backButtonListener) backButtonListener.remove(); 
        if (urlListener) urlListener.remove();
    };
  }, [
    stateRef,
    setShowSettings,
    setShowHistory,
    setShowPreviewModal,
    setShowTextModal,
    setShowBarcodeModal,
    setShowCorrectionModal,
    setShowAuthModal,
    setShowSubscriptionModal,
    setShowPrivacy,
    setShowTerms,
    setResult,
    setError,
    setImages,
    setAnalyzedTextContent,
    setIsLoading,
    setShowAuthSuccess,
    setShowENumbersModal,
    setShowQueueModal
  ]);
};
