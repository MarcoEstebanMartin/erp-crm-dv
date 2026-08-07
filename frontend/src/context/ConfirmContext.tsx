import React, { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import ConfirmModal from '../components/modals/ConfirmModal';

interface ConfirmOptions {
  title?: string;
  type?: 'danger' | 'warning' | 'info' | 'success';
  confirmText?: string;
  cancelText?: string;
  isAlert?: boolean;
}

interface ConfirmContextType {
  confirm: (messageOrOptions: string | (ConfirmOptions & { message?: string }), options?: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export const useConfirm = () => {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return context.confirm;
};

export const ConfirmProvider = ({ children }: { children: ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [options, setOptions] = useState<ConfirmOptions>({});
  const [resolver, setResolver] = useState<{ resolve: (value: boolean) => void } | null>(null);

  const confirm = useCallback((msgOrOpts: string | (ConfirmOptions & { message?: string }), opts?: ConfirmOptions): Promise<boolean> => {
    if (typeof msgOrOpts === 'object' && msgOrOpts !== null) {
      setMessage(msgOrOpts.message || '');
      setOptions(msgOrOpts);
    } else {
      setMessage(msgOrOpts);
      setOptions(opts || {});
    }
    setIsOpen(true);
    return new Promise((resolve) => {
      setResolver({ resolve });
    });
  }, []);

  const handleConfirm = () => {
    setIsOpen(false);
    resolver?.resolve(true);
  };

  const handleCancel = () => {
    setIsOpen(false);
    resolver?.resolve(false);
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <ConfirmModal
        isOpen={isOpen}
        message={message}
        title={options.title}
        type={options.type}
        confirmText={options.confirmText}
        cancelText={options.cancelText}
        isAlert={options.isAlert}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </ConfirmContext.Provider>
  );
};
