import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import BookingPage from "./pages/BookingPage";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-base-200">
        <Routes>
          {/* HALAMAN UTAMA: Navbar + Booking Form */}
          <Route path="/" element={
            <>
              <Navbar />
              <BookingPage />
            </>
          } />

          {/* HALAMAN ADMIN: Login */}
          <Route path="/admin" element={<AdminLogin />} />

          {/* HALAMAN ADMIN: Dashboard (Sudah ada proteksi login di dalamnya) */}
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}