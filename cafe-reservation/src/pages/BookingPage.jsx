import { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, query, where, getDocs, addDoc } from "firebase/firestore";

export default function BookingPage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [time, setTime] = useState(""); 
  const [customer, setCustomer] = useState({ name: "", phone: "" }); 
  
  const [packages, setPackages] = useState([]);
  const [products, setProducts] = useState([]); // Butuh untuk membaca nama menu
  const [bundles, setBundles] = useState([]); // Keranjang Paket
  const [totalPrice, setTotalPrice] = useState(0);

  // State untuk Modal Pilihan Pelanggan
  const [isPackageModalOpen, setIsPackageModalOpen] = useState(false);
  const [selectedPkg, setSelectedPkg] = useState(null);
  const [pkgSelection, setPkgSelection] = useState({ foodId: "", drinkId: "" });

  useEffect(() => {
      const fetchData = async () => {
          // Ambil Paket
          const pkgSnap = await getDocs(query(collection(db, "packages"), where("isAvailable", "==", true)));
          setPackages(pkgSnap.docs.map(d => ({ id: d.id, ...d.data() })));
          // Ambil Produk (Menu)
          const prodSnap = await getDocs(query(collection(db, "products"), where("isAvailable", "==", true)));
          setProducts(prodSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      };
      fetchData();
  }, []);

  useEffect(() => {
    const total = bundles.reduce((sum, b) => sum + b.price, 0);
    setTotalPrice(total);
  }, [bundles]);

  const handleStep1Submit = () => {
    if(!date || !time) return alert("Mohon isi tanggal & jam kedatangan dulu ya 🙏");
    if (new Date(`${date}T${time}`) < new Date()) return alert("Waktu sudah berlalu! Mohon pilih jadwal masa depan 😅");
    setStep(2);
  };

  // Membuka Modal Pilihan Paket
  const openPackageSelection = (pkg) => {
      setSelectedPkg(pkg);
      setPkgSelection({ foodId: "", drinkId: "" });
      setIsPackageModalOpen(true);
  };

  // Menyimpan Paket ke Keranjang
  const handleAddBundleToCart = () => {
      const needsFood = selectedPkg.foodOptions?.length > 0;
      const needsDrink = selectedPkg.drinkOptions?.length > 0;

      if (needsFood && !pkgSelection.foodId) return alert("Silakan pilih makanannya!");
      if (needsDrink && !pkgSelection.drinkId) return alert("Silakan pilih minumannya!");

      const foodName = products.find(p => p.id === pkgSelection.foodId)?.name || "";
      const drinkName = products.find(p => p.id === pkgSelection.drinkId)?.name || "";
      
      const selectionsText = [foodName, drinkName].filter(Boolean).join(" & ");

      setBundles([...bundles, {
          id: `pkg-${Date.now()}`,
          name: selectedPkg.name,
          price: selectedPkg.price,
          selections: selectionsText || "Tanpa pilihan khusus",
          note: ""
      }]);
      
      setIsPackageModalOpen(false);
  };

  const removeBundle = (index) => {
      const newBundles = [...bundles];
      newBundles.splice(index, 1);
      setBundles(newBundles);
  };

  const updateBundleNote = (index, text) => {
      const newBundles = [...bundles];
      newBundles[index].note = text;
      setBundles(newBundles);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const orderItems = bundles.map(b => ({
        name: b.name, 
        qty: 1, 
        price: b.price, 
        subtotal: b.price,
        selections: b.selections, // Pilihan kombinasi
        note: b.note || "" 
    }));

    try {
      await addDoc(collection(db, "reservations"), {
        date, time, customerName: customer.name, customerPhone: customer.phone,
        items: orderItems, totalPrice, status: "pending", createdAt: new Date()
      });
      setStep(4); 
    } catch (error) { alert("Gagal menyimpan reservasi."); } finally { setLoading(false); }
  };

  const generateWaLink = () => {
    const phoneNumber = "6287819502426"; 
    const orderText = bundles.map(b => {
        const note = b.note ? ` _(Catatan: ${b.note})_` : "";
        return `- 1x *${b.name}*\n  > Pilihan: ${b.selections}${note}`;
    }).join("\n\n");

    const message = `Halo Cafe Tropis 🌵,\nSaya ingin reservasi:\n\n👤 *Nama:* ${customer.name}\n📅 *Jam:* ${time}, ${date}\n\n📦 *Order Paket:*\n${orderText}\n\n💰 *Total: Rp ${totalPrice.toLocaleString()}*`;
    return `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
  };

  return (
    <div style={{ paddingBottom: '120px' }}>
      <div className="navbar"><div className="logo">🌵 Cafe Tropis</div>{step < 4 && <div className="badge badge-green">Langkah {step} / 3</div>}</div>

      <div className="container">
        
        {/* STEP 1: WAKTU */}
        {step === 1 && (
          <div className="text-center mt-4">
            <h2 className="text-lg">Kapan mau mampir?</h2>
            <div className="card text-left mt-4">
              <div className="form-group"><label className="label"> Tanggal</label><input type="date" className="input" value={date} min={new Date().toISOString().split("T")[0]} onChange={(e) => setDate(e.target.value)} /></div>
              <div className="form-group"><label className="label"> Jam</label><input type="time" className="input" value={time} onChange={(e) => setTime(e.target.value)} /></div>
            </div>
            <button onClick={() => setTime("17:45")} className="btn btn-ghost btn-block mb-4" style={{border:'2px solid #047857', color:'#047857'}}>🌙 Shortcut Buka Puasa (17:45)</button>
            <button onClick={handleStep1Submit} className="btn btn-primary btn-block" style={{padding: '15px', fontSize: '1.1em'}}>LANJUT PILIH PAKET ➔</button>
          </div>
        )}

        {/* STEP 2: PILIH PAKET */}
        {step === 2 && (
          <div className="mt-4">
            <h2 className="text-lg mb-4 text-primary">Pilih Paket Tersedia</h2>
            
            <div>
              {packages.length === 0 ? (
                <div className="text-center card" style={{padding:'40px', color:'#999'}}>Belum ada paket.</div>
              ) : (
                packages.map((pkg) => (
                  <div key={pkg.id} className="card" style={{padding:'20px', borderTop: '5px solid #047857', marginBottom: '20px'}}>
                    <div style={{marginBottom: '15px'}}>
                       <h3 style={{margin: '0 0 5px 0', color: '#047857'}}>{pkg.name}</h3>
                       <div className="text-primary font-bold" style={{fontSize: '1.2em'}}>Rp {pkg.price.toLocaleString()}</div>
                    </div>
                    <button onClick={() => openPackageSelection(pkg)} className="btn btn-primary btn-block">+ Tambah Paket Ini</button>
                  </div>
                ))
              )}
            </div>

            {/* KERANJANG AKTIF */}
            {bundles.length > 0 && (
                 <div className="mt-8">
                    <h3 style={{borderBottom: '1px solid #ddd', paddingBottom: '10px'}}>Keranjang Anda:</h3>
                    {bundles.map((b, idx) => (
                        <div key={b.id} className="card" style={{padding:'15px', marginBottom:'10px', background: '#f4f7f6'}}>
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <b style={{color: '#047857'}}>{b.name}</b>
                                    <div style={{fontSize:'0.85em', color:'#555', marginTop:'2px'}}>Pilihan: <b>{b.selections}</b></div>
                                </div>
                                <div className="flex" style={{flexDirection: 'column', alignItems:'flex-end'}}>
                                    <b>Rp {b.price.toLocaleString()}</b>
                                    <button onClick={() => removeBundle(idx)} className="btn btn-danger" style={{padding:'4px 10px', marginTop:'5px', fontSize:'0.75em'}}>Hapus ✕</button>
                                </div>
                            </div>
                            <input className="input" style={{padding:'8px', fontSize:'0.85em', background:'#fff', border: '1px solid #ccc', marginTop: '10px'}}
                                placeholder="Catatan spesifik (Misal: Es dipisah)..." value={b.note} onChange={(e) => updateBundleNote(idx, e.target.value)} />
                        </div>
                    ))}
                 </div>
            )}
            
            {/* FOOTER KERANJANG */}
            <div style={{ position:'fixed', bottom:0, left:0, right:0, padding:'20px', background:'white', borderTop:'1px solid #eee', boxShadow:'0 -5px 15px rgba(0,0,0,0.05)', zIndex: 100 }}>
               <div className="container flex justify-between align-center" style={{padding: 0}}>
                  <div>
                    <small style={{fontWeight: 'bold', color: '#666'}}>Total Estimasi</small>
                    <div className="text-lg text-primary" style={{fontWeight: '900'}}>Rp {totalPrice.toLocaleString()}</div>
                  </div>
                  <button onClick={() => { if(bundles.length === 0) return alert("Pilih minimal 1 paket 🙏"); setStep(3); }} className="btn btn-primary" style={{padding: '12px 25px', fontSize: '1.1em'}}>CHECKOUT ➔</button>
               </div>
            </div>
          </div>
        )}

        {/* MODAL PELANGGAN MEMILIH ISI PAKET */}
        {isPackageModalOpen && selectedPkg && (
            <div className="modal-overlay">
                <div className="modal-content">
                    <h3 style={{color: '#047857', borderBottom: '1px solid #eee', paddingBottom: '10px'}}>Racik {selectedPkg.name}</h3>
                    
                    {/* JIKA PAKET PUNYA OPSI MAKANAN */}
                    {selectedPkg.foodOptions && selectedPkg.foodOptions.length > 0 && (
                        <div className="form-group mt-4">
                            <label className="label">Pilih Makanan:</label>
                            <select className="select" value={pkgSelection.foodId} onChange={e => setPkgSelection({...pkgSelection, foodId: e.target.value})}>
                                <option value="">-- Pilih Makanan --</option>
                                {selectedPkg.foodOptions.map(id => {
                                    const p = products.find(prod => prod.id === id);
                                    return p ? <option key={id} value={id}>{p.name}</option> : null;
                                })}
                            </select>
                        </div>
                    )}

                    {/* JIKA PAKET PUNYA OPSI MINUMAN */}
                    {selectedPkg.drinkOptions && selectedPkg.drinkOptions.length > 0 && (
                        <div className="form-group mt-4">
                            <label className="label">Pilih Minuman:</label>
                            <select className="select" value={pkgSelection.drinkId} onChange={e => setPkgSelection({...pkgSelection, drinkId: e.target.value})}>
                                <option value="">-- Pilih Minuman --</option>
                                {selectedPkg.drinkOptions.map(id => {
                                    const p = products.find(prod => prod.id === id);
                                    return p ? <option key={id} value={id}>{p.name}</option> : null;
                                })}
                            </select>
                        </div>
                    )}

                    <div className="flex mt-4 pt-4" style={{borderTop: '1px solid #eee'}}>
                        <button onClick={() => setIsPackageModalOpen(false)} className="btn btn-ghost" style={{flex:1}}>Batal</button>
                        <button onClick={handleAddBundleToCart} className="btn btn-primary" style={{flex:2}}>MASUKKAN KERANJANG</button>
                    </div>
                </div>
            </div>
        )}

        {/* STEP 3 & 4 (KONFIRMASI & SUKSES) */}
        {step === 3 && (
          <form onSubmit={handleSubmit} className="mt-4">
            <h2 className="text-center text-primary mb-4">📝 Konfirmasi Pesanan</h2>
            <div className="card mb-4" style={{background:'#f8fafc', border:'1px solid #e2e8f0'}}>
                <h3 style={{marginTop:0, fontSize:'1rem', borderBottom:'1px solid #ddd', paddingBottom:'10px', marginBottom:'10px'}}>Cek Pesananmu:</h3>
                <div style={{maxHeight:'250px', overflowY:'auto'}}>
                    {bundles.map((b, i) => (
                        <div key={i} style={{display:'flex', justifyContent:'space-between', marginBottom:'12px', fontSize:'0.95em', borderBottom:'1px dashed #ccc', paddingBottom:'8px'}}>
                            <div style={{flex:1, paddingRight: '10px'}}>
                                <div style={{fontWeight:'bold', color: '#047857'}}>1x {b.name}</div>
                                <div style={{fontSize:'0.85em', color:'#666', marginTop: '2px'}}>Pilihan: {b.selections}</div>
                                {b.note && <div style={{fontSize:'0.85em', color:'#d97706', fontStyle:'italic', marginTop: '4px'}}>📝 {b.note}</div>}
                            </div>
                            <div style={{fontWeight:'bold'}}>Rp {b.price.toLocaleString()}</div>
                        </div>
                    ))}
                </div>
            </div>
            <div className="card">
                <div className="flex justify-between mb-4" style={{borderBottom:'1px solid #eee', paddingBottom:'10px'}}><span style={{fontWeight: 'bold', color: '#666'}}>Total Tagihan</span><b className="text-primary" style={{fontSize:'1.3em'}}>Rp {totalPrice.toLocaleString()}</b></div>
                <div className="form-group"><label className="label"> Nama Lengkap</label><input required className="input" placeholder="Contoh: Budi" onChange={(e) => setCustomer({...customer, name: e.target.value})} /></div>
                {/* <div className="form-group"><label className="label">📱 Nomor WhatsApp</label><input required type="tel" className="input" placeholder="08..." onChange={(e) => setCustomer({...customer, phone: e.target.value})} /></div> */}
            </div>
            <div className="flex mt-4 gap-2">
                <button type="button" onClick={() => setStep(2)} className="btn btn-ghost" style={{flex:1, border: '1px solid #ddd'}}>← Ubah Pesanan</button>
                <button type="submit" disabled={loading} className="btn btn-primary" style={{flex:2}}>{loading ? "Proses..." : "KIRIM PESANAN ✅"}</button>
            </div>
          </form>
        )}
        {step === 4 && (
          <div className="text-center mt-8">
            <h2 className="text-primary" style={{fontSize:'2.2em', margin: '0 0 10px 0'}}>Siap Dipesan! 🚀</h2>
            <p className="mb-4" style={{color: '#666'}}>Satu langkah lagi! Kirim rincian pesanan paket ini ke WhatsApp Admin.</p>
            <a href={generateWaLink()} target="_blank" rel="noreferrer" className="btn btn-secondary btn-block shadow" style={{padding:'20px', fontSize:'1.2em', display: 'flex', gap: '10px'}}><span style={{fontSize: '1.5em'}}>💬</span> KIRIM KE WHATSAPP</a>
            <button onClick={() => window.location.reload()} className="btn btn-ghost mt-6" style={{color: '#888'}}>↻ Buat Pesanan Baru</button>
          </div>
        )}
      </div>
    </div>
  );
}