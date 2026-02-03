import { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import { collection, getDocs, updateDoc, doc, deleteDoc, addDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("orders"); // 'orders' atau 'menu'
  
  // --- STATE UNTUK PESANAN ---
  const [reservations, setReservations] = useState([]);

  // --- STATE UNTUK MENU ---
  const [products, setProducts] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null); // Data produk yg sedang diedit
  const [formData, setFormData] = useState({ name: "", price: "", category: "Coffee", isAvailable: true });

  useEffect(() => {
    // Cek Login
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) navigate("/admin");
    });
    
    // Ambil data awal
    fetchReservations();
    fetchProducts();

    return () => unsubscribe();
  }, []);

  // --- FUNGSI DATA PESANAN ---
  const fetchReservations = async () => {
    const querySnapshot = await getDocs(collection(db, "reservations"));
    const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setReservations(data.sort((a, b) => b.createdAt - a.createdAt));
  };

  const handleStatus = async (id, status) => {
    await updateDoc(doc(db, "reservations", id), { status });
    fetchReservations();
  };

  const handleUpdateMeja = async (id, nomorMeja) => {
    if (!nomorMeja) return;
    await updateDoc(doc(db, "reservations", id), { tableNumber: nomorMeja });
  };

  // --- FUNGSI DATA MENU (BARU) ---
  const fetchProducts = async () => {
    const querySnapshot = await getDocs(collection(db, "products"));
    const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setProducts(data);
  };

  const handleOpenModal = (product = null) => {
    if (product) {
      // Mode Edit
      setEditingProduct(product);
      setFormData({ 
        name: product.name, 
        price: product.price, 
        category: product.category, 
        isAvailable: product.isAvailable 
      });
    } else {
      // Mode Tambah Baru
      setEditingProduct(null);
      setFormData({ name: "", price: "", category: "Coffee", isAvailable: true });
    }
    setIsModalOpen(true);
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    const payload = {
      name: formData.name,
      price: Number(formData.price),
      category: formData.category,
      isAvailable: formData.isAvailable
    };

    try {
      if (editingProduct) {
        // Update Produk Lama
        await updateDoc(doc(db, "products", editingProduct.id), payload);
      } else {
        // Buat Produk Baru
        await addDoc(collection(db, "products"), payload);
      }
      setIsModalOpen(false);
      fetchProducts(); // Refresh list
      alert("Berhasil disimpan!");
    } catch (error) {
      console.error(error);
      alert("Gagal menyimpan menu.");
    }
  };

  const handleDeleteProduct = async (id) => {
    if(!confirm("Yakin mau hapus menu ini?")) return;
    await deleteDoc(doc(db, "products", id));
    fetchProducts();
  };

  return (
    <div className="min-h-screen bg-base-200 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        
        {/* HEADER & LOGOUT */}
        <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-base-content">Dashboard Admin</h1>
            <button onClick={() => auth.signOut()} className="btn btn-error btn-sm text-white">Logout</button>
        </div>

        {/* --- TAB NAVIGASI --- */}
        <div className="tabs tabs-boxed mb-6 bg-base-100 p-2 shadow-md">
          <a 
            className={`tab tab-lg flex-1 ${activeTab === 'orders' ? 'tab-active' : ''}`} 
            onClick={() => setActiveTab('orders')}
          >
            📋 Daftar Pesanan
          </a>
          <a 
            className={`tab tab-lg flex-1 ${activeTab === 'menu' ? 'tab-active' : ''}`} 
            onClick={() => setActiveTab('menu')}
          >
            🍔 Kelola Menu
          </a>
        </div>

        {/* --- KONTEN TAB: ORDERS --- */}
        {activeTab === 'orders' && (
          <div className="overflow-x-auto bg-base-100 rounded-xl shadow-xl animate-fade-in">
            <table className="table table-zebra w-full">
              <thead className="bg-base-300 text-base-content">
                <tr>
                  <th>Waktu</th>
                  <th>Pelanggan</th>
                  <th>Lokasi/Meja</th>
                  <th>Order</th>
                  <th>Total</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {reservations.map((res) => (
                  <tr key={res.id}>
                    <td>
                      <div className="font-bold">{res.date}</div>
                      <div className="text-xs opacity-50">{res.time}</div>
                      <span className={`badge badge-sm mt-1 ${res.status === 'confirmed' ? 'badge-success text-white' : res.status === 'rejected' ? 'badge-error text-white' : 'badge-warning'}`}>
                          {res.status}
                      </span>
                    </td>
                    <td>
                      <div className="font-bold">{res.customerName}</div>
                      <div className="text-xs">{res.customerPhone}</div>
                    </td>
                    <td>
                      <input 
                        className="input input-xs input-bordered w-20" 
                        defaultValue={res.tableNumber || ""} 
                        onBlur={(e) => handleUpdateMeja(res.id, e.target.value)}
                        placeholder="Meja..."
                      />
                    </td>
                    <td>
                      <ul className="text-xs list-disc list-inside">
                        {res.items?.map((item, idx) => (
                            <li key={idx}>{item.name} ({item.qty})</li>
                        ))}
                      </ul>
                    </td>
                    <td className="font-bold">Rp {res.totalPrice?.toLocaleString()}</td>
                    <td>
                      <div className="flex gap-1">
                        {res.status === 'pending' && (
                          <>
                            <button onClick={() => handleStatus(res.id, 'confirmed')} className="btn btn-xs btn-success text-white">✔</button>
                            <button onClick={() => handleStatus(res.id, 'rejected')} className="btn btn-xs btn-error text-white">✖</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* --- KONTEN TAB: KELOLA MENU --- */}
        {activeTab === 'menu' && (
          <div className="bg-base-100 rounded-xl shadow-xl p-6 animate-fade-in">
            <div className="flex justify-between mb-4">
              <h2 className="text-xl font-bold">Daftar Menu Cafe</h2>
              <button onClick={() => handleOpenModal(null)} className="btn btn-primary btn-sm">+ Tambah Menu</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {products.map((item) => (
                <div key={item.id} className="border border-base-300 rounded-lg p-4 flex justify-between items-center hover:bg-base-200 transition">
                  <div>
                    <h3 className="font-bold text-lg">{item.name}</h3>
                    <div className="flex gap-2 text-xs mb-1">
                      <span className="badge badge-ghost">{item.category}</span>
                      <span className={`badge ${item.isAvailable ? 'badge-success badge-outline' : 'badge-error badge-outline'}`}>
                        {item.isAvailable ? 'Ready' : 'Habis'}
                      </span>
                    </div>
                    <p className="font-bold text-primary">Rp {item.price?.toLocaleString()}</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button onClick={() => handleOpenModal(item)} className="btn btn-sm btn-outline btn-info">✏ Edit</button>
                    <button onClick={() => handleDeleteProduct(item.id)} className="btn btn-sm btn-outline btn-error">🗑 Hapus</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* --- MODAL EDIT/TAMBAH MENU --- */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-base-100 p-6 rounded-xl w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold mb-4">
              {editingProduct ? "Edit Menu" : "Tambah Menu Baru"}
            </h3>
            
            <form onSubmit={handleSaveProduct} className="space-y-4">
              <div className="form-control">
                <label className="label font-bold">Nama Menu</label>
                <input required type="text" className="input input-bordered" 
                  value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="label font-bold">Harga</label>
                  <input required type="number" className="input input-bordered" 
                    value={formData.price} onChange={(e) => setFormData({...formData, price: e.target.value})} />
                </div>
                <div className="form-control">
                  <label className="label font-bold">Kategori</label>
                  <select className="select select-bordered" 
                    value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})}>
                    <option>Coffee</option>
                    <option>Non-Coffee</option>
                    <option>Food</option>
                    <option>Snack</option>
                  </select>
                </div>
              </div>

              <div className="form-control">
                <label className="label cursor-pointer justify-start gap-4">
                  <span className="label-text font-bold">Status Ketersediaan</span>
                  <input type="checkbox" className="toggle toggle-success" 
                    checked={formData.isAvailable} onChange={(e) => setFormData({...formData, isAvailable: e.target.checked})} />
                  <span className="text-sm opacity-70">{formData.isAvailable ? "Tersedia" : "Habis"}</span>
                </label>
              </div>

              <div className="flex gap-2 mt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-ghost flex-1">Batal</button>
                <button type="submit" className="btn btn-primary flex-1">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}