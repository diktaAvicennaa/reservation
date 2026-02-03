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
    <div className="min-h-screen bg-base-200 pb-32 font-sans text-base-content selection:bg-primary selection:text-primary-content">
      
      {/* HEADER MINIMALIS */}
      <div className="bg-base-100/80 backdrop-blur-md sticky top-0 z-40 border-b border-base-content/5 px-6 py-4 flex justify-between items-center">
        <h1 className="font-bold text-lg tracking-tight">Cafe Tropis 🌿</h1>
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

            <button onClick={() => { if(!date || !time) return alert("Isi tanggal & jam dulu ya"); setStep(2); }} 
              className="btn btn-primary btn-lg w-full rounded-2xl shadow-xl">Lanjut Pilih Menu</button>
          </div>
        )}

        {/* STEP 2: MENU */}
        {step === 2 && (
          <div className="animate-fade-in pb-20">
            <h2 className="text-2xl font-bold mb-6">Pilih Menu</h2>
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
                      <button onClick={() => removeFromCart(item.id)} className="btn btn-sm btn-circle btn-ghost">-</button>
                      <span className="font-bold w-4 text-center">{cart[item.id]}</span>
                      <button onClick={() => addToCart(item.id)} className="btn btn-sm btn-circle btn-ghost">+</button>
                    </div>
                  ) : (
                    <button onClick={() => addToCart(item.id)} className="btn btn-sm btn-primary rounded-xl px-4 shadow-lg shadow-primary/20">Add</button>
                  )}
                </div>
              ))}
            </div>
            
            {/* FLOATING CART BAR */}
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
            <div className="w-24 h-24 bg-success/10 text-success rounded-full flex items-center justify-center mx-auto mb-6">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
            </div>
            <h2 className="text-3xl font-bold mb-2">Siap Dipesan!</h2>
            <p className="opacity-60 mb-8 max-w-xs mx-auto">Satu langkah lagi: Kirim detail pesanan ini ke WhatsApp kami untuk konfirmasi.</p>
            <a href={generateWaLink()} target="_blank" rel="noreferrer" className="btn btn-success btn-lg w-full rounded-2xl text-white shadow-xl shadow-success/30">
              Kirim ke WhatsApp ➔
            </a>
            <button onClick={() => window.location.reload()} className="btn btn-ghost mt-8 opacity-50">Buat Pesanan Baru</button>
          </div>
        )}
      </div>
    </div>
  );
}