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
  const handleDeleteProduct = async (id) => { if(confirm("Hapus?")) { await deleteDoc(doc(db, "products", id)); fetchProducts(); }};
  
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
    <div className="min-h-screen bg-base-200 font-sans">
      {/* NAVBAR DASHBOARD */}
      <div className="bg-base-100 border-b border-base-300 px-6 py-4 flex justify-between items-center sticky top-0 z-30">
         <h1 className="text-xl font-bold tracking-tight">Admin<span className="text-primary">Panel</span></h1>
         <div className="flex gap-4">
            <div className="join bg-base-200 p-1 rounded-lg">
                <button onClick={() => setActiveTab('orders')} className={`join-item btn btn-sm border-none ${activeTab==='orders' ? 'bg-base-100 shadow-sm' : 'btn-ghost'}`}>Pesanan</button>
                <button onClick={() => setActiveTab('menu')} className={`join-item btn btn-sm border-none ${activeTab==='menu' ? 'bg-base-100 shadow-sm' : 'btn-ghost'}`}>Menu</button>
            </div>
            <button onClick={() => auth.signOut()} className="btn btn-sm btn-circle btn-ghost text-error">✕</button>
         </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {/* TAB 1: ORDERS */}
        {activeTab === 'orders' && (
          <div className="overflow-hidden rounded-2xl shadow-sm bg-base-100 border border-base-300">
            <table className="table w-full">
              <thead className="bg-base-200/50 text-base-content/60 uppercase text-[10px] tracking-wider">
                <tr><th>Waktu</th><th>Pelanggan</th><th>Meja</th><th>Order</th><th>Total</th><th>Aksi</th></tr>
              </thead>
              <tbody>
                {reservations.map((res) => (
                  <tr key={res.id} className="hover:bg-base-200/30 transition-colors">
                    <td>
                      <div className="font-bold text-sm">{res.date}</div>
                      <div className="text-xs opacity-50">{res.time}</div>
                      <div className={`badge badge-xs mt-1 ${res.status==='confirmed'?'badge-success':res.status==='rejected'?'badge-error':'badge-warning'}`}>{res.status}</div>
                    </td>
                    <td>
                        <div className="font-bold">{res.customerName}</div>
                        <div className="text-xs opacity-60 font-mono">{res.customerPhone}</div>
                    </td>
                    <td>
                        <input className="input input-xs bg-base-200 rounded w-16 text-center focus:bg-base-100 focus:w-24 transition-all" 
                            placeholder="-" defaultValue={res.tableNumber} onBlur={(e)=>handleUpdateMeja(res.id, e.target.value)} />
                    </td>
                    <td>
                        <div className="text-xs space-y-1">
                            {res.items?.map((i,x)=><div key={x}><span className="font-bold">{i.qty}x</span> {i.name}</div>)}
                        </div>
                    </td>
                    <td className="font-bold text-primary">Rp {res.totalPrice?.toLocaleString()}</td>
                    <td>
                        {res.status === 'pending' && <div className="flex gap-1"><button onClick={()=>handleStatus(res.id,'confirmed')} className="btn btn-xs btn-square btn-success text-white">✓</button><button onClick={()=>handleStatus(res.id,'rejected')} className="btn btn-xs btn-square btn-error text-white">✕</button></div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {reservations.length===0 && <div className="p-10 text-center opacity-50">Belum ada pesanan.</div>}
          </div>
        )}

        {/* TAB 2: MENU */}
        {activeTab === 'menu' && (
            <div>
                <button onClick={()=>handleOpenModal(null)} className="btn btn-primary btn-sm mb-6 rounded-lg shadow-lg shadow-primary/20">+ Tambah Menu</button>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {products.map((p) => (
                        <div key={p.id} className="bg-base-100 p-4 rounded-2xl border border-base-200 hover:border-primary/30 transition-all shadow-sm group">
                            <div className="flex justify-between items-start mb-2">
                                <div className={`badge badge-xs ${p.isAvailable?'badge-success':'badge-error'} badge-outline`}>{p.isAvailable?'Ready':'Habis'}</div>
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                    <button onClick={()=>handleOpenModal(p)} className="btn btn-xs btn-square btn-ghost">✎</button>
                                    <button onClick={()=>handleDeleteProduct(p.id)} className="btn btn-xs btn-square btn-ghost text-error">🗑</button>
                                </div>
                            </div>
                            <h3 className="font-bold truncate">{p.name}</h3>
                            <p className="text-xs opacity-50 mb-3">{p.category}</p>
                            <p className="font-bold text-primary">Rp {p.price?.toLocaleString()}</p>
                        </div>
                    ))}
                </div>
            </div>
        )}
      </div>

      {/* MODAL (MINIMALIS) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-base-100 w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-fade-in">
                <h3 className="text-lg font-bold mb-4">{editingProduct ? 'Edit Menu' : 'Menu Baru'}</h3>
                <form onSubmit={handleSaveProduct} className="space-y-3">
                    <input className="input input-bordered w-full rounded-xl bg-base-200/50" placeholder="Nama Menu" required value={formData.name} onChange={e=>setFormData({...formData, name:e.target.value})} />
                    <div className="grid grid-cols-2 gap-3">
                        <input type="number" className="input input-bordered w-full rounded-xl bg-base-200/50" placeholder="Harga" required value={formData.price} onChange={e=>setFormData({...formData, price:e.target.value})} />
                        <select className="select select-bordered w-full rounded-xl bg-base-200/50" value={formData.category} onChange={e=>setFormData({...formData, category:e.target.value})}>
                            <option>Coffee</option><option>Non-Coffee</option><option>Food</option><option>Snack</option>
                        </select>
                    </div>
                    <div className="form-control">
                        <label className="label cursor-pointer justify-start gap-3">
                            <input type="checkbox" className="toggle toggle-success toggle-sm" checked={formData.isAvailable} onChange={e=>setFormData({...formData, isAvailable:e.target.checked})} />
                            <span className="label-text text-xs">{formData.isAvailable ? 'Stok Tersedia' : 'Stok Habis'}</span>
                        </label>
                    </div>
                    <div className="flex gap-2 mt-4">
                        <button type="button" onClick={()=>setIsModalOpen(false)} className="btn btn-ghost flex-1 rounded-xl">Batal</button>
                        <button type="submit" className="btn btn-primary flex-1 rounded-xl shadow-lg shadow-primary/20">Simpan</button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
}