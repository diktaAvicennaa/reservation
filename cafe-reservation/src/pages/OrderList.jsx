import { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, getDocs } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

export default function OrderList() {
  const navigate = useNavigate();
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchReservations();
  }, []);

  const fetchReservations = async () => {
    try {
      setLoading(true);
      const s = await getDocs(collection(db, "reservations"));
      const data = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      setReservations(data);
      console.log("Data pesanan:", data);
    } catch (err) {
      console.error("Error fetching reservations:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-container">
      {/* NAVBAR */}
      <div className="admin-navbar">
        <h1><span>🌵</span> Daftar Pesanan - Cafe Tropis</h1>
        <button onClick={() => navigate("/")} className="btn btn-ghost">← Kembali</button>
      </div>

      <div className="admin-content">
        {/* LOADING STATE */}
        {loading && (
          <div className="text-center" style={{padding:'40px', color:'#999'}}>
            <p>⏳ Sedang memuat pesanan...</p>
          </div>
        )}

        {/* ERROR STATE */}
        {error && (
          <div className="card" style={{background:'#fee2e2', border:'1px solid #fca5a5', color:'#991b1b', padding:'20px'}}>
            <p>❌ Error: {error}</p>
            <button onClick={fetchReservations} className="btn btn-primary mt-2">Coba Lagi</button>
          </div>
        )}

        {/* DAFTAR PESANAN READ-ONLY */}
        {!loading && !error && (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th className="force-nowrap">Waktu</th>
                  <th className="table-center">Pelanggan</th>
                  <th className="table-center">Meja</th>
                  <th>Pesanan</th>
                  <th className="price-column">Total</th>
                  <th className="table-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {reservations.map((res) => (
                  <tr key={res.id}>
                    <td className="force-nowrap">
                      <div style={{fontWeight:'bold'}}>{res.time}</div>
                      <small>{res.date}</small>
                    </td>
                    <td className="table-center force-nowrap">
                      <b>{res.customerName}</b><br/>
                      <small>{res.customerPhone}</small>
                    </td>
                    <td className="table-center">
                      <b>{res.tableNumber || '-'}</b>
                    </td>
                    <td>
                      {res.items?.map((i,x)=><div key={x} className="force-nowrap"><b>{i.qty}x</b> {i.name}</div>)}
                      {res.customerNotes && <div className="badge badge-yellow" style={{marginTop:'5px'}}>📝 {res.customerNotes}</div>}
                    </td>
                    <td className="price-column">Rp {res.totalPrice?.toLocaleString()}</td>
                    <td className="table-center">
                      <span className={`badge ${res.status==='confirmed'?'badge-green':res.status==='rejected'?'badge-red':'badge-yellow'}`}>
                        {res.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {reservations.length === 0 && <div className="empty-state">Belum ada pesanan masuk.</div>}
          </div>
        )}
      </div>
    </div>
  );
}
