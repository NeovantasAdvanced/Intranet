import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import tabIcon from './assets/neovantas-logo-mark.svg';

const favicon = document.querySelector<HTMLLinkElement>("link[rel='icon']");

if (favicon) {
  favicon.href = tabIcon;
} else {
  const link = document.createElement('link');
  link.rel = 'icon';
  link.href = tabIcon;
  document.head.appendChild(link);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
