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
    <div className="full-screen-center">
      <div className="card" style={{width: '100%', maxWidth: '350px', textAlign: 'center'}}>
          <h1 className="text-primary" style={{margin:'0 0 20px 0'}}>🌵 Cafe Tropis</h1>
          <p style={{marginBottom: '30px', color:'#666'}}>Admin Portal</p>
          
          {error && <div className="badge badge-red mb-4" style={{display:'block', padding:'10px'}}>{error}</div>}

          <form onSubmit={handleLogin} style={{textAlign: 'left'}}>
            <div className="form-group">
              <label className="label">Email Access</label>
              <input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>

            <div className="form-group">
              <label className="label">Security Key</label>
              <input type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>

            <button type="submit" disabled={loading} className="btn btn-primary btn-block mt-4">
              {loading ? "Loading..." : "MASUK DASHBOARD 🚀"}
            </button>
          </form>

          <a href="/" style={{display:'block', marginTop:'20px', textDecoration:'none', color:'#888', fontSize:'0.9em'}}>← Kembali ke Depan</a>
      </div>
    </div>
  );
}