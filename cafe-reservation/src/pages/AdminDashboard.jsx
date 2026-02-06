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
  const handleDeleteReservation = async (id) => {
    if(!confirm("Yakin hapus riwayat ini?")) return;
    await deleteDoc(doc(db, "reservations", id)); fetchReservations();
  };
  const handleUpdateMeja = async (id, val) => { if(val) await updateDoc(doc(db, "reservations", id), { tableNumber: val }); };
  const handleDeleteProduct = async (id) => { if(confirm("Hapus item ini?")) { await deleteDoc(doc(db, "products", id)); fetchProducts(); }};
  
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
    <div style={{minHeight:'100vh', paddingBottom:'50px'}}>
      {/* NAVBAR */}
      <div className="navbar">
         <div className="logo">🌵 Admin Panel</div>
         <button onClick={() => auth.signOut()} className="btn btn-danger" style={{padding:'5px 10px', fontSize:'0.8em'}}>LOGOUT</button>
      </div>

      <div className="container" style={{maxWidth:'1000px'}}>
        
        {/* TABS */}
        <div className="flex mb-4">
          <button onClick={() => setActiveTab('orders')} className={`btn ${activeTab === 'orders' ? 'btn-primary' : 'btn-ghost'}`} style={{flex:1}}>
            Daftar Pesanan
          </button>
          <button onClick={() => setActiveTab('menu')} className={`btn ${activeTab === 'menu' ? 'btn-primary' : 'btn-ghost'}`} style={{flex:1}}>
            Kelola Menu
          </button>
        </div>

        {/* TAB 1: ORDERS */}
        {activeTab === 'orders' && (
          <div className="card table-container">
            <table>
                <thead>
                  <tr>
                      <th>Waktu</th>
                      <th>Pelanggan</th>
                      <th>Meja</th>
                      <th>Pesanan</th>
                      <th>Total</th>
                      <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {reservations.map((res) => (
                    <tr key={res.id}>
                      <td>
                        <div style={{fontWeight:'bold'}}>{res.time}</div>
                        <small>{res.date}</small>
                        <br/>
                        <span className={`badge ${res.status==='confirmed'?'badge-green':res.status==='rejected'?'badge-red':'badge-yellow'}`}>
                            {res.status}
                        </span>
                      </td>
                      <td>
                          <b>{res.customerName}</b><br/>
                          <small>{res.customerPhone}</small>
                      </td>
                      <td>
                          <input className="input" style={{width:'50px', padding:'5px', textAlign:'center'}}
                              defaultValue={res.tableNumber} onBlur={(e)=>handleUpdateMeja(res.id, e.target.value)} />
                      </td>
                      <td>
                          {res.items?.map((i,x)=><div key={x} style={{fontSize:'0.9em'}}><b>{i.qty}x</b> {i.name}</div>)}
                          {res.customerNotes && <div className="badge badge-yellow" style={{marginTop:'5px'}}>📝 {res.customerNotes}</div>}
                      </td>
                      <td className="text-primary font-bold">Rp {res.totalPrice?.toLocaleString()}</td>
                      <td>
                          {res.status === 'pending' ? (
                              <div className="flex flex-col gap-2">
                                  <button onClick={()=>handleStatus(res.id,'confirmed')} className="btn btn-primary" style={{padding:'5px'}}>✔ Terima</button>
                                  <button onClick={()=>handleStatus(res.id,'rejected')} className="btn btn-danger" style={{padding:'5px'}}>✖ Tolak</button>
                              </div>
                          ) : (
                              <button onClick={()=>handleDeleteReservation(res.id)} className="btn btn-ghost" style={{color:'red'}}>🗑 Hapus</button>
                          )}
                      </td>
                    </tr>
                  ))}
                </tbody>
            </table>
            {reservations.length===0 && <div className="text-center" style={{padding:'20px', color:'#999'}}>Belum ada pesanan masuk.</div>}
          </div>
        )}

        {/* TAB 2: MENU */}
        {activeTab === 'menu' && (
            <div>
                <button onClick={()=>handleOpenModal(null)} className="btn btn-primary btn-block mb-4">+ TAMBAH MENU BARU</button>
                <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(250px, 1fr))', gap:'20px'}}>
                    {products.map((p) => (
                        <div key={p.id} className="card">
                            <div>
                                <h3 style={{margin:0}}>{p.name}</h3>
                                <div className="flex mt-2 mb-2">
                                    <span className={`badge ${p.isAvailable ? 'badge-green' : 'badge-red'}`}>{p.isAvailable ? 'Ready' : 'Habis'}</span>
                                    <span className="badge badge-yellow">{p.category}</span>
                                </div>
                                <div className="text-primary font-bold">Rp {p.price?.toLocaleString()}</div>
                            </div>
                            <div className="flex mt-4">
                                <button onClick={()=>handleOpenModal(p)} className="btn btn-ghost" style={{flex:1}}>Edit</button>
                                <button onClick={()=>handleDeleteProduct(p.id)} className="btn btn-danger" style={{flex:1}}>Hapus</button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}
      </div>

      {/* MODAL */}
      {isModalOpen && (
        <div className="modal-overlay">
            <div className="modal-content">
                <h3>{editingProduct ? 'Edit Menu' : 'Menu Baru'}</h3>
                <form onSubmit={handleSaveProduct}>
                    <div className="form-group">
                        <label className="label">Nama Menu</label>
                        <input className="input" required value={formData.name} onChange={e=>setFormData({...formData, name:e.target.value})} />
                    </div>
                    <div className="form-group">
                        <label className="label">Harga</label>
                        <input type="number" className="input" required value={formData.price} onChange={e=>setFormData({...formData, price:e.target.value})} />
                    </div>
                    <div className="form-group">
                        <label className="label">Kategori</label>
                        <select className="select" value={formData.category} onChange={e=>setFormData({...formData, category:e.target.value})}>
                            <option>Coffee</option><option>Non-Coffee</option><option>Food</option><option>Snack</option>
                        </select>
                    </div>
                    <div className="form-group flex">
                        <label className="label" style={{flex:1}}>Stok Tersedia?</label>
                        <input type="checkbox" style={{width:'20px', height:'20px'}} checked={formData.isAvailable} onChange={e=>setFormData({...formData, isAvailable:e.target.checked})} />
                    </div>
                    <div className="flex mt-4">
                        <button type="button" onClick={()=>setIsModalOpen(false)} className="btn btn-ghost" style={{flex:1}}>Batal</button>
                        <button type="submit" className="btn btn-primary" style={{flex:1}}>SIMPAN</button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
}