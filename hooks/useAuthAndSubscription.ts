import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { PurchaseService } from '../services/purchaseService';

const WEB_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "565514314234-9ae9k1bf0hhubkacivkuvpu01duqfthv.apps.googleusercontent.com";

export const useAuthAndSubscription = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  
  // Initialize Scan Count (Guests: LocalStorage, Users: DB via Effect)
  const [scanCount, setScanCount] = useState(() => {
      const saved = localStorage.getItem('guestScanCount');
      return saved ? parseInt(saved, 10) : 0;
  });

  const fetchUserStats = async (uid: string) => { 
    // We check RevenueCat status on login too
    PurchaseService.logIn(uid);
    // Keep local DB check for scan counts if needed
    const { data } = await supabase.from('user_stats').select('scan_count').eq('id', uid).single(); 
    if (data) { 
        setScanCount(data.scan_count); 
    } 
  };

  useEffect(() => {
    try { 
      GoogleAuth.initialize({ 
        clientId: WEB_CLIENT_ID, 
        scopes: ['profile', 'email'], 
        grantOfflineAccess: false 
      }); 
    } catch (e) {
      console.warn("GoogleAuth init failed", e);
    }
    
    let mounted = true;
    const initAuth = async () => {
        try {
            const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Auth Timeout")), 5000));
            const authPromise = supabase.auth.getSession();
            const { data } = await Promise.race([authPromise, timeout]) as any;

            if (mounted && data?.session?.user) {
                setUserId(data.session.user.id);
                fetchUserStats(data.session.user.id).catch(console.error);
            }
        } catch (e) {
            console.warn("Auth initialization skipped:", e);
        } finally {
            if (mounted) setIsAuthLoading(false);
        }
    };
    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
        if (!mounted) return;
        if (session?.user) {
            setUserId(session.user.id);
            fetchUserStats(session.user.id).catch(console.error);
        } else {
            setUserId(null);
            // Revert to local guest count
            const saved = localStorage.getItem('guestScanCount');
            setScanCount(saved ? parseInt(saved, 10) : 0);
            
            PurchaseService.logOut(); // RevenueCat Logout
        }
        setIsAuthLoading(false);
    });

    return () => {
        mounted = false;
        subscription.unsubscribe();
    };
  }, []);

  // Persist Guest Scan Count locally (ABSOLUTE COUNT)
  useEffect(() => {
      if (!userId) {
          localStorage.setItem('guestScanCount', scanCount.toString());
      }
  }, [scanCount, userId]);

  return {
    userId,
    isAuthLoading,
    scanCount,
    setScanCount,
    fetchUserStats
  };
};
