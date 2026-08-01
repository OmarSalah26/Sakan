import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ListingDetailPage from './pages/ListingDetailPage';
import AdvertiserProfilePage from './pages/AdvertiserProfilePage';
import { AppProvider } from './context/AppContext';
import { RouterProvider, Routes, Route } from './router/Router';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppProvider>
      <RouterProvider>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/listings/:id" element={<ListingDetailPage />} />
          <Route path="/users/:id" element={<AdvertiserProfilePage />} />
        </Routes>
      </RouterProvider>
    </AppProvider>
  </React.StrictMode>
);
