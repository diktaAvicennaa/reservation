import { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("orders");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // STATE DATA
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [newProduct, setNewProduct] = useState({ name: "", price: "", category: "Food", isAvailable: true });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        navigate("/admin");
      } else {
        fetchData();
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  const fetchData = async () => {
    try {
      // AMBIL MENU (Produk)
      const snapMenu = await getDocs(collection(db, "products"));
      const dataMenu = snapMenu.docs.map(d => ({ id: d.id, ...d.data() }));
      
      // AMBIL PESANAN (Reservations)
      const snapOrder = await getDocs(collection(db, "reservations"));
      const dataOrders = snapOrder.docs.map(d => ({ id: d.id, ...d.data() }));
      
      // Sort Manual (Anti Error)
      dataOrders.sort((a, b) => {
         const timeA = a.createdAt?.seconds || 0;
         const timeB = b.createdAt?.seconds || 0;
         return timeB - timeA; // Paling baru di atas
      });

      setProducts(dataMenu);
      setOrders(dataOrders);
    } catch (error) {
      console.error("Error:", error);
      alert("Gagal memuat data: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => { await signOut(auth); navigate("/"); };
  
  const handleAddProduct = async (e) => {
    e.preventDefault();
    if(!newProduct.name) return;
    try {
        await addDoc(collection(db, "products"), { ...newProduct, price: Number(newProduct.price), createdAt: new Date() });
        setNewProduct({ name: "", price: "", category: "Food", isAvailable: true });
        fetchData();
    } catch(e) { alert(e.message); }
  };

  const handleDeleteProduct = async (id) => { if(confirm("Hapus menu ini?")) { await deleteDoc(doc(db, "products", id)); fetchData(); }};
  const toggleAvailability = async (id, status) => { await updateDoc(doc(db, "products", id), { isAvailable: !status }); fetchData(); };
  const updateStatus = async (id, status) => { await updateDoc(doc(db, "reservations", id), { status }); fetchData(); };
  const handleDeleteOrder = async (id) => { if(confirm("Hapus pesanan ini?")) { await deleteDoc(doc(db, "reservations", id)); fetchData(); }};

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-200">
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200 p-4 md:p-8">
      {/* HEADER */}
      <div className="max-w-6xl mx-auto flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-base-content">Dashboard Admin</h1>
          <p className="text-sm opacity-70">Kelola pesanan dan menu cafe</p>
        </div>
        <button onClick={handleLogout} className="btn btn-sm btn-error text-white">Logout</button>
      </div>

      <div className="max-w-6xl mx-auto">
        {/* TABS */}
        <div className="tabs tabs-boxed bg-base-100 mb-6 p-1">
          <a className={`tab ${activeTab === 'orders' ? 'tab-active' : ''}`} onClick={() => setActiveTab('orders')}>
            Pesanan <div className="badge badge-sm badge-ghost ml-2">{orders.length}</div>
          </a>
          <a className={`tab ${activeTab === 'menu' ? 'tab-active' : ''}`} onClick={() => setActiveTab('menu')}>
            Menu <div className="badge badge-sm badge-ghost ml-2">{products.length}</div>
          </a>
        </div>

        {/* TAB 1: PESANAN */}
        {activeTab === 'orders' && (
          <div className="bg-base-100 rounded-xl shadow-xl overflow-hidden border border-base-300">
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead className="bg-base-200 text-base-content">
                  <tr>
                    <th>Waktu</th>
                    <th>Pelanggan</th>
                    <th>Menu Dipesan</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.length === 0 ? (
                    <tr><td colSpan="6" className="text-center py-8 opacity-50">Belum ada pesanan masuk.</td></tr>
                  ) : orders.map(o => (
                    <tr key={o.id} className="hover:bg-base-200/50 transition-colors">
                      <td>
                        <div className="font-bold">{o.date}</div>
                        <span className="text-xs opacity-60">{o.time}</span>
                      </td>
                      <td>
                        <div className="font-semibold">{o.customerName}</div>
                        <a href={`https://wa.me/${o.customerPhone}`} target="_blank" className="link text-xs text-success flex items-center gap-1">
                          {o.customerPhone} ↗
                        </a>
                      </td>
                      <td>
                        <ul className="text-xs list-disc pl-4 opacity-80">
                          {o.items?.map((i,x)=><li key={x}>{i.name} <span className="font-bold">x{i.qty}</span></li>)}
                        </ul>
                      </td>
                      <td className="font-bold text-primary">Rp {o.totalPrice?.toLocaleString()}</td>
                      <td>
                        <select 
                          value={o.status} 
                          onChange={(e)=>updateStatus(o.id, e.target.value)} 
                          className={`select select-xs select-bordered w-full max-w-xs ${
                            o.status === 'confirmed' ? 'select-success' : 
                            o.status === 'cancelled' ? 'select-error' : 'select-warning'
                          }`}
                        >
                            <option value="pending">Pending</option>
                            <option value="confirmed">Selesai</option>
                            <option value="cancelled">Batal</option>
                        </select>
                      </td>
                      <td>
                        <button onClick={()=>handleDeleteOrder(o.id)} className="btn btn-xs btn-square btn-ghost text-error hover:bg-error/10">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                        </button>
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
          <div className="grid md:grid-cols-3 gap-6">
            {/* Form Tambah */}
            <div className="card bg-base-100 shadow-xl h-fit border border-base-300">
              <div className="card-body p-5">
                <h3 className="card-title text-lg mb-2">Tambah Menu Baru</h3>
                <form onSubmit={handleAddProduct} className="flex flex-col gap-3">
                    <input 
                      placeholder="Nama Menu" 
                      className="input input-bordered w-full" 
                      value={newProduct.name} 
                      onChange={e=>setNewProduct({...newProduct, name: e.target.value})}
                    />
                    <div className="join w-full">
                      <span className="join-item btn btn-active btn-sm no-animation">Rp</span>
                      <input 
                        type="number" 
                        placeholder="Harga" 
                        className="join-item input input-bordered input-sm w-full" 
                        value={newProduct.price} 
                        onChange={e=>setNewProduct({...newProduct, price: e.target.value})}
                      />
                    </div>
                    <select 
                      className="select select-bordered w-full" 
                      value={newProduct.category} 
                      onChange={e=>setNewProduct({...newProduct, category: e.target.value})}
                    >
                        <option>Coffee</option>
                        <option>Non-Coffee</option>
                        <option>Food</option>
                        <option>Snack</option>
                    </select>
                    <button className="btn btn-primary w-full mt-2">+ Simpan Menu</button>
                </form>
              </div>
            </div>
            
            {/* List Menu */}
            <div className="md:col-span-2 bg-base-100 rounded-xl shadow-xl overflow-hidden border border-base-300">
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="table table-sm table-pin-rows">
                    <thead className="bg-base-200 text-base-content">
                      <tr><th>Nama Menu</th><th>Harga</th><th>Status</th><th>Aksi</th></tr>
                    </thead>
                    <tbody>
                        {products.map(p => (
                            <tr key={p.id} className="hover:bg-base-200/50">
                                <td>
                                  <div className="font-bold">{p.name}</div>
                                  <div className="badge badge-ghost badge-xs">{p.category}</div>
                                </td>
                                <td>Rp {p.price.toLocaleString()}</td>
                                <td>
                                  <button 
                                    onClick={()=>toggleAvailability(p.id, p.isAvailable)} 
                                    className={`btn btn-xs ${p.isAvailable?'btn-success text-white':'btn-error text-white'}`}
                                  >
                                    {p.isAvailable?'Tersedia':'Habis'}
                                  </button>
                                </td>
                                <td>
                                  <button onClick={()=>handleDeleteProduct(p.id)} className="btn btn-xs btn-ghost text-error">Hapus</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}