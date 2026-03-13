import { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { CustomAlert, AlertType } from '../components/CustomAlert';

interface AlertContextType {
  showAlert: (title: string, message: string, type?: AlertType) => void;
  showConfirm: (title: string, message: string, onConfirm: () => void, type?: AlertType) => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export const AlertProvider = ({ children }: { children?: ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState({
    title: '',
    message: '',
    type: 'info' as AlertType,
    isConfirm: false,
    onConfirm: undefined as (() => void) | undefined
  });

  const showAlert = useCallback((title: string, message: string, type: AlertType = 'info') => {
    setConfig({
        title,
        message,
        type,
        isConfirm: false,
        onConfirm: undefined
    });
    setIsOpen(true);
  }, []);

  const showConfirm = useCallback((title: string, message: string, onConfirm: () => void, type: AlertType = 'warning') => {
    setConfig({
        title,
        message,
        type,
        isConfirm: true,
        onConfirm
    });
    setIsOpen(true);
  }, []);

  const closeAlert = useCallback(() => {
    setIsOpen(false);
  }, []);

  return (
    <AlertContext.Provider value={{ showAlert, showConfirm }}>
      {children}
      <CustomAlert 
        isOpen={isOpen}
        onClose={closeAlert}
        title={config.title}
        message={config.message}
        type={config.type}
        isConfirm={config.isConfirm}
        onConfirm={config.onConfirm}
      />
    </AlertContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAlert = () => {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert must be used within an AlertProvider');
  }
  return context;
};
