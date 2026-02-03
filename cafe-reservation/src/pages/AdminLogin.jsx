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
    <div className="min-h-screen flex items-center justify-center bg-base-200 p-4">
      <div className="card w-full max-w-sm bg-base-100 shadow-xl border-none">
        <div className="card-body text-center">
          <div className="mb-4">
            <h1 className="text-3xl font-bold text-primary">Cafe Tropis</h1>
            <p className="text-xs opacity-60 tracking-widest uppercase mt-1">Admin Portal</p>
          </div>
          
          {error && <div className="alert alert-error text-xs py-2 rounded-lg">{error}</div>}

          <form onSubmit={handleLogin} className="space-y-3 text-left mt-2">
            <div>
              <label className="label text-xs font-bold opacity-70">Email Access</label>
              <input 
                type="email" 
                className="input input-bordered w-full bg-base-200/50 focus:bg-base-100 transition-all" 
                value={email} onChange={(e) => setEmail(e.target.value)} required 
              />
            </div>

            <div>
              <label className="label text-xs font-bold opacity-70">Security Key</label>
              <input 
                type="password" 
                className="input input-bordered w-full bg-base-200/50 focus:bg-base-100 transition-all" 
                value={password} onChange={(e) => setPassword(e.target.value)} required 
              />
            </div>

            <button type="submit" disabled={loading} className="btn btn-primary w-full mt-4 shadow-lg shadow-primary/30">
              {loading ? <span className="loading loading-dots"></span> : "Masuk Dashboard"}
            </button>
          </form>

          <a href="/" className="link link-hover text-xs text-base-content/40 mt-6">Kembali ke Menu Utama</a>
        </div>
      </div>
    </div>
  );
}