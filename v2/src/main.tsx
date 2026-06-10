import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './ui/App';
import { applySettings, loadSettings } from './ui/themes';
import './styles.css';

// theme before first paint — no flash of the wrong universe
applySettings(loadSettings());

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
