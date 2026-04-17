import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, doc, deleteDoc, setDoc, serverTimestamp, getDoc, getCountFromServer, where } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut, createUserWithEmailAndPassword as createUserAuth, getAuth } from 'firebase/auth';
import { initializeApp, getApp, getApps } from 'firebase/app';
import firebaseConfig from '../firebase-applet-config.json';
import { useLanguage } from '../contexts/LanguageContext';
import { useAlert } from '../contexts/AlertContext';

interface Report {
  id: string;
  original_text: string;
  reported_ingredient?: string;
  reported_ingredients?: string[];
  ingredient_corrections?: Record<string, string>;
  ai_result: any;
  user_correction: string;
  user_notes?: string;
  created_at: any;
}

interface AdminPanelProps {
  onClose: () => void;
}

const defaultRules = `   - HALAL: Known permissible sources like Sugar, Tomatoes, Honey, Vegetables, Fruits, Grains, Natural Spices. ALL types of fish and marine animals (e.g., Anchovy, Tuna, Salmon, Sardine) are HALAL and do not require slaughtering.
   - DOUBTFUL: Ingredients with unspecified sources like Natural Flavor, Flavoring, Enzymes, Emulsifiers, Extracts (unspecified), Gelatin (unspecified), E471, Whey/Rennet (unspecified), Glycerin (unspecified). If an ingredient is a mixture of known HALAL and unspecified sources, classify it as DOUBTFUL, NOT HARAM.
   - HARAM: Clearly prohibited ingredients like Pork, Lard, Bacon, Alcohol/Ethanol, Wine, Beer, Rum, Gelatin (from pork), Carmine/E120, Shellac, L-Cysteine (human/hair).
   - IMPORTANT: Marine animals and fish like Anchovy are HALAL and do NOT require slaughtering. Never classify them as HARAM or DOUBTFUL based on slaughtering.
   - IMPORTANT: Do NOT classify any product as HARAM unless there is a clear, explicit HARAM ingredient.
   - IMPORTANT - MEAT & POULTRY: Any meat or poultry ingredient (e.g., Beef, Chicken, Lamb, Meat Extract, Chicken Broth, Animal Fat) MUST be classified as DOUBTFUL unless the packaging explicitly states it is "Halal Certified" or "Zabiha". Do not assume meat is Halal or Haram without explicit certification or source information.
   - RULE TAGGING: You MUST assign a specific "rule_id" to EVERY ingredient based on why it received its status. Choose from: "RULE_HALAL_NATURAL", "RULE_HALAL_MARINE", "RULE_HARAM_PORK", "RULE_HARAM_ALCOHOL", "RULE_HARAM_INSECTS", "RULE_DOUBTFUL_UNSPECIFIED", "RULE_DOUBTFUL_MEAT", "RULE_OTHER".`;

const defaultHaramList = 'alcohol, ethanol, pork, gelatin';
const defaultUnknownList = 'flavor, vanilla extract, glycerin, emulsifier, stabilizer, enzyme';

const AdminPanel: React.FC<AdminPanelProps> = ({ onClose }) => {
  const { t, language } = useLanguage();
  const { showAlert } = useAlert();
  
  // Auth State
  const [loginState, setLoginState] = useState<'checking' | 'login' | 'unauthorized' | 'loggedIn'>('checking');
  const [adminRole, setAdminRole] = useState<'superadmin' | 'reviewer' | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // Dashboard Stats
  const [totalUsers, setTotalUsers] = useState(0);
  const [premiumUsers, setPremiumUsers] = useState(0);

  // Staff Management Form
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffPassword, setNewStaffPassword] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<'superadmin' | 'reviewer'>('reviewer');
  const [creatingStaff, setCreatingStaff] = useState(false);
  const [existingStaff, setExistingStaff] = useState<any[]>([]);

  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminEdits, setAdminEdits] = useState<Record<string, Record<string, string>>>({});
  
  // Tabs & Rules State
  const [activeTab, setActiveTab] = useState<'reports' | 'rules' | 'dashboard' | 'staff'>('reports');
  const [rulesText, setRulesText] = useState(defaultRules);
  const [haramListText, setHaramListText] = useState(defaultHaramList);
  const [unknownListText, setUnknownListText] = useState(defaultUnknownList);
  const [savingRules, setSavingRules] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (user) {
            try {
                const roleDoc = await getDoc(doc(db, 'admin_roles', user.uid));
                if (roleDoc.exists()) {
                    setAdminRole(roleDoc.data().role);
                    setLoginState('loggedIn');
                    if (roleDoc.data().role === 'superadmin') {
                        setActiveTab('dashboard');
                    }
                } else if (user.email === 'a43995642@gmail.com') {
                    // Bootstrap Main Admin
                    await setDoc(doc(db, 'admin_roles', user.uid), { role: 'superadmin' });
                    setAdminRole('superadmin');
                    setLoginState('loggedIn');
                    setActiveTab('dashboard');
                } else {
                    setLoginState('unauthorized');
                }
            } catch(e) {
                setLoginState('unauthorized');
            }
        } else {
            setLoginState('login');
            setAdminRole(null);
        }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (loginState === 'loggedIn') {
        fetchReports();
        fetchRules();
        if (adminRole === 'superadmin') {
            fetchStats();
            fetchStaff();
        }
    }
  }, [loginState, adminRole]);

  const fetchStats = async () => {
      try {
         const usersSnap = await getCountFromServer(collection(db, 'user_stats'));
         setTotalUsers(usersSnap.data().count);
         
         const premiumQuery = query(collection(db, 'user_stats'), where('is_premium', '==', true));
         const premiumSnap = await getCountFromServer(premiumQuery);
         setPremiumUsers(premiumSnap.data().count);
      } catch (e) {
         console.error("Fetch stats error", e);
      }
  };

  const fetchStaff = async () => {
      try {
          const q = query(collection(db, 'admin_roles'));
          const querySnapshot = await getDocs(q);
          const staff: any[] = [];
          querySnapshot.forEach((doc) => {
              staff.push({ id: doc.id, ...doc.data() });
          });
          setExistingStaff(staff);
      } catch (e) {
          console.error("Fetch staff error", e);
      }
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newStaffEmail || !newStaffPassword || newStaffPassword.length < 6) {
          showAlert(language === 'ar' ? 'يرجى إدخال بريد صالح وكلمة مرور (6 أحرف على الأقل).' : 'Please enter a valid email and password (min 6 chars).', 'error');
          return;
      }
      setCreatingStaff(true);
      try {
          const secondaryAppName = 'SecondaryStaffCreator';
          let secondaryApp;
          if (getApps().find(app => app.name === secondaryAppName)) {
              secondaryApp = getApp(secondaryAppName);
          } else {
              secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
          }
          const secondaryAuth = getAuth(secondaryApp);
          
          const userCredential = await createUserAuth(secondaryAuth, newStaffEmail, newStaffPassword);
          const newUid = userCredential.user.uid;
          
          await setDoc(doc(db, 'admin_roles', newUid), {
              role: newStaffRole,
              email: newStaffEmail,
              created_at: serverTimestamp()
          });
          
          await signOut(secondaryAuth);
          
          showAlert(language === 'ar' ? 'تمت إضافة الموظف بنجاح' : 'Staff added successfully', 'success');
          setNewStaffEmail('');
          setNewStaffPassword('');
          fetchStaff();
      } catch (error: any) {
          console.error("Error creating staff:", error);
          showAlert(error.message || 'Error creating staff', 'error');
      } finally {
          setCreatingStaff(false);
      }
  };

  const handleRemoveStaffRole = async (uid: string) => {
      try {
          await deleteDoc(doc(db, 'admin_roles', uid));
          showAlert(language === 'ar' ? 'تمت إزالة صلاحيات الموظف' : 'Staff role removed', 'success');
          fetchStaff();
      } catch (error) {
          console.error("Error removing staff role:", error);
          showAlert('Error removing staff role', 'error');
      }
  };

  const handleLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      setAuthError('');
      try {
          await signInWithEmailAndPassword(auth, email, password);
      } catch(err: any) {
          setAuthError(err.message || 'Login failed');
      }
  };

  const handleLogout = async () => {
      await signOut(auth);
      onClose(); // Close panel since user signed out of the app
  };

  const fetchRules = async () => {
    try {
      const docRef = doc(db, 'app_settings', 'analysis_rules');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.prompt_rules) setRulesText(data.prompt_rules);
        if (data.haram_list) setHaramListText(data.haram_list);
        if (data.unknown_list) setUnknownListText(data.unknown_list);
      }
    } catch (error) {
      console.error("Error fetching rules:", error);
    }
  };

  const saveRules = async () => {
    try {
      setSavingRules(true);
      const docRef = doc(db, 'app_settings', 'analysis_rules');
      await setDoc(docRef, {
        prompt_rules: rulesText,
        haram_list: haramListText,
        unknown_list: unknownListText,
        updated_at: serverTimestamp()
      }, { merge: true });
      showAlert(language === 'ar' ? 'تم حفظ القواعد بنجاح' : 'Rules saved successfully', 'success');
    } catch (error) {
      console.error("Error saving rules:", error);
      showAlert(language === 'ar' ? 'فشل حفظ القواعد' : 'Failed to save rules', 'error');
    } finally {
      setSavingRules(false);
    }
  };

  const fetchReports = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, 'reports'));
      const querySnapshot = await getDocs(q);
      const fetchedReports: Report[] = [];
      querySnapshot.forEach((doc) => {
        fetchedReports.push({ id: doc.id, ...doc.data() } as Report);
      });
      // Sort by newest first
      fetchedReports.sort((a, b) => {
        const timeA = a.created_at?.toMillis ? a.created_at.toMillis() : 0;
        const timeB = b.created_at?.toMillis ? b.created_at.toMillis() : 0;
        return timeB - timeA;
      });

      const initialEdits: Record<string, Record<string, string>> = {};
      fetchedReports.forEach(report => {
          initialEdits[report.id] = {};
          if (report.ai_result?.ingredientsDetected) {
              report.ai_result.ingredientsDetected.forEach((ing: any) => {
                  initialEdits[report.id][ing.name] = ing.status;
              });
          }
          if (report.ingredient_corrections) {
              Object.entries(report.ingredient_corrections).forEach(([name, status]) => {
                  initialEdits[report.id][name] = status;
              });
          }
      });
      setAdminEdits(initialEdits);
      setReports(fetchedReports);
    } catch (error) {
      console.error("Error fetching reports:", error);
      showAlert("Error fetching reports.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (report: Report) => {
    try {
      // 1. Add to ingredient_cache
      const edits = adminEdits[report.id] || {};
      const updates: { name: string, status: string }[] = [];

      if (Object.keys(edits).length > 0) {
          for (const [ingName, status] of Object.entries(edits)) {
              updates.push({ name: ingName, status });
          }
      } else {
          // Fallback for older reports
          if (report.ingredient_corrections && Object.keys(report.ingredient_corrections).length > 0) {
              for (const [ingName, status] of Object.entries(report.ingredient_corrections)) {
                  updates.push({ name: ingName, status });
              }
          } else if (report.reported_ingredients && report.reported_ingredients.length > 0) {
              let newStatus = "HALAL";
              if (report.user_correction === "حرام" || report.user_correction === "Haram" || report.user_correction === "HARAM") newStatus = "HARAM";
              if (report.user_correction === "مشتبه به" || report.user_correction === "Doubtful" || report.user_correction === "DOUBTFUL") newStatus = "DOUBTFUL";
              for (const ingName of report.reported_ingredients) {
                  updates.push({ name: ingName, status: newStatus });
              }
          } else if (report.reported_ingredient) {
              let newStatus = "HALAL";
              if (report.user_correction === "حرام" || report.user_correction === "Haram" || report.user_correction === "HARAM") newStatus = "HARAM";
              if (report.user_correction === "مشتبه به" || report.user_correction === "Doubtful" || report.user_correction === "DOUBTFUL") newStatus = "DOUBTFUL";
              updates.push({ name: report.reported_ingredient, status: newStatus });
          } else if (report.user_correction) {
              let newStatus = "HALAL";
              if (report.user_correction === "حرام" || report.user_correction === "Haram" || report.user_correction === "HARAM") newStatus = "HARAM";
              if (report.user_correction === "مشتبه به" || report.user_correction === "Doubtful" || report.user_correction === "DOUBTFUL") newStatus = "DOUBTFUL";
              updates.push({ name: report.original_text, status: newStatus });
          }
      }

      for (const update of updates) {
          const ingredientName = update.name.trim().toLowerCase();
          const safeId = encodeURIComponent(ingredientName).replace(/\./g, '%2E');
          
          const cacheRef = doc(db, 'ingredient_cache', safeId);
          await setDoc(cacheRef, {
            name: ingredientName,
            status: update.status,
            rule_id: "RULE_USER_CORRECTED",
            result: {
                status: update.status,
                reason: "User corrected via report",
                ingredientsDetected: [{
                    name: ingredientName,
                    status: update.status,
                    rule_id: "RULE_USER_CORRECTED"
                }],
                confidence: 100
            },
            timestamp: serverTimestamp()
          }, { merge: true });
      }

      // 2. Delete the report
      await deleteDoc(doc(db, 'reports', report.id));
      
      setReports(reports.filter(r => r.id !== report.id));
      showAlert(t.reportApproved, "success");
    } catch (error) {
      console.error("Error approving report:", error);
      showAlert(t.errorApproving, "error");
    }
  };

  const handleDismiss = async (reportId: string) => {
    try {
      await deleteDoc(doc(db, 'reports', reportId));
      setReports(reports.filter(r => r.id !== reportId));
      showAlert(t.reportDismissed, "success");
    } catch (error) {
      console.error("Error dismissing report:", error);
      showAlert(t.errorDismissing, "error");
    }
  };

  if (loginState === 'checking') {
      return (
          <div className="fixed inset-0 z-[100] bg-gray-900 flex items-center justify-center">
              <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
      );
  }

  if (loginState === 'login' || loginState === 'unauthorized') {
      return (
          <div className="fixed inset-0 z-[100] bg-gray-900 flex items-center justify-center p-4">
              <button 
                  onClick={onClose} 
                  className="absolute top-6 right-6 p-2 bg-gray-800 rounded-full text-gray-400 hover:text-white transition"
              >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
              </button>

              <div className="bg-gray-800 p-8 rounded-3xl max-w-sm w-full border border-gray-700 shadow-2xl">
                  <div className="flex justify-center mb-6 text-emerald-500">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                      </svg>
                  </div>
                  
                  <h2 className="text-2xl font-bold text-center text-white mb-6">
                      {language === 'ar' ? 'وصول الموظفين' : 'Staff Access'}
                  </h2>

                  {loginState === 'unauthorized' && (
                      <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg mb-4 text-sm text-center">
                          {language === 'ar' ? 'عذراً، هذا الحساب لا يملك صلاحيات موظف.' : 'Sorry, this account lacks staff permissions.'}
                      </div>
                  )}

                  {authError && (
                      <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg mb-4 text-sm text-center">
                          {authError === 'Firebase: Error (auth/invalid-credential).' 
                              ? (language === 'ar' ? 'البيانات غير صحيحة' : 'Invalid credentials') 
                              : authError}
                      </div>
                  )}

                 <form onSubmit={handleLogin} className="space-y-4">
                     <div>
                         <input 
                            type="email" 
                            placeholder="Email" 
                            value={email} 
                            onChange={e=>setEmail(e.target.value)} 
                            className="w-full bg-gray-900 border border-gray-700 p-4 rounded-xl text-white outline-none focus:border-emerald-500 transition" 
                            required 
                         />
                     </div>
                     <div>
                         <input 
                            type="password" 
                            placeholder="Password" 
                            value={password} 
                            onChange={e=>setPassword(e.target.value)} 
                            className="w-full bg-gray-900 border border-gray-700 p-4 rounded-xl text-white outline-none focus:border-emerald-500 transition" 
                            required 
                         />
                     </div>
                     <button 
                        type="submit" 
                        className="w-full bg-emerald-600 hover:bg-emerald-500 p-4 rounded-xl text-white font-bold transition shadow-lg shadow-emerald-500/20"
                     >
                         {language === 'ar' ? 'تسجيل الدخول' : 'Sign In'}
                     </button>
                     
                     {loginState === 'unauthorized' && (
                        <button 
                           type="button" 
                           onClick={() => signOut(auth)} 
                           className="w-full p-4 mt-2 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-xl transition"
                        >
                            {language === 'ar' ? 'تسجيل الخروج من الحساب الحالي' : 'Sign out current user'}
                        </button>
                     )}
                 </form>
              </div>
          </div>
      );
  }

  return (
    <div className="fixed inset-0 z-[100] bg-gray-900 flex flex-col overflow-hidden">
      
      {/* Header */}
      <div className="flex flex-col border-b border-gray-800 bg-gray-950 shadow-md">
        <div className="flex items-center justify-between p-6 pb-2">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-500/20 rounded-xl text-emerald-400">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl lg:text-3xl font-bold text-white tracking-tight">{t.adminPanel}</h2>
              <p className="text-gray-400 text-sm mt-1">{t.pendingReports}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 text-red-400 hover:text-red-300 hover:bg-gray-800 rounded-xl transition-colors font-medium border border-gray-700"
            >
              <span>{language === 'ar' ? 'تسجيل الخروج' : 'Logout Staff'}</span>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
              </svg>
            </button>
            <button 
              onClick={onClose}
              className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-xl transition-colors font-medium border border-gray-700"
            >
              <span>{language === 'ar' ? 'العودة للتطبيق' : 'Back to App'}</span>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        
        {/* Tabs */}
        <div className="flex px-6 space-x-4 space-x-reverse mt-2">
          {adminRole === 'superadmin' && (
              <>
                  <button
                    onClick={() => setActiveTab('dashboard')}
                    className={`pb-3 px-2 border-b-2 font-bold text-sm transition-colors ${
                      activeTab === 'dashboard' 
                        ? 'border-emerald-500 text-emerald-400' 
                        : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-600'
                    }`}
                  >
                    {language === 'ar' ? 'لوحة القيادة' : 'Dashboard'}
                  </button>
                  <button
                    onClick={() => setActiveTab('staff')}
                    className={`pb-3 px-2 border-b-2 font-bold text-sm transition-colors ${
                      activeTab === 'staff' 
                        ? 'border-emerald-500 text-emerald-400' 
                        : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-600'
                    }`}
                  >
                    {language === 'ar' ? 'إدارة الموظفين' : 'Manage Staff'}
                  </button>
              </>
          )}
          <button
            onClick={() => setActiveTab('reports')}
            className={`pb-3 px-2 border-b-2 font-bold text-sm transition-colors ${
              activeTab === 'reports' 
                ? 'border-emerald-500 text-emerald-400' 
                : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-600'
            }`}
          >
            {language === 'ar' ? 'تقارير المستخدمين' : 'User Reports'}
          </button>
          <button
             onClick={() => setActiveTab('rules')}
             className={`pb-3 px-2 border-b-2 font-bold text-sm transition-colors ${
               activeTab === 'rules' 
                 ? 'border-emerald-500 text-emerald-400' 
                 : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-600'
             }`}
           >
             {language === 'ar' ? 'القواعد الشرعية' : 'Islamic Rules'}
           </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-8 w-full">
        <div className="max-w-7xl mx-auto space-y-6">
          {activeTab === 'dashboard' && adminRole === 'superadmin' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Total Users */}
                  <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 shadow-lg flex items-center gap-4">
                      <div className="p-4 bg-blue-500/20 rounded-xl text-blue-400">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                             <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                          </svg>
                      </div>
                      <div>
                          <p className="text-gray-400 text-sm font-medium">{language === 'ar' ? 'إجمالي المستخدمين' : 'Total App Users'}</p>
                          <p className="text-3xl font-bold text-white mt-1">{totalUsers}</p>
                      </div>
                  </div>

                  {/* Premium Users */}
                  <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 shadow-lg flex items-center gap-4">
                      <div className="p-4 bg-amber-500/20 rounded-xl text-amber-400">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                             <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                          </svg>
                      </div>
                      <div>
                          <p className="text-gray-400 text-sm font-medium">{language === 'ar' ? 'إجمالي المشتركين' : 'Premium Subscribers'}</p>
                          <p className="text-3xl font-bold text-white mt-1">{premiumUsers}</p>
                      </div>
                  </div>

                  {/* Estimated Revenue */}
                  <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 shadow-lg flex items-center gap-4">
                      <div className="p-4 bg-emerald-500/20 rounded-xl text-emerald-400">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                             <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                      </div>
                      <div>
                          <p className="text-gray-400 text-sm font-medium">{language === 'ar' ? 'إجمالي تكلفة الاشتراكات' : 'Est. Revenue'}</p>
                          <p className="text-3xl font-bold text-white mt-1">~${(premiumUsers * 4.99).toFixed(2)}</p>
                      </div>
                  </div>
              </div>
          ) : activeTab === 'staff' && adminRole === 'superadmin' ? (
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 shadow-lg">
                   <h3 className="text-xl font-bold text-white mb-4">{language === 'ar' ? 'إضافة موظف جديد' : 'Add New Staff'}</h3>
                   <form onSubmit={handleCreateStaff} className="space-y-4">
                       <div>
                           <label className="text-gray-400 text-sm mb-1 block">{language === 'ar' ? 'البريد الإلكتروني' : 'Email'}</label>
                           <input type="email" value={newStaffEmail} onChange={e=>setNewStaffEmail(e.target.value)} required className="w-full bg-gray-900 border border-gray-700 p-3 rounded-xl text-white outline-none focus:border-emerald-500" />
                       </div>
                       <div>
                           <label className="text-gray-400 text-sm mb-1 block">{language === 'ar' ? 'كلمة المرور' : 'Password'}</label>
                           <input type="password" value={newStaffPassword} onChange={e=>setNewStaffPassword(e.target.value)} minLength={6} required className="w-full bg-gray-900 border border-gray-700 p-3 rounded-xl text-white outline-none focus:border-emerald-500" />
                       </div>
                       <div>
                           <label className="text-gray-400 text-sm mb-1 block">{language === 'ar' ? 'الصلاحيات' : 'Role'}</label>
                           <select value={newStaffRole} onChange={e=>setNewStaffRole(e.target.value as any)} className="w-full bg-gray-900 border border-gray-700 p-3 rounded-xl text-white outline-none focus:border-emerald-500">
                               <option value="reviewer">{language === 'ar' ? 'مراجع (تقارير فقط)' : 'Reviewer (Reports Only)'}</option>
                               <option value="superadmin">{language === 'ar' ? 'مشرف عام' : 'Super Admin'}</option>
                           </select>
                       </div>
                       <button type="submit" disabled={creatingStaff} className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition">
                           {creatingStaff ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : 'إضافة موظف'}
                       </button>
                   </form>
                </div>
                <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 shadow-lg">
                   <h3 className="text-xl font-bold text-white mb-4">{language === 'ar' ? 'قائمة الموظفين' : 'Staff List'}</h3>
                   <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                       {existingStaff.map(staff => (
                           <div key={staff.id} className="flex justify-between items-center bg-gray-900 border border-gray-700 p-3 rounded-xl">
                               <div>
                                   <p className="text-white font-bold">{staff.email || staff.id}</p>
                                   <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${staff.role === 'superadmin' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                       {staff.role === 'superadmin' ? 'Super Admin' : 'Reviewer'}
                                   </span>
                               </div>
                               {staff.email !== 'a43995642@gmail.com' && (
                                   <button onClick={() => handleRemoveStaffRole(staff.id)} className="text-red-400 hover:text-red-300 p-2 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition" title="Remove Access">
                                       <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                                   </button>
                               )}
                           </div>
                       ))}
                   </div>
                </div>
             </div>
          ) : activeTab === 'rules' ? (
             <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 shadow-lg flex flex-col gap-6">
                <div>
                  <h3 className="text-xl font-bold text-white mb-2">{language === 'ar' ? 'قواعد تحليل المكونات (للذكاء الاصطناعي)' : 'Analysis Rules (for AI)'}</h3>
                  <p className="text-gray-400 text-sm mb-4">
                    {language === 'ar' 
                      ? 'هذه هي التعليمات التي يتم إرسالها لنموذج الذكاء الاصطناعي ليقوم بتصنيف المكونات بناءً عليها. يمكنك تعديلها لتوجيه التحليل بشكل أدق.'
                      : 'These instructions are sent to the AI model to classify ingredients. You can edit them to fine-tune the analysis.'}
                  </p>
                  <textarea 
                    value={rulesText}
                    onChange={(e) => setRulesText(e.target.value)}
                    dir="ltr"
                    className="w-full h-64 bg-gray-900 border border-gray-700 rounded-xl p-4 text-emerald-300 font-mono text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all custom-scrollbar"
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div>
                     <h3 className="text-lg font-bold text-white mb-2">{language === 'ar' ? 'كلمات مفتاحية لمكونات محرمة' : 'Haram Keywords'}</h3>
                     <p className="text-gray-400 text-sm mb-4">
                        {language === 'ar' ? 'كلمات مفتاحية مفصولة بفاصلة. سيتم تصنيف أي مكون يحتوي عليها كـ "حرام" مباشرةً.' : 'Comma-separated keywords. Ingredients matching these will immediately be marked HARAM.'}
                     </p>
                     <textarea 
                        value={haramListText}
                        onChange={(e) => setHaramListText(e.target.value)}
                        dir="ltr"
                        className="w-full h-32 bg-gray-900 border border-gray-700 rounded-xl p-4 text-red-300 font-mono text-sm focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all custom-scrollbar"
                      />
                   </div>
                   
                   <div>
                     <h3 className="text-lg font-bold text-white mb-2">{language === 'ar' ? 'كلمات مفتاحية لمكونات مشتبه بها' : 'Doubtful Keywords'}</h3>
                     <p className="text-gray-400 text-sm mb-4">
                        {language === 'ar' ? 'كلمات مفتاحية مفصولة بفاصلة. سيتم تصنيف أي مكون يحتوي عليها كـ "مشتبه به".' : 'Comma-separated keywords. Ingredients matching these will be marked DOUBTFUL.'}
                     </p>
                     <textarea 
                        value={unknownListText}
                        onChange={(e) => setUnknownListText(e.target.value)}
                        dir="ltr"
                        className="w-full h-32 bg-gray-900 border border-gray-700 rounded-xl p-4 text-amber-300 font-mono text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all custom-scrollbar"
                      />
                   </div>
                </div>

                <div className="pt-4 border-t border-gray-700 flex justify-end">
                   <button
                     onClick={saveRules}
                     disabled={savingRules}
                     className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 py-3 rounded-xl transition-all shadow-lg font-bold"
                   >
                     {savingRules ? (
                       <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                     ) : (
                       <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                         <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                       </svg>
                     )}
                     {language === 'ar' ? 'حفظ القواعد' : 'Save Rules'}
                   </button>
                </div>
             </div>
          ) : loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : reports.length === 0 ? (
            <div className="text-center bg-gray-800/50 rounded-3xl py-24 border border-gray-700/50">
              <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-500">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-medium text-gray-300">{t.noPendingReports}</h3>
              <p className="text-gray-500 mt-2">{language === 'ar' ? 'جميع التقارير تمت معالجتها.' : 'All reports have been processed.'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {reports.map((report) => (
                <div key={report.id} className="bg-gray-800 rounded-2xl p-6 border border-gray-700 flex flex-col shadow-lg hover:border-gray-600 transition-colors">
                  <div className="flex-1 space-y-5">
                    
                    {/* Original Text */}
                    <div>
                      <span className="text-xs text-gray-400 uppercase tracking-widest font-bold">{t.originalText}</span>
                      <div className="bg-gray-900/50 p-4 rounded-xl mt-2 border border-gray-700/50">
                        <p className="text-white font-medium leading-relaxed">{report.original_text}</p>
                      </div>
                    </div>
                    
                    {/* Ingredients Review */}
                    {report.ai_result?.ingredientsDetected && report.ai_result.ingredientsDetected.length > 0 ? (
                      <div>
                        <span className="text-xs text-blue-400/70 uppercase tracking-widest font-bold">
                          {language === 'ar' ? 'مراجعة المكونات' : 'Review Ingredients'}
                        </span>
                        <div className="flex flex-col gap-2 mt-2 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                          {report.ai_result.ingredientsDetected.map((ing: any, idx: number) => {
                            const currentEdit = adminEdits[report.id]?.[ing.name] || ing.status;
                            const isUserCorrected = report.ingredient_corrections && report.ingredient_corrections[ing.name];
                            
                            return (
                              <div key={idx} className={`flex justify-between items-center p-2 rounded-lg border ${isUserCorrected ? 'bg-blue-900/20 border-blue-500/50' : 'bg-gray-800/50 border-gray-700/50'}`}>
                                <div className="flex flex-col">
                                  <span className="text-gray-200 text-sm font-medium">{ing.name}</span>
                                  {isUserCorrected && (
                                    <span className="text-xs text-blue-400">{language === 'ar' ? 'اقتراح المستخدم:' : 'User suggested:'} {isUserCorrected}</span>
                                  )}
                                </div>
                                <select
                                  value={currentEdit}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setAdminEdits(prev => ({
                                      ...prev,
                                      [report.id]: {
                                        ...(prev[report.id] || {}),
                                        [ing.name]: val
                                      }
                                    }));
                                  }}
                                  className={`text-xs font-bold px-2 py-1 rounded outline-none border-none ${
                                    currentEdit === 'HALAL' ? 'bg-emerald-500/20 text-emerald-400' :
                                    currentEdit === 'HARAM' ? 'bg-red-500/20 text-red-400' :
                                    currentEdit === 'DOUBTFUL' ? 'bg-amber-500/20 text-amber-400' :
                                    'bg-gray-500/20 text-gray-400'
                                  }`}
                                >
                                  <option value="HALAL">HALAL</option>
                                  <option value="HARAM">HARAM</option>
                                  <option value="DOUBTFUL">DOUBTFUL</option>
                                  <option value="NON_FOOD">NON_FOOD</option>
                                </select>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : report.ingredient_corrections && Object.keys(report.ingredient_corrections).length > 0 ? (
                      <div>
                        <span className="text-xs text-blue-400/70 uppercase tracking-widest font-bold">
                          {language === 'ar' ? 'تصحيحات المكونات' : 'Ingredient Corrections'}
                        </span>
                        <div className="flex flex-col gap-2 mt-2">
                          {Object.entries(report.ingredient_corrections).map(([ing, status], idx) => (
                            <div key={idx} className="flex justify-between items-center bg-blue-900/20 border border-blue-900/50 px-3 py-2 rounded-lg">
                              <span className="text-blue-100 text-sm font-medium">{ing}</span>
                              <span className={`font-bold text-xs px-2 py-1 rounded ${status === 'HALAL' ? 'bg-emerald-500/20 text-emerald-400' : status === 'HARAM' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                {status}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (report.reported_ingredients?.length ? report.reported_ingredients.length > 0 : report.reported_ingredient) ? (
                      <div>
                        <span className="text-xs text-blue-400/70 uppercase tracking-widest font-bold">
                          {language === 'ar' ? 'المكونات المبلغ عنها' : 'Reported Ingredients'}
                        </span>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {(report.reported_ingredients || (report.reported_ingredient ? [report.reported_ingredient] : [])).map((ing, idx) => (
                            <div key={idx} className="bg-blue-900/20 border border-blue-900/50 px-3 py-1.5 rounded-lg">
                              <p className="text-blue-400 font-bold text-sm">{ing}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {/* AI Result & User Correction */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-xs text-gray-400 uppercase tracking-widest font-bold">{t.aiResult}</span>
                        <div className="bg-gray-900/50 p-3 rounded-xl mt-2 border border-gray-700/50 h-full flex items-center justify-center">
                          <span className={`font-bold ${
                            report.ai_result?.status === 'HALAL' ? 'text-emerald-400' :
                            report.ai_result?.status === 'HARAM' ? 'text-red-400' : 'text-yellow-400'
                          }`}>{report.ai_result?.status}</span>
                        </div>
                      </div>
                      
                      <div>
                        <span className="text-xs text-emerald-400/70 uppercase tracking-widest font-bold">{t.userCorrection}</span>
                        <div className="bg-emerald-900/20 border border-emerald-900/50 p-3 rounded-xl mt-2 h-full flex items-center justify-center">
                          <p className="text-emerald-400 font-bold">{report.user_correction}</p>
                        </div>
                      </div>
                    </div>

                    {/* User Notes */}
                    {report.user_notes && (
                      <div>
                        <span className="text-xs text-gray-400 uppercase tracking-widest font-bold">{t.userNotes}</span>
                        <div className="bg-gray-900/30 p-4 rounded-xl mt-2 border border-gray-700/30">
                          <p className="text-gray-300 text-sm italic leading-relaxed">"{report.user_notes}"</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 mt-6 pt-6 border-t border-gray-700/50">
                    <button
                      onClick={() => handleApprove(report)}
                      className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-3 rounded-xl transition-all shadow-lg shadow-emerald-900/20 font-bold active:scale-[0.98]"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      {t.approve}
                    </button>
                    <button
                      onClick={() => handleDismiss(report.id)}
                      className="flex-1 flex items-center justify-center gap-2 bg-gray-700 hover:bg-red-600 text-white px-4 py-3 rounded-xl transition-all shadow-lg font-bold active:scale-[0.98]"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                      {t.dismiss}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
