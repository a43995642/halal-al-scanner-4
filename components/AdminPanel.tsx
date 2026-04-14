import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, doc, deleteDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useLanguage } from '../contexts/LanguageContext';
import { useAlert } from '../contexts/AlertContext';

interface Report {
  id: string;
  original_text: string;
  ai_result: any;
  user_correction: string;
  user_notes?: string;
  created_at: any;
}

interface AdminPanelProps {
  onClose: () => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ onClose }) => {
  const { t } = useLanguage();
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
      const ingredientName = report.original_text.trim().toLowerCase();
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-gray-900 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl border border-gray-800">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h2 className="text-xl font-bold text-white">{t.adminPanel} - {t.pendingReports}</h2>
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-full transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="flex justify-center items-center h-32">
              <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : reports.length === 0 ? (
            <div className="text-center text-gray-400 py-12">
              {t.noPendingReports}
            </div>
          ) : (
            reports.map((report) => (
              <div key={report.id} className="bg-gray-800 rounded-xl p-4 border border-gray-700 flex flex-col md:flex-row gap-4">
                <div className="flex-1 space-y-3">
                  <div>
                    <span className="text-xs text-gray-400 uppercase tracking-wider">{t.originalText}</span>
                    <p className="text-white font-medium mt-1">{report.original_text}</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="bg-gray-900/50 p-3 rounded-lg">
                      <span className="text-xs text-gray-400 uppercase tracking-wider">{t.aiResult}</span>
                      <p className="text-white mt-1 text-sm">
                        Status: <span className={
                          report.ai_result?.status === 'HALAL' ? 'text-emerald-400' :
                          report.ai_result?.status === 'HARAM' ? 'text-red-400' : 'text-yellow-400'
                        }>{report.ai_result?.status}</span>
                      </p>
                    </div>
                    
                    <div className="bg-emerald-900/20 border border-emerald-900/50 p-3 rounded-lg">
                      <span className="text-xs text-emerald-400/70 uppercase tracking-wider">{t.userCorrection}</span>
                      <p className="text-emerald-400 font-bold mt-1">{report.user_correction}</p>
                    </div>
                  </div>

                  {report.user_notes && (
                    <div>
                      <span className="text-xs text-gray-400 uppercase tracking-wider">{t.userNotes}</span>
                      <p className="text-gray-300 text-sm mt-1 italic">"{report.user_notes}"</p>
                    </div>
                  )}
                </div>

                <div className="flex flex-row md:flex-col gap-2 justify-center border-t md:border-t-0 md:border-l border-gray-700 pt-4 md:pt-0 md:pl-4">
                  <button
                    onClick={() => handleApprove(report)}
                    className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    {t.approve}
                  </button>
                  <button
                    onClick={() => handleDismiss(report.id)}
                    className="flex-1 flex items-center justify-center gap-2 bg-gray-700 hover:bg-red-600/80 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                    {t.dismiss}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
