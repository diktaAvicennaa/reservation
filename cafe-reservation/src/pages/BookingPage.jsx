import { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, query, where, getDocs, addDoc, writeBatch, doc } from "firebase/firestore";

export default function BookingPage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  // Data Booking
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [time, setTime] = useState(""); 
  const [customer, setCustomer] = useState({ name: "", phone: "" });

  // Data Menu & Cart
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
    } catch (error) {
      console.error("Gagal ambil menu:", error);
    }
  };

  const addToCart = (itemId) => { setCart(prev => ({ ...prev, [itemId]: (prev[itemId] || 0) + 1 })); };
  const removeFromCart = (itemId) => {
    setCart(prev => {
      const currentQty = prev[itemId] || 0;
      if (currentQty <= 1) {
        const newCart = { ...prev };
        delete newCart[itemId];
        return newCart;
      }
      return { ...prev, [itemId]: currentQty - 1 };
    });
  };

  const seedDatabase = async () => {
    if(!confirm("Isi database dengan menu contoh?")) return;
    const batch = writeBatch(db);
    const dummyMenu = [
      { name: "Kopi Susu Gula Aren", price: 18000, category: "Coffee", isAvailable: true },
      { name: "Paket Bedug (Ayam + Teh)", price: 35000, category: "Food", isAvailable: true },
      { name: "Nasi Goreng Spesial", price: 25000, category: "Food", isAvailable: true },
      { name: "Kentang Goreng", price: 12000, category: "Snack", isAvailable: true },
      { name: "Ice Lychee Tea", price: 18000, category: "Non-Coffee", isAvailable: true },
    ];
    dummyMenu.forEach(item => {
      const docRef = doc(collection(db, "products"));
      batch.set(docRef, item);
    });
    await batch.commit();
    alert("Menu contoh berhasil ditambahkan! Refresh halaman.");
    window.location.reload();
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
        date, time,
        customerName: customer.name,
        customerPhone: customer.phone,
        items: orderDetails,
        totalPrice: totalPrice,
        status: "pending",
        createdAt: new Date()
      });
      setStep(4); 
    } catch (error) {
      console.error("Error:", error);
      alert("Gagal menyimpan reservasi.");
    } finally {
      setLoading(false);
    }
  };

  const generateWaLink = () => {
    const phoneNumber = "6287819502426"; 
    const orderListText = Object.keys(cart).map(itemId => {
      const item = menuItems.find(p => p.id === itemId);
      return `- ${item.name} (${cart[itemId]}x)`;
    }).join("\n");
    
    // Label khusus maghrib
    let headerText = "Detail Order:";
    if(time >= "17:30" && time <= "18:30") {
        headerText = "RESERVASI BUKA PUASA";
    }

    const message = `kak saya sudah reservasi silahkan dikonfirmasi\n\n${headerText}\nNama: ${customer.name}\nTgl: ${date}\nJam: ${time}\n\nMenu:\n${orderListText}\n\nTotal Estimasi: Rp ${totalPrice.toLocaleString()}`;
    return `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
  };

  return (
    <div className="min-h-screen bg-base-200 pb-24 font-sans">
      <div className="container mx-auto py-6 px-4">
        
        {/* STEPPER */}
        {step < 4 && (
          <ul className="steps w-full mb-8 text-sm">
            <li className={`step ${step >= 1 ? 'step-primary' : ''}`}>Waktu</li>
            <li className={`step ${step >= 2 ? 'step-primary' : ''}`}>Menu</li>
            <li className={`step ${step >= 3 ? 'step-primary' : ''}`}>Konfirmasi</li>
          </ul>
        )}

        <div className="max-w-3xl mx-auto bg-base-100 rounded-2xl shadow-xl overflow-hidden p-6 border border-base-300">
            
            {/* STEP 1: PILIH WAKTU */}
            {step === 1 && (
              <div className="space-y-6 animate-fade-in">
                <div className="text-center">
                   <h2 className="text-2xl font-bold text-primary">Atur Jadwal</h2>
                   <p className="text-base-content/60 text-sm">Tentukan waktu kunjunganmu.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Tanggal */}
                  <div className="form-control">
                    <label className="label font-bold">Tanggal</label>
                    <input 
                        type="date" 
                        className="input input-bordered w-full font-medium" 
                        value={date} 
                        min={new Date().toISOString().split("T")[0]} 
                        onChange={(e) => setDate(e.target.value)} 
                    />
                  </div>

                  {/* Jam (Flexible Input) */}
                  <div className="form-control">
                    <label className="label font-bold">
                        <span>Jam Kedatangan</span>
                       
                    </label>
                    <input 
                        type="time" 
                        className="input input-bordered w-full font-medium text-lg" 
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                    />
                  </div>
                </div>

                {/* SHORTCUT KHUSUS BUKA PUASA */}
                <div className="divider text-xs text-base-content/40">Spesial Ramadhan</div>
                
                <div className="grid grid-cols-1 gap-3">
                    <button 
                        onClick={() => setTime("17:45")} 
                        className={`btn h-auto py-3 flex flex-row items-center justify-center gap-4 ${time === "17:45" ? "btn-primary" : "btn-outline border-base-300"}`}
                    >
                        <span className="text-3xl">🌙</span>
                        <div className="text-left">
                            <div className="font-bold text-lg">Buka Puasa</div>
                            <div className="text-xs opacity-70">Otomatis set jam 17:45</div>
                        </div>
                    </button>
                </div>
                
                {/* Generate Button jika menu kosong */}
                {menuItems.length === 0 && (
                  <div className="alert alert-warning mt-4 shadow-sm">
                    <div className="text-xs">Database Menu Kosong.</div>
                    <button onClick={seedDatabase} className="btn btn-xs btn-outline">Generate Contoh</button>
                  </div>
                )}

                <button 
                  onClick={() => {
                    if(!date || !time) return alert("Mohon isi tanggal & jam dulu ya");
                    setStep(2);
                  }} 
                  className="btn btn-primary w-full mt-6 btn-lg"
                >
                  Lanjut Pilih Menu ➔
                </button>
              </div>
            )}

            {/* STEP 2: PILIH MENU */}
            {step === 2 && (
              <div className="animate-fade-in">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">Pilih Menu</h2>
                    <div className="badge badge-primary badge-outline">Rp {totalPrice.toLocaleString()}</div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-20">
                  {menuItems.map((item) => (
                    <div key={item.id} className="flex flex-col justify-between border border-base-200 bg-base-100 p-4 rounded-xl shadow-sm hover:shadow-md transition">
                      <div className="flex justify-between items-start mb-2">
                         <div>
                            <h4 className="font-bold text-base-content">{item.name}</h4>
                            <span className="badge badge-xs badge-ghost mt-1">{item.category}</span>
                         </div>
                         <p className="font-bold text-primary">Rp {item.price.toLocaleString()}</p>
                      </div>
                      
                      <div className="flex justify-end items-center gap-3 mt-2">
                        {cart[item.id] > 0 ? (
                          <div className="join border border-base-300 rounded-lg">
                            <button onClick={() => removeFromCart(item.id)} className="join-item btn btn-sm btn-ghost hover:bg-base-200">-</button>
                            <span className="join-item btn btn-sm btn-ghost no-animation bg-base-100 cursor-default min-w-[3rem]">{cart[item.id]}</span>
                            <button onClick={() => addToCart(item.id)} className="join-item btn btn-sm btn-ghost hover:bg-base-200">+</button>
                          </div>
                        ) : (
                          <button onClick={() => addToCart(item.id)} className="btn btn-sm btn-outline btn-primary w-full">Tambah</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="fixed bottom-0 left-0 w-full bg-base-100 border-t border-base-300 p-4 shadow-[0_-5px_10px_rgba(0,0,0,0.1)] z-50">
                   <div className="container mx-auto max-w-3xl flex justify-between items-center">
                      <div>
                        <p className="text-xs text-base-content/60">Estimasi Total:</p>
                        <p className="text-xl font-bold text-primary">Rp {totalPrice.toLocaleString()}</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setStep(1)} className="btn btn-ghost">Kembali</button>
                        <button 
                          onClick={() => {
                            if(totalPrice === 0) return alert("Pilih minimal 1 menu dong kak :)");
                            setStep(3);
                          }} 
                          className="btn btn-primary px-8"
                        >
                          Lanjut
                        </button>
                      </div>
                   </div>
                </div>
              </div>
            )}

            {/* STEP 3: DATA DIRI */}
            {step === 3 && (
              <form onSubmit={handleSubmit} className="space-y-4 animate-fade-in">
                <h2 className="text-xl font-bold text-center mb-4">Konfirmasi Pesanan</h2>
                
                <div className="bg-base-200 p-4 rounded-xl text-sm space-y-2 mb-6">
                  <div className="flex justify-between border-b border-base-content/10 pb-2">
                    <span>📅 Waktu</span>
                    <span className="font-bold">{date}, {time}</span>
                  </div>
                  <div className="flex justify-between border-b border-base-content/10 pb-2">
                    <span>🍔 Item</span>
                    <span className="font-bold">{Object.values(cart).reduce((a,b)=>a+b, 0)} menu</span>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span>💰 Total</span>
                    <span className="font-bold text-primary text-lg">Rp {totalPrice.toLocaleString()}</span>
                  </div>
                </div>

                <div className="form-control">
                   <label className="label"><span className="label-text font-bold">Nama Pemesan</span></label>
                   <input required type="text" placeholder="Contoh: Ahmad" className="input input-bordered w-full" onChange={(e) => setCustomer({...customer, name: e.target.value})} />
                </div>
              
                
                <div className="flex gap-2 mt-6">
                  <button type="button" onClick={() => setStep(2)} className="btn btn-ghost flex-1">Kembali</button>
                  <button type="submit" disabled={loading} className="btn btn-primary flex-1">
                    {loading ? <span className="loading loading-spinner"></span> : "Konfirmasi Order"}
                  </button>
                </div>
              </form>
            )}

            {/* STEP 4: SUKSES & LINK WA */}
            {step === 4 && (
              <div className="text-center py-10 animate-fade-in">
                <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-success/10 text-success mb-6">
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                </div>
                <h3 className="text-2xl font-bold text-base-content mb-2">Berhasil Dipesan!</h3>
                <p className="text-base-content/60 mb-8 max-w-sm mx-auto">
                   Langkah terakhir, konfirmasi ke WhatsApp Admin ya.
                </p>
                
                <a 
                  href={generateWaLink()}
                  target="_blank" 
                  rel="noreferrer"
                  className="btn btn-success btn-lg w-full text-white shadow-lg shadow-success/30"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>
                  Kirim ke WhatsApp
                </a>
                
                <button onClick={() => window.location.reload()} className="btn btn-ghost mt-6 text-base-content/50">Pesan Lagi</button>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}