import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { startAutoBackup } from './lib/autoBackup';
import './index.css';

startAutoBackup();

// All data lives only in this browser, so ask it not to evict our storage.
navigator.storage?.persist?.().catch(() => {});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
