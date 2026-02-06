import { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import { collection, getDocs, updateDoc, doc, deleteDoc, addDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("orders");
  const [reservations, setReservations] = useState([]);
  const [products, setProducts] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({ name: "", price: "", category: "Coffee", isAvailable: true });

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => { if (!user) navigate("/admin"); });
    fetchReservations();
    fetchProducts();
    return () => unsubscribe();
  }, []);

  const fetchReservations = async () => {
    const s = await getDocs(collection(db, "reservations"));
    setReservations(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.createdAt - a.createdAt));
  };
  
  const fetchProducts = async () => {
    const s = await getDocs(collection(db, "products"));
    setProducts(s.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const handleStatus = async (id, status) => { await updateDoc(doc(db, "reservations", id), { status }); fetchReservations(); };
  const handleUpdateMeja = async (id, val) => { if(val) await updateDoc(doc(db, "reservations", id), { tableNumber: val }); };
  const handleDeleteReservation = async (id) => { if(confirm("Hapus pesanan ini?")) { await deleteDoc(doc(db, "reservations", id)); fetchReservations(); }};
  
  const handleSaveProduct = async (e) => {
    e.preventDefault();
    const payload = { name: formData.name, price: Number(formData.price), category: formData.category, isAvailable: formData.isAvailable };
    if (editingProduct) await updateDoc(doc(db, "products", editingProduct.id), payload);
    else await addDoc(collection(db, "products"), payload);
    setIsModalOpen(false); fetchProducts();
  };

  const handleOpenModal = (p) => {
    setEditingProduct(p);
    setFormData(p ? { name: p.name, price: p.price, category: p.category, isAvailable: p.isAvailable } : { name: "", price: "", category: "Coffee", isAvailable: true });
    setIsModalOpen(true);
  };

  return (
    <div className="admin-container">
      <div className="admin-navbar">
         <h1><span>🌵</span> Admin Panel</h1>
         <button onClick={() => auth.signOut()} className="btn btn-danger">Keluar</button>
      </div>

      <div className="admin-content">
        <div className="tabs">
          <button onClick={() => setActiveTab('orders')} className={activeTab === 'orders' ? 'active' : ''}> Pesanan</button>
          <button onClick={() => setActiveTab('menu')} className={activeTab === 'menu' ? 'active' : ''}> Menu</button>
        </div>

        {activeTab === 'orders' && (
          <div className="table-container no-border">
            <table className="clean-table">
              <thead>
                <tr>
                  <th className="force-nowrap">Waktu</th>
                  <th className="table-center">Pelanggan</th>
                  <th className="table-center">Meja</th>
                  <th>Pesanan</th>
                  <th className="price-column force-nowrap">Total</th>
                  <th className="table-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {reservations.map((res) => (
                  <tr key={res.id}>
                    <td className="force-nowrap">
                      <div style={{fontWeight:'bold'}}>{res.time}</div>
                      <small>{res.date}</small>
                      <br/>
                      <span className={`badge ${res.status==='confirmed'?'badge-green':res.status==='rejected'?'badge-red':'badge-yellow'}`}>
                          {res.status}
                      </span>
                    </td>
                    <td className="table-center force-nowrap">
                        <b>{res.customerName}</b><br/>
                        <small>{res.customerPhone}</small>
                    </td>
                    <td className="table-center">
                        <input className="input-meja" defaultValue={res.tableNumber} onBlur={(e)=>handleUpdateMeja(res.id, e.target.value)} />
                    </td>
                    <td>
                        {res.items?.map((i,x)=><div key={x} className="force-nowrap"><b>{i.qty}x</b> {i.name}</div>)}
                        {res.customerNotes && <div className="badge badge-yellow" style={{marginTop:'5px'}}>📝 {res.customerNotes}</div>}
                    </td>
                    <td className="price-column force-nowrap">Rp {res.totalPrice?.toLocaleString()}</td>
                    <td className=" table-center force-nowrap">
                        {res.status === 'pending' ? (
                            <div className="flex flex-col gap-2">
                                <button onClick={()=>handleStatus(res.id,'confirmed')} className="btn btn-primary btn-sm">✔ Terima</button>
                                <button onClick={()=>handleStatus(res.id,'rejected')} className="btn btn-danger btn-sm">✖ Tolak</button>
                            </div>
                        ) : (
                            <button onClick={()=>handleDeleteReservation(res.id)} className="btn btn-ghost" style={{color:'red'}}>🗑 Hapus</button>
                        )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {reservations.length===0 && <div className="empty-state">Belum ada pesanan masuk.</div>}
          </div>
        )}
      </div>
    </div>
  );
}