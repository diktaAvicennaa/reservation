/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [
    require('daisyui'),
  ],
  daisyui: {
    themes: [
      {
        tropis: {
          "primary": "#065F46",    // Hijau Tua
          "secondary": "#065F46",  // Hijau Tua
          "accent": "#065F46",     // Hijau Tua
          "neutral": "#1F2937",    // Abu Gelap (Teks)
          "base-100": "#ffffff",   // Putih Bersih (Background Kartu)
          "base-200": "#ECFDF5",   // Hijau Mint Sangat Muda (Background Halaman)
          "info": "#065F46",
          "success": "#36D399",
          "warning": "#FBBD23",
          "error": "#F87272",
        },
      },
    ],
  },
}