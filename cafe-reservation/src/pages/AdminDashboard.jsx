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
      <div className="bg-base-100/95 backdrop-blur border-b border-base-content/5 px-6 py-4 flex justify-between items-center sticky top-0 z-30 shadow-sm">
         <h1 className="font-extrabold text-xl tracking-tight">Admin Tropis 🌵</h1>
         <button onClick={() => auth.signOut()} className="btn btn-sm btn-error text-white font-bold rounded-lg shadow-md">LOGOUT</button>
      </div>

      <div className="max-w-6xl mx-auto p-6 pb-20">
        
        {/* TABS */}
        <div className="flex border-b border-base-content/10 mb-8">
          <button onClick={() => setActiveTab('orders')} 
            className={`flex-1 pb-4 text-center font-bold text-lg transition-all ${activeTab === 'orders' ? 'border-b-4 border-primary text-primary' : 'text-base-content/40 hover:text-base-content'}`}>
            Daftar Pesanan
          </button>
          <button onClick={() => setActiveTab('menu')} 
            className={`flex-1 pb-4 text-center font-bold text-lg transition-all ${activeTab === 'menu' ? 'border-b-4 border-primary text-primary' : 'text-base-content/40 hover:text-base-content'}`}>
            Kelola Menu
          </button>
        </div>

        {/* TAB 1: ORDERS */}
        {activeTab === 'orders' && (
          <div className="bg-base-100 rounded-3xl shadow-lg border border-base-content/5 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead className="bg-base-200 text-base-content/60 font-bold uppercase text-xs tracking-wider">
                  <tr>
                      <th className="py-4 pl-6">Waktu</th>
                      <th>Pelanggan</th>
                      <th>Meja</th>
                      <th>Pesanan & Catatan</th>
                      <th>Total</th>
                      <th className="pr-6">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {reservations.map((res) => (
                    <tr key={res.id} className="hover:bg-base-200/50 transition-colors border-b border-base-200">
                      <td className="pl-6 py-4 align-top">
                        <div className="font-extrabold text-lg">{res.time}</div>
                        <div className="text-xs opacity-50 font-bold">{res.date}</div>
                        <div className={`badge badge-sm mt-2 font-bold text-white border-none py-3 ${res.status==='confirmed'?'bg-emerald-500':res.status==='rejected'?'bg-red-500':'bg-amber-400'}`}>
                            {res.status === 'confirmed' ? 'Diterima' : res.status === 'rejected' ? 'Ditolak' : 'Baru'}
                        </div>
                      </td>
                      <td className="align-top">
                          <div className="font-bold text-base">{res.customerName}</div>
                          <div className="text-xs opacity-60 font-mono mt-1">{res.customerPhone}</div>
                      </td>
                      <td className="align-top">
                          <input className="input input-sm input-bordered w-16 text-center font-bold bg-base-200 focus:bg-white focus:w-20 transition-all" 
                              placeholder="-" defaultValue={res.tableNumber} onBlur={(e)=>handleUpdateMeja(res.id, e.target.value)} />
                      </td>
                      <td className="align-top">
                          <div className="space-y-1 mb-2">
                              {res.items?.map((i,x)=><div key={x} className="text-sm"><span className="font-bold">{i.qty}x</span> {i.name}</div>)}
                          </div>
                          {/* TAMPILKAN CATATAN JIKA ADA */}
                          {res.customerNotes && (
                              <div className="bg-amber-100 text-amber-900 p-2 rounded-lg text-xs font-medium border border-amber-200 inline-block max-w-xs">
                                  📝 {res.customerNotes}
                              </div>
                          )}
                      </td>
                      <td className="font-extrabold text-primary text-base align-top">Rp {res.totalPrice?.toLocaleString()}</td>
                      <td className="pr-6 align-top">
                          {res.status === 'pending' ? (
                              <div className="flex flex-col gap-2">
                                  <button onClick={()=>handleStatus(res.id,'confirmed')} className="btn btn-sm btn-success text-white font-bold w-full shadow-md">Terima ✓</button>
                                  <button onClick={()=>handleStatus(res.id,'rejected')} className="btn btn-sm btn-error text-white font-bold w-full shadow-md">Tolak ✕</button>
                              </div>
                          ) : (
                             <span className="opacity-30 text-xs font-bold italic">Selesai</span>
                          )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {reservations.length===0 && <div className="p-16 text-center opacity-40 font-bold">Belum ada pesanan masuk.</div>}
          </div>
        )}

        {/* TAB 2: MENU */}
        {activeTab === 'menu' && (
            <div className="animate-fade-in">
                <button onClick={()=>handleOpenModal(null)} className="btn btn-primary w-full mb-6 rounded-2xl text-white font-bold text-lg shadow-xl shadow-primary/20 h-14">+ Tambah Menu Baru</button>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {products.map((p) => (
                        <div key={p.id} className="bg-base-100 p-5 rounded-3xl border border-base-200 flex justify-between items-center shadow-sm hover:border-primary/50 transition-all">
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <h3 className="font-extrabold text-lg">{p.name}</h3>
                                    <span className={`badge badge-xs ${p.isAvailable ? 'badge-success' : 'badge-error'}`}></span>
                                </div>
                                <p className="text-xs font-bold bg-base-200 px-2 py-1 rounded-md opacity-60 inline-block mb-2">{p.category}</p>
                                <p className="text-lg font-extrabold text-primary">Rp {p.price?.toLocaleString()}</p>
                            </div>
                            <div className="flex flex-col gap-2">
                                <button onClick={()=>handleOpenModal(p)} className="btn btn-sm btn-ghost border border-base-300 rounded-xl font-bold">Edit</button>
                                <button onClick={()=>handleDeleteProduct(p.id)} className="btn btn-sm btn-ghost text-error rounded-xl font-bold">Hapus</button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}
      </div>

      {/* MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-base-100 w-full max-w-sm rounded-3xl p-8 shadow-2xl animate-scale-in">
                <h3 className="font-extrabold text-2xl mb-6 text-center">{editingProduct ? 'Edit Menu' : 'Tambah Menu'}</h3>
                <form onSubmit={handleSaveProduct} className="space-y-5">
                    <div className="form-control">
                        <label className="label text-xs font-bold uppercase opacity-60 tracking-wider">Nama Menu</label>
                        <input className="input input-bordered w-full rounded-2xl bg-base-200 font-bold focus:bg-white transition-all" required value={formData.name} onChange={e=>setFormData({...formData, name:e.target.value})} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="form-control">
                            <label className="label text-xs font-bold uppercase opacity-60 tracking-wider">Harga</label>
                            <input type="number" className="input input-bordered w-full rounded-2xl bg-base-200 font-bold" required value={formData.price} onChange={e=>setFormData({...formData, price:e.target.value})} />
                        </div>
                        <div className="form-control">
                             <label className="label text-xs font-bold uppercase opacity-60 tracking-wider">Kategori</label>
                            <select className="select select-bordered w-full rounded-2xl bg-base-200 font-bold" value={formData.category} onChange={e=>setFormData({...formData, category:e.target.value})}>
                                <option>Coffee</option><option>Non-Coffee</option><option>Food</option><option>Snack</option>
                            </select>
                        </div>
                    </div>
                    <div className="form-control bg-base-200 p-4 rounded-2xl">
                        <label className="label cursor-pointer justify-between">
                            <span className="label-text font-bold text-sm">Status: {formData.isAvailable ? 'Tersedia ✅' : 'Habis ❌'}</span>
                            <input type="checkbox" className="toggle toggle-success toggle-md" checked={formData.isAvailable} onChange={e=>setFormData({...formData, isAvailable:e.target.checked})} />
                        </label>
                    </div>
                    <div className="flex gap-3 mt-8">
                        <button type="button" onClick={()=>setIsModalOpen(false)} className="btn btn-ghost flex-1 rounded-2xl font-bold opacity-60">Batal</button>
                        <button type="submit" className="btn btn-primary flex-1 rounded-2xl text-white shadow-lg font-bold">Simpan</button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
}