import React, { createContext, useContext, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('sakan_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [toastMessage, setToastMessage] = useState(null);

  useEffect(() => {
    if (user) {
      localStorage.setItem('sakan_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('sakan_user');
    }
  }, [user]);

  const showToast = (msg) => {
    let cleanMsg = msg;
    if (typeof msg === 'object' && msg !== null) {
      if (Array.isArray(msg)) {
        cleanMsg = msg.map(item => (typeof item === 'object' ? (item.msg || item.detail || JSON.stringify(item)) : String(item))).join(' | ');
      } else if (msg.msg) {
        cleanMsg = msg.msg;
      } else if (msg.detail) {
        cleanMsg = typeof msg.detail === 'object' ? (Array.isArray(msg.detail) ? msg.detail.map(d => d.msg || JSON.stringify(d)).join(' | ') : JSON.stringify(msg.detail)) : msg.detail;
      } else {
        cleanMsg = JSON.stringify(msg);
      }
    }
    const textStr = String(cleanMsg || 'حدث خطأ غير متوقع');
    setToastMessage(textStr);
    setTimeout(() => {
      setToastMessage((prev) => (prev === textStr ? null : prev));
    }, 3500);
  };

  return (
    <AppContext.Provider value={{ user, setUser, showToast, toastMessage }}>
      {children}
      {toastMessage && createPortal(
        <div className="alert-toast">
          <Info style={{ width: 18, height: 18, flexShrink: 0, color: 'var(--primary, #3b82f6)' }} />
          <span>{toastMessage}</span>
        </div>,
        document.body
      )}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
