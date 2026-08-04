import React, { createContext, useContext, useState, useEffect } from 'react';

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
      {toastMessage && (
        <div className="alert-toast" style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 99999,
          background: '#1e293b',
          color: '#ffffff',
          padding: '0.85rem 1.4rem',
          borderRadius: '12px',
          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)',
          fontWeight: 600,
          fontSize: '0.9rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          animation: 'fadeInUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
          {toastMessage}
        </div>
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
