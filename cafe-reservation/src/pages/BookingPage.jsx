import { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, query, where, getDocs, addDoc } from "firebase/firestore";

export default function BookingPage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [time, setTime] = useState(""); 
  const [customer, setCustomer] = useState({ name: "", phone: "", notes: "" });
  const [menuItems, setMenuItems] = useState([]);
  
  const [cart, setCart] = useState({}); 
  const [bundles, setBundles] = useState([]); 
  const [totalPrice, setTotalPrice] = useState(0);

  const [isPromoOpen, setIsPromoOpen] = useState(false);
  const [promoSelection, setPromoSelection] = useState({ food: "", drink: "" });

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
    if (selectedDateTime < now) {
        alert("Waktu sudah berlalu! Mohon pilih jadwal masa depan 😅");
        return;
    }
    setStep(2);
  };

  const handleAddBundle = () => {
      const food = menuItems.find(i => i.id === promoSelection.food);
      const drink = menuItems.find(i => i.id === promoSelection.drink);
      if (!food || !drink) return alert("Wajib pilih 1 Makanan & 1 Minuman!");

      const newBundle = {
          id: `promo-${Date.now()}`,
          name: `Paket Ramadhan: ${food.name} + ${drink.name}`,
          price: 25000,
          qty: 1
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

  const addToCart = (itemId) => { setCart(prev => ({ ...prev, [itemId]: (prev[itemId] || 0) + 1 })); };
  const removeFromCart = (itemId) => {
    setCart(prev => {
      const currentQty = prev[itemId] || 0;
      if (currentQty <= 1) { const newCart = { ...prev }; delete newCart[itemId]; return newCart; }
      return { ...prev, [itemId]: currentQty - 1 };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const regularItems = Object.keys(cart).map(itemId => {
      const item = menuItems.find(p => p.id === itemId);
      return { name: item.name, qty: cart[itemId], price: item.price, subtotal: item.price * cart[itemId] };
    });

    const bundleItems = bundles.map(b => ({
        name: b.name, qty: 1, price: 25000, subtotal: 25000
    }));

    const finalOrderItems = [...regularItems, ...bundleItems];

    try {
      await addDoc(collection(db, "reservations"), {
        date, time, 
        customerName: customer.name, 
        customerPhone: customer.phone,
        customerNotes: customer.notes,
        items: finalOrderItems, 
        totalPrice: totalPrice, 
        status: "pending", 
        createdAt: new Date()
      });
      setStep(4); 
    } catch (error) { alert("Gagal menyimpan reservasi."); } finally { setLoading(false); }
  };

  const generateWaLink = () => {
    const phoneNumber = "6287819502426"; 
    const regularText = Object.keys(cart).map(itemId => {
        const item = menuItems.find(p => p.id === itemId);
        return `- ${item.name} (${cart[itemId]}x)`;
    }).join("\n");
    const bundleText = bundles.map(b => `- ${b.name}`).join("\n");
    const notesText = customer.notes ? `\n📝 Catatan: ${customer.notes}` : "";
    const message = `Halo Cafe Tropis 🌵,\nSaya ingin reservasi:\n\n👤 Nama: ${customer.name}\n📅 Jam: ${time}, ${date}\n\n🛒 Order:\n${regularText}\n${bundleText}\n${notesText}\n\n💰 Total: Rp ${totalPrice.toLocaleString()}`;
    return `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
  };

  return (
    <div className="min-h-screen bg-base-200 pb-40 font-sans text-neutral selection:bg-primary selection:text-white">
      
      {/* HEADER */}
      <div className="bg-base-100/95 backdrop-blur-md sticky top-0 z-40 border-b border-primary/10 px-6 py-4 flex justify-between items-center shadow-sm">
        <h1 className="font-extrabold text-xl tracking-tight text-primary flex items-center gap-2">
          <span>🌵</span> Cafe Tropis
        </h1>
        {step < 4 && <div className="badge badge-primary font-bold text-white px-3 py-3">Langkah {step} / 3</div>}
      </div>

      <div className="max-w-xl mx-auto p-6">
        
        {/* STEP 1: WAKTU */}
        {step === 1 && (
          <div className="animate-fade-in space-y-8 mt-4">
            <div className="text-center space-y-2">
               <h2 className="text-3xl font-extrabold text-primary">Kapan mau mampir?</h2>
               <p className="opacity-70 font-medium">Atur jadwal kunjunganmu.</p>
            </div>

            <div className="bg-base-100 p-6 rounded-3xl shadow-lg border border-primary/10 space-y-6">
              <div className="form-control">
                <label className="label text-sm font-bold uppercase opacity-80 tracking-wider text-neutral">📅 Tanggal</label>
                <input type="date" className="input input-lg w-full rounded-2xl font-bold bg-base-200 border-2 border-transparent focus:border-primary focus:bg-white transition-all text-lg" 
                  value={date} min={new Date().toISOString().split("T")[0]} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="form-control">
                <label className="label text-sm font-bold uppercase opacity-80 tracking-wider text-neutral">⏰ Jam</label>
                <input type="time" className="input input-lg w-full rounded-2xl font-extrabold text-2xl bg-base-200 border-2 border-transparent focus:border-primary focus:bg-white transition-all" 
                  value={time} onChange={(e) => setTime(e.target.value)} />
              </div>
            </div>

            <button onClick={() => setTime("17:45")} 
              className={`w-full p-5 rounded-2xl flex items-center gap-4 transition-all border-2 shadow-md ${time === "17:45" ? "border-primary bg-primary text-white ring-2 ring-primary ring-offset-2 ring-offset-base-100" : "border-base-300 bg-base-100 hover:border-primary/50"}`}>
                <span className="text-4xl">🌙</span>
                <div className="text-left">
                    <div className="font-bold text-lg">Shortcut Buka Puasa</div>
                    <div className="text-sm opacity-80">Otomatis set jam 17:45</div>
                </div>
            </button>

            <button onClick={handleStep1Submit} 
              className="btn btn-lg w-full rounded-2xl shadow-2xl shadow-primary/40 text-white font-extrabold text-xl h-16 border-none bg-gradient-to-r from-primary to-secondary hover:from-primary hover:to-primary hover:scale-[1.02] active:scale-95 transition-all ring-2 ring-primary/30 ring-offset-2 ring-offset-base-200">
              LANJUT PILIH MENU ➔
            </button>
          </div>
        )}

        {/* STEP 2: MENU */}
        {step === 2 && (
          <div className="animate-fade-in pb-24">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 text-primary">
              🍽️ Pilih Menu
            </h2>
            
            {/* KARTU PROMO (Lebih Elegan) */}
            <div 
                onClick={() => setIsPromoOpen(true)}
                className="bg-gradient-to-br from-primary to-emerald-800 p-6 rounded-3xl mb-8 shadow-xl cursor-pointer hover:shadow-2xl hover:-translate-y-1 transition-all text-white relative overflow-hidden group border border-white/20">
                <div className="absolute -right-4 -top-4 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
                <h3 className="text-2xl font-extrabold flex items-center gap-2">📦 Paket Ramadhan</h3>
                <p className="text-white/90 font-bold mt-1 text-lg">Rp 25.000 <span className="badge badge-accent text-neutral font-bold ml-2">HEMAT!</span></p>
                <div className="mt-4 w-full bg-white text-primary py-3 rounded-xl text-center font-extrabold shadow-md">
                    🔥 AMBIL PROMO
                </div>
            </div>

            {/* KERANJANG AKTIF */}
            {(bundles.length > 0 || Object.keys(cart).length > 0) && (
                 <div className="mb-8 space-y-3">
                    {bundles.map((b, idx) => (
                        <div key={b.id} className="bg-white border-l-8 border-primary p-4 rounded-xl flex justify-between items-center shadow-md">
                            <div>
                                <h4 className="font-bold text-neutral">📦 Paket Ramadhan</h4>
                                <p className="text-xs font-bold opacity-60">{b.name.replace("Paket Ramadhan: ", "")}</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="font-bold text-primary">Rp 25.000</span>
                                <button onClick={() => removeBundle(idx)} className="btn btn-sm btn-square btn-error text-white">✕</button>
                            </div>
                        </div>
                    ))}
                 </div>
            )}

            {/* LIST MENU */}
            <h3 className="font-bold text-lg mb-4 opacity-80 uppercase tracking-widest text-xs text-neutral">Menu Satuan</h3>
            <div className="space-y-4">
              {menuItems.map((item) => (
                <div key={item.id} className="flex flex-col bg-base-100 p-5 rounded-3xl shadow-sm border border-base-200 hover:border-primary transition-all">
                  <div className="flex justify-between items-start mb-4">
                     <div>
                        <h4 className="font-extrabold text-lg text-neutral">{item.name}</h4>
                        <span className="text-[10px] font-bold bg-primary/10 text-primary px-3 py-1 rounded-full uppercase tracking-wide mt-1 inline-block">{item.category}</span>
                     </div>
                     <p className="text-xl font-extrabold text-primary">Rp {item.price.toLocaleString()}</p>
                  </div>
                  
                  {cart[item.id] > 0 ? (
                    <div className="flex items-center justify-between bg-base-200 rounded-2xl p-1.5 border border-base-300">
                      <button onClick={() => removeFromCart(item.id)} className="btn btn-md btn-square btn-ghost bg-white text-xl rounded-xl shadow-sm">-</button>
                      <span className="font-extrabold text-xl w-12 text-center text-neutral">{cart[item.id]}</span>
                      <button onClick={() => addToCart(item.id)} className="btn btn-md btn-square btn-primary text-white text-xl rounded-xl shadow-md">+</button>
                    </div>
                  ) : (
                    <button onClick={() => addToCart(item.id)} className="btn btn-block btn-outline btn-primary font-bold rounded-2xl border-2 hover:bg-primary hover:text-white hover:border-primary">
                      + TAMBAH
                    </button>
                  )}
                </div>
              ))}
            </div>
            
            {/* FOOTER KERANJANG */}
            <div className="fixed bottom-6 left-0 right-0 px-4 z-50 max-w-xl mx-auto">
               <div className="bg-neutral text-white p-4 rounded-3xl shadow-2xl flex justify-between items-center border border-white/10">
                  <div className="pl-3">
                    <p className="text-[10px] uppercase tracking-wider font-bold opacity-70">Total Bayar</p>
                    <p className="text-2xl font-black text-accent">Rp {totalPrice.toLocaleString()}</p>
                  </div>
                  <div className="flex gap-2">
                     <button onClick={() => { if(totalPrice === 0) return alert("Pilih minimal 1 menu"); setStep(3); }} 
                        className="btn btn-lg btn-primary rounded-2xl px-8 text-white font-black shadow-lg border-none">
                        CHECKOUT ➔
                     </button>
                  </div>
               </div>
            </div>
          </div>
        )}

        {/* STEP 3: KONFIRMASI */}
        {step === 3 && (
          <form onSubmit={handleSubmit} className="animate-fade-in space-y-6 mt-4">
            <h2 className="text-2xl font-bold text-center text-primary">📝 Data Pemesan</h2>
            
            <div className="bg-base-100 p-6 rounded-3xl shadow-lg border border-base-200 space-y-5">
                <div className="flex justify-between items-center pb-5 border-b border-base-200">
                    <span className="opacity-70 font-bold text-sm uppercase">Total Tagihan</span>
                    <span className="font-extrabold text-3xl text-primary">Rp {totalPrice.toLocaleString()}</span>
                </div>
                
                <div className="form-control">
                   <label className="label text-xs font-bold uppercase opacity-70 tracking-wider">👤 Nama Lengkap</label>
                   <input required className="input input-lg w-full rounded-2xl font-bold bg-base-200 border-2 border-transparent focus:border-primary focus:bg-white transition-all" 
                      onChange={(e) => setCustomer({...customer, name: e.target.value})} placeholder="Contoh: Budi" />
                </div>
                
                <div className="form-control">
                   <label className="label text-xs font-bold uppercase opacity-70 tracking-wider">📱 WhatsApp</label>
                   <input required type="tel" className="input input-lg w-full rounded-2xl font-bold bg-base-200 border-2 border-transparent focus:border-primary focus:bg-white transition-all" 
                      onChange={(e) => setCustomer({...customer, phone: e.target.value})} placeholder="08..." />
                </div>

                <div className="form-control">
                   <label className="label text-xs font-bold uppercase opacity-70 tracking-wider">📝 Catatan (Opsional)</label>
                   <textarea className="textarea textarea-bordered h-24 rounded-2xl bg-base-200 focus:bg-white focus:border-primary font-medium text-base" 
                      placeholder="Contoh: Jangan pedas, Es dipisah..."
                      onChange={(e) => setCustomer({...customer, notes: e.target.value})}></textarea>
                </div>
                
            </div>

            <div className="flex gap-4 pt-4">
              <button type="button" onClick={() => setStep(2)} className="btn btn-ghost flex-1 rounded-2xl font-bold opacity-70">Kembali</button>
              <button type="submit" disabled={loading} className="btn btn-primary flex-[2] rounded-2xl text-white font-extrabold text-xl shadow-xl shadow-primary/30 h-16 border-none hover:scale-[1.02] active:scale-95 transition-all">
                {loading ? "Menyimpan..." : "KIRIM PESANAN ✅"}
              </button>
            </div>
          </form>
        )}

        {/* STEP 4: SUKSES */}
        {step === 4 && (
          <div className="text-center pt-16 animate-fade-in px-4">
            <h2 className="text-4xl font-black mb-4 text-primary">Pesanan Siap! 🚀</h2>
            <p className="opacity-70 mb-8 max-w-xs mx-auto text-lg leading-relaxed font-medium">
                Langkah terakhir: Kirim detail pesanan ini ke WhatsApp Admin.
            </p>
            <a href={generateWaLink()} target="_blank" rel="noreferrer" 
               className="btn btn-success btn-lg w-full rounded-3xl text-white font-black shadow-xl shadow-success/30 h-20 text-xl flex items-center gap-3 border-none hover:scale-[1.02] transition-all">
              <span className="text-3xl">💬</span> KIRIM KE WHATSAPP
            </a>
            <button onClick={() => window.location.reload()} className="btn btn-ghost mt-8 opacity-50 btn-sm font-bold uppercase tracking-widest">
              ↻ Buat Pesanan Baru
            </button>
          </div>
        )}
      </div>

      {/* MODAL PROMO */}
      {isPromoOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-base-100 w-full max-w-sm rounded-3xl p-8 shadow-2xl animate-scale-in relative border-t-8 border-primary">
                <button onClick={() => setIsPromoOpen(false)} className="btn btn-sm btn-circle btn-ghost absolute right-4 top-4">✕</button>
                <h3 className="text-2xl font-black mb-2 text-primary">Pilih Menu Paket</h3>
                <p className="text-sm font-bold opacity-60 mb-8">1 Makanan + 1 Minuman</p>
                <div className="space-y-6">
                    <div className="form-control">
                        <label className="label font-bold text-xs uppercase opacity-70">Makanan</label>
                        <select className="select select-bordered select-lg w-full rounded-2xl font-bold bg-base-200 focus:border-primary" 
                            onChange={(e) => setPromoSelection({...promoSelection, food: e.target.value})}>
                            <option value="">-- Pilih Makanan --</option>
                            {menuItems.filter(i => i.category === 'Food').map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                        </select>
                    </div>
                    <div className="form-control">
                        <label className="label font-bold text-xs uppercase opacity-70">Minuman</label>
                        <select className="select select-bordered select-lg w-full rounded-2xl font-bold bg-base-200 focus:border-primary"
                            onChange={(e) => setPromoSelection({...promoSelection, drink: e.target.value})}>
                            <option value="">-- Pilih Minuman --</option>
                            {menuItems.filter(i => i.category === 'Coffee' || i.category === 'Non-Coffee').map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                        </select>
                    </div>
                </div>
                <div className="mt-8">
                    <button onClick={handleAddBundle} className="btn btn-primary btn-lg w-full rounded-2xl shadow-lg text-white font-black h-16">
                        SIMPAN PAKET ➔
                    </button>
                </div>
            </div>
        </div>
      )}

    </div>
  );
}