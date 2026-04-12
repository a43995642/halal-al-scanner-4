import { useState, useEffect } from 'react';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
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
    try {
        const docRef = doc(db, 'user_stats', uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            setScanCount(docSnap.data().scan_count || 0);
        }
    } catch (e) {
        console.error("Error fetching user stats:", e);
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
    
    const unsubscribe = onAuthStateChanged(auth, (user) => {
        if (!mounted) return;
        if (user) {
            setUserId(user.uid);
            fetchUserStats(user.uid).catch(console.error);
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
        unsubscribe();
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
