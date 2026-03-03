import { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import { collection, getDocs, updateDoc, doc, deleteDoc, addDoc, deleteField, query, where, setDoc, getDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("orders");
  const [reservations, setReservations] = useState([]);
    const [dateSort, setDateSort] = useState("newest");
  const [packages, setPackages] = useState([]);
  const [products, setProducts] = useState([]);
  const [spots, setSpots] = useState([]); 

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState(""); 
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({});
    const [cleanupPromptShown, setCleanupPromptShown] = useState(false);

    const [isOrderMenuModalOpen, setIsOrderMenuModalOpen] = useState(false);
    const [editingReservation, setEditingReservation] = useState(null);
    const [orderMenuItems, setOrderMenuItems] = useState([]);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => { if (!user) navigate("/admin"); });
    fetchReservations();
    fetchPackages();
    fetchProducts();
    fetchSpots();
    return () => unsubscribe();
  }, []);

    const parseDateTimeToMs = (dateValue, timeValue) => {
        if (!dateValue) return 0;

        const dateText = String(dateValue).trim();
        const timeText = String(timeValue || "00:00").trim();
        const normalizedTime = /^\d{1,2}:\d{2}$/.test(timeText)
            ? `${timeText.padStart(5, "0")}:00`
            : "00:00:00";

        const directParse = Date.parse(`${dateText} ${normalizedTime}`);
        if (!Number.isNaN(directParse)) return directParse;

        const slashMatch = dateText.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
        if (!slashMatch) return 0;

        const day = slashMatch[1].padStart(2, "0");
        const month = slashMatch[2].padStart(2, "0");
        const yearRaw = slashMatch[3];
        const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;

        const isoParse = Date.parse(`${year}-${month}-${day}T${normalizedTime}`);
        return Number.isNaN(isoParse) ? 0 : isoParse;
    };

    const getReservationTimestamp = (reservation) => {
        const reservationDateMs = parseDateTimeToMs(reservation?.date, reservation?.time);
        if (reservationDateMs > 0) return reservationDateMs;

        const createdAtMs = reservation?.createdAt?.toMillis?.();
        if (typeof createdAtMs === "number" && createdAtMs > 0) return createdAtMs;
        return 0;
    };

    const getReservationDayStartMs = (reservation) => {
        if (!reservation?.date) return 0;

        const dateText = String(reservation.date).trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
            const [year, month, day] = dateText.split("-").map(Number);
            return new Date(year, month - 1, day, 0, 0, 0, 0).getTime();
        }

        const slashMatch = dateText.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
        if (slashMatch) {
            const day = Number(slashMatch[1]);
            const month = Number(slashMatch[2]);
            const year = Number(slashMatch[3].length === 2 ? `20${slashMatch[3]}` : slashMatch[3]);
            return new Date(year, month - 1, day, 0, 0, 0, 0).getTime();
        }

        const parsed = Date.parse(`${dateText} 00:00:00`);
        return Number.isNaN(parsed) ? 0 : new Date(parsed).setHours(0, 0, 0, 0);
    };

    const isReservationPastDay = (reservation) => {
        const reservationDayMs = getReservationDayStartMs(reservation);
        if (!reservationDayMs) return false;
        const todayStartMs = new Date().setHours(0, 0, 0, 0);
        return reservationDayMs < todayStartMs;
    };

  const fetchReservations = async () => {
    const s = await getDocs(collection(db, "reservations"));
        setReservations(s.docs.map(d => ({ id: d.id, ...d.data() })));
  };
  const fetchPackages = async () => {
    const s = await getDocs(collection(db, "packages"));
    setPackages(s.docs.map(d => ({ id: d.id, ...d.data() })));
  };
  const fetchProducts = async () => {
    const s = await getDocs(collection(db, "products"));
    setProducts(s.docs.map(d => ({ id: d.id, ...d.data() })));
  };
  const fetchSpots = async () => {
    const s = await getDocs(collection(db, "spots"));
    setSpots(s.docs.map(d => ({ id: d.id, ...d.data() })));
  };

    const buildReservationLockId = (reservationDate, spotId) => `${reservationDate}__${spotId}`;

    const syncReservationLock = async ({ reservationId, date, time, spotId, spotName, status }) => {
        if (!reservationId || !date || !spotId) return;
        const lockRef = doc(db, "reservationLocks", buildReservationLockId(date, spotId));
        await setDoc(lockRef, {
            reservationId,
            date,
            time: time || "",
            spotId,
            spotName: spotName || "",
            status: status || "pending",
            updatedAt: new Date()
        }, { merge: true });
    };

    const releaseReservationLockIfOwned = async ({ reservationId, date, spotId }) => {
        if (!reservationId || !date || !spotId) return;
        const lockRef = doc(db, "reservationLocks", buildReservationLockId(date, spotId));
        const lockSnap = await getDoc(lockRef);
        if (!lockSnap.exists()) return;

        const lockData = lockSnap.data();
        if (lockData?.reservationId !== reservationId) return;

        await setDoc(lockRef, {
            status: "rejected",
            updatedAt: new Date()
        }, { merge: true });
    };

    const handleStatus = async (id, status) => {
        const currentReservation = reservations.find(r => r.id === id);
        await updateDoc(doc(db, "reservations", id), { status });

        if (currentReservation?.date && currentReservation?.spotId) {
            if (status === "rejected") {
                await releaseReservationLockIfOwned({
                    reservationId: id,
                    date: currentReservation.date,
                    spotId: currentReservation.spotId
                });
            } else {
                await syncReservationLock({
                    reservationId: id,
                    date: currentReservation.date,
                    time: currentReservation.time,
                    spotId: currentReservation.spotId,
                    spotName: currentReservation.spotName,
                    status
                });
            }
        }

        fetchReservations();
    };
  const handleDeleteReservation = async (id) => {
    if(!confirm("Yakin hapus riwayat pesanan ini?")) return;
        const currentReservation = reservations.find(r => r.id === id);
        await deleteDoc(doc(db, "reservations", id));

        if (currentReservation?.date && currentReservation?.spotId) {
            await releaseReservationLockIfOwned({
                reservationId: id,
                date: currentReservation.date,
                spotId: currentReservation.spotId
            });
        }

        fetchReservations();
  };

    const handleCleanupPastReservations = async (pastReservationList = []) => {
        if (!pastReservationList.length) return;

        try {
            for (const reservation of pastReservationList) {
                await deleteDoc(doc(db, "reservations", reservation.id));
                if (reservation?.date && reservation?.spotId) {
                    await releaseReservationLockIfOwned({
                        reservationId: reservation.id,
                        date: reservation.date,
                        spotId: reservation.spotId
                    });
                }
            }
            await fetchReservations();
            alert(`${pastReservationList.length} pesanan beda hari berhasil dibersihkan.`);
        } catch (error) {
            alert("Gagal membersihkan pesanan beda hari. Coba lagi.");
        }
    };

    const handleUpdateReservationDate = async (id, newDate) => {
        if (!newDate) return;

        const currentReservation = reservations.find(r => r.id === id);
        if (!currentReservation) return;
        if (currentReservation.date === newDate) return;

        if (currentReservation?.spotId && currentReservation?.time) {
            const conflictQuery = query(
                collection(db, "reservations"),
                where("date", "==", newDate),
                where("time", "==", currentReservation.time),
                where("spotId", "==", currentReservation.spotId)
            );
            const conflictSnap = await getDocs(conflictQuery);
            const hasConflict = conflictSnap.docs.some(d => {
                const data = d.data();
                return d.id !== id && data.status !== "rejected";
            });

            if (hasConflict) {
                alert(`Tanggal ${newDate} bentrok: tempat ${currentReservation.spotName || "terpilih"} jam ${currentReservation.time} sudah terisi.`);
                return;
            }
        }

        await updateDoc(doc(db, "reservations", id), { date: newDate });

        if (currentReservation?.spotId) {
            await releaseReservationLockIfOwned({
                reservationId: id,
                date: currentReservation.date,
                spotId: currentReservation.spotId
            });

            await syncReservationLock({
                reservationId: id,
                date: newDate,
                time: currentReservation.time,
                spotId: currentReservation.spotId,
                spotName: currentReservation.spotName,
                status: currentReservation.status
            });
        }

        fetchReservations();
    };
  
  const handleUpdateSpot = async (id, spotId) => {
    const spot = spots.find(s => s.id === spotId);
    if (spot) {
        const currentReservation = reservations.find(r => r.id === id);
        if (!currentReservation?.date || !currentReservation?.time) {
            await updateDoc(doc(db, "reservations", id), { spotId: spot.id, spotName: spot.name });

            await releaseReservationLockIfOwned({
                reservationId: id,
                date: currentReservation.date,
                spotId: currentReservation.spotId
            });
            await syncReservationLock({
                reservationId: id,
                date: currentReservation.date,
                time: currentReservation.time,
                spotId: spot.id,
                spotName: spot.name,
                status: currentReservation.status
            });

            fetchReservations();
            return;
        }

        const conflictQuery = query(
            collection(db, "reservations"),
            where("date", "==", currentReservation.date),
            where("time", "==", currentReservation.time),
            where("spotId", "==", spot.id)
        );
        const conflictSnap = await getDocs(conflictQuery);
        const hasConflict = conflictSnap.docs.some(d => {
            const data = d.data();
            return d.id !== id && data.status !== 'rejected';
        });

        if (hasConflict) {
            alert(`Tempat ${spot.name} sudah terpakai di ${currentReservation.date} jam ${currentReservation.time}.`);
            return;
        }

        await updateDoc(doc(db, "reservations", id), { spotId: spot.id, spotName: spot.name });

        await releaseReservationLockIfOwned({
            reservationId: id,
            date: currentReservation.date,
            spotId: currentReservation.spotId
        });
        await syncReservationLock({
            reservationId: id,
            date: currentReservation.date,
            time: currentReservation.time,
            spotId: spot.id,
            spotName: spot.name,
            status: currentReservation.status
        });

        fetchReservations();
    }
  };

    const handleOpenOrderMenuModal = (reservation) => {
        const initialItems = (reservation?.items || []).map((item) => ({
            name: item?.name || "",
            qty: Number(item?.qty) || 1,
            price: Number(item?.price) || 0,
            selections: item?.selections || "",
            note: item?.note || ""
        }));

        setEditingReservation(reservation);
        setOrderMenuItems(initialItems.length ? initialItems : [{ name: "", qty: 1, price: 0, selections: "", note: "" }]);
        setIsOrderMenuModalOpen(true);
    };

    const handleOrderMenuNameChange = (index, selectedName) => {
        const selectedProduct = products.find((product) => product.name === selectedName);
        setOrderMenuItems((prev) => {
            const next = [...prev];
            next[index] = {
                ...next[index],
                name: selectedName,
                price: selectedProduct ? Number(selectedProduct.price) || 0 : next[index].price
            };
            return next;
        });
    };

    const handleOrderMenuItemChange = (index, field, value) => {
        setOrderMenuItems((prev) => {
            const next = [...prev];
            next[index] = {
                ...next[index],
                [field]: field === "qty" || field === "price" ? Number(value) || 0 : value
            };
            return next;
        });
    };

    const handleAddOrderMenuItem = () => {
        setOrderMenuItems((prev) => [...prev, { name: "", qty: 1, price: 0, selections: "", note: "" }]);
    };

    const handleRemoveOrderMenuItem = (index) => {
        setOrderMenuItems((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
    };

    const handleSaveOrderMenu = async (e) => {
        e.preventDefault();
        if (!editingReservation?.id) return;

        const normalizedItems = orderMenuItems
            .map((item) => {
                const qty = Math.max(1, Number(item.qty) || 1);
                const price = Math.max(0, Number(item.price) || 0);
                return {
                    name: String(item.name || "").trim(),
                    qty,
                    price,
                    subtotal: qty * price,
                    selections: String(item.selections || "").trim(),
                    note: String(item.note || "").trim()
                };
            })
            .filter((item) => item.name);

        if (!normalizedItems.length) {
            alert("Minimal harus ada 1 menu pesanan.");
            return;
        }

        const newTotalPrice = normalizedItems.reduce((sum, item) => sum + item.subtotal, 0);

        await updateDoc(doc(db, "reservations", editingReservation.id), {
            items: normalizedItems,
            totalPrice: newTotalPrice
        });

        setIsOrderMenuModalOpen(false);
        setEditingReservation(null);
        setOrderMenuItems([]);
        fetchReservations();
    };

    useEffect(() => {
        if (!reservations.length || cleanupPromptShown) return;

        const pastReservations = reservations.filter(isReservationPastDay);
        setCleanupPromptShown(true);

        if (!pastReservations.length) return;

        const shouldCleanup = confirm(
            `Ada ${pastReservations.length} pesanan dari hari sebelumnya. Hapus permanen sekarang?`
        );

        if (shouldCleanup) {
            handleCleanupPastReservations(pastReservations);
        }
    }, [reservations, cleanupPromptShown]);

  const handleDeleteItem = async (type, id) => { 
      if(confirm(`Yakin hapus data ini?`)) { 
          const col = type === 'package' ? "packages" : type === 'spot' ? "spots" : "products";
          await deleteDoc(doc(db, col, id)); 
          if(type === 'package') fetchPackages();
          else if(type === 'spot') fetchSpots();
          else fetchProducts(); 
      }
  };

  const handleOpenModal = (type, item = null) => {
    setModalType(type);
    setEditingItem(item);
    
    // HAPUS IMG DARI STATE PAKET
    if (type === 'package') {
        setFormData(item ? { name: item.name, price: item.price, description: item.description || "", foodOptions: item.foodOptions || [], drinkOptions: item.drinkOptions || [], isAvailable: item.isAvailable } : { name: "", price: "", description: "", foodOptions: [], drinkOptions: [], isAvailable: true });
    } else if (type === 'spot') {
        setFormData(item ? { name: item.name, min: item.min, img: item.img || "", unavailableDates: (item.unavailableDates || []).join(", "), isAvailable: item.isAvailable } : { name: "", min: 2, img: "", unavailableDates: "", isAvailable: true });
    } else {
        setFormData(item ? { name: item.name, price: item.price, category: item.category, img: item.img || "", isAvailable: item.isAvailable } : { name: "", price: "", category: "Food", img: "", isAvailable: true });
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
    let collectionName = "products";
    if (modalType === 'package') collectionName = "packages";
    if (modalType === 'spot') collectionName = "spots";

    let payload = { isAvailable: formData.isAvailable, name: formData.name };
    
    if (modalType === 'spot') {
        payload.min = Number(formData.min);
        payload.img = formData.img; 
        payload.unavailableDates = (formData.unavailableDates || "")
            .split(",")
            .map(d => d.trim())
            .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d));
    } else {
        payload.price = Number(formData.price);
        if (modalType === 'package') {
            payload.description = formData.description;
            // Hapus payload.img untuk paket
            payload.foodOptions = formData.foodOptions;
            payload.drinkOptions = formData.drinkOptions;
        }
        if (modalType === 'menu') {
            payload.category = formData.category;
            const isFoodMenu = formData.category === 'Food' || formData.category === 'Snack';
            payload.img = isFoodMenu ? (formData.img || "") : deleteField();
        }
    }

    if (editingItem) await updateDoc(doc(db, collectionName, editingItem.id), payload);
    else await addDoc(collection(db, collectionName), payload);
    
    setIsModalOpen(false); 
    if (modalType === 'package') fetchPackages();
    else if (modalType === 'spot') fetchSpots();
    else fetchProducts();
  };

  const getProductNames = (ids) => {
      if(!ids || ids.length === 0) return "-";
      return ids.map(id => products.find(p => p.id === id)?.name).filter(Boolean).join(", ");
  };

    const pastReservations = reservations.filter(isReservationPastDay);
    const activeReservations = reservations.filter((reservation) => !isReservationPastDay(reservation));

    const sortedReservations = [...activeReservations].sort((a, b) => {
        const aTs = getReservationTimestamp(a);
        const bTs = getReservationTimestamp(b);
        return dateSort === "oldest" ? aTs - bTs : bTs - aTs;
    });

  return (
    <div style={{minHeight:'100vh', paddingBottom:'50px', background:'#f4f7f6'}}>
      <div className="navbar">
         <div className="logo">🌵 Admin Panel</div>
         <button onClick={() => auth.signOut()} className="btn btn-danger" style={{padding:'5px 10px', fontSize:'0.8em'}}>LOGOUT</button>
      </div>

      <div className="container" style={{maxWidth:'1000px'}}>
        
        {/* TABS MENU */}
        <div className="flex mb-4" style={{background: 'white', padding: '5px', borderRadius: '12px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', overflowX: 'auto'}}>
          <button onClick={() => setActiveTab('orders')} className={`btn ${activeTab === 'orders' ? 'btn-primary' : 'btn-ghost'}`} style={{flex:1, whiteSpace:'nowrap'}}>📋 Pesanan</button>
          <button onClick={() => setActiveTab('packages')} className={`btn ${activeTab === 'packages' ? 'btn-primary' : 'btn-ghost'}`} style={{flex:1, whiteSpace:'nowrap'}}>📦 Paket</button>
          <button onClick={() => setActiveTab('spots')} className={`btn ${activeTab === 'spots' ? 'btn-primary' : 'btn-ghost'}`} style={{flex:1, whiteSpace:'nowrap'}}>📍 Tempat</button>
          <button onClick={() => setActiveTab('menu')} className={`btn ${activeTab === 'menu' ? 'btn-primary' : 'btn-ghost'}`} style={{flex:1, whiteSpace:'nowrap'}}>🍔 Menu Master</button>
        </div>

        {/* TAB 1: ORDERS */}
        {activeTab === 'orders' && (
                    <>
                                                {pastReservations.length > 0 && (
                                                        <div className="card" style={{marginBottom:'15px', padding:'12px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', gap:'12px', flexWrap:'wrap'}}>
                                                                <span style={{color:'#92400e', fontWeight:600}}>⚠️ Ada {pastReservations.length} pesanan beda hari (disembunyikan dari daftar).</span>
                                                                <button
                                                                    onClick={() => {
                                                                        if (!confirm(`Hapus ${pastReservations.length} pesanan beda hari secara permanen?`)) return;
                                                                        handleCleanupPastReservations(pastReservations);
                                                                    }}
                                                                    className="btn btn-danger"
                                                                    style={{padding:'8px 12px'}}
                                                                >
                                                                    Bersihkan Sekarang
                                                                </button>
                                                        </div>
                                                )}
                        <div className="card" style={{marginBottom:'15px', padding:'12px 16px', display:'flex', justifyContent:'flex-end', alignItems:'center', gap:'10px'}}>
                            <label className="label" style={{margin:0}}>Urutkan Berdasarkan</label>
                            <select className="input" value={dateSort} onChange={(e) => setDateSort(e.target.value)} style={{maxWidth:'220px', height:'45px'}}>
                                <option value="newest">Tanggal terjauh</option>
                                <option value="oldest">Tanggal terdekat</option>
                            </select>
                        </div>
                    <div className="card table-container">
                        <table>
                <thead>
                  <tr><th>Waktu</th><th>Pelanggan</th><th>Tempat & Pax</th><th>Pesanan (Paket)</th><th>Total</th><th>Aksi</th></tr>
                </thead>
                <tbody>
                                    {sortedReservations.map((res) => (
                    <tr key={res.id}>
                      <td style={{verticalAlign: 'middle'}}>
                        <div style={{fontWeight:'bold', color: '#047857', fontSize: '1.1em'}}>{res.time}</div>
                                                <input
                                                    type="date"
                                                    className="input"
                                                    value={res.date || ""}
                                                    onChange={(e) => handleUpdateReservationDate(res.id, e.target.value)}
                                                    style={{marginTop:'6px', marginBottom:'6px', maxWidth:'170px', padding:'6px 8px', fontSize:'0.85em'}}
                                                /><br/>
                        <span className={`badge ${res.status==='confirmed'?'badge-green':res.status==='rejected'?'badge-red':'badge-yellow'}`} style={{marginTop:'5px', display:'inline-block'}}>
                            {res.status === 'confirmed' ? 'Diterima' : res.status === 'rejected' ? 'Ditolak' : 'Menunggu'}
                        </span>
                      </td>
                      <td style={{verticalAlign: 'middle'}}>
                          <b>{res.customerName}</b><br/>
                          <small style={{color: '#666'}}>{res.customerPhone}</small>
                      </td>
                      <td style={{verticalAlign: 'middle'}}>
                          <select 
                              className="select" 
                              style={{padding: '6px', fontSize: '0.85em', fontWeight: 'bold', color: '#047857', border: '1px solid #047857', borderRadius: '6px', width: '100%', marginBottom: '5px'}}
                              value={res.spotId || ""} 
                              onChange={(e) => handleUpdateSpot(res.id, e.target.value)}
                          >
                              <option value="" disabled>-- Atur Tempat --</option>
                              {spots.map(spot => (
                                  <option key={spot.id} value={spot.id}>{spot.name}</option>
                              ))}
                          </select>
                          <div style={{fontSize: '0.8em', color: '#666', textAlign: 'center'}}>
                              {res.partySize ? `${res.partySize} Orang` : "Data Lama"}
                          </div>
                      </td>
                      <td style={{verticalAlign: 'middle'}}>
                          {res.items?.map((i,x)=>(
                              <div key={x} style={{fontSize:'0.9em', marginBottom:'8px', background:'#f9f9f9', padding:'5px', borderRadius:'4px'}}>
                                  <b style={{color: '#047857'}}>{i.qty}x</b> <b>{i.name}</b><br/>
                                  {i.selections && <span style={{color: '#666'}}>↳ {i.selections}</span>}
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
                                  <button onClick={()=>handleOpenOrderMenuModal(res)} className="btn btn-ghost" style={{padding:'8px', width:'100%', border:'1px solid #047857', color:'#047857'}}>✏️ Edit Menu</button>
                              </div>
                          ) : (
                              <div className="text-center">
                                 <div style={{fontSize:'0.8em', color:'#aaa', marginBottom:'5px'}}>Selesai</div>
                                 <button onClick={()=>handleOpenOrderMenuModal(res)} className="btn btn-ghost" style={{width:'100%', padding:'8px', marginBottom:'6px', border:'1px solid #047857', color:'#047857'}}>✏️ Edit Menu</button>
                                 <button onClick={()=>handleDeleteReservation(res.id)} className="btn btn-ghost" style={{color:'red', width:'100%', padding:'8px'}}>🗑 Hapus</button>
                              </div>
                          )}
                      </td>
                    </tr>
                  ))}
                                    {sortedReservations.length === 0 && (
                                        <tr>
                                            <td colSpan="6" style={{textAlign:'center', color:'#777', padding:'20px'}}>Belum ada pesanan aktif untuk hari ini atau setelahnya.</td>
                                        </tr>
                                    )}
                </tbody>
            </table>
          </div>
                    </>
        )}

        {/* TAB 2: KELOLA PAKET (TANPA GAMBAR) */}
        {activeTab === 'packages' && (
            <div>
                <button onClick={()=>handleOpenModal('package')} className="btn btn-primary btn-block mb-4" style={{padding: '15px', fontSize: '1.1em'}}>+ BUAT PAKET BARU</button>
                <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:'20px'}}>
                    {packages.map((p) => (
                        <div key={p.id} className="card" style={{borderTop: '5px solid #047857', padding: '20px'}}>
                            
                            <div>
                                <h3 style={{margin:0, color: '#047857'}}>{p.name}</h3>
                                <div className="flex mt-2 mb-3"><span className={`badge ${p.isAvailable ? 'badge-green' : 'badge-red'}`}>{p.isAvailable ? 'Tersedia' : 'Habis'}</span></div>
                                
                                <div style={{fontSize: '0.85em', color: '#555', background: '#f9f9f9', padding: '10px', borderRadius: '8px', marginBottom: '15px'}}>
                                    <b>Deskripsi:</b> {p.description}<br/><br/>
                                    <b>Opsi Makanan:</b> {getProductNames(p.foodOptions)}<br/>
                                    <b>Opsi Minuman:</b> {getProductNames(p.drinkOptions)}
                                </div>
                                
                                <div className="text-primary font-bold" style={{fontSize: '1.3em'}}>Rp {p.price?.toLocaleString()}</div>
                                
                                <div className="flex mt-4 gap-2">
                                    <button onClick={()=>handleOpenModal('package', p)} className="btn btn-ghost" style={{flex:1, border: '1px solid #047857', color: '#047857'}}>Edit ✏️</button>
                                    <button onClick={()=>handleDeleteItem('package', p.id)} className="btn btn-danger" style={{flex:1}}>Hapus 🗑️</button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* TAB 3: KELOLA TEMPAT (TETAP ADA GAMBAR) */}
        {activeTab === 'spots' && (
            <div>
                <button onClick={()=>handleOpenModal('spot')} className="btn btn-primary btn-block mb-4" style={{padding: '15px', fontSize: '1.1em'}}>+ TAMBAH TEMPAT BARU</button>
                <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(250px, 1fr))', gap:'20px'}}>
                    {spots.map((s) => (
                        <div key={s.id} className="card" style={{borderTop: '5px solid #F59E0B'}}>
                            {/* Menampilkan Gambar Tempat */}
                            {s.img ? (
                                <img src={s.img} alt={s.name} style={{width: '100%', height: '150px', objectFit: 'cover', borderRadius: '8px', marginBottom: '10px'}} />
                            ) : (
                                <div style={{width: '100%', height: '150px', background: '#eee', borderRadius: '8px', marginBottom: '10px', display:'flex', alignItems:'center', justifyContent:'center', color:'#999'}}>Tidak ada gambar</div>
                            )}
                            
                            <div>
                                <h3 style={{margin:0, color: '#333'}}>{s.name}</h3>
                                <div className="flex mt-2 mb-2">
                                    <span className={`badge ${s.isAvailable ? 'badge-green' : 'badge-red'}`}>{s.isAvailable ? 'Buka' : 'Tutup'}</span>
                                    <span className="badge badge-yellow">Min. {s.min} Orang</span>
                                </div>
                            </div>
                            <div className="flex mt-4">
                                <button onClick={()=>handleOpenModal('spot', s)} className="btn btn-ghost" style={{flex:1}}>Edit</button>
                                <button onClick={()=>handleDeleteItem('spot', s.id)} className="btn btn-danger" style={{flex:1}}>Hapus</button>
                            </div>
                        </div>
                    ))}
                    {spots.length === 0 && <div className="text-center" style={{padding:'20px', color:'#888', width: '100%'}}>Belum ada data tempat. Tambahkan minimal 1 agar pelanggan bisa memesan.</div>}
                </div>
            </div>
        )}

        {/* TAB 4: MENU MASTER */}
        {activeTab === 'menu' && (
            <div>
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

      {/* MODAL GLOBAL */}
      {isModalOpen && (
        <div className="modal-overlay">
            <div className="modal-content" style={{maxWidth: '500px', maxHeight:'90vh', overflowY:'auto'}}>
                <h3 style={{color: '#047857'}}>{editingItem ? 'Edit Data' : (modalType === 'package' ? 'Buat Paket Baru' : modalType === 'spot' ? 'Tambah Tempat' : 'Tambah Menu')}</h3>
                <form onSubmit={handleSaveItem}>
                    <div className="form-group"><label className="label">Nama {modalType === 'package' ? 'Paket' : modalType === 'spot' ? 'Tempat' : 'Menu'}</label><input className="input" required value={formData.name} onChange={e=>setFormData({...formData, name:e.target.value})} /></div>
                    
                    {/* INPUT HARGA (Hanya Menu & Paket) */}
                    {modalType !== 'spot' && (
                        <div className="form-group"><label className="label">Harga</label><input type="number" className="input" required value={formData.price} onChange={e=>setFormData({...formData, price:e.target.value})} /></div>
                    )}

                    {/* INPUT KHUSUS TEMPAT */}
                    {modalType === 'spot' && (
                        <>
                            <div className="form-group"><label className="label">Minimal Orang (Pax)</label><input type="number" min="1" className="input" required value={formData.min} onChange={e=>setFormData({...formData, min:e.target.value})} /></div>
                            <div className="form-group">
                                <label className="label">Link URL Gambar Tempat</label>
                                <input className="input" placeholder="https://..." value={formData.img || ""} onChange={e=>setFormData({...formData, img:e.target.value})} />
                                <small style={{color:'#666'}}>*Copy paste link gambar dari Google/Unsplash</small>
                            </div>
                            <div className="form-group">
                                <label className="label">Tanggal Tidak Tersedia</label>
                                <input className="input" placeholder="Contoh: 2026-03-01, 2026-03-02" value={formData.unavailableDates || ""} onChange={e=>setFormData({...formData, unavailableDates:e.target.value})} />
                                <small style={{color:'#666'}}>Pisahkan dengan koma. Format wajib YYYY-MM-DD.</small>
                            </div>
                        </>
                    )}
                    
                    {/* INPUT KHUSUS PAKET (TANPA GAMBAR) */}
                    {modalType === 'package' && (
                        <>
                            <div className="form-group">
                                <label className="label">Isi Paket / Deskripsi</label>
                                <textarea className="textarea" rows="2" value={formData.description} onChange={e=>setFormData({...formData, description:e.target.value})}></textarea>
                            </div>
                            <div className="form-group">
                                <label className="label">Opsi Makanan (Pelanggan boleh pilih apa saja?)</label>
                                <div style={{maxHeight:'150px', overflowY:'auto', border:'1px solid #ddd', padding:'10px', borderRadius:'8px'}}>
                                    {products.filter(p => p.category === 'Food' || p.category === 'Snack').map(p => (
                                        <label key={p.id} style={{display:'flex', alignItems:'center', gap:'10px', marginBottom:'5px'}}><input type="checkbox" checked={formData.foodOptions?.includes(p.id)} onChange={(e) => handleOptionChange('foodOptions', p.id, e.target.checked)} />{p.name}</label>
                                    ))}
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="label">Opsi Minuman (Pelanggan boleh pilih apa saja?)</label>
                                <div style={{maxHeight:'150px', overflowY:'auto', border:'1px solid #ddd', padding:'10px', borderRadius:'8px'}}>
                                    {products.filter(p => p.category === 'Coffee' || p.category === 'Non-Coffee').map(p => (
                                        <label key={p.id} style={{display:'flex', alignItems:'center', gap:'10px', marginBottom:'5px'}}><input type="checkbox" checked={formData.drinkOptions?.includes(p.id)} onChange={(e) => handleOptionChange('drinkOptions', p.id, e.target.checked)} />{p.name}</label>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}

                    {modalType === 'menu' && (
                        <>
                            <div className="form-group"><label className="label">Kategori</label><select className="select" value={formData.category} onChange={e=>setFormData({...formData, category:e.target.value})}><option>Coffee</option><option>Non-Coffee</option><option>Food</option><option>Snack</option></select></div>
                            {(formData.category === 'Food' || formData.category === 'Snack') && (
                                <div className="form-group">
                                    <label className="label">Link URL Foto Makanan</label>
                                    <input className="input" placeholder="https://..." value={formData.img || ""} onChange={e=>setFormData({...formData, img:e.target.value})} />
                                    <small style={{color:'#666'}}>Foto ini akan tampil saat pelanggan memilih isi paket.</small>
                                </div>
                            )}
                        </>
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

            {isOrderMenuModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{maxWidth:'700px', maxHeight:'90vh', overflowY:'auto'}}>
                        <h3 style={{color:'#047857'}}>Edit Menu Pesanan</h3>
                        <form onSubmit={handleSaveOrderMenu}>
                            {orderMenuItems.map((item, index) => (
                                <div key={index} style={{border:'1px solid #e5e7eb', borderRadius:'8px', padding:'12px', marginBottom:'10px', background:'#fafafa'}}>
                                    <div className="form-group">
                                        <label className="label">Pilih Menu (Menu Master)</label>
                                        <select
                                            className="select"
                                            required
                                            value={item.name}
                                            onChange={(e) => handleOrderMenuNameChange(index, e.target.value)}
                                        >
                                            <option value="" disabled>-- Pilih menu --</option>
                                            {products.map((product) => (
                                                <option key={product.id} value={product.name}>
                                                    {product.name} - Rp {Number(product.price || 0).toLocaleString()}
                                                </option>
                                            ))}
                                            {item.name && !products.some((product) => product.name === item.name) && (
                                                <option value={item.name}>{item.name} (menu lama)</option>
                                            )}
                                        </select>
                                    </div>
                                    <div className="flex" style={{gap:'10px'}}>
                                        <div className="form-group" style={{flex:1}}>
                                            <label className="label">Qty</label>
                                            <input
                                                type="number"
                                                min="1"
                                                className="input"
                                                required
                                                value={item.qty}
                                                onChange={(e) => handleOrderMenuItemChange(index, "qty", e.target.value)}
                                            />
                                        </div>
                                        <div className="form-group" style={{flex:1}}>
                                            <label className="label">Harga Satuan</label>
                                            <input
                                                type="number"
                                                min="0"
                                                className="input"
                                                required
                                                value={item.price}
                                                onChange={(e) => handleOrderMenuItemChange(index, "price", e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label className="label">Pilihan (opsional)</label>
                                        <input
                                            className="input"
                                            value={item.selections}
                                            onChange={(e) => handleOrderMenuItemChange(index, "selections", e.target.value)}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="label">Catatan (opsional)</label>
                                        <input
                                            className="input"
                                            value={item.note}
                                            onChange={(e) => handleOrderMenuItemChange(index, "note", e.target.value)}
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveOrderMenuItem(index)}
                                        className="btn btn-danger"
                                        style={{padding:'8px 12px'}}
                                        disabled={orderMenuItems.length === 1}
                                    >
                                        Hapus Item
                                    </button>
                                </div>
                            ))}

                            <div className="flex" style={{gap:'10px', marginTop:'10px'}}>
                                <button type="button" onClick={handleAddOrderMenuItem} className="btn btn-secondary" style={{flex:1}}>+ Tambah Item</button>
                                <button type="button" onClick={() => setIsOrderMenuModalOpen(false)} className="btn btn-ghost" style={{flex:1}}>Batal</button>
                                <button type="submit" className="btn btn-primary" style={{flex:2}}>Simpan Perubahan</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
    </div>
  );
}