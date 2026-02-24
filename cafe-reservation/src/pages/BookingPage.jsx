import { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { collection, query, where, getDocs, addDoc } from "firebase/firestore";

export default function BookingPage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  // State Step 1 & 2: Waktu, Orang & Tempat
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [time, setTime] = useState(""); 
  const [partySize, setPartySize] = useState(2);
  const [selectedSpot, setSelectedSpot] = useState(null);
  const [bookedSpots, setBookedSpots] = useState([]);
  
  const [customer, setCustomer] = useState({ name: "", phone: "" }); 
  
  // State Data Master dari Database
  const [packages, setPackages] = useState([]);
  const [spots, setSpots] = useState([]); 
  const [products, setProducts] = useState([]); 
  
  // State Keranjang Paket
  const [bundles, setBundles] = useState([]); 
  const [totalPrice, setTotalPrice] = useState(0);

  // State Modal Pilihan Isi Paket
  const [isPackageModalOpen, setIsPackageModalOpen] = useState(false);
  const [selectedPkg, setSelectedPkg] = useState(null);
  const [pkgSelection, setPkgSelection] = useState({ foodId: "", drinkId: "" });

  // Ambil semua data Master dari Firestore
  useEffect(() => {
      const fetchData = async () => {
          const pkgSnap = await getDocs(query(collection(db, "packages"), where("isAvailable", "==", true)));
          setPackages(pkgSnap.docs.map(d => ({ id: d.id, ...d.data() })));
          
          const prodSnap = await getDocs(query(collection(db, "products"), where("isAvailable", "==", true)));
          setProducts(prodSnap.docs.map(d => ({ id: d.id, ...d.data() })));

          const spotSnap = await getDocs(query(collection(db, "spots"), where("isAvailable", "==", true)));
          setSpots(spotSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      };
      fetchData();
  }, []);

  // Hitung Total Harga dari keranjang
  useEffect(() => {
    const total = bundles.reduce((sum, b) => sum + b.subtotal, 0);
    setTotalPrice(total);
  }, [bundles]);

  const handleStep1Submit = async () => {
    if(!date || !time) return alert("Mohon isi tanggal & jam kedatangan dulu ya 🙏");
    if (new Date(`${date}T${time}`) < new Date()) return alert("Waktu sudah berlalu! Mohon pilih jadwal masa depan 😅");
    
    setLoading(true);
    try {
        const q = query(collection(db, "reservations"), where("date", "==", date));
        const snap = await getDocs(q);
        const booked = snap.docs.map(d => d.data()).filter(data => data.status !== 'rejected').map(data => data.spotId);
            
        setBookedSpots(booked);
        setSelectedSpot(null);
        setStep(2); 
    } catch(e) {
        alert("Gagal mengecek ketersediaan tempat.");
    } finally {
        setLoading(false);
    }
  };

  const openPackageSelection = (pkg) => {
      setSelectedPkg(pkg);
      setPkgSelection({ foodId: "", drinkId: "" });
      setIsPackageModalOpen(true);
  };

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
          unitPrice: selectedPkg.price,
          qty: 1,
          subtotal: selectedPkg.price,
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
    if (bundles.length !== partySize) {
      return alert(`Jumlah paket harus sama dengan jumlah orang (${partySize} orang). Saat ini baru ${bundles.length} paket.`);
    }
    setLoading(true);

    const orderItems = bundles.map(b => ({
      name: b.name, qty: b.qty, price: b.unitPrice, subtotal: b.subtotal, selections: b.selections, note: b.note || "" 
    }));

    try {
      await addDoc(collection(db, "reservations"), {
        date, time, partySize, spotId: selectedSpot.id, spotName: selectedSpot.name, 
        customerName: customer.name, customerPhone: customer.phone,
        items: orderItems, totalPrice, status: "pending", createdAt: new Date()
      });
      setStep(5); 
    } catch (error) { alert("Gagal menyimpan reservasi."); } finally { setLoading(false); }
  };

  const generateWaLink = () => {
    const phoneNumber = "6288989719187"; 
    const orderText = bundles.map(b => {
        const note = b.note ? ` _(Catatan: ${b.note})_` : "";
      return `- ${b.qty}x *${b.name}*\n  > Pilihan: ${b.selections}\n  > Subtotal: Rp ${b.subtotal.toLocaleString()}${note}`;
    }).join("\n\n");

    const message = `Halo Cafe Tropis 🌵,\nSaya ingin reservasi:\n\n *Nama:* ${customer.name}\n *Jadwal:* ${time}, ${date}\n *Orang:* ${partySize} Pax\n *Tempat:* ${selectedSpot.name}\n\n *Order Paket:*\n${orderText}\n\n *Total: Rp ${totalPrice.toLocaleString()}*`;
    return `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
  };

  return (
    <div style={{ paddingBottom: '120px' }}>
      <div className="navbar">
          <div className="logo">🌵 Cafe Tropis</div>
          {step < 5 && <div className="badge badge-green">Langkah {step} / 4</div>}
      </div>

      <div className="container">
        
        {/* STEP 1: WAKTU */}
        {step === 1 && (
          <div className="text-center mt-4">
            <h2 className="text-lg">Kapan mau mampir?</h2>
            <div className="card text-left mt-4">
              <div className="form-group"><label className="label">Tanggal</label><input type="date" className="input" value={date} min={new Date().toISOString().split("T")[0]} onChange={(e) => setDate(e.target.value)} /></div>
              <div className="form-group"><label className="label"> Jam</label><input type="time" className="input" value={time} onChange={(e) => setTime(e.target.value)} /></div>
            </div>
            <button onClick={() => setTime("17:45")} className="btn btn-ghost btn-block mb-4" style={{border:'2px solid #047857', color:'#047857'}}>🌙 Shortcut Buka Puasa (17:45)</button>
            <button onClick={handleStep1Submit} disabled={loading} className="btn btn-primary btn-block" style={{padding: '15px', fontSize: '1.1em'}}>
              {loading ? "Mengecek Ketersediaan..." : "LANJUT ➔"}
            </button>
          </div>
        )}

        {/* STEP 2: TEMPAT & PAX */}
        {step === 2 && (
          <div className="mt-4">
            <h2 className="text-lg mb-4 text-primary text-center">📍 Pilih Tempat Duduk</h2>
            
            <div className="card mb-4" style={{background: '#f9f9f9', padding: '15px'}}>
               <label className="label" style={{marginBottom: '5px'}}> Untuk Berapa Orang?</label>
               <input type="number" min="1" className="input" value={partySize} 
                 onChange={e => {
                   const value = e.target.value;
                   if (value === "") {
                     setPartySize("");
                   } else {
                     setPartySize(Math.max(1, Number(value)));
                   }
                     setSelectedSpot(null); 
                 }}
                 onBlur={() => {
                     if (!partySize || partySize < 1) setPartySize(1);
                 }}
               />
               <small style={{color: '#666', marginTop: '5px', display: 'block'}}>Kapasitas meja akan menyesuaikan jumlah orang.</small>
            </div>

            {spots.length === 0 ? (
                <div className="text-center card" style={{padding:'20px', color:'#999'}}>Belum ada tempat yang tersedia.</div>
            ) : (
                <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:'15px', marginBottom: '20px'}}>
                    {spots.map(spot => {
                        const isBooked = bookedSpots.includes(spot.id);
                        const notEnoughPax = partySize < spot.min;
                      const isClosedAtSelectedDate = Array.isArray(spot.unavailableDates) && spot.unavailableDates.includes(date);
                      const isDisabled = isBooked || notEnoughPax || isClosedAtSelectedDate;
                        const isSelected = selectedSpot?.id === spot.id;

                        return (
                            <div key={spot.id} 
                                onClick={() => !isDisabled && setSelectedSpot(spot)}
                                style={{
                                    border: isSelected ? '3px solid #047857' : '1px solid #ddd',
                                    borderRadius: '12px',
                                    overflow: 'hidden',
                                    opacity: isDisabled ? 0.5 : 1,
                                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                                    position: 'relative',
                                    background: 'white',
                                    boxShadow: isSelected ? '0 4px 10px rgba(4, 120, 87, 0.3)' : '0 2px 5px rgba(0,0,0,0.05)',
                                    transition: '0.2s'
                                }}>
                                {spot.img ? (
                                  <img src={spot.img} alt={spot.name} style={{width:'100%', aspectRatio:'1 / 1', objectFit:'cover', display:'block'}} />
                                ) : (
                                  <div style={{width:'100%', aspectRatio:'1 / 1', background:'#eee', display:'flex', alignItems:'center', justifyContent:'center'}}>No Image</div>
                                )}
                                <div style={{padding:'10px', textAlign:'center'}}>
                                    <b style={{display:'block', fontSize: '0.9em', color: '#333'}}>{spot.name}</b>
                                    <span style={{fontSize: '0.75em', color: '#666'}}>Min. {spot.min} Orang</span>
                                </div>
                                
                                {isBooked && <div style={{position:'absolute', top:'10px', left:'10px', background:'#ef4444', color:'white', padding:'4px 8px', fontSize:'0.7em', borderRadius:'6px', fontWeight:'bold'}}>Terisi</div>}
                                {!isBooked && !isClosedAtSelectedDate && notEnoughPax && <div style={{position:'absolute', top:'10px', left:'10px', background:'#f59e0b', color:'white', padding:'4px 8px', fontSize:'0.7em', borderRadius:'6px', fontWeight:'bold'}}>Kurang Orang</div>}
                                {!isBooked && isClosedAtSelectedDate && <div style={{position:'absolute', top:'10px', left:'10px', background:'#6b7280', color:'white', padding:'4px 8px', fontSize:'0.7em', borderRadius:'6px', fontWeight:'bold'}}>Tutup Hari Ini</div>}
                                {isSelected && <div style={{position:'absolute', top:'10px', right:'10px', background:'#047857', color:'white', padding:'4px 8px', fontSize:'0.7em', borderRadius:'6px', fontWeight:'bold'}}>✓ Dipilih</div>}
                            </div>
                        )
                    })}
                </div>
            )}

            <div className="flex mt-4 gap-2">
                <button onClick={() => setStep(1)} className="btn btn-ghost" style={{flex:1}}>Kembali</button>
                <button onClick={() => {
                  if (!partySize || partySize < 1) return alert("Jumlah orang minimal 1 ya.");
                    if(!selectedSpot) return alert("Silakan pilih tempat duduk yang tersedia terlebih dahulu!");
                    setStep(3);
                }} className="btn btn-primary" style={{flex:2}}>LANJUT PILIH PAKET ➔</button>
            </div>
          </div>
        )}

        {/* STEP 3: PILIH PAKET (TANPA GAMBAR) */}
        {step === 3 && (
          <div className="mt-4">
            <h2 className="text-lg mb-4 text-primary"> Pilih Paket Tersedia</h2>
            
            <div style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
              {packages.length === 0 ? (
                <div className="text-center card" style={{padding:'40px', color:'#999'}}>Belum ada paket.</div>
              ) : (
                packages.map((pkg) => (
                  <div key={pkg.id} className="card" style={{padding: '20px', overflow: 'hidden', border: '1px solid #eee', borderTop: '5px solid #047857', boxShadow: '0 4px 12px rgba(0,0,0,0.05)'}}>
                    
                    {/* INFO PAKET (Hanya Teks) */}
                    <div style={{marginBottom: '15px'}}>
                       <h3 style={{margin: '0 0 5px 0', color: '#047857', fontSize: '1.3em'}}>{pkg.name}</h3>
                       {pkg.description && <p style={{color: '#666', fontSize: '0.9em', margin: '5px 0 10px 0'}}>{pkg.description}</p>}
                       <div className="text-primary font-bold" style={{fontSize: '1.2em'}}>
                           Rp {pkg.price.toLocaleString()}
                       </div>
                    </div>
                    <button onClick={() => openPackageSelection(pkg)} className="btn btn-primary btn-block" style={{padding: '12px', fontSize: '1.05em', borderRadius: '8px'}}>
                        + Pilih Paket Ini
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* KERANJANG AKTIF */}
            {bundles.length > 0 && (
                 <div className="mt-8">
                <h3 style={{borderBottom: '1px solid #ddd', paddingBottom: '10px'}}>Keranjang Anda ({bundles.length}/{partySize} paket):</h3>
                    {bundles.map((b, idx) => (
                        <div key={b.id} className="card" style={{padding:'15px', marginBottom:'10px', background: '#f4f7f6'}}>
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                  <b style={{color: '#047857'}}>{b.name}</b>
                                    <div style={{fontSize:'0.85em', color:'#555', marginTop:'2px'}}>Pilihan: <b>{b.selections}</b></div>
                                </div>
                                <div className="flex" style={{flexDirection: 'column', alignItems:'flex-end'}}>
                                  <b>Rp {b.subtotal.toLocaleString()}</b>
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
                  <button onClick={() => setStep(2)} className="btn btn-ghost" style={{padding: '12px 15px'}}>← Tempat</button>
                  <div style={{textAlign: 'right'}}>
                    <small style={{fontWeight: 'bold', color: '#666'}}>Total Estimasi</small>
                    <div className="text-lg text-primary" style={{fontWeight: '900', marginBottom: '5px'}}>Rp {totalPrice.toLocaleString()}</div>
                    <button onClick={() => {
                      if (bundles.length === 0) return alert("Pilih minimal 1 paket 🙏");
                      if (bundles.length !== partySize) return alert(`Jumlah paket harus pas ${partySize}. Saat ini ${bundles.length}.`);
                      setStep(4);
                    }} className="btn btn-primary">CHECKOUT ➔</button>
                  </div>
               </div>
            </div>
          </div>
        )}

        {/* MODAL PELANGGAN MEMILIH ISI PAKET */}
        {isPackageModalOpen && selectedPkg && (
            <div className="modal-overlay">
                <div className="modal-content" style={{maxWidth: '520px', width: '100%', maxHeight: '85vh', overflowY: 'auto', padding: '20px'}}>
                    <h3 style={{color: '#047857', borderBottom: '1px solid #eee', paddingBottom: '10px'}}>Racik {selectedPkg.name}</h3>
                    
                    {selectedPkg.foodOptions && selectedPkg.foodOptions.length > 0 && (
                        <div className="form-group mt-4">
                            <label className="label">Pilih Makanan:</label>
                        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(120px, 1fr))', gap:'10px'}}>
                          {selectedPkg.foodOptions.map(id => {
                            const p = products.find(prod => prod.id === id);
                            if (!p) return null;
                            const isSelectedFood = pkgSelection.foodId === id;
                            return (
                              <button
                                key={id}
                                type="button"
                                onClick={() => setPkgSelection({...pkgSelection, foodId: id})}
                                style={{
                                  border: isSelectedFood ? '2px solid #047857' : '1px solid #ddd',
                                  borderRadius: '10px',
                                  padding: 0,
                                  overflow: 'hidden',
                                  background: '#fff',
                                  cursor: 'pointer',
                                  textAlign: 'left'
                                }}
                              >
                                {p.img ? (
                                  <img src={p.img} alt={p.name} style={{width:'100%', aspectRatio:'1 / 1', objectFit:'cover', display:'block'}} />
                                ) : (
                                  <div style={{width:'100%', aspectRatio:'1 / 1', background:'#eee', display:'flex', alignItems:'center', justifyContent:'center', color:'#888', fontSize:'0.8em'}}>No Image</div>
                                )}
                                <div style={{padding:'8px', fontSize:'0.85em', fontWeight:isSelectedFood ? 'bold' : 'normal', color:'#333'}}>{p.name}</div>
                              </button>
                            );
                          })}
                        </div>
                        </div>
                    )}

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

                    <div className="flex mt-4 pt-4" style={{borderTop: '1px solid #eee', position: 'sticky', bottom: 0, background: '#fff'}}>
                        <button onClick={() => setIsPackageModalOpen(false)} className="btn btn-ghost" style={{flex:1}}>Batal</button>
                        <button onClick={handleAddBundleToCart} className="btn btn-primary" style={{flex:2}}>SIMPAN</button>
                    </div>
                </div>
            </div>
        )}

        {/* STEP 4: KONFIRMASI */}
        {step === 4 && (
          <form onSubmit={handleSubmit} className="mt-4">
            <h2 className="text-center text-primary mb-4">📝 Konfirmasi Pesanan</h2>
            
            <div className="card mb-4" style={{background:'#f4f7f6', border:'1px solid #047857'}}>
                <h3 style={{marginTop:0, fontSize:'1rem'}}>Info Tempat</h3>
                <div style={{fontSize: '0.9em'}}>
                     {date} |  {time} <br/>
                     {partySize} Orang <br/>
                     <b>{selectedSpot.name}</b>
                </div>
            </div>

            <div className="card mb-4" style={{background:'#f8fafc', border:'1px solid #e2e8f0'}}>
                <h3 style={{marginTop:0, fontSize:'1rem', borderBottom:'1px solid #ddd', paddingBottom:'10px', marginBottom:'10px'}}>Cek Pesananmu:</h3>
                <div style={{maxHeight:'250px', overflowY:'auto'}}>
                    {bundles.map((b, i) => (
                        <div key={i} style={{display:'flex', justifyContent:'space-between', marginBottom:'12px', fontSize:'0.95em', borderBottom:'1px dashed #ccc', paddingBottom:'8px'}}>
                            <div style={{flex:1, paddingRight: '10px'}}>
                                <div style={{fontWeight:'bold', color: '#047857'}}>{b.name}</div>
                                <div style={{fontSize:'0.85em', color:'#666', marginTop: '2px'}}>Pilihan: {b.selections}</div>
                                {b.note && <div style={{fontSize:'0.85em', color:'#d97706', fontStyle:'italic', marginTop: '4px'}}>📝 {b.note}</div>}
                            </div>
                              <div style={{fontWeight:'bold'}}>Rp {b.subtotal.toLocaleString()}</div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="card">
                <div className="flex justify-between mb-4" style={{borderBottom:'1px solid #eee', paddingBottom:'10px'}}><span style={{fontWeight: 'bold', color: '#666'}}>Total Tagihan</span><b className="text-primary" style={{fontSize:'1.3em'}}>Rp {totalPrice.toLocaleString()}</b></div>
                <div className="form-group"><label className="label">Nama Lengkap</label><input required className="input" placeholder="Contoh: Budi" onChange={(e) => setCustomer({...customer, name: e.target.value})} /></div>
                {/* <div className="form-group"><label className="label"> Nomor WhatsApp</label><input required type="tel" className="input" placeholder="08..." onChange={(e) => setCustomer({...customer, phone: e.target.value})} /></div> */}
            </div>
            <div className="flex mt-4 gap-2">
                <button type="button" onClick={() => setStep(3)} className="btn btn-ghost" style={{flex:1, border: '1px solid #ddd'}}>← Ubah</button>
                <button type="submit" disabled={loading} className="btn btn-primary" style={{flex:2}}>{loading ? "Proses..." : "KIRIM PESANAN ✅"}</button>
            </div>
          </form>
        )}

        {/* STEP 5: SUKSES */}
        {step === 5 && (
          <div className="text-center mt-8">
            <h2 className="text-primary" style={{fontSize:'2.2em', margin: '0 0 10px 0'}}>Siap Dipesan! 🚀</h2>
            <p className="mb-4" style={{color: '#666'}}>Satu langkah lagi! Kirim rincian pesanan paket ini ke WhatsApp Admin untuk diproses.</p>
            <a href={generateWaLink()} target="_blank" rel="noreferrer" className="btn btn-secondary btn-block shadow" style={{padding:'20px', fontSize:'1.2em', display: 'flex', gap: '10px'}}><span style={{fontSize: '1.5em'}}></span> KIRIM KE WHATSAPP</a>
            <button onClick={() => window.location.reload()} className="btn btn-ghost mt-6" style={{color: '#888'}}>↻ Buat Pesanan Baru</button>
          </div>
        )}
      </div>
    </div>
  );
}