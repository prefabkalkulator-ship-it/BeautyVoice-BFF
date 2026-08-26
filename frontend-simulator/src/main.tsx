

const originalFetch = window.fetch;
window.fetch = async (...args) => {
  let [resource, config] = args;
  if (typeof resource === 'string' && resource.startsWith('/api')) {
    config = config || {};
    const tid = localStorage.getItem('tenantId');
    
    // Zawsze dodajemy cache-buster do zapytan GET by ominac CDN Firebase
    const isGet = !config.method || config.method.toUpperCase() === 'GET';
    if (isGet) {
      const sep = resource.includes('?') ? '&' : '?';
      resource += `${sep}cb=${Date.now()}`;
      args[0] = resource;
    }

    if (tid) {
      config.headers = {
        ...config.headers,
        'X-Tenant-Id': tid,
        'Cache-Control': 'no-cache'
      };
    }
    args[1] = config;
  }
  return originalFetch(...args);
};

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
