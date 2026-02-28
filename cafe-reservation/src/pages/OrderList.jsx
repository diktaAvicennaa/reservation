import { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, getDocs } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

export default function OrderList() {
  const navigate = useNavigate();
  const [reservations, setReservations] = useState([]);
  const [dateSort, setDateSort] = useState("newest");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [products, setProducts] = useState([]);

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
    if (reservationDateMs > 0) {
      return reservationDateMs;
    }

    const createdAtMs = reservation?.createdAt?.toMillis?.();
    if (typeof createdAtMs === "number" && createdAtMs > 0) {
      return createdAtMs;
    }
    return 0;
  };

  useEffect(() => {
    fetchReservations();
    fetchProducts();
  }, []);

  const fetchReservations = async () => {
    try {
      setLoading(true);
      const s = await getDocs(collection(db, "reservations"));
      const data = s.docs.map(d => ({ id: d.id, ...d.data() }));
      setReservations(data);
      console.log("Data pesanan:", data);
    } catch (err) {
      console.error("Error fetching reservations:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const s = await getDocs(collection(db, "products"));
      setProducts(s.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Error fetching products:", err);
    }
  };

  const productCategoryMap = new Map(
    products
      .filter(p => p?.name)
      .map(p => [p.name.toLowerCase(), p.category])
  );

  const normalizeCategory = (cat = "") =>
    String(cat).toLowerCase().replace(/\s|_/g, "-");

  const getCategoryRank = (cat = "") => {
    const c = normalizeCategory(cat);
    if (c === "coffee" || c === "non-coffee" || c === "non-coffe") return 0; // minuman
    if (c === "snack") return 1;
    if (c === "food") return 2;
    return 99;
  };

  const sortItemsByCategory = (items = []) => {
    return [...items].sort((a, b) => {
      const aCat = a?.category || a?.cat || a?.type || productCategoryMap.get(a?.name?.toLowerCase());
      const bCat = b?.category || b?.cat || b?.type || productCategoryMap.get(b?.name?.toLowerCase());
      const aRank = getCategoryRank(aCat);
      const bRank = getCategoryRank(bCat);
      return aRank - bRank;
    });
  };

  const sortedReservations = [...reservations].sort((a, b) => {
    const aTs = getReservationTimestamp(a);
    const bTs = getReservationTimestamp(b);
    return dateSort === "oldest" ? aTs - bTs : bTs - aTs;
  });

  return (
    <div className="admin-container">
      {/* NAVBAR */}
      <div className="admin-navbar">
        <h1><span>🌵</span> Daftar Pesanan - Cafe Tropis</h1>
        <button onClick={() => navigate("/")} className="btn btn-ghost">← Kembali</button>
      </div>

      <div className="admin-content">
        {/* LOADING STATE */}
        {loading && (
          <div className="text-center" style={{padding:'40px', color:'#999'}}>
            <p>⏳ Sedang memuat pesanan...</p>
          </div>
        )}

        {/* ERROR STATE */}
        {error && (
          <div className="card" style={{background:'#fee2e2', border:'1px solid #fca5a5', color:'#991b1b', padding:'20px'}}>
            <p>❌ Error: {error}</p>
            <button onClick={fetchReservations} className="btn btn-primary mt-2">Coba Lagi</button>
          </div>
        )}

        {/* DAFTAR PESANAN READ-ONLY */}
        {!loading && !error && (
          <>
            <div className="card sort-card">
              <label className="label sort-label">Urutkan Berdasarkan</label>
              <select className="input sort-select" value={dateSort} onChange={(e) => setDateSort(e.target.value)}>
                <option value="newest">Tanggal terjauh</option>
                <option value="oldest">Tanggal terdekat</option>
              </select>
            </div>

          <div className="table-container">
            <div className="order-list-desktop">
              <table>
                <thead>
                  <tr>
                    <th className="force-nowrap">Waktu</th>
                    <th className="table-center">Pelanggan</th>
                    <th className="table-center">Meja</th>
                    <th>Pesanan</th>
                    <th className="price-column">Total</th>
                    <th className="table-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedReservations.map((res) => (
                    <tr key={res.id}>
                      <td className="force-nowrap" style={{verticalAlign: 'top'}}>
                        <div style={{fontWeight:'bold', color: '#047857'}}>{res.time}</div>
                        <small>{res.date}</small>
                      </td>
                      <td className="table-center force-nowrap" style={{verticalAlign: 'top'}}>
                        <b>{res.customerName}</b><br/>
                        <small>{res.customerPhone}</small>
                      </td>
                      <td className="table-center" style={{verticalAlign: 'top'}}>
                        <div style={{fontWeight: 'bold', color: '#047857'}}>{res.spotName || "Meja Standar"}</div>
                        <div style={{fontSize: '0.85em', color: '#555'}}>{res.partySize} Orang</div>
                      </td>
                      <td style={{verticalAlign: 'top'}}>
                        {sortItemsByCategory(res.items)?.map((i,x)=>(
                          <div key={x} style={{marginBottom:'10px', background:'#f9f9f9', padding:'8px', borderRadius:'6px'}}>
                            <div className="force-nowrap">
                                <b style={{color: '#047857'}}>{i.qty}x</b> <b>{i.name}</b>
                            </div>
                            
                            {/* MENAMPILKAN DETAIL MENU YANG DIPILIH */}
                            {i.selections && (
                                <div style={{color: '#555', fontSize: '0.9em', marginTop: '2px'}}>
                                    ↳ {i.selections}
                                </div>
                            )}

                            {/* MENAMPILKAN CATATAN PER PAKET */}
                            {i.note && (
                                <div style={{fontSize: '0.85em', color: '#d97706', fontStyle: 'italic', marginTop: '2px'}}>
                                    📝 {i.note}
                                </div>
                            )}
                          </div>
                        ))}
                        {/* CATATAN GLOBAL */}
                        {res.customerNotes && <div className="badge badge-yellow" style={{marginTop:'5px', display:'inline-block'}}>📝 {res.customerNotes}</div>}
                      </td>
                      <td className="price-column" style={{verticalAlign: 'top', fontWeight: 'bold'}}>Rp {res.totalPrice?.toLocaleString()}</td>
                      <td className="table-center" style={{verticalAlign: 'top'}}>
                        <span className={`badge ${res.status==='confirmed'?'badge-green':res.status==='rejected'?'badge-red':'badge-yellow'}`}>
                          {res.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="order-list-mobile">
              {sortedReservations.map((res) => (
                <div className="order-card" key={res.id}>
                  <div className="order-card-header">
                    <div>
                      <div className="order-time" style={{color: '#047857'}}>{res.time}</div>
                      <div className="order-date">{res.date}</div>
                    </div>
                    <span className={`badge ${res.status==='confirmed'?'badge-green':res.status==='rejected'?'badge-red':'badge-yellow'}`}>
                      {res.status}
                    </span>
                  </div>

                  <div className="order-card-row">
                    <div className="order-label">Pelanggan</div>
                    <div className="order-value">
                      <b>{res.customerName}</b> <span className="order-sep">•</span> {res.customerPhone}
                    </div>
                  </div>

                  <div className="order-card-row">
                    <div className="order-label">Meja</div>
                    <div className="order-value">
                      <b>{res.spotName || "Meja Standar"}</b>
                      <div style={{fontSize: '0.85em', color: '#555'}}>{res.partySize} Orang</div>
                    </div>
                  </div>

                  <div className="order-card-row">
                    <div className="order-label">Pesanan</div>
                    <div className="order-value">
                      <div className="order-items">
                        {sortItemsByCategory(res.items)?.map((i, x) => (
                          <div key={x} className="order-item" style={{marginBottom: '10px', background:'#f9f9f9', padding:'8px', borderRadius:'6px'}}>
                              <div style={{fontWeight: 'bold'}}>
                                  <span style={{color: '#047857'}}>{i.qty}x</span> {i.name}
                              </div>
                              
                              {/* MENAMPILKAN DETAIL MENU YANG DIPILIH DI MOBILE */}
                              {i.selections && (
                                  <div style={{color: '#555', fontSize: '0.9em', marginTop: '2px'}}>
                                      ↳ {i.selections}
                                  </div>
                              )}

                              {/* MENAMPILKAN CATATAN PER PAKET DI MOBILE */}
                              {i.note && (
                                  <div style={{fontSize: '0.85em', color: '#d97706', fontStyle: 'italic', marginTop: '2px'}}>
                                      📝 {i.note}
                                  </div>
                              )}
                          </div>
                        ))}
                      </div>
                      {/* CATATAN GLOBAL */}
                      {res.customerNotes && (
                        <div className="badge badge-yellow order-notes" style={{display:'inline-block'}}>📝 {res.customerNotes}</div>
                      )}
                    </div>
                  </div>

                  <div className="order-card-footer">
                    <div className="order-total" style={{color: '#047857'}}>Rp {res.totalPrice?.toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>

            {sortedReservations.length === 0 && <div className="empty-state">Belum ada pesanan masuk.</div>}
          </div>
          </>
        )}
      </div>
    </div>
  );
}