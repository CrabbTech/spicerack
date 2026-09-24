import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './ui/App';
import { migrateStorage } from './state/storage';
import { isDesktop, isMac } from './input/native';
import '@fontsource-variable/newsreader/opsz.css';
import '@fontsource-variable/newsreader/opsz-italic.css';
import '@fontsource-variable/fraunces/full.css';
import '@fontsource-variable/fraunces/full-italic.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/600.css';
import '@fontsource/silkscreen/400.css';
import './styles.css';

migrateStorage();
// the desktop shell draws its own title bar over the page; the page leaves it room (?shell=mac previews that in a browser)
const preview = new URLSearchParams(window.location.search).get('shell');
document.documentElement.dataset.shell = isDesktop() ? (isMac() ? 'mac' : 'desktop') : preview ?? '';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
