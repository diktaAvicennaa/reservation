import { useEffect, useState, useMemo } from "react";
import { db, auth } from "../firebase";
import { collection, getDocs, updateDoc, doc, deleteDoc, addDoc, query, where } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("orders");
  const [reservations, setReservations] = useState([]);
  const [products, setProducts] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({ name: "", price: "", category: "Coffee", isAvailable: true });
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);
  const productCategoryMap = useMemo(() => {
    const map = new Map();
    products.forEach((p) => {
      if (p?.name) map.set(p.name.toLowerCase(), p.category);
    });
    return map;
  }, [products]);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      if (!currentUser) {
        navigate("/admin");
      } else {
        setUser(currentUser);
        fetchReservations(); // Hanya fetch SETELAH login
        fetchProducts();
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/admin");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const fetchReservations = async () => {
    try {
      const s = await getDocs(collection(db, "reservations"));
      setReservations(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.createdAt - a.createdAt));
      setError(null);
    } catch (err) {
      setError("❌ Akses ditolak: " + err.message);
      console.error("Fetch reservations error:", err);
    }
  };
  
  const fetchProducts = async () => {
    try {
      const s = await getDocs(collection(db, "products"));
      setProducts(s.docs.map(d => ({ id: d.id, ...d.data() })));
      setError(null);
    } catch (err) {
      setError("❌ Akses ditolak: " + err.message);
      console.error("Fetch products error:", err);
    }
  };

  const handleStatus = async (id, status) => { 
    try {
      await updateDoc(doc(db, "reservations", id), { status }); 
      fetchReservations(); 
    } catch (err) {
      setError("❌ Gagal update status: " + err.message);
    }
  };

  const handleUpdateMeja = async (id, val) => { 
    try {
      if(val && val.trim() !== "") { // Validasi input tidak kosong
        await updateDoc(doc(db, "reservations", id), { tableNumber: val }); 
        fetchReservations(); // Refresh data setelah update
      }
    } catch (err) {
      setError("❌ Gagal update meja: " + err.message);
    }
  };

  const handleDeleteReservation = async (id) => { 
    if(confirm("Hapus pesanan ini?")) { 
      try {
        await deleteDoc(doc(db, "reservations", id)); 
        fetchReservations(); 
      } catch (err) {
        setError("❌ Gagal hapus pesanan: " + err.message);
      }
    }
  };

  const handleDeleteProduct = async (id) => { 
    if(confirm("Hapus item menu ini?")) { 
      try {
        await deleteDoc(doc(db, "products", id)); 
        fetchProducts(); 
      } catch (err) {
        setError("❌ Gagal hapus menu: " + err.message);
      }
    }
  };
  
  const handleSaveProduct = async (e) => {
    e.preventDefault();
    try {
      const payload = { 
        name: formData.name, 
        price: Number(formData.price), 
        category: formData.category, 
        isAvailable: formData.isAvailable,
        updatedAt: new Date()
      };
      if (editingProduct) await updateDoc(doc(db, "products", editingProduct.id), payload);
      else await addDoc(collection(db, "products"), { ...payload, createdAt: new Date() });
      setIsModalOpen(false); 
      fetchProducts();
      setError(null);
    } catch (err) {
      setError("❌ Gagal simpan menu: " + err.message);
    }
  };
  const [searchQuery, setSearchQuery] = useState("");
  

  const handleOpenModal = (p) => {
    setEditingProduct(p);
    setFormData(p ? { name: p.name, price: p.price, category: p.category, isAvailable: p.isAvailable } : { name: "", price: "", category: "Coffee", isAvailable: true });
    setIsModalOpen(true);
  };

  // Filter reservations berdasarkan search
  const filteredReservations = reservations.filter(res => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      res.customerName?.toLowerCase().includes(query) ||
      res.customerPhone?.includes(query) ||
      res.tableNumber?.toLowerCase().includes(query) ||
      res.status?.toLowerCase().includes(query)
    );
  });

  // Filter products berdasarkan search
  const filteredProducts = products.filter(p => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      p.name?.toLowerCase().includes(query) ||
      p.category?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="admin-container">
      {/* NAVBAR */}
      <div className="admin-navbar">
         <h1><span>🌵</span> Admin Panel - Cafe Tropis</h1>
         <div style={{display:'flex', gap:'15px', alignItems:'center'}}>
           <span style={{fontSize:'0.9em', color:'#666'}}>👤 {user?.email}</span>
           <button onClick={handleLogout} className="btn btn-danger">Keluar</button>
         </div>
      </div>

      {/* ERROR MESSAGE */}
      {error && (
        <div style={{padding:'15px', margin:'15px', backgroundColor:'#fee', border:'1px solid #f99', borderRadius:'5px', color:'#c00'}}>
          {error}
        </div>
      )}

      <div className="admin-content">
        {/* TAB NAVIGATION */}
        <div className="tabs">
          <button onClick={() => setActiveTab('orders')} className={activeTab === 'orders' ? 'active' : ''}>Daftar Pesanan</button>
          <button onClick={() => setActiveTab('menu')} className={activeTab === 'menu' ? 'active' : ''}>Kelola Menu</button>
        </div>

        {/* SEARCH BAR */}
        <div style={{padding:'15px', marginBottom:'15px'}}>
          <input 
            id="admin-search"
            name="adminSearch"
            type="text"
            placeholder={activeTab === 'orders' ? 'Cari nama, nomor HP, meja, atau status...' : ' Cari nama menu atau kategori...'}
            className="input-field"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{width:'100%', padding:'12px'}}
          />
        </div>

        {/* TAB 1: DAFTAR PESANAN */}
        {activeTab === 'orders' && (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th className="force-nowrap">Waktu</th>
                  <th className="table-center">Pelanggan</th>
                  <th className="table-center">Meja</th>
                  <th>Pesanan</th>
                  <th className="price-column">Total</th>
                  <th className="table-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredReservations.map((res) => (
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
                        <input 
                          id={`table-number-${res.id}`}
                          name={`tableNumber-${res.id}`}
                          className="input-meja" 
                          defaultValue={res.tableNumber || ""} 
                          onBlur={(e)=>handleUpdateMeja(res.id, e.target.value)}
                          placeholder="No. Meja"
                        />
                    </td>
                    <td>
                        {sortItemsByCategory(res.items, productCategoryMap)?.map((i,x)=><div key={x} className="force-nowrap"><b>{i.qty}x</b> {i.name}</div>)}
                        {res.customerNotes && <div className="badge badge-yellow" style={{marginTop:'5px'}}>📝 {res.customerNotes}</div>}
                    </td>
                    <td className="price-column">Rp {res.totalPrice?.toLocaleString()}</td>
                    <td className="table-center force-nowrap">
                        {res.status === 'pending' ? (
                            <div className="flex-col gap-2">
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
            {filteredReservations.length === 0 && <div className="empty-state">Tidak ada pesanan ditemukan.</div>}
          </div>
        )}

        {/* TAB 2: KELOLA MENU */}
        {activeTab === 'menu' && (
          <div className="menu-section">
            <button onClick={() => handleOpenModal(null)} className="btn btn-primary w-full mb-4" style={{width:'100%', padding:'15px'}}>+ TAMBAH MENU BARU</button>
            <div className="menu-grid">
              {filteredProducts.map((p) => (
                <div key={p.id} className="menu-card">
                  <div className="menu-info">
                    <h3>{p.name}</h3>
                    <div className="flex gap-2 mt-1">
                      <span className={`badge ${p.isAvailable ? 'badge-green' : 'badge-red'}`}>
                        {p.isAvailable ? 'Ready' : 'Habis'}
                      </span>
                      <span className="category-tag">{p.category}</span>
                    </div>
                    <p className="price-text">Rp {p.price?.toLocaleString()}</p>
                  </div>
                  <div className="flex-col gap-2">
                    <button onClick={() => handleOpenModal(p)} className="btn btn-sm btn-primary">Edit ✏️</button>
                    <button onClick={() => handleDeleteProduct(p.id)} className="btn btn-sm btn-danger">Hapus 🗑️</button>
                  </div>
                </div>
              ))}
            </div>
            {filteredProducts.length === 0 && <div className="empty-state">Tidak ada menu ditemukan.</div>}
          </div>
        )}
      </div>

      {/* MODAL TAMBAH/EDIT MENU */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>{editingProduct ? '✏️ Edit Menu' : '➕ Menu Baru'}</h3>
            <form onSubmit={handleSaveProduct} className="flex-col gap-2">
              <div className="form-group">
                <label htmlFor="menu-name">Nama Menu</label>
                <input
                  id="menu-name"
                  name="menuName"
                  className="input-field"
                  required
                  value={formData.name}
                  onChange={e=>setFormData({...formData, name:e.target.value})}
                />
              </div>
              <div className="form-group">
                <label htmlFor="menu-price">Harga (Rp)</label>
                <input
                  id="menu-price"
                  name="menuPrice"
                  type="number"
                  className="input-field"
                  required
                  value={formData.price}
                  onChange={e=>setFormData({...formData, price:e.target.value})}
                />
              </div>
              <div className="form-group">
                <label htmlFor="menu-category">Kategori</label>
                <select
                  id="menu-category"
                  name="menuCategory"
                  className="input-field"
                  value={formData.category}
                  onChange={e=>setFormData({...formData, category:e.target.value})}
                >
                  <option>Coffee</option>
                  <option>Non-Coffee</option>
                  <option>Food</option>
                  <option>Snack</option>
                </select>
              </div>
              <div className="flex justify-between mt-2" style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <span style={{fontWeight:'bold'}}>Tersedia?</span>
                <input
                  id="menu-available"
                  name="menuAvailable"
                  type="checkbox"
                  style={{width:'20px', height:'20px'}}
                  checked={formData.isAvailable}
                  onChange={e=>setFormData({...formData, isAvailable:e.target.checked})}
                />
              </div>
              <div className="flex gap-2 mt-4" style={{display:'flex', gap:'10px', marginTop:'20px'}}>
                <button type="button" onClick={()=>setIsModalOpen(false)} className="btn btn-ghost" style={{flex:1, border:'1px solid #ccc'}}>Batal</button>
                <button type="submit" className="btn btn-primary" style={{flex:1}}>Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const normalizeCategory = (cat = "") =>
  String(cat).toLowerCase().replace(/\s|_/g, "-");

const getCategoryRank = (cat = "") => {
  const c = normalizeCategory(cat);
  if (c === "coffee" || c === "non-coffee" || c === "non-coffe") return 0; // minuman
  if (c === "snack") return 1;
  if (c === "food") return 2;
  return 99;
};

const sortItemsByCategory = (items = [], categoryMap = new Map()) => {
  return [...items].sort((a, b) => {
    const aCat = a?.category || a?.cat || a?.type || categoryMap.get(a?.name?.toLowerCase());
    const bCat = b?.category || b?.cat || b?.type || categoryMap.get(b?.name?.toLowerCase());
    const aRank = getCategoryRank(aCat);
    const bRank = getCategoryRank(bCat);
    return aRank - bRank;
  });
};