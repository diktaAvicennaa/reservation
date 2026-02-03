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
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-green-50 font-sans">
      {/* NAVBAR DASHBOARD - RESPONSIVE */}
      <div className="bg-gradient-to-r from-emerald-700 to-green-600 shadow-lg px-4 sm:px-6 py-3 sm:py-5 flex justify-between items-center sticky top-0 z-30 gap-2">
         <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-9 sm:w-10 h-9 sm:h-10 bg-white/20 rounded-full flex items-center justify-center text-lg sm:text-2xl flex-shrink-0">🌿</div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-xl font-bold tracking-tight text-white truncate">Admin<span className="text-emerald-200">Panel</span></h1>
              <p className="text-xs text-emerald-100 hidden sm:block">Cafe Tropis</p>
            </div>
         </div>
         <div className="flex gap-2 sm:gap-4 flex-shrink-0">
            <div className="join bg-white/10 p-0.5 sm:p-1 rounded-lg backdrop-blur-md">
                <button onClick={() => setActiveTab('orders')} className={`join-item btn btn-xs sm:btn-sm border-none text-xs sm:text-base ${activeTab==='orders' ? 'bg-white text-emerald-700 shadow-sm' : 'bg-transparent text-white hover:bg-white/20'}`}>📋 Orders</button>
                <button onClick={() => setActiveTab('menu')} className={`join-item btn btn-xs sm:btn-sm border-none text-xs sm:text-base ${activeTab==='menu' ? 'bg-white text-emerald-700 shadow-sm' : 'bg-transparent text-white hover:bg-white/20'}`}>🍽️ Menu</button>
            </div>
            <button onClick={() => auth.signOut()} className="btn btn-circle btn-xs sm:btn-sm bg-white/20 hover:bg-white/30 border-white/30 text-white text-xs sm:text-base">✕</button>
         </div>
      </div>

      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        {/* TAB 1: ORDERS */}
        {activeTab === 'orders' && (
          <div className="overflow-x-auto rounded-xl sm:rounded-2xl shadow-xl bg-white border-2 border-emerald-100">
            <table className="table table-compact sm:table-normal w-full text-xs sm:text-base">
              <thead className="bg-gradient-to-r from-emerald-100 to-green-100 text-emerald-800 uppercase text-[9px] sm:text-[10px] tracking-wider">
                <tr><th className="px-1 sm:px-3 py-2">⏰</th><th className="px-1 sm:px-3 py-2">👤</th><th className="px-1 sm:px-3 py-2">🪑</th><th className="px-1 sm:px-3 py-2">🍽️</th><th className="px-1 sm:px-3 py-2">💰</th><th className="px-1 sm:px-3 py-2">⚡</th></tr>
              </thead>
              <tbody>
                {reservations.map((res) => (
                  <tr key={res.id} className="hover:bg-emerald-50/50 transition-colors border-b border-emerald-50 text-xs sm:text-sm">
                    <td className="px-1 sm:px-3 py-2 sm:py-3">
                      <div className="font-bold text-xs sm:text-sm text-emerald-800">{res.date}</div>
                      <div className="text-xs text-gray-600">{res.time}</div>
                      <div className={`badge badge-xs mt-1 ${res.status==='confirmed'?'bg-emerald-100 text-emerald-700 border-emerald-200':res.status==='rejected'?'bg-red-100 text-red-700 border-red-200':'bg-amber-100 text-amber-700 border-amber-200'}`}>{res.status}</div>
                    </td>
                    <td className="px-1 sm:px-3 py-2 sm:py-3">
                        <div className="font-bold text-xs sm:text-sm text-gray-800 truncate">{res.customerName}</div>
                        <div className="text-xs text-gray-600 font-mono truncate">{res.customerPhone}</div>
                    </td>
                    <td className="px-1 sm:px-3 py-2 sm:py-3">
                        <input className="input input-xs bg-emerald-50 border-emerald-200 rounded text-center focus:bg-white focus:border-emerald-500 w-12 sm:w-16 text-xs sm:text-sm" 
                            placeholder="-" defaultValue={res.tableNumber} onBlur={(e)=>handleUpdateMeja(res.id, e.target.value)} />
                    </td>
                    <td className="px-1 sm:px-3 py-2 sm:py-3">
                        <div className="text-xs space-y-0.5">
                            {res.items?.slice(0,2).map((i,x)=><div key={x} className="truncate"><span className="font-bold text-emerald-700">{i.qty}x</span> {i.name}</div>)}
                            {res.items?.length > 2 && <div className="text-emerald-600 text-xs">+{res.items.length - 2} lagi</div>}
                        </div>
                    </td>
                    <td className="px-1 sm:px-3 py-2 sm:py-3 font-bold text-emerald-700 text-xs sm:text-sm whitespace-nowrap">Rp {res.totalPrice?.toLocaleString()}</td>
                    <td className="px-1 sm:px-3 py-2 sm:py-3">
                        {res.status === 'pending' && <div className="flex gap-0.5 sm:gap-1"><button onClick={()=>handleStatus(res.id,'confirmed')} className="btn btn-xs bg-emerald-600 hover:bg-emerald-700 text-white border-none text-xs">✓</button><button onClick={()=>handleStatus(res.id,'rejected')} className="btn btn-xs bg-red-500 hover:bg-red-600 text-white border-none text-xs">✕</button></div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {reservations.length===0 && <div className="p-4 sm:p-10 text-center text-gray-500 text-sm">Belum ada pesanan.</div>}
          </div>
        )}

        {/* TAB 2: MENU */}
        {activeTab === 'menu' && (
            <div>
                <button onClick={()=>handleOpenModal(null)} className="btn btn-xs sm:btn-sm mb-4 sm:mb-6 rounded-lg sm:rounded-xl shadow-lg bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white border-none text-xs sm:text-base">+ Tambah Menu Baru</button>
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
                    {products.map((p) => (
                        <div key={p.id} className="bg-white p-3 sm:p-5 rounded-lg sm:rounded-2xl border-2 border-emerald-100 hover:border-emerald-400 transition-all shadow-md group">
                            <div className="flex justify-between items-start mb-2 sm:mb-3">
                                <div className={`badge badge-xs text-xs sm:text-xs ${p.isAvailable?'bg-emerald-100 text-emerald-700 border-emerald-200':'bg-red-100 text-red-700 border-red-200'}`}>{p.isAvailable?'✓':'✕'}</div>
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                    <button onClick={()=>handleOpenModal(p)} className="btn btn-xs bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700 rounded-lg">✎</button>
                                    <button onClick={()=>handleDeleteProduct(p.id)} className="btn btn-xs bg-red-50 hover:bg-red-100 border-red-200 text-red-600 rounded-lg">🗑</button>
                                </div>
                            </div>
                            <h3 className="font-bold truncate text-gray-800 text-sm sm:text-lg">{p.name}</h3>
                            <p className="text-xs text-emerald-600 font-semibold mb-2 sm:mb-3 truncate">{p.category}</p>
                            <p className="font-bold text-emerald-700 text-xs sm:text-base">Rp {p.price?.toLocaleString()}</p>
                        </div>
                    ))}
                </div>
            </div>
        )}
      </div>

      {/* MODAL (MINIMALIS) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-sm rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xl animate-fade-in border-2 border-emerald-100">
                <h3 className="text-lg sm:text-xl font-bold mb-4 sm:mb-5 bg-gradient-to-r from-emerald-700 to-green-600 bg-clip-text text-transparent">{editingProduct ? '✏️ Edit Menu' : '➕ Menu Baru'}</h3>
                <form onSubmit={handleSaveProduct} className="space-y-3 sm:space-y-4">
                    <input className="input input-sm sm:input-md w-full rounded-lg sm:rounded-xl bg-emerald-50 border-2 border-emerald-200 focus:border-emerald-500 text-emerald-900 text-sm sm:text-base" placeholder="Nama Menu" required value={formData.name} onChange={e=>setFormData({...formData, name:e.target.value})} />
                    <div className="grid grid-cols-2 gap-2 sm:gap-3">
                        <input type="number" className="input input-sm sm:input-md w-full rounded-lg sm:rounded-xl bg-emerald-50 border-2 border-emerald-200 focus:border-emerald-500 text-emerald-900 text-sm sm:text-base" placeholder="Harga" required value={formData.price} onChange={e=>setFormData({...formData, price:e.target.value})} />
                        <select className="select select-sm sm:select-md w-full rounded-lg sm:rounded-xl bg-emerald-50 border-2 border-emerald-200 focus:border-emerald-500 text-emerald-900 text-sm sm:text-base" value={formData.category} onChange={e=>setFormData({...formData, category:e.target.value})}>
                            <option>Coffee</option><option>Non-Coffee</option><option>Food</option><option>Snack</option>
                        </select>
                    </div>
                    <div className="form-control bg-emerald-50 rounded-lg sm:rounded-xl p-2 sm:p-3 border-2 border-emerald-200">
                        <label className="label cursor-pointer justify-start gap-2 sm:gap-3 py-1 px-0">
                            <input type="checkbox" className="toggle bg-emerald-600 border-emerald-600 toggle-xs sm:toggle-sm" checked={formData.isAvailable} onChange={e=>setFormData({...formData, isAvailable:e.target.checked})} />
                            <span className="label-text text-xs sm:text-sm font-medium text-emerald-800">{formData.isAvailable ? '✓ Stok Tersedia' : '✕ Stok Habis'}</span>
                        </label>
                    </div>
                    <div className="flex gap-2 sm:gap-3 mt-4 sm:mt-6">
                        <button type="button" onClick={()=>setIsModalOpen(false)} className="btn btn-xs sm:btn-sm flex-1 rounded-lg sm:rounded-xl bg-gray-100 hover:bg-gray-200 border-gray-300 text-gray-700 text-xs sm:text-base">Batal</button>
                        <button type="submit" className="btn btn-xs sm:btn-sm flex-1 rounded-lg sm:rounded-xl shadow-lg bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white border-none text-xs sm:text-base">Simpan</button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
}