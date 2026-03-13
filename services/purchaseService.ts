
import { Purchases, PurchasesOfferings, LOG_LEVEL, CustomerInfo } from '@revenuecat/purchases-capacitor';
import { Capacitor } from '@capacitor/core';
import { secureStorage } from '../utils/secureStorage';

// --- إعدادات وضع الاختبار ---
// اجعل هذا true لتجربة التطبيق كاملاً بدون حساب مطور جوجل
// Make this FALSE when you release to the store
const USE_MOCK_STORE = true; 

const ENTITLEMENT_ID = 'pro_access';
const REVENUECAT_API_KEY = import.meta.env.VITE_REVENUECAT_PUBLIC_KEY;

// بيانات وهمية للعرض عند عدم وجود اتصال بالمتجر
const MOCK_OFFERINGS = {
    current: {
        monthly: {
            product: { priceString: "$3.99", title: "Monthly Subscription", identifier: "halal_monthly_399" },
            identifier: "$rc_monthly"
        },
        annual: {
            product: { priceString: "$19.99", title: "Annual Subscription", identifier: "halal_annual_1999" },
            identifier: "$rc_annual"
        }
    }
};

export const PurchaseService = {
  
  async initialize() {
    if (!Capacitor.isNativePlatform()) {
        console.warn("Web Mode: RevenueCat Disabled.");
        return;
    }

    if (USE_MOCK_STORE) {
        console.log("⚠️ RUNNING IN MOCK STORE MODE - NO REAL PAYMENTS ⚠️");
        await this.checkSubscriptionStatus();
        return;
    }

    if (!REVENUECAT_API_KEY || REVENUECAT_API_KEY.includes('PLACEHOLDER')) {
        console.error("RevenueCat Key Missing.");
        return;
    }

    try {
      if (Capacitor.getPlatform() === 'android') {
        await Purchases.configure({ apiKey: REVENUECAT_API_KEY });
      }
      await Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG });
      Purchases.addCustomerInfoUpdateListener((info: CustomerInfo) => {
          this.updateLocalStatus(info);
      });
      await this.checkSubscriptionStatus();
    } catch (error) {
      console.error("RevenueCat Init Error:", error);
    }
  },

  async presentPaywall(): Promise<boolean> {
    if (USE_MOCK_STORE || !Capacitor.isNativePlatform()) return false;
    try {
        // @ts-ignore
        const paywallResult = await Purchases.presentPaywall({ displayCloseButton: true });
        if (paywallResult === "NOT_PRESENTED") return false;
        return await this.checkSubscriptionStatus();
    } catch (e) {
        console.error("Paywall Error:", e);
        return false;
    }
  },

  async presentCustomerCenter() {
      if (USE_MOCK_STORE) { 
          console.log("Mock Mode: Customer Center requested"); 
          return; 
      }
      if (!Capacitor.isNativePlatform()) return;
      try {
          // @ts-ignore
          if (Purchases.presentCustomerCenter) await Purchases.presentCustomerCenter();
          // @ts-ignore
          else await Purchases.manageSubscriptions(); 
      } catch (e) { console.warn(e); }
  },

  async getOfferings(): Promise<PurchasesOfferings | null> {
     if (USE_MOCK_STORE) {
         return MOCK_OFFERINGS as any;
     }

     if (!Capacitor.isNativePlatform()) return null;
     try {
       const offerings = await Purchases.getOfferings();
       if (offerings.current !== null) return offerings;
       return null;
     } catch (e) {
       console.error("Error fetching offerings", e);
       return MOCK_OFFERINGS as any;
     }
  },

  async purchasePackage(pkg: any): Promise<boolean> {
    if (USE_MOCK_STORE) {
        console.log(`Mock Purchase of ${pkg.identifier} Successful!`);
        // Determine plan based on identifier for mock
        const planType = pkg.identifier.includes('annual') ? 'annual' : 'monthly';
        this.setMockStatus(true, planType);
        return true;
    }

    try {
      const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });
      return this.updateLocalStatus(customerInfo);
    } catch (error: any) {
      if (!error.userCancelled) console.error("Purchase Error:", error);
      throw error;
    }
  },

  async restorePurchases(): Promise<boolean> {
    if (USE_MOCK_STORE) {
        const isPro = secureStorage.getItem('isPremium', false);
        return isPro;
    }
    try {
      const { customerInfo } = await Purchases.restorePurchases();
      return this.updateLocalStatus(customerInfo);
    } catch (error) {
      console.error("Restore Error:", error);
      throw error;
    }
  },

  async checkSubscriptionStatus(): Promise<boolean> {
     if (USE_MOCK_STORE || !Capacitor.isNativePlatform()) {
         return secureStorage.getItem('isPremium', false);
     }
     
     try {
        const { customerInfo } = await Purchases.getCustomerInfo();
        return this.updateLocalStatus(customerInfo);
     } catch (e) {
        console.error("Check Status Error", e);
        return secureStorage.getItem('isPremium', false);
     }
  },
  
  // Helper for Mock Mode
  setMockStatus(isPro: boolean, plan: 'monthly' | 'annual' | 'free') {
      secureStorage.setItem('isPremium', isPro);
      secureStorage.setItem('subscriptionPlan', plan);
      window.dispatchEvent(new CustomEvent('subscription-changed', { 
          detail: { isPremium: isPro, plan: plan } 
      }));
  },

  updateLocalStatus(info: CustomerInfo): boolean {
      const isPro = typeof info.entitlements.active[ENTITLEMENT_ID] !== "undefined";
      
      // Determine Plan Type from active subscriptions
      let plan: 'monthly' | 'annual' | 'free';
      if (isPro) {
          const activeSubs = info.activeSubscriptions || [];
          // Check if any active subscription string contains 'annual' or 'year'
          const isAnnual = activeSubs.some(subId => subId.toLowerCase().includes('annual') || subId.toLowerCase().includes('year'));
          plan = isAnnual ? 'annual' : 'monthly';
      } else {
          plan = 'free';
      }

      secureStorage.setItem('isPremium', isPro);
      secureStorage.setItem('subscriptionPlan', plan);
      
      window.dispatchEvent(new CustomEvent('subscription-changed', { 
          detail: { isPremium: isPro, plan: plan } 
      }));
      return isPro;
  },

  async logIn(userId: string) {
     if (!USE_MOCK_STORE && Capacitor.isNativePlatform()) {
         await Purchases.logIn({ appUserID: userId });
         await this.checkSubscriptionStatus();
     }
  },

  async logOut() {
      if (!USE_MOCK_STORE && Capacitor.isNativePlatform()) {
          await Purchases.logOut();
      }
      this.setMockStatus(false, 'free');
  }
};
