import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// --- FIX: Add Buffer Polyfill for React-PDF ---
import { Buffer } from 'buffer';
window.Buffer = window.Buffer || Buffer;
// ----------------------------------------------

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Privacy-friendly, cookieless analytics (Vercel Web Analytics + Speed Insights), loaded after the page is idle.
const startAnalytics = () => {
  if (import.meta.env.DEV || navigator.webdriver) return
  import('@vercel/analytics').then(m => m.inject()).catch(() => {})
  import('@vercel/speed-insights').then(m => m.injectSpeedInsights()).catch(() => {})
}
if (document.readyState === 'complete') setTimeout(startAnalytics, 1500)
else window.addEventListener('load', () => setTimeout(startAnalytics, 1500), { once: true })
