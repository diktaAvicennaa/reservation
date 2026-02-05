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
    <div className="min-h-screen flex items-center justify-center bg-base-200 p-4 font-sans text-neutral">
      <div className="card w-full max-w-sm bg-base-100 shadow-2xl border-t-8 border-primary">
        <div className="card-body text-center p-8">
          <div className="mb-6">
            <h1 className="text-4xl font-black tracking-tight text-primary mb-1">Cafe Tropis 🌵</h1>
            <p className="text-xs uppercase tracking-[0.3em] opacity-50 font-bold">Admin Portal</p>
          </div>
          
          {error && <div className="alert alert-error text-xs font-bold text-white py-3 rounded-xl mb-4 shadow-lg">⚠️ {error}</div>}

          <form onSubmit={handleLogin} className="space-y-5 text-left">
            <div className="form-control">
              <label className="label text-xs font-bold uppercase opacity-60">Email Access</label>
              <input 
                type="email" 
                className="input input-lg input-bordered w-full bg-base-200 focus:bg-white focus:border-primary transition-all rounded-2xl font-bold" 
                value={email} onChange={(e) => setEmail(e.target.value)} required 
              />
            </div>

            <div className="form-control">
              <label className="label text-xs font-bold uppercase opacity-60">Security Key</label>
              <input 
                type="password" 
                className="input input-lg input-bordered w-full bg-base-200 focus:bg-white focus:border-primary transition-all rounded-2xl font-bold" 
                value={password} onChange={(e) => setPassword(e.target.value)} required 
              />
            </div>

            <button type="submit" disabled={loading} className="btn btn-primary w-full mt-6 rounded-2xl text-white shadow-xl font-black text-xl h-16 border-none hover:scale-[1.02] transition-all">
              {loading ? <span className="loading loading-dots"></span> : "MASUK DASHBOARD 🚀"}
            </button>
          </form>

          <a href="/" className="btn btn-link btn-xs no-underline text-neutral/40 hover:text-primary mt-6 font-bold">← Kembali ke Halaman Depan</a>
        </div>
      </div>
    </div>
  );
}