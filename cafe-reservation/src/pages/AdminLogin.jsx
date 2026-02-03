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
    <div className="min-h-screen flex items-center justify-center bg-base-200 p-4 font-sans text-base-content">
      <div className="card w-full max-w-sm bg-base-100 shadow-xl border border-base-content/5">
        <div className="card-body text-center p-8">
          <div className="mb-6">
            <h1 className="text-3xl font-bold tracking-tight">Cafe Tropis 🌵</h1>
            <p className="text-xs uppercase tracking-widest opacity-50 mt-1 font-bold">Admin Portal</p>
          </div>
          
          {error && <div className="alert alert-error text-xs py-2 rounded-lg text-white mb-4">{error}</div>}

          <form onSubmit={handleLogin} className="space-y-4 text-left">
            <div className="form-control">
              <label className="label text-[10px] font-bold uppercase opacity-50">Email</label>
              <input 
                type="email" 
                className="input input-bordered w-full bg-base-200 focus:bg-base-100 transition-all rounded-xl" 
                value={email} onChange={(e) => setEmail(e.target.value)} required 
              />
            </div>

            <div className="form-control">
              <label className="label text-[10px] font-bold uppercase opacity-50">Password</label>
              <input 
                type="password" 
                className="input input-bordered w-full bg-base-200 focus:bg-base-100 transition-all rounded-xl" 
                value={password} onChange={(e) => setPassword(e.target.value)} required 
              />
            </div>

            <button type="submit" disabled={loading} className="btn btn-primary w-full mt-6 rounded-xl text-white shadow-lg shadow-primary/20">
              {loading ? <span className="loading loading-dots"></span> : "Masuk Dashboard"}
            </button>
          </form>

          <a href="/" className="btn btn-link btn-xs no-underline text-base-content/40 mt-6">Kembali ke Halaman Depan</a>
        </div>
      </div>
    </div>
  );
}