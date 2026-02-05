import { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, query, where, getDocs, addDoc } from "firebase/firestore";

export default function BookingPage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [time, setTime] = useState(""); 
  const [customer, setCustomer] = useState({ name: "", phone: "" });
  const [menuItems, setMenuItems] = useState([]);
  
  // --- STATE KERANJANG ---
  const [cart, setCart] = useState({}); 
  const [bundles, setBundles] = useState([]); // Keranjang khusus Paket Ramadhan
  const [totalPrice, setTotalPrice] = useState(0);

  // --- STATE MODAL PROMO ---
  const [isPromoOpen, setIsPromoOpen] = useState(false);
  const [promoSelection, setPromoSelection] = useState({ food: "", drink: "" });

  useEffect(() => { fetchMenu(); }, []);

  // Hitung Total Harga (Menu Satuan + Paket Ramadhan)
  useEffect(() => {
    let total = 0;
    
    // 1. Hitung menu satuan
    Object.keys(cart).forEach((itemId) => {
      const item = menuItems.find(p => p.id === itemId);
      if (item) total += item.price * cart[itemId];
    });

    // 2. Hitung paket ramadhan (Rp 25.000 per paket)
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

  // --- VALIDASI WAKTU (BAGIAN TRICKY) ---
  const handleStep1Submit = () => {
    if(!date || !time) return alert("Isi tanggal & jam dulu ya");

    const selectedDateTime = new Date(`${date}T${time}`);
    const now = new Date();

    // Cek apakah waktu yang dipilih sudah lewat
    if (selectedDateTime < now) {
        alert("Waktu sudah berlalu! Mohon pilih jadwal masa depan 😅");
        return;
    }
    
    setStep(2);
  };

  // --- LOGIKA PAKET RAMADHAN ---
  const handleAddBundle = () => {
      const food = menuItems.find(i => i.id === promoSelection.food);
      const drink = menuItems.find(i => i.id === promoSelection.drink);

      if (!food || !drink) return alert("Wajib pilih 1 Makanan & 1 Minuman!");

      const newBundle = {
          id: `promo-${Date.now()}`, // ID unik
          name: `Paket Ramadhan: ${food.name} + ${drink.name}`,
          price: 25000,
          qty: 1
      };

      setBundles([...bundles, newBundle]);
      setIsPromoOpen(false);
      setPromoSelection({ food: "", drink: "" }); // Reset pilihan
  };

  const removeBundle = (index) => {
      const newBundles = [...bundles];
      newBundles.splice(index, 1);
      setBundles(newBundles);
  };

  // Logika Cart Biasa
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

    // 1. Siapkan item satuan
    const regularItems = Object.keys(cart).map(itemId => {
      const item = menuItems.find(p => p.id === itemId);
      return { name: item.name, qty: cart[itemId], price: item.price, subtotal: item.price * cart[itemId] };
    });

    // 2. Siapkan item paket
    const bundleItems = bundles.map(b => ({
        name: b.name, qty: 1, price: 25000, subtotal: 25000
    }));

    // Gabungkan semua
    const finalOrderItems = [...regularItems, ...bundleItems];

    try {
      await addDoc(collection(db, "reservations"), {
        date, time, customerName: customer.name, customerPhone: customer.phone,
        items: finalOrderItems, totalPrice: totalPrice, status: "pending", createdAt: new Date()
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

    const message = `Halo Cafe Tropis 🌵,\nSaya ingin reservasi:\n\nNama: ${customer.name}\nJam: ${time}, ${date}\n\nOrder:\n${regularText}\n${bundleText}\n\nTotal: Rp ${totalPrice.toLocaleString()}`;
    return `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
  };

  return (
    <div className="min-h-screen bg-base-200 pb-32 font-sans text-base-content selection:bg-primary selection:text-primary-content">
      
      {/* HEADER */}
      <div className="bg-base-100/80 backdrop-blur-md sticky top-0 z-40 border-b border-base-content/5 px-6 py-4 flex justify-between items-center">
        <h1 className="font-bold text-lg tracking-tight">Cafe Tropis 🌵</h1>
        {step < 4 && <div className="badge badge-primary badge-outline text-xs">Langkah {step}/3</div>}
      </div>

      <div className="max-w-xl mx-auto p-6">
        
        {/* STEP 1: WAKTU */}
        {step === 1 && (
          <div className="animate-fade-in space-y-8 mt-4">
            <div className="text-center space-y-2">
               <h2 className="text-3xl font-bold">Kapan mau mampir?</h2>
               <p className="opacity-60">Pilih waktu kunjunganmu.</p>
            </div>

            <div className="bg-base-100 p-6 rounded-3xl shadow-sm space-y-4">
              <div className="form-control">
                <label className="label text-xs font-bold uppercase opacity-50">Tanggal</label>
                <input type="date" className="input input-lg bg-base-200 rounded-2xl w-full" 
                  value={date} min={new Date().toISOString().split("T")[0]} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="form-control">
                <label className="label text-xs font-bold uppercase opacity-50">Jam</label>
                <input type="time" className="input input-lg bg-base-200 rounded-2xl w-full font-bold text-xl" 
                  value={time} onChange={(e) => setTime(e.target.value)} />
              </div>
            </div>

            <button onClick={() => setTime("17:45")} 
              className={`w-full p-4 rounded-3xl flex items-center gap-4 transition-all ${time === "17:45" ? "bg-primary text-primary-content shadow-lg shadow-primary/30" : "bg-base-100 hover:bg-base-300"}`}>
                <span className="text-3xl">🌙</span>
                <div className="text-left">
                    <div className="font-bold">Shortcut Buka Puasa</div>
                    <div className="text-xs opacity-70">Otomatis set 17:45</div>
                </div>
            </button>

            {/* Tombol Lanjut dengan Validasi Waktu */}
            <button onClick={handleStep1Submit} 
              className="btn btn-primary btn-lg w-full rounded-2xl shadow-xl">Lanjut Pilih Menu</button>
          </div>
        )}

        {/* STEP 2: MENU */}
        {step === 2 && (
          <div className="animate-fade-in pb-20">
            <h2 className="text-2xl font-bold mb-6">Pilih Menu</h2>
            
            {/* --- KARTU PROMO PAKET RAMADHAN --- */}
            <div 
                onClick={() => setIsPromoOpen(true)}
                className="bg-gradient-to-r from-emerald-600 to-teal-500 p-5 rounded-2xl mb-6 shadow-lg shadow-emerald-500/20 cursor-pointer hover:scale-[1.02] transition-transform text-white relative overflow-hidden group">
                <div className="absolute top-0 right-0 -mt-2 -mr-2 w-20 h-20 bg-white/20 rounded-full blur-xl group-hover:bg-white/30 transition-all"></div>
                <h3 className="text-xl font-bold flex items-center gap-2">📦 Paket Ramadhan Hemat</h3>
                <p className="text-sm opacity-90 mt-1">Rp 25.000 (Makan + Minum Bebas Pilih)</p>
                <div className="mt-3 inline-block bg-white/20 px-3 py-1 rounded-lg text-xs font-bold backdrop-blur-sm border border-white/30">
                    Klik untuk pilih menu ➔
                </div>
            </div>

            {/* DAFTAR ITEM DI KERANJANG (BUNDLE + REGULER) */}
            {(bundles.length > 0 || Object.keys(cart).length > 0) && (
                 <div className="mb-6 space-y-3">
                    {/* Render Bundles */}
                    {bundles.map((b, idx) => (
                        <div key={b.id} className="bg-primary/5 border border-primary/20 p-3 rounded-xl flex justify-between items-center">
                            <div>
                                <h4 className="font-bold text-sm text-primary">📦 Paket Ramadhan</h4>
                                <p className="text-xs opacity-70 truncate max-w-[200px]">{b.name.replace("Paket Ramadhan: ", "")}</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-sm font-bold">Rp 25.000</span>
                                <button onClick={() => removeBundle(idx)} className="btn btn-xs btn-circle btn-error text-white">✕</button>
                            </div>
                        </div>
                    ))}
                 </div>
            )}

            <h3 className="font-bold text-lg mb-3">Menu Satuan</h3>
            <div className="space-y-3">
              {menuItems.map((item) => (
                <div key={item.id} className="group flex justify-between items-center bg-base-100 p-4 rounded-2xl shadow-sm hover:shadow-md transition-all border border-transparent hover:border-primary/20">
                  <div className="flex-1">
                     <h4 className="font-bold text-lg group-hover:text-primary transition-colors">{item.name}</h4>
                     <div className="flex items-center gap-2 mt-1">
                       <span className="text-xs font-bold bg-base-200 px-2 py-1 rounded-md opacity-70">{item.category}</span>
                       <span className="text-sm font-bold text-primary">Rp {item.price.toLocaleString()}</span>
                     </div>
                  </div>
                  
                  {cart[item.id] > 0 ? (
                    <div className="flex items-center gap-3 bg-base-200 rounded-xl p-1">
                      <button onClick={() => removeFromCart(item.id)} className="btn btn-sm btn-circle btn-ghost font-bold text-lg">-</button>
                      <span className="font-bold w-4 text-center">{cart[item.id]}</span>
                      <button onClick={() => addToCart(item.id)} className="btn btn-sm btn-circle btn-ghost font-bold text-lg">+</button>
                    </div>
                  ) : (
                    <button onClick={() => addToCart(item.id)} className="btn btn-sm btn-primary rounded-xl px-4 shadow-lg shadow-primary/20">Add</button>
                  )}
                </div>
              ))}
            </div>
            
            {/* FLOATING CART */}
            <div className="fixed bottom-6 left-0 right-0 px-6 z-50 max-w-xl mx-auto">
               <div className="bg-base-content/90 backdrop-blur-md text-base-100 p-4 rounded-3xl shadow-2xl flex justify-between items-center ring-1 ring-white/10">
                  <div className="pl-2">
                    <p className="text-xs opacity-70">Total Estimasi</p>
                    <p className="text-xl font-bold">Rp {totalPrice.toLocaleString()}</p>
                  </div>
                  <div className="flex gap-2">
                     <button onClick={() => setStep(1)} className="btn btn-circle btn-ghost btn-sm text-base-100">❮</button>
                     <button onClick={() => { if(totalPrice === 0) return alert("Pilih minimal 1 menu"); setStep(3); }} 
                        className="btn btn-primary rounded-2xl px-6 text-primary-content border-none">Checkout ➔</button>
                  </div>
               </div>
            </div>
          </div>
        )}

        {/* STEP 3: DATA DIRI */}
        {step === 3 && (
          <form onSubmit={handleSubmit} className="animate-fade-in space-y-6 mt-4">
            <h2 className="text-2xl font-bold text-center">Konfirmasi</h2>
            
            <div className="bg-base-100 p-6 rounded-3xl shadow-sm space-y-4">
                <div className="flex justify-between items-center pb-4 border-b border-base-content/5">
                    <span className="opacity-60">Total Pesanan</span>
                    <span className="font-bold text-2xl text-primary">Rp {totalPrice.toLocaleString()}</span>
                </div>
                <div className="form-control">
                   <label className="label text-xs font-bold uppercase opacity-50">Nama Kamu</label>
                   <input required className="input input-lg bg-base-200 rounded-2xl" placeholder="Siapa namamu?"
                      onChange={(e) => setCustomer({...customer, name: e.target.value})} />
                </div>
                <div className="form-control">
                   <label className="label text-xs font-bold uppercase opacity-50">WhatsApp</label>
                   <input required type="tel" className="input input-lg bg-base-200 rounded-2xl" placeholder="08..."
                      onChange={(e) => setCustomer({...customer, phone: e.target.value})} />
                </div>
            </div>

            <div className="flex gap-4">
              <button type="button" onClick={() => setStep(2)} className="btn btn-ghost flex-1 rounded-2xl">Kembali</button>
              <button type="submit" disabled={loading} className="btn btn-primary flex-[2] rounded-2xl shadow-xl">
                {loading ? "Menyimpan..." : "Kirim Pesanan"}
              </button>
            </div>
          </form>
        )}

        {/* STEP 4: SUKSES */}
        {step === 4 && (
          <div className="text-center pt-10 animate-fade-in">
            <h2 className="text-3xl font-bold mb-2">Siap Dipesan!</h2>
            <p className="opacity-60 mb-8 max-w-xs mx-auto">Satu langkah lagi: Kirim detail pesanan ini ke WhatsApp kami untuk konfirmasi.</p>
            <a href={generateWaLink()} target="_blank" rel="noreferrer" className="btn btn-success btn-lg w-full rounded-2xl text-white shadow-xl shadow-success/30">
              Kirim ke WhatsApp ➔
            </a>
            <button onClick={() => window.location.reload()} className="btn btn-ghost mt-8 opacity-50">Buat Pesanan Baru</button>
          </div>
        )}
      </div>

      {/* MODAL PILIH PAKET RAMADHAN */}
      {isPromoOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-base-100 w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-scale-in">
                <h3 className="text-xl font-bold mb-4 text-emerald-600">Pilih Menu Paket</h3>
                <p className="text-xs opacity-60 mb-6">Pilih 1 Makanan & 1 Minuman (Snack tidak berlaku)</p>
                
                <div className="space-y-4">
                    <div className="form-control">
                        <label className="label font-bold text-xs uppercase opacity-50">Pilih Makanan</label>
                        <select className="select select-bordered w-full rounded-xl" 
                            onChange={(e) => setPromoSelection({...promoSelection, food: e.target.value})}>
                            <option value="">-- Pilih Makanan --</option>
                            {menuItems.filter(i => i.category === 'Food').map(i => (
                                <option key={i.id} value={i.id}>{i.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="form-control">
                        <label className="label font-bold text-xs uppercase opacity-50">Pilih Minuman</label>
                        <select className="select select-bordered w-full rounded-xl"
                            onChange={(e) => setPromoSelection({...promoSelection, drink: e.target.value})}>
                            <option value="">-- Pilih Minuman --</option>
                            {menuItems.filter(i => i.category === 'Coffee' || i.category === 'Non-Coffee').map(i => (
                                <option key={i.id} value={i.id}>{i.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="flex gap-3 mt-8">
                    <button onClick={() => setIsPromoOpen(false)} className="btn btn-ghost flex-1 rounded-xl">Batal</button>
                    <button onClick={handleAddBundle} className="btn btn-primary flex-1 rounded-xl shadow-lg text-white">Simpan Paket</button>
                </div>
            </div>
        </div>
      )}

    </div>
  );
}