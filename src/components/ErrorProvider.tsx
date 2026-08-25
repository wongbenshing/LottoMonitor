import React, { createContext, useContext, useState, useCallback } from 'react';
import { ErrorBoundary, ErrorState, AppError } from '../utils/errorHandling';
import ErrorNotification from './ErrorNotification';

interface ErrorContextType {
  errorState: ErrorState;
  addError: (error: AppError) => void;
  removeError: (id: string) => void;
  clearErrors: () => void;
}

const ErrorContext = createContext<ErrorContextType | undefined>(undefined);

export const useError = () => {
  const context = useContext(ErrorContext);
  if (!context) {
    throw new Error('useError must be used within ErrorProvider');
  }
  return context;
};

interface ErrorProviderProps {
  children: React.ReactNode;
}

export const ErrorProvider: React.FC<ErrorProviderProps> = ({ children }) => {
  const [errorState, setErrorState] = useState<ErrorState>(ErrorBoundary.getErrorState());

  const addError = useCallback((error: AppError) => {
    ErrorBoundary.addError(error);
    setErrorState(ErrorBoundary.getErrorState());
  }, []);

  const removeError = useCallback((id: string) => {
    ErrorBoundary.removeError(id);
    setErrorState(ErrorBoundary.getErrorState());
  }, []);

  const clearErrors = useCallback(() => {
    ErrorBoundary.clearErrors();
    setErrorState(ErrorBoundary.getErrorState());
  }, []);

  return (
    <ErrorContext.Provider value={{ errorState, addError, removeError, clearErrors }}>
      <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
        {errorState.notifications.map((notification) => (
          <ErrorNotification
            key={notification.id}
            notification={notification}
            onDismiss={removeError}
          />
        ))}
      </div>
      {children}
    </ErrorContext.Provider>
  );
};