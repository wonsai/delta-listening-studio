import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { DAEGU_EDU_LOGO } from './assets/daeguEduLogo';
import './index.css';

// 브라우저 탭 파비콘에도 대구광역시교육청 로고 적용
const favicon =
  (document.querySelector("link[rel='icon']") as HTMLLinkElement | null) ||
  document.createElement('link');
favicon.rel = 'icon';
favicon.type = 'image/png';
favicon.href = DAEGU_EDU_LOGO;
if (!favicon.parentNode) {
  document.head.appendChild(favicon);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
