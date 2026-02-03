import { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import { collection, getDocs, updateDoc, doc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

export default function AdminDashboard() {
  const [reservations, setReservations] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    // Cek apakah sudah login sebagai admin
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) navigate("/admin");
    });

    fetchReservations();
    return () => unsubscribe();
  }, []);

  const fetchReservations = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "reservations"));
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Urutkan: Pesanan terbaru paling atas
      setReservations(data.sort((a, b) => b.createdAt - a.createdAt));
    } catch (error) {
      console.error("Gagal ambil data:", error);
    }
  };

  const handleStatus = async (id, status) => {
    // Update status pesanan (Terima/Tolak)
    await updateDoc(doc(db, "reservations", id), { status });
    fetchReservations(); // Refresh data
  };

  const handleUpdateMeja = async (id, nomorMeja) => {
    // Update nomor meja ke database
    if (!nomorMeja) return; // Jangan simpan kalau kosong
    try {
      await updateDoc(doc(db, "reservations", id), { tableNumber: nomorMeja });
      // Opsional: Kasih notifikasi kecil atau refresh data (tidak wajib refresh agar input tidak kedip)
      console.log("Meja disimpan:", nomorMeja);
    } catch (error) {
      console.error("Gagal simpan meja:", error);
      alert("Gagal menyimpan nomor meja");
    }
  };

  return (
    <div className="min-h-screen bg-base-200 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-base-content">Dashboard Admin</h1>
            <button onClick={() => auth.signOut()} className="btn btn-error btn-sm text-white">
              Logout
            </button>
        </div>

        <div className="overflow-x-auto bg-base-100 rounded-xl shadow-xl">
          <table className="table table-zebra w-full">
            {/* --- HEADER TABEL --- */}
            <thead className="bg-base-300 text-base-content">
              <tr>
                <th>Waktu & Status</th>
                <th>Pelanggan</th>
                <th>Lokasi/Meja</th> {/* KOLOM BARU */}
                <th>Detail Pesanan</th>
                <th>Total</th>
                <th>Aksi</th>
              </tr>
            </thead>

            {/* --- ISI TABEL --- */}
            <tbody>
              {reservations.map((res) => (
                <tr key={res.id} className="hover">
                  
                  {/* 1. Waktu & Status */}
                  <td>
                    <div className="font-bold">{res.date}</div>
                    <div className="text-xs opacity-50 mb-2">{res.time}</div>
                    <span className={`badge badge-sm ${
                        res.status === 'confirmed' ? 'badge-success text-white' : 
                        res.status === 'rejected' ? 'badge-error text-white' : 'badge-warning'
                    }`}>
                        {res.status === 'confirmed' ? 'Diterima' : 
                         res.status === 'rejected' ? 'Ditolak' : 'Menunggu'}
                    </span>
                  </td>

                  {/* 2. Pelanggan */}
                  <td>
                    <div className="font-bold">{res.customerName}</div>
                    <div className="text-xs opacity-50">{res.customerPhone}</div>
                  </td>

                  {/* 3. INPUT NOMOR MEJA (FITUR BARU) */}
                  <td>
                    <input 
                      type="text" 
                      placeholder="Ketik Meja..." 
                      className="input input-bordered input-sm w-24 border-primary/50 focus:border-primary"
                      defaultValue={res.tableNumber || ""} 
                      onBlur={(e) => handleUpdateMeja(res.id, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleUpdateMeja(res.id, e.target.value);
                          e.target.blur(); // Hilangkan fokus setelah Enter
                        }
                      }}
                    />
                    <div className="text-[10px] opacity-50 mt-1 italic">Enter/Klik luar utk simpan</div>
                  </td>

                  {/* 4. Detail Pesanan */}
                  <td>
                    <ul className="text-xs space-y-1">
                        {res.items?.map((item, idx) => (
                            <li key={idx}>• {item.name} <span className="font-bold">x{item.qty}</span></li>
                        ))}
                    </ul>
                  </td>

                  {/* 5. Total Harga */}
                  <td className="font-bold text-primary">
                    Rp {res.totalPrice?.toLocaleString()}
                  </td>

                  {/* 6. Tombol Aksi */}
                  <td>
                    <div className="flex flex-col gap-2">
                      {res.status === 'pending' && (
                        <>
                          <button onClick={() => handleStatus(res.id, 'confirmed')} className="btn btn-xs btn-success text-white">
                            ✔ Terima
                          </button>
                          <button onClick={() => handleStatus(res.id, 'rejected')} className="btn btn-xs btn-error text-white">
                            ✖ Tolak
                          </button>
                        </>
                      )}
                      {res.status === 'confirmed' && (
                        <button className="btn btn-xs btn-disabled btn-outline">Sudah Diterima</button>
                      )}
                      {res.status === 'rejected' && (
                        <button className="btn btn-xs btn-disabled btn-outline">Dibatalkan</button>
                      )}
                    </div>
                  </td>

                </tr>
              ))}
            </tbody>
          </table>
          
          {reservations.length === 0 && (
            <div className="text-center py-10 opacity-50">Belum ada pesanan masuk.</div>
          )}
        </div>
      </div>
    </div>
  );
}