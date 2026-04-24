import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import { initializeThemeMode } from './lib/theme';
import './styles/global.css';

initializeThemeMode();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
