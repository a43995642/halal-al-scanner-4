
import React, { Component, ReactNode, ErrorInfo, useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { LanguageProvider } from './contexts/LanguageContext';
import { AlertProvider } from './contexts/AlertContext';

const AdminPanel = React.lazy(() => import('./components/AdminPanel'));

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Critical App Crash:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const errorMessage = this.state.error?.message || "";
      if (errorMessage === 'Script error.' || errorMessage === 'error') {
        // Ignore generic cross-origin script errors that don't actually crash the app
        return (this as any).props.children;
      }
      return (
        <div className="flex items-center justify-center min-h-screen bg-slate-950 p-6 text-center" dir="rtl">
          <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 shadow-2xl max-w-sm w-full">
            <h1 className="text-xl font-bold text-white mb-4 font-sans">حدث خطأ في التشغيل</h1>
            <p className="text-gray-400 mb-6 text-sm">{errorMessage || "مشكلة في تحميل المكونات"}</p>
            <button 
              onClick={() => window.location.reload()}
              className="bg-emerald-600 text-white w-full py-3 rounded-xl font-bold"
            >
              إعادة محاولة التشغيل
            </button>
          </div>
        </div>
      );
    }
    return (this as any).props.children;
  }
}

function RootApp() {
  const [isAdminRoute, setIsAdminRoute] = useState(window.location.pathname === '/admin');

  useEffect(() => {
    const handleLocationChange = () => {
      setIsAdminRoute(window.location.pathname === '/admin');
    };

    window.addEventListener('popstate', handleLocationChange);
    
    // Custom event to handle routing from components without full reload
    window.addEventListener('navigate', handleLocationChange);

    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('navigate', handleLocationChange);
    };
  }, []);

  if (isAdminRoute) {
    return (
      <React.Suspense fallback={<div className="bg-slate-950 min-h-screen flex items-center justify-center"><div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div></div>}>
         <AdminPanel onClose={() => { 
             window.history.pushState({}, '', '/'); 
             window.dispatchEvent(new Event('navigate')); 
         }} />
      </React.Suspense>
    );
  }

  return <App />;
}

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <LanguageProvider>
          <AlertProvider>
            <RootApp />
          </AlertProvider>
        </LanguageProvider>
      </ErrorBoundary>
    </React.StrictMode>
  );
} else {
  console.error("Fatal: Root element not found");
}
