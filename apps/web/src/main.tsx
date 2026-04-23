import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './styles/global.css';
import { bootstrapThemeMode } from './lib/theme';

bootstrapThemeMode();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
