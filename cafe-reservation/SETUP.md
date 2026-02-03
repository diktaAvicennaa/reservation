# 🚀 Setup Guide - Cafe Reservation System

## Prerequisites
- Node.js v18 atau lebih baru
- npm atau yarn
- Akun Firebase

## Installation

1. **Clone & Install Dependencies**
   ```bash
   npm install
   ```

2. **Firebase Setup**
   
   a. Buat project di [Firebase Console](https://console.firebase.google.com/)
   
   b. Enable Authentication (Email/Password)
   
   c. Create Firestore Database dengan Collections:
   
   **Collection: `products`**
   ```
   {
     name: "Kopi Latte",
     price: 25000,
     category: "drink",
     isAvailable: true
   }
   ```
   
   **Collection: `reservations`** (akan terisi otomatis)
   
   d. Setup Firestore Rules:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /products/{productId} {
         allow read: if true;
         allow write: if request.auth != null;
       }
       match /reservations/{reservationId} {
         allow read, write: if request.auth != null;
       }
     }
   }
   ```
   
   e. Create Admin User di Firebase Authentication:
   - Email: admin@cafemenu.com
   - Password: (your secure password)

3. **Environment Variables**
   
   Config sudah ada di `src/firebase.js` atau bisa gunakan `.env`:
   ```bash
   cp .env.example .env
   # Edit .env dengan credentials Firebase Anda
   ```

## Running the Application

**Development:**
```bash
npm run dev
```

**Build Production:**
```bash
npm run build
```

**Preview Production Build:**
```bash
npm run preview
```

## 📁 Struktur Halaman

- `/` - Halaman Booking untuk Customer
- `/admin` - Login Admin
- `/admin/dashboard` - Dashboard Admin (Protected)

## 🔐 Default Admin Credentials

Setelah create user di Firebase:
- Email: admin@cafemenu.com
- Password: (sesuai yang Anda buat)

## 🚢 Deployment ke Vercel

1. Push code ke GitHub
2. Import project di [Vercel](https://vercel.com)
3. Vercel akan auto-detect Vite config
4. Deploy!

Config `vercel.json` sudah ada dan siap digunakan.

## 📦 Tech Stack

- React 19
- Vite 7
- Firebase (Auth + Firestore)
- TailwindCSS + DaisyUI
- React Router DOM

## 🐛 Troubleshooting

**Port sudah digunakan:**
Vite akan otomatis mencari port lain (5174, 5175, dst)

**Firebase error:**
Pastikan credentials di `firebase.js` sudah benar

**Build error:**
```bash
npm install --force
npm run build
```
