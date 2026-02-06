# Security Implementation Guide

## ✅ Fitur Keamanan yang Sudah Diimplementasi

### 1. **Protected Routes** 
- `/admin/dashboard` hanya bisa diakses setelah login
- Jika user belum login, otomatis redirect ke `/admin`
- ProtectedRoute component memvalidasi authentication state

### 2. **Firestore Security Rules**
- File: `firestore.rules`
- Hanya authenticated users (admin) yang bisa read/write data
- Public bisa read menu products, tapi tidak bisa edit

### 3. **Logout Functionality**
- Admin bisa logout dengan aman
- Session berkakhir dan redirect ke login page
- Email admin ditampilkan di navbar

### 4. **Session Management**
- Firebase Authentication mengelola session otomatis
- Token di-refresh otomatis
- Logout membersihkan session

---

## 🚀 Cara Deploy Firestore Rules

### Step 1: Install Firebase CLI
```bash
npm install -g firebase-tools
```

### Step 2: Login ke Firebase
```bash
firebase login
```

### Step 3: Initialize Firebase Project (jika belum)
```bash
firebase init
```
Pilih:
- Firestore
- Use existing project: `reservation-ef3ec`
- Keep default settings

### Step 4: Deploy Firestore Rules
```bash
firebase deploy --only firestore:rules
```

---

## 📋 Security Rules Breakdown

```
- /reservations/* → Hanya admin (authenticated) bisa read & write
- /products/* → Public bisa read, hanya admin bisa write
```

---

## 🔒 Keamanan Berlapis (Defense in Depth)

✅ **Frontend Protection** - ProtectedRoute component  
✅ **Authentication** - Firebase Auth (email/password)  
✅ **Backend Security** - Firestore Security Rules  
✅ **Session Management** - Automatic token refresh  
✅ **Logout** - Clear session & redirect  

---

## ⚡ Testing Security

### Test 1: Akses tanpa login
1. Buka: `http://localhost:5173/admin/dashboard`
2. Seharusnya redirect ke `/admin` (login page)

### Test 2: Firestore Rules
1. Buka DevTools → Application → Console
2. Coba: `db.collection("reservations").getDocs()`
3. Akan error "Missing or insufficient permissions" (jika belum login)
4. Setelah login, akan berhasil

---

## 📌 Catatan Penting

1. **Deploy Rules** sebelum production - jangan lupa step ini!
2. **API Key di firebase.js** - Normal untuk Firebase, sudah aman
3. **Jangan commit credentials** - `.env` file kalau ada
4. **Regular security review** - Update rules jika ada fitur baru
