import { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import { collection, getDocs, updateDoc, doc, deleteDoc, addDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("orders");
  const [reservations, setReservations] = useState([]);
  const [packages, setPackages] = useState([]);
  const [products, setProducts] = useState([]); // Master Menu

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState(""); 
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({});

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => { if (!user) navigate("/admin"); });
    fetchReservations();
    fetchPackages();
    fetchProducts();
    return () => unsubscribe();
  }, []);

  const fetchReservations = async () => {
    const s = await getDocs(collection(db, "reservations"));
    setReservations(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.createdAt - a.createdAt));
  };
  const fetchPackages = async () => {
    const s = await getDocs(collection(db, "packages"));
    setPackages(s.docs.map(d => ({ id: d.id, ...d.data() })));
  };
  const fetchProducts = async () => {
    const s = await getDocs(collection(db, "products"));
    setProducts(s.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const handleStatus = async (id, status) => { await updateDoc(doc(db, "reservations", id), { status }); fetchReservations(); };
  const handleDeleteReservation = async (id) => {
    if(!confirm("Yakin hapus riwayat pesanan ini?")) return;
    await deleteDoc(doc(db, "reservations", id)); fetchReservations();
  };
  const handleUpdateMeja = async (id, val) => { if(val) await updateDoc(doc(db, "reservations", id), { tableNumber: val }); };
  
  const handleDeleteItem = async (type, id) => { 
      if(confirm(`Yakin hapus data ini?`)) { 
          await deleteDoc(doc(db, type === 'package' ? "packages" : "products", id)); 
          type === 'package' ? fetchPackages() : fetchProducts(); 
      }
  };

  const handleOpenModal = (type, item = null) => {
    setModalType(type);
    setEditingItem(item);
    if (type === 'package') {
        setFormData(item ? { 
            name: item.name, price: item.price, 
            foodOptions: item.foodOptions || [], 
            drinkOptions: item.drinkOptions || [], 
            isAvailable: item.isAvailable 
        } : { name: "", price: "", foodOptions: [], drinkOptions: [], isAvailable: true });
    } else {
        setFormData(item ? { name: item.name, price: item.price, category: item.category, isAvailable: item.isAvailable } : { name: "", price: "", category: "Food", isAvailable: true });
    }
    setIsModalOpen(true);
  };

  const handleOptionChange = (type, id, checked) => {
    setFormData(prev => {
        const list = prev[type] || [];
        if (checked) return { ...prev, [type]: [...list, id] };
        return { ...prev, [type]: list.filter(itemId => itemId !== id) };
    });
  };

  const handleSaveItem = async (e) => {
    e.preventDefault();
    const collectionName = modalType === 'package' ? "packages" : "products";
    const payload = { name: formData.name, price: Number(formData.price), isAvailable: formData.isAvailable };
    
    if (modalType === 'package') {
        payload.foodOptions = formData.foodOptions;
        payload.drinkOptions = formData.drinkOptions;
    }
    if (modalType === 'menu') payload.category = formData.category;

    if (editingItem) await updateDoc(doc(db, collectionName, editingItem.id), payload);
    else await addDoc(collection(db, collectionName), payload);
    
    setIsModalOpen(false); 
    modalType === 'package' ? fetchPackages() : fetchProducts();
  };

  // Helper untuk menampilkan nama menu di kartu paket
  const getProductNames = (ids) => {
      if(!ids || ids.length === 0) return "-";
      return ids.map(id => products.find(p => p.id === id)?.name).filter(Boolean).join(", ");
  };

  return (
    <div style={{minHeight:'100vh', paddingBottom:'50px', background:'#f4f7f6'}}>
      <div className="navbar">
         <div className="logo">🌵 Admin Panel</div>
         <button onClick={() => auth.signOut()} className="btn btn-danger" style={{padding:'5px 10px', fontSize:'0.8em'}}>LOGOUT</button>
      </div>

      <div className="container" style={{maxWidth:'1000px'}}>
        
        {/* TABS */}
        <div className="flex mb-4" style={{background: 'white', padding: '5px', borderRadius: '12px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)'}}>
          <button onClick={() => setActiveTab('orders')} className={`btn ${activeTab === 'orders' ? 'btn-primary' : 'btn-ghost'}`} style={{flex:1}}>📋 Pesanan</button>
          <button onClick={() => setActiveTab('packages')} className={`btn ${activeTab === 'packages' ? 'btn-primary' : 'btn-ghost'}`} style={{flex:1}}>📦 Kelola Paket</button>
          <button onClick={() => setActiveTab('menu')} className={`btn ${activeTab === 'menu' ? 'btn-primary' : 'btn-ghost'}`} style={{flex:1}}>🍔 Menu Master</button>
        </div>

        {/* TAB 1: ORDERS */}
        {activeTab === 'orders' && (
          <div className="card table-container">
            <table>
                <thead>
                  <tr><th>Waktu</th><th>Pelanggan</th><th>Meja</th><th>Pesanan (Paket)</th><th>Total</th><th>Aksi</th></tr>
                </thead>
                <tbody>
                  {reservations.map((res) => (
                    <tr key={res.id}>
                      <td style={{verticalAlign: 'middle'}}>
                        <div style={{fontWeight:'bold', color: '#047857', fontSize: '1.1em'}}>{res.time}</div>
                        <small>{res.date}</small><br/>
                        <span className={`badge ${res.status==='confirmed'?'badge-green':res.status==='rejected'?'badge-red':'badge-yellow'}`} style={{marginTop:'5px', display:'inline-block'}}>
                            {res.status === 'confirmed' ? 'Diterima' : res.status === 'rejected' ? 'Ditolak' : 'Menunggu'}
                        </span>
                      </td>
                      <td style={{verticalAlign: 'middle'}}><b>{res.customerName}</b><br/></td>
                      <td style={{verticalAlign: 'middle'}}><input className="input" style={{width:'60px', padding:'8px', textAlign:'center', fontWeight:'bold'}} defaultValue={res.tableNumber} onBlur={(e)=>handleUpdateMeja(res.id, e.target.value)} /></td>
                      <td style={{verticalAlign: 'middle'}}>
                          {res.items?.map((i,x)=>(
                              <div key={x} style={{fontSize:'0.9em', marginBottom:'8px', background:'#f9f9f9', padding:'5px', borderRadius:'4px'}}>
                                  <b style={{color: '#047857'}}>{i.qty}x</b> <b>{i.name}</b><br/>
                                  <span style={{color: '#666'}}>↳ {i.selections}</span>
                                  {i.note && <div style={{fontSize: '0.85em', color: '#d97706', fontStyle: 'italic'}}>📝 {i.note}</div>}
                              </div>
                          ))}
                      </td>
                      <td className="text-primary font-bold" style={{verticalAlign: 'middle', fontSize: '1.1em'}}>Rp {res.totalPrice?.toLocaleString()}</td>
                      <td style={{verticalAlign: 'middle'}}>
                          {res.status === 'pending' ? (
                              <div className="flex flex-col gap-2">
                                  <button onClick={()=>handleStatus(res.id,'confirmed')} className="btn btn-primary" style={{padding:'8px', width:'100%'}}>✔ Terima</button>
                                  <button onClick={()=>handleStatus(res.id,'rejected')} className="btn btn-danger" style={{padding:'8px', width:'100%'}}>✖ Tolak</button>
                              </div>
                          ) : (
                              <div className="text-center">
                                 <div style={{fontSize:'0.8em', color:'#aaa', marginBottom:'5px'}}>Selesai</div>
                                 <button onClick={()=>handleDeleteReservation(res.id)} className="btn btn-ghost" style={{color:'red', width:'100%', padding:'8px'}}>🗑 Hapus</button>
                              </div>
                          )}
                      </td>
                    </tr>
                  ))}
                </tbody>
            </table>
            {reservations.length===0 && <div className="text-center" style={{padding:'20px', color:'#999'}}>Belum ada pesanan masuk.</div>}
          </div>
        )}

        {/* TAB 2: KELOLA PAKET */}
        {activeTab === 'packages' && (
            <div>
                <button onClick={()=>handleOpenModal('package')} className="btn btn-primary btn-block mb-4" style={{padding: '15px', fontSize: '1.1em'}}>+ BUAT PAKET BARU</button>
                <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:'20px'}}>
                    {packages.map((p) => (
                        <div key={p.id} className="card" style={{borderTop: '5px solid #047857'}}>
                            <div>
                                <h3 style={{margin:0, color: '#047857'}}>{p.name}</h3>
                                <div className="flex mt-2 mb-2"><span className={`badge ${p.isAvailable ? 'badge-green' : 'badge-red'}`}>{p.isAvailable ? 'Tersedia' : 'Habis'}</span></div>
                                <div style={{fontSize: '0.85em', color: '#555', background: '#f9f9f9', padding: '10px', borderRadius: '8px', marginBottom: '10px'}}>
                                    <b>Opsi Makanan:</b> {getProductNames(p.foodOptions)}<br/>
                                    <b>Opsi Minuman:</b> {getProductNames(p.drinkOptions)}
                                </div>
                                <div className="text-primary font-bold" style={{fontSize: '1.2em'}}>Rp {p.price?.toLocaleString()}</div>
                            </div>
                            <div className="flex mt-4">
                                <button onClick={()=>handleOpenModal('package', p)} className="btn btn-ghost" style={{flex:1, border: '1px solid #047857', color: '#047857'}}>Edit ✏️</button>
                                <button onClick={()=>handleDeleteItem('package', p.id)} className="btn btn-danger" style={{flex:1}}>Hapus 🗑️</button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* TAB 3: MENU MASTER */}
        {activeTab === 'menu' && (
            <div>
                <div style={{background: '#fff3cd', color: '#856404', padding: '10px', borderRadius: '8px', marginBottom: '15px', fontSize: '0.9em'}}>
                    ℹ️ <b>Info:</b> Ini adalah database master. Tambahkan menu di sini agar bisa dipilih saat meracik Paket.
                </div>
                <button onClick={()=>handleOpenModal('menu')} className="btn btn-secondary btn-block mb-4" style={{padding: '15px', fontSize: '1.1em'}}>+ TAMBAH MENU MASTER</button>
                <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(250px, 1fr))', gap:'20px'}}>
                    {products.map((p) => (
                        <div key={p.id} className="card" style={{borderTop: '5px solid #10B981'}}>
                            <div>
                                <h3 style={{margin:0}}>{p.name}</h3>
                                <div className="flex mt-2 mb-2">
                                    <span className={`badge ${p.isAvailable ? 'badge-green' : 'badge-red'}`}>{p.isAvailable ? 'Ready' : 'Habis'}</span>
                                    <span className="badge badge-yellow">{p.category}</span>
                                </div>
                                <div className="text-primary font-bold">Rp {p.price?.toLocaleString()}</div>
                            </div>
                            <div className="flex mt-4">
                                <button onClick={()=>handleOpenModal('menu', p)} className="btn btn-ghost" style={{flex:1}}>Edit</button>
                                <button onClick={()=>handleDeleteItem('menu', p.id)} className="btn btn-danger" style={{flex:1}}>Hapus</button>
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
            <div className="modal-content" style={{maxWidth: '500px', maxHeight:'90vh', overflowY:'auto'}}>
                <h3 style={{color: '#047857'}}>{editingItem ? 'Edit Data' : (modalType === 'package' ? 'Buat Paket Baru' : 'Tambah Menu Master')}</h3>
                <form onSubmit={handleSaveItem}>
                    <div className="form-group"><label className="label">Nama {modalType === 'package' ? 'Paket' : 'Menu'}</label><input className="input" required value={formData.name} onChange={e=>setFormData({...formData, name:e.target.value})} /></div>
                    <div className="form-group"><label className="label">Harga</label><input type="number" className="input" required value={formData.price} onChange={e=>setFormData({...formData, price:e.target.value})} /></div>
                    
                    {/* INPUT CHECKLIST KHUSUS PAKET */}
                    {modalType === 'package' && (
                        <>
                            <div className="form-group">
                                <label className="label">Pilih Opsi Makanan (Pelanggan boleh pilih apa saja?)</label>
                                <div style={{maxHeight:'150px', overflowY:'auto', border:'1px solid #ddd', padding:'10px', borderRadius:'8px'}}>
                                    {products.filter(p => p.category === 'Food' || p.category === 'Snack').map(p => (
                                        <label key={p.id} style={{display:'flex', alignItems:'center', gap:'10px', marginBottom:'5px'}}>
                                            <input type="checkbox" checked={formData.foodOptions?.includes(p.id)} onChange={(e) => handleOptionChange('foodOptions', p.id, e.target.checked)} />
                                            {p.name}
                                        </label>
                                    ))}
                                    {products.filter(p => p.category === 'Food' || p.category === 'Snack').length === 0 && <small>Belum ada makanan di Menu Master.</small>}
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="label">Pilih Opsi Minuman (Pelanggan boleh pilih apa saja?)</label>
                                <div style={{maxHeight:'150px', overflowY:'auto', border:'1px solid #ddd', padding:'10px', borderRadius:'8px'}}>
                                    {products.filter(p => p.category === 'Coffee' || p.category === 'Non-Coffee').map(p => (
                                        <label key={p.id} style={{display:'flex', alignItems:'center', gap:'10px', marginBottom:'5px'}}>
                                            <input type="checkbox" checked={formData.drinkOptions?.includes(p.id)} onChange={(e) => handleOptionChange('drinkOptions', p.id, e.target.checked)} />
                                            {p.name}
                                        </label>
                                    ))}
                                    {products.filter(p => p.category === 'Coffee' || p.category === 'Non-Coffee').length === 0 && <small>Belum ada minuman di Menu Master.</small>}
                                </div>
                            </div>
                        </>
                    )}

                    {/* INPUT KATEGORI KHUSUS MENU */}
                    {modalType === 'menu' && (
                        <div className="form-group">
                            <label className="label">Kategori</label>
                            <select className="select" value={formData.category} onChange={e=>setFormData({...formData, category:e.target.value})}>
                                <option>Coffee</option><option>Non-Coffee</option><option>Food</option><option>Snack</option>
                            </select>
                        </div>
                    )}

                    <div className="form-group flex" style={{background: '#f9f9f9', padding: '15px', borderRadius: '8px', border: '1px solid #eee'}}>
                        <label className="label" style={{flex:1, margin: 0}}>Tersedia (Ready)?</label>
                        <input type="checkbox" style={{width:'25px', height:'25px'}} checked={formData.isAvailable} onChange={e=>setFormData({...formData, isAvailable:e.target.checked})} />
                    </div>
                    <div className="flex mt-4">
                        <button type="button" onClick={()=>setIsModalOpen(false)} className="btn btn-ghost" style={{flex:1}}>Batal</button>
                        <button type="submit" className="btn btn-primary" style={{flex:2}}>SIMPAN</button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
}