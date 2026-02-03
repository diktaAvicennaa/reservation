import { useState } from "react";
import { auth } from "../firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useNavigate } from "react-router-dom";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/admin/dashboard");
    } catch (err) {
      setError("Email atau Password salah!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-100 via-green-50 to-emerald-50 p-4">
      <div className="card w-full max-w-sm bg-white shadow-2xl border-2 border-emerald-100">
        <div className="card-body text-center p-4 sm:p-6">
          <div className="mb-4 sm:mb-6">
            <div className="w-14 sm:w-16 h-14 sm:h-16 bg-gradient-to-br from-emerald-600 to-green-600 rounded-full flex items-center justify-center text-2xl sm:text-3xl mx-auto mb-3 sm:mb-4 shadow-lg">🌿</div>
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-emerald-700 to-green-600 bg-clip-text text-transparent">Cafe Tropis</h1>
            <p className="text-xs text-emerald-600 tracking-widest uppercase mt-1 font-bold">Admin Portal</p>
          </div>
          
          {error && <div className="alert bg-red-50 text-red-600 border-2 border-red-200 text-sm py-2 sm:py-3 rounded-lg sm:rounded-xl">{error}</div>}

          <form onSubmit={handleLogin} className="space-y-3 sm:space-y-4 text-left mt-2 sm:mt-4">
            <div>
              <label className="label text-xs font-bold text-emerald-700 uppercase py-1 sm:py-2 px-0">🔐 Email Access</label>
              <input 
                type="email" 
                className="input input-sm sm:input-md bg-emerald-50 border-2 border-emerald-200 focus:border-emerald-500 focus:bg-white transition-all text-emerald-900 text-sm sm:text-base rounded-lg sm:rounded-xl" 
                value={email} onChange={(e) => setEmail(e.target.value)} required 
              />
            </div>

            <div>
              <label className="label text-xs font-bold text-emerald-700 uppercase py-1 sm:py-2 px-0">🔑 Security Key</label>
              <input 
                type="password" 
                className="input input-sm sm:input-md bg-emerald-50 border-2 border-emerald-200 focus:border-emerald-500 focus:bg-white transition-all text-emerald-900 text-sm sm:text-base rounded-lg sm:rounded-xl" 
                value={password} onChange={(e) => setPassword(e.target.value)} required 
              />
            </div>

            <button type="submit" disabled={loading} className="btn btn-sm sm:btn-md w-full mt-3 sm:mt-4 shadow-xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white border-none text-xs sm:text-base">
              {loading ? <span className="loading loading-dots loading-xs sm:loading-sm"></span> : "Masuk Dashboard →"}
            </button>
          </form>

          <a href="/" className="link link-hover text-xs sm:text-sm text-emerald-600 hover:text-emerald-700 mt-4 sm:mt-6 font-medium">← Kembali ke Menu Utama</a>
        </div>
      </div>
    </div>
  );
}