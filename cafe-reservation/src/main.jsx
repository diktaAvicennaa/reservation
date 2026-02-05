import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// --- JURUS PAKSA TEMA TROPIS ---
localStorage.removeItem("theme");
document.documentElement.setAttribute('data-theme', 'tropis');
document.documentElement.classList.add('bg-base-200'); 
// -------------------------------

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)