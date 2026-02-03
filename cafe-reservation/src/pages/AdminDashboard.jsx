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
    <div className="min-h-screen bg-base-200 font-sans text-base-content text-sm">
      {/* NAVBAR */}
      <div className="bg-base-100/90 backdrop-blur border-b border-base-content/5 px-4 py-3 flex justify-between items-center sticky top-0 z-30">
         <h1 className="font-bold text-lg tracking-tight">Admin Tropis 🌵</h1>
         <button onClick={() => auth.signOut()} className="btn btn-xs btn-ghost text-error font-bold">LOGOUT</button>
      </div>

      <div className="max-w-5xl mx-auto p-4 pb-20">
        
        {/* TABS (Teks Saja, Lebih Bersih) */}
        <div className="flex border-b border-base-content/10 mb-6">
          <button onClick={() => setActiveTab('orders')} 
            className={`flex-1 pb-3 text-center font-bold transition-all ${activeTab === 'orders' ? 'border-b-2 border-primary text-primary' : 'text-base-content/40 hover:text-base-content'}`}>
            Daftar Pesanan
          </button>
          <button onClick={() => setActiveTab('menu')} 
            className={`flex-1 pb-3 text-center font-bold transition-all ${activeTab === 'menu' ? 'border-b-2 border-primary text-primary' : 'text-base-content/40 hover:text-base-content'}`}>
            Kelola Menu
          </button>
        </div>

        {/* TAB 1: ORDERS */}
        {activeTab === 'orders' && (
          <div className="bg-base-100 rounded-2xl shadow-sm border border-base-content/5 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="table table-sm w-full whitespace-nowrap">
                <thead className="bg-base-200 text-base-content/60 font-bold uppercase text-[10px] tracking-wider">
                  <tr><th>Jam</th><th>Pelanggan</th><th>Meja</th><th>Pesanan</th><th>Total</th><th>Aksi</th></tr>
                </thead>
                <tbody>
                  {reservations.map((res) => (
                    <tr key={res.id} className="hover:bg-base-200/50">
                      <td>
                        <div className="font-bold">{res.time}</div>
                        <div className="text-[10px] opacity-50">{res.date}</div>
                        <div className={`badge badge-xs mt-1 font-bold ${res.status==='confirmed'?'badge-success text-white':res.status==='rejected'?'badge-error text-white':'badge-warning'}`}>
                            {res.status === 'confirmed' ? 'Diterima' : res.status === 'rejected' ? 'Ditolak' : 'Baru'}
                        </div>
                      </td>
                      <td>
                          <div className="font-bold">{res.customerName}</div>
                          <div className="text-[10px] opacity-60 font-mono">{res.customerPhone}</div>
                      </td>
                      <td>
                          <input className="input input-xs input-bordered w-14 text-center bg-base-200 focus:bg-base-100" 
                              placeholder="-" defaultValue={res.tableNumber} onBlur={(e)=>handleUpdateMeja(res.id, e.target.value)} />
                      </td>
                      <td>
                          <div className="text-xs space-y-1">
                              {res.items?.map((i,x)=><div key={x}><span className="font-bold">{i.qty}x</span> {i.name}</div>)}
                          </div>
                      </td>
                      <td className="font-bold text-primary">Rp {res.totalPrice?.toLocaleString()}</td>
                      <td>
                          {res.status === 'pending' && (
                              <div className="flex gap-1">
                                  <button onClick={()=>handleStatus(res.id,'confirmed')} className="btn btn-xs btn-success text-white">Terima</button>
                                  <button onClick={()=>handleStatus(res.id,'rejected')} className="btn btn-xs btn-error text-white">Tolak</button>
                              </div>
                          )}
                          {res.status !== 'pending' && <span className="opacity-30 text-xs italic">Selesai</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {reservations.length===0 && <div className="p-10 text-center opacity-40 text-xs">Belum ada pesanan masuk.</div>}
          </div>
        )}

        {/* TAB 2: MENU */}
        {activeTab === 'menu' && (
            <div className="animate-fade-in">
                <button onClick={()=>handleOpenModal(null)} className="btn btn-primary btn-sm w-full mb-4 rounded-xl text-white font-bold shadow-lg shadow-primary/20">+ Tambah Menu Baru</button>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {products.map((p) => (
                        <div key={p.id} className="bg-base-100 p-4 rounded-xl border border-base-content/5 flex justify-between items-center shadow-sm">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <h3 className="font-bold text-lg">{p.name}</h3>
                                    <span className={`badge badge-xs ${p.isAvailable ? 'badge-success' : 'badge-error'}`}></span>
                                </div>
                                <p className="text-xs opacity-50 mb-1">{p.category}</p>
                                <p className="text-sm font-bold text-primary">Rp {p.price?.toLocaleString()}</p>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={()=>handleOpenModal(p)} className="btn btn-sm btn-ghost border border-base-300 rounded-lg">Edit</button>
                                <button onClick={()=>handleDeleteProduct(p.id)} className="btn btn-sm btn-ghost text-error rounded-lg">Hapus</button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}
      </div>

      {/* MODAL EDIT/TAMBAH */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-base-100 w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-scale-in">
                <h3 className="font-bold text-xl mb-6 text-center">{editingProduct ? 'Edit Menu' : 'Tambah Menu'}</h3>
                <form onSubmit={handleSaveProduct} className="space-y-4">
                    <div className="form-control">
                        <label className="label text-[10px] font-bold uppercase opacity-50">Nama Menu</label>
                        <input className="input input-bordered w-full rounded-xl bg-base-200" required value={formData.name} onChange={e=>setFormData({...formData, name:e.target.value})} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="form-control">
                            <label className="label text-[10px] font-bold uppercase opacity-50">Harga</label>
                            <input type="number" className="input input-bordered w-full rounded-xl bg-base-200" required value={formData.price} onChange={e=>setFormData({...formData, price:e.target.value})} />
                        </div>
                        <div className="form-control">
                             <label className="label text-[10px] font-bold uppercase opacity-50">Kategori</label>
                            <select className="select select-bordered w-full rounded-xl bg-base-200" value={formData.category} onChange={e=>setFormData({...formData, category:e.target.value})}>
                                <option>Coffee</option><option>Non-Coffee</option><option>Food</option><option>Snack</option>
                            </select>
                        </div>
                    </div>
                    <div className="form-control bg-base-200 p-3 rounded-xl">
                        <label className="label cursor-pointer justify-between">
                            <span className="label-text font-bold text-sm">Status: {formData.isAvailable ? 'Tersedia ✅' : 'Habis ❌'}</span>
                            <input type="checkbox" className="toggle toggle-success toggle-sm" checked={formData.isAvailable} onChange={e=>setFormData({...formData, isAvailable:e.target.checked})} />
                        </label>
                    </div>
                    <div className="flex gap-3 mt-6">
                        <button type="button" onClick={()=>setIsModalOpen(false)} className="btn btn-ghost flex-1 rounded-xl">Batal</button>
                        <button type="submit" className="btn btn-primary flex-1 rounded-xl text-white shadow-lg">Simpan</button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
}