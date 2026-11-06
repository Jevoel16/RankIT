import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { CloseIcon } from './Modal';

const ToastContext = createContext(null);
const DURATION_MS = { success: 3500, info: 4000, error: 6500 };

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((toast) => toast.id !== id)), []);

  const show = useCallback(
    (type, message) => {
      if (!message) return;
      const id = nextId.current++;
      // Keep at most four on screen so a burst of errors can't cover the page.
      setToasts((list) => [...list.slice(-3), { id, type, message }]);
      window.setTimeout(() => dismiss(id), DURATION_MS[type] || 4000);
    },
    [dismiss]
  );

  const api = useMemo(
    () => ({
      success: (message) => show('success', message),
      error: (message) => show('error', message),
      info: (message) => show('info', message),
      dismiss
    }),
    [show, dismiss]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="ui-toasts" aria-live="polite" aria-relevant="additions">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`ui-toast ui-toast--${toast.type}`}
            role={toast.type === 'error' ? 'alert' : 'status'}
          >
            <span className="ui-toast__message">{toast.message}</span>
            <button
              type="button"
              className="ui-icon-btn"
              aria-label="Dismiss notification"
              onClick={() => dismiss(toast.id)}
            >
              <CloseIcon />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}
