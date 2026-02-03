import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";
import { useNavigate } from "react-router-dom";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(""); // Reset error lama
    
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Jika sukses, arahkan ke dashboard
      navigate("/admin/dashboard");
    } catch (err) {
      console.error("Login failed:", err);
      setError("Email atau password salah!");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-base-200">
      <div className="card w-96 bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title justify-center mb-4">Login Admin</h2>
          
          {error && <div className="alert alert-error text-sm p-2 mb-2">{error}</div>}
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="form-control">
              <label className="label"><span className="label-text">Email</span></label>
              <input 
                type="email" 
                placeholder="admin@cafe.com" 
                className="input input-bordered"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            
            <div className="form-control">
              <label className="label"><span className="label-text">Password</span></label>
              <input 
                type="password" 
                placeholder="********" 
                className="input input-bordered" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="card-actions justify-end mt-4">
              <button type="submit" className="btn btn-primary w-full">Masuk</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}