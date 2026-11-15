import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { installLinkGuard } from './link-state';
import '@fontsource-variable/space-grotesk';
import './styles.css';
import './nasa-references.css';
import './landing.css';

installLinkGuard();

const element = document.getElementById('root');
if (!element) throw new Error('Expected #root in index.html');
createRoot(element).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
