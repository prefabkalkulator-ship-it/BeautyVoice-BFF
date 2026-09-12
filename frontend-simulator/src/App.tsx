import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import Auth from './pages/Auth';
import DashboardLayout from './layouts/DashboardLayout';

import Appointments from './components/Appointments';
import Services from './components/Services';
import Faq from './components/Faq';
import Customers from './components/Customers';
import Simulator from './components/Simulator';
import Settings from './components/Settings';
import TimeOff from './components/TimeOff';
import Subscription from './pages/Subscription';
import Guide from './pages/Guide';
import { SuperAdminDashboard } from './components/SuperAdminDashboard';
import VipContacts from './components/VipContacts';
import AnnualEvents from './components/AnnualEvents';
import CallHistoryMessages from './components/CallHistoryMessages';

import './index.css';

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as any });
    if (document.documentElement) {
      document.documentElement.scrollTop = 0;
    }
    if (document.body) {
      document.body.scrollTop = 0;
    }
  }, [pathname]);

  return null;
}

function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Auth />} />
        <Route path="/register" element={<Auth />} />
        <Route path="/superadmin" element={<SuperAdminDashboard />} />
        
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<Navigate to="/dashboard/appointments" replace />} />
          <Route path="appointments" element={<Appointments />} />
          <Route path="vip-contacts" element={<VipContacts />} />
          <Route path="annual-events" element={<AnnualEvents />} />
          <Route path="messages" element={<CallHistoryMessages />} />
          <Route path="services" element={<Services />} />
          <Route path="customers" element={<Customers />} />
          <Route path="faq" element={<Faq />} />
          <Route path="simulator" element={<Simulator />} />
          <Route path="settings" element={<Settings />} />
          <Route path="timeoff" element={<TimeOff />} />
          <Route path="subscription" element={<Subscription />} />
          <Route path="guide" element={<Guide />} />
        </Route>
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
