import { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, getDocs } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

export default function OrderList() {
  const navigate = useNavigate();
  const [reservations, setReservations] = useState([]);
  const [dateFilter, setDateFilter] = useState("");
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

  const parseItemQty = (qtyValue) => {
    const qtyNumber = Number(qtyValue);
    if (!Number.isFinite(qtyNumber) || qtyNumber <= 0) return 0;
    return qtyNumber;
  };

  const extractSubMenusFromItem = (item) => {
    if (!item) return [];

    if (Array.isArray(item.subMenus)) {
      return item.subMenus
        .map((subMenu) => String(subMenu || "").trim())
        .filter(Boolean);
    }

    return String(item.selections || "")
      .split(/\s*&\s*|\s*,\s*|\s*\|\s*/)
      .map((text) => text.trim())
      .filter(Boolean);
  };

  const getReservationSubMenuTotals = (reservation) => {
    const totals = {};

    (reservation?.items || []).forEach((item) => {
      const qty = parseItemQty(item?.qty);
      if (!qty) return;

      const subMenus = extractSubMenusFromItem(item);
      subMenus.forEach((subMenu) => {
        totals[subMenu] = (totals[subMenu] || 0) + qty;
      });
    });

    return Object.entries(totals).sort((a, b) => b[1] - a[1]);
  };

  const getReservationMenuTotals = (reservation) => {
    const totals = {};

    (reservation?.items || []).forEach((item) => {
      const itemName = String(item?.name || "").trim();
      if (!itemName) return;

      const qty = parseItemQty(item?.qty);
      if (!qty) return;

      totals[itemName] = (totals[itemName] || 0) + qty;
    });

    return Object.entries(totals).sort((a, b) => b[1] - a[1]);
  };

  const productCategoryByName = products.reduce((acc, product) => {
    const productName = String(product?.name || "").trim().toLowerCase();
    if (!productName) return acc;
    acc[productName] = String(product?.category || "").trim().toLowerCase();
    return acc;
  }, {});

  const getReservationOptionalTotalsByCategory = (reservation) => {
    const reservationSubMenuTotals = getReservationSubMenuTotals(reservation);
    const foodSubMenuTotals = [];
    const drinkSubMenuTotals = [];

    reservationSubMenuTotals.forEach(([subMenuName, qty], index) => {
      const normalizedName = String(subMenuName || "").trim().toLowerCase();
      const category = productCategoryByName[normalizedName] || "";

      if (category === "coffee" || category === "non-coffee" || category === "non-coffe") {
        drinkSubMenuTotals.push([subMenuName, qty]);
        return;
      }

      if (category === "food" || category === "snack") {
        foodSubMenuTotals.push([subMenuName, qty]);
        return;
      }

      if (reservationSubMenuTotals.length === 2 && index === 1) {
        drinkSubMenuTotals.push([subMenuName, qty]);
        return;
      }

      foodSubMenuTotals.push([subMenuName, qty]);
    });

    return { foodSubMenuTotals, drinkSubMenuTotals };
  };

  const visibleReservations = reservations.filter((reservation) => !isReservationPastDay(reservation));

  const sortedReservations = [...visibleReservations].sort((a, b) => {
    const aTs = getReservationTimestamp(a);
    const bTs = getReservationTimestamp(b);
    const primaryDiff = bTs - aTs;
    if (primaryDiff !== 0) return primaryDiff;

    const aCreatedAtMs = a?.createdAt?.toMillis?.() || 0;
    const bCreatedAtMs = b?.createdAt?.toMillis?.() || 0;
    const createdAtDiff = aCreatedAtMs - bCreatedAtMs;
    if (createdAtDiff !== 0) return createdAtDiff;

    return String(a?.id || "").localeCompare(String(b?.id || ""));
  });

  const filteredReservations = dateFilter
    ? sortedReservations.filter((reservation) => reservation.date === dateFilter)
    : sortedReservations;

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
            <div className="card sort-card" style={{marginBottom:'15px'}}>
              <label className="label sort-label">Filter Tanggal</label>
              <div style={{display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap'}}>
                <input
                  type="date"
                  className="input sort-select"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  style={{maxWidth:'220px'}}
                />
                {dateFilter && (
                  <button className="btn btn-ghost" onClick={() => setDateFilter("")}>Reset</button>
                )}
              </div>
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
                  {filteredReservations.map((res) => {
                    const reservationMenuTotals = getReservationMenuTotals(res);
                    const { foodSubMenuTotals, drinkSubMenuTotals } = getReservationOptionalTotalsByCategory(res);

                    return (
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
                        <div style={{marginTop:'6px', background:'#f0fdfa', border:'1px solid #99f6e4', borderRadius:'6px', padding:'8px'}}>
                          <div style={{fontSize:'0.82em', fontWeight:600, color:'#0f766e', marginBottom:'6px'}}>Ringkasan menu </div>

                          <div style={{fontSize:'0.78em', fontWeight:600, color:'#374151', marginBottom:'3px'}}>Menu utama</div>
                          {reservationMenuTotals.length > 0 ? (
                            reservationMenuTotals.map(([menuName, totalQty]) => (
                              <div key={`main-${menuName}`} style={{display:'flex', justifyContent:'flex-start', gap:'6px', fontSize:'0.82em', marginBottom:'2px'}}>
                                <span>{menuName}</span>
                                <b>{totalQty}</b>
                              </div>
                            ))
                          ) : (
                            <div style={{fontSize:'0.82em', color:'#6b7280', marginBottom:'4px'}}>Belum ada menu utama.</div>
                          )}

                          <div style={{fontSize:'0.78em', fontWeight:600, color:'#b45309', marginTop:'6px', marginBottom:'3px'}}> makanan</div>
                          {foodSubMenuTotals.length > 0 ? (
                            foodSubMenuTotals.map(([menuName, totalQty]) => (
                              <div key={`food-${menuName}`} style={{display:'flex', justifyContent:'flex-start', gap:'6px', fontSize:'0.82em', marginBottom:'2px'}}>
                                <span>{menuName}</span>
                                <b>{totalQty}</b>
                              </div>
                            ))
                          ) : (
                            <div style={{fontSize:'0.82em', color:'#6b7280', marginBottom:'4px'}}>Tidak ada  makanan.</div>
                          )}

                          <div style={{fontSize:'0.78em', fontWeight:600, color:'#0369a1', marginTop:'6px', marginBottom:'3px'}}>minuman</div>
                          {drinkSubMenuTotals.length > 0 ? (
                            drinkSubMenuTotals.map(([menuName, totalQty]) => (
                              <div key={`drink-${menuName}`} style={{display:'flex', justifyContent:'flex-start', gap:'6px', fontSize:'0.82em', marginBottom:'2px'}}>
                                <span>{menuName}</span>
                                <b>{totalQty}</b>
                              </div>
                            ))
                          ) : (
                            <div style={{fontSize:'0.82em', color:'#6b7280'}}>Tidak ada  minuman.</div>
                          )}
                        </div>
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
                  );
                  })}
                </tbody>
              </table>
            </div>

            <div className="order-list-mobile">
              {filteredReservations.map((res) => {
                const reservationMenuTotals = getReservationMenuTotals(res);
                const { foodSubMenuTotals, drinkSubMenuTotals } = getReservationOptionalTotalsByCategory(res);

                return (
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
                      <div style={{marginTop:'8px', background:'#f0fdfa', border:'1px solid #99f6e4', borderRadius:'6px', padding:'8px'}}>
                        <div style={{fontSize:'0.82em', fontWeight:600, color:'#0f766e', marginBottom:'6px'}}>Ringkasan menu pesanan ini</div>

                        <div style={{fontSize:'0.78em', fontWeight:600, color:'#374151', marginBottom:'3px'}}>Menu utama</div>
                        {reservationMenuTotals.length > 0 ? (
                          reservationMenuTotals.map(([menuName, totalQty]) => (
                            <div key={`m-main-${menuName}`} style={{display:'flex', justifyContent:'flex-start', gap:'6px', fontSize:'0.82em', marginBottom:'2px'}}>
                              <span>{menuName}</span>
                              <b>{totalQty}</b>
                            </div>
                          ))
                        ) : (
                          <div style={{fontSize:'0.82em', color:'#6b7280', marginBottom:'4px'}}>Belum ada menu utama.</div>
                        )}

                        <div style={{fontSize:'0.78em', fontWeight:600, color:'#b45309', marginTop:'6px', marginBottom:'3px'}}>Opsional makanan</div>
                        {foodSubMenuTotals.length > 0 ? (
                          foodSubMenuTotals.map(([menuName, totalQty]) => (
                            <div key={`m-food-${menuName}`} style={{display:'flex', justifyContent:'flex-start', gap:'6px', fontSize:'0.82em', marginBottom:'2px'}}>
                              <span>{menuName}</span>
                              <b>{totalQty}</b>
                            </div>
                          ))
                        ) : (
                          <div style={{fontSize:'0.82em', color:'#6b7280', marginBottom:'4px'}}>Tidak ada opsional makanan.</div>
                        )}

                        <div style={{fontSize:'0.78em', fontWeight:600, color:'#0369a1', marginTop:'6px', marginBottom:'3px'}}>Opsional minuman</div>
                        {drinkSubMenuTotals.length > 0 ? (
                          drinkSubMenuTotals.map(([menuName, totalQty]) => (
                            <div key={`m-drink-${menuName}`} style={{display:'flex', justifyContent:'flex-start', gap:'6px', fontSize:'0.82em', marginBottom:'2px'}}>
                              <span>{menuName}</span>
                              <b>{totalQty}</b>
                            </div>
                          ))
                        ) : (
                          <div style={{fontSize:'0.82em', color:'#6b7280'}}>Tidak ada opsional minuman.</div>
                        )}
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
              );
              })}
            </div>

            {filteredReservations.length === 0 && (
              <div className="empty-state">
                {dateFilter
                  ? "Tidak ada pesanan untuk tanggal yang dipilih."
                  : "Belum ada pesanan masuk."}
              </div>
            )}
          </div>
          </>
        )}
      </div>
    </div>
  );
}