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
    <div className="min-h-screen bg-base-200 font-sans text-neutral text-sm">
      {/* NAVBAR */}
      <div className="bg-base-100/95 backdrop-blur border-b border-primary/10 px-6 py-4 flex justify-between items-center sticky top-0 z-30 shadow-sm">
         <h1 className="font-black text-xl tracking-tight text-primary flex items-center gap-2"><span>🌵</span> Admin Panel</h1>
         <button onClick={() => auth.signOut()} className="btn btn-sm btn-error text-white font-bold rounded-lg shadow uppercase">Keluar</button>
      </div>

      <div className="max-w-6xl mx-auto p-6 pb-20">
        
        {/* TABS */}
        <div className="flex bg-base-100 p-1.5 rounded-2xl mb-8 shadow-sm border border-base-200">
          <button onClick={() => setActiveTab('orders')} 
            className={`flex-1 py-3 text-center font-bold text-lg rounded-xl transition-all ${activeTab === 'orders' ? 'bg-primary text-white shadow-lg' : 'text-neutral/50 hover:bg-base-200'}`}>
            📋 Daftar Pesanan
          </button>
          <button onClick={() => setActiveTab('menu')} 
            className={`flex-1 py-3 text-center font-bold text-lg rounded-xl transition-all ${activeTab === 'menu' ? 'bg-primary text-white shadow-lg' : 'text-neutral/50 hover:bg-base-200'}`}>
            🍔 Kelola Menu
          </button>
        </div>

        {/* TAB 1: ORDERS */}
        {activeTab === 'orders' && (
          <div className="bg-base-100 rounded-3xl shadow-lg border border-base-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead className="bg-base-200 text-neutral/60 font-bold uppercase text-xs tracking-wider">
                  <tr>
                      <th className="py-4 pl-6">Waktu</th>
                      <th>Pelanggan</th>
                      <th>Meja</th>
                      <th>Pesanan</th>
                      <th>Total</th>
                      <th className="pr-6">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {reservations.map((res) => (
                    <tr key={res.id} className="hover:bg-base-200/50 transition-colors border-b border-base-200">
                      <td className="pl-6 py-4 align-top">
                        <div className="font-black text-lg text-primary">{res.time}</div>
                        <div className="text-xs opacity-50 font-bold">{res.date}</div>
                        <div className={`badge badge-sm mt-2 font-bold border-none py-3 text-white ${res.status==='confirmed'?'bg-emerald-500':res.status==='rejected'?'bg-red-500':'bg-amber-400'}`}>
                            {res.status === 'confirmed' ? 'Diterima' : res.status === 'rejected' ? 'Ditolak' : 'Menunggu'}
                        </div>
                      </td>
                      <td className="align-top">
                          <div className="font-bold text-base text-neutral">{res.customerName}</div>
                          <div className="text-xs opacity-60 font-mono mt-1">{res.customerPhone}</div>
                      </td>
                      <td className="align-top">
                          <input className="input input-sm w-16 text-center font-bold bg-base-200 border-2 border-transparent focus:border-primary focus:bg-white transition-all rounded-lg" 
                              placeholder="-" defaultValue={res.tableNumber} onBlur={(e)=>handleUpdateMeja(res.id, e.target.value)} />
                      </td>
                      <td className="align-top">
                          <div className="space-y-1 mb-2">
                              {res.items?.map((i,x)=><div key={x} className="text-sm font-medium"><span className="font-bold text-primary">{i.qty}x</span> {i.name}</div>)}
                          </div>
                          {res.customerNotes && <div className="bg-amber-100 text-amber-800 p-2 rounded-lg text-xs font-bold border border-amber-200">📝 {res.customerNotes}</div>}
                      </td>
                      <td className="font-black text-primary text-base align-top">Rp {res.totalPrice?.toLocaleString()}</td>
                      <td className="pr-6 align-top">
                          {res.status === 'pending' ? (
                              <div className="flex flex-col gap-2">
                                  <button onClick={()=>handleStatus(res.id,'confirmed')} className="btn btn-sm btn-success text-white border-none font-bold w-full shadow">✔ TERIMA</button>
                                  <button onClick={()=>handleStatus(res.id,'rejected')} className="btn btn-sm btn-error text-white border-none font-bold w-full shadow">✖ TOLAK</button>
                              </div>
                          ) : <span className="opacity-30 text-xs font-bold italic">Selesai</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: MENU */}
        {activeTab === 'menu' && (
            <div className="animate-fade-in">
                <button onClick={()=>handleOpenModal(null)} className="btn btn-primary w-full mb-6 rounded-2xl text-white font-black text-lg shadow-xl shadow-primary/20 h-16 border-none hover:scale-[1.01] transition-transform">
                    + TAMBAH MENU BARU
                </button>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {products.map((p) => (
                        <div key={p.id} className="bg-base-100 p-5 rounded-3xl border border-base-200 flex justify-between items-center shadow-md hover:border-primary transition-all group">
                            <div>
                                <h3 className="font-extrabold text-lg text-neutral">{p.name}</h3>
                                <div className="flex gap-2 mt-1 mb-2">
                                    <span className={`badge badge-xs font-bold text-white ${p.isAvailable ? 'badge-success' : 'badge-error'}`}>{p.isAvailable ? 'Ready' : 'Habis'}</span>
                                    <span className="text-xs font-bold opacity-50 bg-base-200 px-2 rounded">{p.category}</span>
                                </div>
                                <p className="text-xl font-black text-primary">Rp {p.price?.toLocaleString()}</p>
                            </div>
                            <div className="flex flex-col gap-2">
                                <button onClick={()=>handleOpenModal(p)} className="btn btn-sm btn-primary text-white font-bold rounded-xl shadow border-none">EDIT ✏️</button>
                                <button onClick={()=>handleDeleteProduct(p.id)} className="btn btn-sm btn-error text-white font-bold rounded-xl shadow border-none">HAPUS 🗑️</button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}
      </div>

      {/* MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-base-100 w-full max-w-sm rounded-3xl p-8 shadow-2xl animate-scale-in border-t-8 border-primary">
                <h3 className="font-black text-2xl mb-6 text-center text-primary">{editingProduct ? 'Edit Menu' : 'Menu Baru'}</h3>
                <form onSubmit={handleSaveProduct} className="space-y-5">
                    <div className="form-control">
                        <label className="label text-xs font-bold uppercase opacity-60">Nama Menu</label>
                        <input className="input input-lg w-full rounded-2xl bg-base-200 font-bold focus:border-primary focus:bg-white" required value={formData.name} onChange={e=>setFormData({...formData, name:e.target.value})} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="form-control">
                            <label className="label text-xs font-bold uppercase opacity-60">Harga</label>
                            <input type="number" className="input input-lg w-full rounded-2xl bg-base-200 font-bold" required value={formData.price} onChange={e=>setFormData({...formData, price:e.target.value})} />
                        </div>
                        <div className="form-control">
                             <label className="label text-xs font-bold uppercase opacity-60">Kategori</label>
                            <select className="select select-lg w-full rounded-2xl bg-base-200 font-bold" value={formData.category} onChange={e=>setFormData({...formData, category:e.target.value})}>
                                <option>Coffee</option><option>Non-Coffee</option><option>Food</option><option>Snack</option>
                            </select>
                        </div>
                    </div>
                    <div className="form-control bg-base-200 p-4 rounded-2xl border border-base-300">
                        <label className="label cursor-pointer justify-between">
                            <span className="label-text font-bold text-sm">Stok Tersedia?</span>
                            <input type="checkbox" className="toggle toggle-success toggle-lg" checked={formData.isAvailable} onChange={e=>setFormData({...formData, isAvailable:e.target.checked})} />
                        </label>
                    </div>
                    <div className="flex gap-3 mt-8">
                        <button type="button" onClick={()=>setIsModalOpen(false)} className="btn btn-ghost flex-1 rounded-2xl font-bold opacity-60">Batal</button>
                        <button type="submit" className="btn btn-primary flex-1 rounded-2xl text-white shadow-lg font-black text-lg">SIMPAN</button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
}