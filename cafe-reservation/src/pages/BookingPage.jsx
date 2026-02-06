import { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, query, where, getDocs, addDoc } from "firebase/firestore";

export default function BookingPage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [time, setTime] = useState(""); 
  // Hapus 'notes' global di customer karena sudah ada per-item
  const [customer, setCustomer] = useState({ name: "", phone: "" }); 
  const [menuItems, setMenuItems] = useState([]);
  
  // State Kategori
  const [selectedCategory, setSelectedCategory] = useState("All");
  const categories = ["All", "Coffee", "Non-Coffee", "Food", "Snack"];

  const [cart, setCart] = useState({}); 
  const [bundles, setBundles] = useState([]); 
  const [totalPrice, setTotalPrice] = useState(0);

  // --- [BARU] STATE CATATAN PER ITEM ---
  const [itemNotes, setItemNotes] = useState({}); 
  // -------------------------------------

  const [isPromoOpen, setIsPromoOpen] = useState(false);
  const [promoSelection, setPromoSelection] = useState({ food: "", drink: "" });

  // Hitung total item
  const totalItemsInCart = Object.values(cart).reduce((a, b) => a + b, 0) + bundles.length;

  useEffect(() => { fetchMenu(); }, []);

  useEffect(() => {
    let total = 0;
    Object.keys(cart).forEach((itemId) => {
      const item = menuItems.find(p => p.id === itemId);
      if (item) total += item.price * cart[itemId];
    });
    total += bundles.length * 25000;
    setTotalPrice(total);
  }, [cart, menuItems, bundles]);

  const fetchMenu = async () => {
    try {
      const q = query(collection(db, "products"), where("isAvailable", "==", true));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMenuItems(data);
    } catch (error) { console.error(error); }
  };

  const handleStep1Submit = () => {
    if(!date || !time) return alert("Mohon isi tanggal & jam kedatangan dulu ya 🙏");
    const selectedDateTime = new Date(`${date}T${time}`);
    const now = new Date();
    if (selectedDateTime < now) return alert("Waktu sudah berlalu! Mohon pilih jadwal masa depan 😅");
    setStep(2);
  };

  // --- LOGIC PAKET (BUNDLE) ---
  const handleAddBundle = () => {
      const food = menuItems.find(i => i.id === promoSelection.food);
      const drink = menuItems.find(i => i.id === promoSelection.drink);
      if (!food || !drink) return alert("Wajib pilih 1 Makanan & 1 Minuman!");

      const newBundle = {
          id: `promo-${Date.now()}`,
          name: `Paket Ramadhan: ${food.name} + ${drink.name}`,
          price: 25000,
          qty: 1,
          note: "" // Default catatan kosong
      };
      setBundles([...bundles, newBundle]);
      setIsPromoOpen(false);
      setPromoSelection({ food: "", drink: "" });
  };

  const removeBundle = (index) => {
      const newBundles = [...bundles];
      newBundles.splice(index, 1);
      setBundles(newBundles);
  };

  // Update Catatan Paket
  const updateBundleNote = (index, text) => {
      const newBundles = [...bundles];
      newBundles[index].note = text;
      setBundles(newBundles);
  };

  // --- LOGIC MENU SATUAN ---
  const addToCart = (itemId) => { setCart(prev => ({ ...prev, [itemId]: (prev[itemId] || 0) + 1 })); };
  const removeFromCart = (itemId) => {
    setCart(prev => {
      const currentQty = prev[itemId] || 0;
      if (currentQty <= 1) { 
          const newCart = { ...prev }; 
          delete newCart[itemId]; 
          // Hapus catatan juga jika item dihapus
          const newNotes = { ...itemNotes };
          delete newNotes[itemId];
          setItemNotes(newNotes);
          return newCart; 
      }
      return { ...prev, [itemId]: currentQty - 1 };
    });
  };

  // Update Catatan Menu Satuan
  const handleItemNoteChange = (id, text) => {
      setItemNotes(prev => ({ ...prev, [id]: text }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    // 1. Siapkan Item Satuan + Catatan
    const regularItems = Object.keys(cart).map(itemId => {
      const item = menuItems.find(p => p.id === itemId);
      return { 
          name: item.name, 
          qty: cart[itemId], 
          price: item.price, 
          subtotal: item.price * cart[itemId],
          note: itemNotes[itemId] || "" // Ambil catatan
      };
    });

    // 2. Siapkan Paket + Catatan
    const bundleItems = bundles.map(b => ({
        name: b.name, 
        qty: 1, 
        price: 25000, 
        subtotal: 25000,
        note: b.note || "" // Ambil catatan paket
    }));

    try {
      await addDoc(collection(db, "reservations"), {
        date, time, 
        customerName: customer.name, 
        customerPhone: customer.phone,
        items: [...regularItems, ...bundleItems], 
        totalPrice: totalPrice, 
        status: "pending", 
        createdAt: new Date()
      });
      setStep(4); 
    } catch (error) { alert("Gagal menyimpan reservasi."); } finally { setLoading(false); }
  };

  const generateWaLink = () => {
    const phoneNumber = "6287819502426"; 
    
    // Format teks Menu Satuan dengan Catatan
    const regularText = Object.keys(cart).map(id => {
        const item = menuItems.find(p => p.id === id);
        // Catatan dibuat miring dengan tanda _
        const note = itemNotes[id] ? ` _(Catatan: ${itemNotes[id]})_` : "";
        return `- ${item.name} (${cart[id]}x)${note}`;
    }).join("\n");

    // Format teks Paket dengan Catatan
    const bundleText = bundles.map(b => {
        const note = b.note ? ` _(Catatan: ${b.note})_` : "";
        return `- ${b.name}${note}`;
    }).join("\n");

    // PERUBAHAN DI SINI: Menambahkan tanda bintang (*) agar tebal
    const message = `Halo Cafe Tropis 🌵,\nSaya ingin reservasi:\n\n *Nama:* ${customer.name}\n *Jam:* ${time}, ${date}\n\n *Order:*\n${regularText}\n${bundleText}\n\n *Total: Rp ${totalPrice.toLocaleString()}*`;
    
    return `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
  };

  // Logic Filter Kategori
  const filteredItems = selectedCategory === "All" 
    ? menuItems 
    : menuItems.filter(item => item.category === selectedCategory);

  return (
    <div style={{ paddingBottom: '100px' }}>
      {/* NAVBAR */}
      <div className="navbar">
        <div className="logo">🌵 Cafe Tropis</div>
        {step < 4 && <div className="badge badge-green">Langkah {step} / 3</div>}
      </div>

      <div className="container">
        
        {/* STEP 1: WAKTU */}
        {step === 1 && (
          <div className="text-center mt-4">
            <h2 className="text-lg">Kapan mau mampir?</h2>
            <p className="mb-4" style={{color:'#666'}}>Atur jadwal kunjunganmu.</p>
            <div className="card text-left">
              <div className="form-group"><label className="label">📅 Tanggal</label><input type="date" className="input" value={date} min={new Date().toISOString().split("T")[0]} onChange={(e) => setDate(e.target.value)} /></div>
              <div className="form-group"><label className="label">⏰ Jam</label><input type="time" className="input" value={time} onChange={(e) => setTime(e.target.value)} /></div>
            </div>
            <button onClick={() => setTime("17:45")} className="btn btn-ghost btn-block mb-4" style={{border:'2px solid #047857', color:'#047857'}}>🌙 Shortcut Buka Puasa (17:45)</button>
            <button onClick={handleStep1Submit} className="btn btn-primary btn-block">LANJUT PILIH MENU ➔</button>
          </div>
        )}

        {/* STEP 2: MENU */}
        {step === 2 && (
          <div className="mt-4">
            <h2 className="text-lg mb-4 text-primary">🍽️ Pilih Menu</h2>
            
            {/* PROMO CARD */}
            <div onClick={() => setIsPromoOpen(true)} className="card" style={{ background: 'linear-gradient(135deg, #047857 0%, #10B981 100%)', color: 'white', cursor: 'pointer' }}>
                <h3 className="text-lg" style={{margin:0}}>☪️ Paket Ramadhan</h3>
                <p style={{margin:'5px 0'}}>Rp 25.000 (Hemat!)</p>
                <small>Klik untuk pilih menu</small>
            </div>

            {/* TAB KATEGORI */}
            <div className="category-scroll">
              {categories.map((cat) => (
                <button key={cat} onClick={() => setSelectedCategory(cat)}
                  className={`btn ${selectedCategory === cat ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ borderRadius: '20px', whiteSpace: 'nowrap', padding: '8px 16px' }}>
                  {cat}
                </button>
              ))}
            </div>

            {/* KERANJANG AKTIF (BUNDLE) */}
            {bundles.length > 0 && (
                 <div className="mb-4">
                    {bundles.map((b, idx) => (
                        <div key={b.id} className="card" style={{padding:'15px', marginBottom:'10px', borderLeft:'5px solid #047857'}}>
                            <div className="flex justify-between">
                                <div><b>☪️ Paket Ramadhan</b><div style={{fontSize:'0.8em', color:'#666'}}>{b.name.replace("Paket Ramadhan: ", "")}</div></div>
                                <div className="flex"><b>Rp 25.000</b><button onClick={() => removeBundle(idx)} className="btn btn-danger" style={{padding:'5px 10px', marginLeft:'10px'}}>✕</button></div>
                            </div>
                            {/* Input Catatan Paket */}
                            <input 
                                className="input" 
                                style={{marginTop:'10px', padding:'8px', fontSize:'0.9em', background:'#f9f9f9'}}
                                placeholder="Catatan Paket..."
                                value={b.note}
                                onChange={(e) => updateBundleNote(idx, e.target.value)}
                            />
                        </div>
                    ))}
                 </div>
            )}

            {/* LIST MENU (SATUAN) */}
            <h3>Menu Satuan</h3>
            <div>
              {filteredItems.length === 0 ? (
                <div className="text-center" style={{padding:'40px', color:'#999'}}>Belum ada menu di kategori ini.</div>
              ) : (
                filteredItems.map((item) => (
                  <div key={item.id} className="card" style={{padding:'15px'}}>
                    <div className="flex justify-between items-center">
                        <div>
                           <h4 style={{margin:0}}>{item.name}</h4>
                           <span className="badge badge-green" style={{fontSize:'0.7em'}}>{item.category}</span>
                           <div className="text-primary font-bold">Rp {item.price.toLocaleString()}</div>
                        </div>
                        
                        {cart[item.id] > 0 ? (
                          <div className="flex">
                            <button onClick={() => removeFromCart(item.id)} className="btn btn-ghost" style={{padding:'5px 10px'}}>-</button>
                            <span style={{padding:'5px 10px', fontWeight:'bold'}}>{cart[item.id]}</span>
                            <button onClick={() => addToCart(item.id)} className="btn btn-primary" style={{padding:'5px 10px'}}>+</button>
                          </div>
                        ) : (
                          <button onClick={() => addToCart(item.id)} className="btn btn-primary" style={{padding:'8px 15px'}}>+ Add</button>
                        )}
                    </div>

                    {/* INPUT CATATAN (Muncul jika ada di keranjang) */}
                    {cart[item.id] > 0 && (
                        <div style={{marginTop:'10px'}}>
                            <input 
                                className="input" 
                                style={{padding:'8px', fontSize:'0.9em', background:'#f9f9f9'}}
                                placeholder={`Catatan untuk ${item.name}...`}
                                value={itemNotes[item.id] || ""}
                                onChange={(e) => handleItemNoteChange(item.id, e.target.value)}
                            />
                        </div>
                    )}
                  </div>
                ))
              )}
            </div>
            
            {/* FOOTER KERANJANG */}
            <div style={{ position:'fixed', bottom:0, left:0, right:0, padding:'20px', background:'white', borderTop:'1px solid #eee', boxShadow:'0 -2px 10px rgba(0,0,0,0.1)' }}>
               <div className="container flex justify-between">
                  <div>
                    <small>Total Bayar</small>
                    <div className="text-lg text-primary">Rp {totalPrice.toLocaleString()}</div>
                  </div>
                  <button onClick={() => { 
                      if(totalItemsInCart < 4) return alert("Pilih minimal 4 menu untuk melanjutkan 🙏"); 
                      setStep(3); 
                    }} className="btn btn-primary">
                    CHECKOUT ➔
                  </button>
               </div>
            </div>
          </div>
        )}

        {/* STEP 3: KONFIRMASI */}
        {step === 3 && (
          <form onSubmit={handleSubmit} className="mt-4">
            <h2 className="text-center text-primary mb-4"> Data Pemesan</h2>
            <div className="card">
                <div className="flex justify-between mb-4" style={{borderBottom:'1px solid #eee', paddingBottom:'10px'}}><span>Total Tagihan</span><b className="text-primary" style={{fontSize:'1.2em'}}>Rp {totalPrice.toLocaleString()}</b></div>
                <div className="form-group"><label className="label">Nama Lengkap</label><input required className="input" placeholder="Contoh: Budi" onChange={(e) => setCustomer({...customer, name: e.target.value})} /></div>
                {/* Note global dihapus karena sudah ada per item */}
            </div>
            <div className="flex mt-4"><button type="button" onClick={() => setStep(2)} className="btn btn-ghost" style={{flex:1}}>Kembali</button><button type="submit" disabled={loading} className="btn btn-primary" style={{flex:2}}>{loading ? "Menyimpan..." : "KIRIM PESANAN ✅"}</button></div>
          </form>
        )}

        {/* STEP 4: SUKSES */}
        {step === 4 && (
          <div className="text-center mt-8">
            <h2 className="text-primary" style={{fontSize:'2em'}}>Pesanan Siap! </h2>
            <p className="mb-4">Langkah terakhir konfirmasi ke admin.</p>
            <a href={generateWaLink()} target="_blank" rel="noreferrer" className="btn btn-secondary btn-block" style={{padding:'20px', fontSize:'1.2em'}}> KIRIM KE ADMIN</a>
            <button onClick={() => window.location.reload()} className="btn btn-ghost mt-4">↻ Buat Pesanan Baru</button>
          </div>
        )}
      </div>

      {/* MODAL PROMO */}
      {isPromoOpen && (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="flex justify-between mb-4"><h3>Pilih Menu Paket</h3><button onClick={() => setIsPromoOpen(false)} className="btn btn-ghost" style={{padding:'5px'}}>✕</button></div>
                <div className="form-group"><label className="label">Makanan</label><select className="select" onChange={(e) => setPromoSelection({...promoSelection, food: e.target.value})}><option value="">-- Pilih Makanan --</option>{menuItems.filter(i => i.category === 'Food').map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</select></div>
                <div className="form-group"><label className="label">Minuman</label><select className="select" onChange={(e) => setPromoSelection({...promoSelection, drink: e.target.value})}><option value="">-- Pilih Minuman --</option>{menuItems.filter(i => i.category === 'Coffee' || i.category === 'Non-Coffee').map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</select></div>
                <button onClick={handleAddBundle} className="btn btn-primary btn-block mt-4">SIMPAN PAKET</button>
            </div>
        </div>
      )}
    </div>
  );
}