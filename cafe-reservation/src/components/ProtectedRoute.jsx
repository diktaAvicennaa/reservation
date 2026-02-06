import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { auth } from "../firebase";

export default function ProtectedRoute({ element }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return <div className="full-screen-center"><p>Mengecek izin akses...</p></div>;
  }

  if (!user) {
    return <Navigate to="/admin" replace />;
  }

  return element;
}
