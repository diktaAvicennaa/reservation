import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// --- JURUS PAKSA TEMA FOREST ---
// Hapus ingatan lama browser
localStorage.removeItem("theme");

// Paksa atribut HTML jadi forest sekarang juga
document.documentElement.setAttribute('data-theme', 'forest');
document.documentElement.classList.add('bg-base-200'); 
// -------------------------------

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)