import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, doc, deleteDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useLanguage } from '../contexts/LanguageContext';
import { useAlert } from '../contexts/AlertContext';

interface Report {
  id: string;
  original_text: string;
  reported_ingredient?: string;
  ai_result: any;
  user_correction: string;
  user_notes?: string;
  created_at: any;
}

interface AdminPanelProps {
  onClose: () => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ onClose }) => {
  const { t, language } = useLanguage();
  const { showAlert } = useAlert();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReports();
  }, []);

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
      const ingredientName = (report.reported_ingredient || report.original_text).trim().toLowerCase();
      const safeId = encodeURIComponent(ingredientName).replace(/\./g, '%2E');
      
      let newStatus = "HALAL";
      if (report.user_correction === "حرام" || report.user_correction === "Haram") newStatus = "HARAM";
      if (report.user_correction === "مشتبه به" || report.user_correction === "Doubtful") newStatus = "DOUBTFUL";

      const cacheRef = doc(db, 'ingredient_cache', safeId);
      await setDoc(cacheRef, {
        name: ingredientName,
        status: newStatus,
        rule_id: "RULE_USER_CORRECTED",
        result: {
            status: newStatus,
            reason: "User corrected via report",
            ingredientsDetected: [{
                name: ingredientName,
                status: newStatus,
                rule_id: "RULE_USER_CORRECTED"
            }],
            confidence: 100
        },
        timestamp: serverTimestamp()
      }, { merge: true });

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

  return (
    <div className="fixed inset-0 z-[100] bg-gray-900 flex flex-col overflow-hidden">
      
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-800 bg-gray-950 shadow-md">
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

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-8 w-full">
        <div className="max-w-7xl mx-auto space-y-6">
          {loading ? (
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
                    
                    {/* Reported Ingredient */}
                    {report.reported_ingredient && (
                      <div>
                        <span className="text-xs text-blue-400/70 uppercase tracking-widest font-bold">
                          {language === 'ar' ? 'المكون المبلغ عنه' : 'Reported Ingredient'}
                        </span>
                        <div className="bg-blue-900/20 border border-blue-900/50 p-3 rounded-xl mt-2">
                          <p className="text-blue-400 font-bold text-lg">{report.reported_ingredient}</p>
                        </div>
                      </div>
                    )}

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
