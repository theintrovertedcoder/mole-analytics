import '@fontsource/poppins/latin-400.css';
import '@fontsource/poppins/latin-600.css';
import '@fontsource/poppins/latin-800.css';
import '@fontsource/poppins/latin-900.css';
import './index.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
