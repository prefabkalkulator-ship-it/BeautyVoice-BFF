import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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

import './index.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Auth />} />
        <Route path="/register" element={<Auth />} />
        
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<Navigate to="/dashboard/appointments" replace />} />
          <Route path="appointments" element={<Appointments />} />
          <Route path="services" element={<Services />} />
          <Route path="customers" element={<Customers />} />
          <Route path="faq" element={<Faq />} />
          <Route path="simulator" element={<Simulator />} />
          <Route path="settings" element={<Settings />} />
          <Route path="timeoff" element={<TimeOff />} />
          <Route path="subscription" element={<Subscription />} />
        </Route>
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
