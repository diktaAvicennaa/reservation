import { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, query, where, getDocs, addDoc, writeBatch, doc } from "firebase/firestore";

export default function BookingPage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [time, setTime] = useState(""); 
  const [customer, setCustomer] = useState({ name: "", phone: "" });
  const [menuItems, setMenuItems] = useState([]);
  const [cart, setCart] = useState({}); 
  const [totalPrice, setTotalPrice] = useState(0);

  useEffect(() => { fetchMenu(); }, []);

  useEffect(() => {
    let total = 0;
    Object.keys(cart).forEach((itemId) => {
      const item = menuItems.find(p => p.id === itemId);
      if (item) total += item.price * cart[itemId];
    });
    setTotalPrice(total);
  }, [cart, menuItems]);

  const fetchMenu = async () => {
    try {
      const q = query(collection(db, "products"), where("isAvailable", "==", true));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMenuItems(data);
    } catch (error) { console.error(error); }
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
    const orderDetails = Object.keys(cart).map(itemId => {
      const item = menuItems.find(p => p.id === itemId);
      return { name: item.name, qty: cart[itemId], price: item.price, subtotal: item.price * cart[itemId] };
    });

    try {
      await addDoc(collection(db, "reservations"), {
        date, time, customerName: customer.name, customerPhone: customer.phone,
        items: orderDetails, totalPrice: totalPrice, status: "pending", createdAt: new Date()
      });
      setStep(4); 
    } catch (error) { alert("Gagal menyimpan reservasi."); } finally { setLoading(false); }
  };

  const generateWaLink = () => {
    const phoneNumber = "6287819502426"; 
    const orderListText = Object.keys(cart).map(itemId => {
        const item = menuItems.find(p => p.id === itemId);
        return `- ${item.name} (${cart[itemId]}x)`;
    }).join("\n");
    const message = `Halo Cafe Tropis,\nSaya ingin reservasi:\n\nNama: ${customer.name}\nJam: ${time}, ${date}\n\nOrder:\n${orderListText}\n\nTotal: Rp ${totalPrice.toLocaleString()}`;
    return `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-green-50 pb-32 font-sans text-gray-800 selection:bg-emerald-600 selection:text-white">
      
      {/* HEADER HIJAU - RESPONSIVE */}
      <div className="bg-gradient-to-r from-emerald-700 to-green-600 sticky top-0 z-40 shadow-lg px-4 sm:px-6 py-4 sm:py-5 flex justify-between items-center">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-9 sm:w-10 h-9 sm:h-10 bg-white/20 rounded-full flex items-center justify-center text-lg sm:text-2xl flex-shrink-0">🌿</div>
          <div className="min-w-0">
            <h1 className="font-bold text-base sm:text-xl text-white tracking-tight truncate">Cafe Tropis</h1>
            <p className="text-xs text-emerald-100 hidden sm:block">Fresh & Natural</p>
          </div>
        </div>
        {step < 4 && <div className="badge bg-white/20 border-white/40 text-white text-xs font-bold whitespace-nowrap ml-2">Step {step}/3</div>}
      </div>

      <div className="w-full max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        
        {/* STEP 1: WAKTU */}
        {step === 1 && (
          <div className="animate-fade-in space-y-4 sm:space-y-8 mt-2 sm:mt-4">
            <div className="text-center space-y-1 sm:space-y-2">
               <h2 className="text-2xl sm:text-4xl font-bold bg-gradient-to-r from-emerald-700 to-green-600 bg-clip-text text-transparent">Kapan mau mampir?</h2>
               <p className="text-sm sm:text-base text-gray-600">Pilih waktu kunjunganmu di Cafe Tropis 🌃</p>
            </div>

            <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-xl border-2 border-emerald-100 space-y-3 sm:space-y-4">
              <div className="form-control">
                <label className="label text-xs font-bold uppercase text-emerald-700 py-1 sm:py-2 px-0">📅 Tanggal</label>
                <input type="date" className="input input-sm sm:input-lg bg-emerald-50 border-2 border-emerald-200 focus:border-emerald-500 rounded-lg sm:rounded-2xl w-full text-emerald-900 text-sm sm:text-base" 
                  value={date} min={new Date().toISOString().split("T")[0]} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="form-control">
                <label className="label text-xs font-bold uppercase text-emerald-700 py-1 sm:py-2 px-0">⏰ Jam</label>
                <input type="time" className="input input-sm sm:input-lg bg-emerald-50 border-2 border-emerald-200 focus:border-emerald-500 rounded-lg sm:rounded-2xl w-full font-bold text-emerald-900 text-sm sm:text-base" 
                  value={time} onChange={(e) => setTime(e.target.value)} />
              </div>
            </div>

            <button onClick={() => setTime("17:45")} 
              className={`w-full p-3 sm:p-5 rounded-2xl sm:rounded-3xl flex items-center gap-2 sm:gap-4 transition-all border-2 text-sm sm:text-base ${time === "17:45" ? "bg-gradient-to-r from-emerald-600 to-green-600 text-white shadow-xl shadow-emerald-300 border-emerald-600" : "bg-white hover:bg-emerald-50 border-emerald-200 text-gray-800"}`}>
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/20 flex items-center justify-center text-lg sm:text-2xl flex-shrink-0">🌙</div>
                <div className="text-left min-w-0">
                    <div className="font-bold text-sm sm:text-lg">Shortcut Buka Puasa</div>
                    <div className="text-xs sm:text-sm opacity-80 truncate">Otomatis set jam 17:45</div>
                </div>
            </button>

            <button onClick={() => { if(!date || !time) return alert("Isi tanggal & jam dulu ya"); setStep(2); }} 
              className="btn btn-sm sm:btn-lg w-full rounded-xl sm:rounded-2xl shadow-xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white border-none text-xs sm:text-lg">Lanjut Pilih Menu →</button>
          </div>
        )}

        {/* STEP 2: MENU */}
        {step === 2 && (
          <div className="animate-fade-in pb-32 sm:pb-20">
            <div className="text-center mb-4 sm:mb-6">
              <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-emerald-700 to-green-600 bg-clip-text text-transparent">Menu Spesial Kami</h2>
              <p className="text-gray-600 mt-1 sm:mt-2 text-sm sm:text-base">Pilih favorit kamu! 🍽️</p>
            </div>
            <div className="space-y-2 sm:space-y-3">
              {menuItems.map((item) => (
                <div key={item.id} className="group flex justify-between items-center gap-2 sm:gap-3 bg-white p-3 sm:p-5 rounded-xl sm:rounded-2xl shadow-md hover:shadow-xl transition-all border-2 border-emerald-100 hover:border-emerald-400">
                  <div className="flex-1 min-w-0">
                     <h4 className="font-bold text-sm sm:text-lg text-gray-800 group-hover:text-emerald-700 transition-colors truncate">{item.name}</h4>
                     <div className="flex items-center gap-1 sm:gap-2 mt-1 flex-wrap">
                       <span className="text-xs font-bold bg-emerald-100 text-emerald-700 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full whitespace-nowrap">{item.category}</span>
                       <span className="text-xs sm:text-sm font-bold text-emerald-600 whitespace-nowrap">Rp {item.price.toLocaleString()}</span>
                     </div>
                  </div>
                  
                  {cart[item.id] > 0 ? (
                    <div className="flex items-center gap-1 sm:gap-2 bg-emerald-50 rounded-lg sm:rounded-xl p-0.5 sm:p-1 border-2 border-emerald-200 flex-shrink-0">
                      <button onClick={() => removeFromCart(item.id)} className="btn btn-xs sm:btn-sm btn-circle bg-white hover:bg-emerald-100 border-emerald-300 text-emerald-700 text-xs sm:text-sm">−</button>
                      <span className="font-bold w-4 sm:w-5 text-center text-emerald-800 text-xs sm:text-sm">{cart[item.id]}</span>
                      <button onClick={() => addToCart(item.id)} className="btn btn-xs sm:btn-sm btn-circle bg-emerald-600 hover:bg-emerald-700 border-emerald-600 text-white text-xs sm:text-sm">+</button>
                    </div>
                  ) : (
                    <button onClick={() => addToCart(item.id)} className="btn btn-xs sm:btn-sm rounded-lg sm:rounded-xl px-3 sm:px-5 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white border-none shadow-md text-xs sm:text-sm flex-shrink-0">Add</button>
                  )}
                </div>
              ))}
            </div>
            
            {/* FLOATING CART BAR */}
            <div className="fixed bottom-4 sm:bottom-6 left-0 right-0 px-4 sm:px-6 z-50 max-w-2xl mx-auto">
               <div className="bg-gradient-to-r from-emerald-700 to-green-600 backdrop-blur-md text-white p-3 sm:p-5 rounded-2xl sm:rounded-3xl shadow-2xl flex justify-between items-center gap-2 sm:gap-4 border-2 border-white/20">
                  <div className="pl-0 sm:pl-2 min-w-0">
                    <p className="text-xs text-emerald-100 truncate">Total Pesanan</p>
                    <p className="text-lg sm:text-2xl font-bold truncate">Rp {totalPrice.toLocaleString()}</p>
                  </div>
                  <div className="flex gap-1 sm:gap-2 flex-shrink-0">
                     <button onClick={() => setStep(1)} className="btn btn-circle btn-xs sm:btn-sm bg-white/20 hover:bg-white/30 border-white/30 text-white">❮</button>
                     <button onClick={() => { if(totalPrice === 0) return alert("Pilih minimal 1 menu"); setStep(3); }} 
                        className="btn btn-xs sm:btn-sm rounded-lg sm:rounded-2xl px-2 sm:px-6 bg-white text-emerald-700 hover:bg-emerald-50 border-none font-bold text-xs sm:text-base whitespace-nowrap">Checkout →</button>
                  </div>
               </div>
            </div>
          </div>
        )}

        {/* STEP 3: DATA DIRI */}
        {step === 3 && (
          <form onSubmit={handleSubmit} className="animate-fade-in space-y-4 sm:space-y-6 mt-2 sm:mt-4">
            <div className="text-center">
              <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-emerald-700 to-green-600 bg-clip-text text-transparent">Konfirmasi Pesanan</h2>
              <p className="text-gray-600 mt-1 sm:mt-2 text-sm sm:text-base">Satu langkah lagi! 🎉</p>
            </div>
            
            <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-xl border-2 border-emerald-100 space-y-3 sm:space-y-4">
                <div className="flex justify-between items-center pb-3 sm:pb-4 border-b-2 border-emerald-100 gap-2">
                    <span className="text-sm sm:text-base text-gray-600 font-medium">Total Pesanan</span>
                    <span className="font-bold text-lg sm:text-3xl bg-gradient-to-r from-emerald-700 to-green-600 bg-clip-text text-transparent truncate">Rp {totalPrice.toLocaleString()}</span>
                </div>
                <div className="form-control">
                   <label className="label text-xs font-bold uppercase text-emerald-700 py-1 sm:py-2 px-0">👤 Nama Kamu</label>
                   <input required className="input input-sm sm:input-lg bg-emerald-50 border-2 border-emerald-200 focus:border-emerald-500 rounded-lg sm:rounded-2xl text-emerald-900 text-sm sm:text-base" placeholder="Siapa namamu?"
                      onChange={(e) => setCustomer({...customer, name: e.target.value})} />
                </div>
                <div className="form-control">
                   <label className="label text-xs font-bold uppercase text-emerald-700 py-1 sm:py-2 px-0">📱 WhatsApp</label>
                   <input required type="tel" className="input input-sm sm:input-lg bg-emerald-50 border-2 border-emerald-200 focus:border-emerald-500 rounded-lg sm:rounded-2xl text-emerald-900 text-sm sm:text-base" placeholder="08..."
                      onChange={(e) => setCustomer({...customer, phone: e.target.value})} />
                </div>
            </div>

            <div className="flex gap-2 sm:gap-4">
              <button type="button" onClick={() => setStep(2)} className="btn btn-sm sm:btn-md flex-1 rounded-lg sm:rounded-2xl bg-white border-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50 text-xs sm:text-base">← Kembali</button>
              <button type="submit" disabled={loading} className="btn btn-sm sm:btn-md flex-[2] rounded-lg sm:rounded-2xl shadow-xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white border-none text-xs sm:text-base">
                {loading ? "Menyimpan..." : "Kirim Pesanan →"}
              </button>
            </div>
          </form>
        )}

        {/* STEP 4: SUKSES */}
        {step === 4 && (
          <div className="text-center pt-6 sm:pt-10 animate-fade-in">
            <div className="w-20 sm:w-28 h-20 sm:h-28 bg-gradient-to-br from-emerald-100 to-green-100 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6 shadow-xl border-4 border-emerald-200">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-10 sm:h-14 w-10 sm:w-14 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
            </div>
            <h2 className="text-2xl sm:text-4xl font-bold mb-2 sm:mb-3 bg-gradient-to-r from-emerald-700 to-green-600 bg-clip-text text-transparent">Pesanan Berhasil!</h2>
            <p className="text-gray-600 mb-6 sm:mb-8 max-w-md mx-auto text-sm sm:text-lg px-2">Satu langkah lagi: Kirim detail pesanan ini ke WhatsApp kami untuk konfirmasi final 🎉</p>
            <a href={generateWaLink()} target="_blank" rel="noreferrer" className="btn btn-sm sm:btn-lg w-full rounded-lg sm:rounded-2xl text-white shadow-2xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 border-none text-xs sm:text-lg">
              <span className="text-lg sm:text-2xl">📱</span> Kirim ke WhatsApp →
            </a>
            <button onClick={() => window.location.reload()} className="btn btn-ghost btn-sm sm:btn-md mt-6 sm:mt-8 text-emerald-700 hover:bg-emerald-50 text-xs sm:text-base">← Buat Pesanan Baru</button>
          </div>
        )}
      </div>
    </div>
  );
}