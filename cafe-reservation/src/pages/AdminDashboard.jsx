import { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import { collection, getDocs, updateDoc, doc, deleteDoc, addDoc, deleteField, query, where, setDoc, getDoc, limit } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("orders");
  const [reservations, setReservations] = useState([]);
    const [deletedReservations, setDeletedReservations] = useState([]);
        const [selectedDeletedReservationIds, setSelectedDeletedReservationIds] = useState([]);
    const [restoreDatesById, setRestoreDatesById] = useState({});
    const [dateSort, setDateSort] = useState("newest");
    const [dateFilter, setDateFilter] = useState("");
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
    fetchAllData();
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

    const sanitizeFirestoreData = (value) => {
        if (value === undefined) return null;
        if (value === null) return null;
        if (Array.isArray(value)) {
            return value.map((item) => sanitizeFirestoreData(item));
        }
        if (value instanceof Date) return value;
        if (typeof value === "object") {
            return Object.entries(value).reduce((acc, [key, nestedValue]) => {
                const cleaned = sanitizeFirestoreData(nestedValue);
                if (cleaned !== undefined) acc[key] = cleaned;
                return acc;
            }, {});
        }
        return value;
    };

  const fetchAllData = async () => {
    const [resSnap, delSnap, pkgSnap, prodSnap, spotSnap] = await Promise.all([
      getDocs(query(collection(db, "reservations"), limit(200))),
      getDocs(query(collection(db, "deletedReservations"), limit(50))),
      getDocs(collection(db, "packages")),
      getDocs(collection(db, "products")),
      getDocs(collection(db, "spots")),
    ]);
    setReservations(resSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setDeletedReservations(delSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setPackages(pkgSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setProducts(prodSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setSpots(spotSnap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const fetchReservations = async () => {
    const s = await getDocs(query(collection(db, "reservations"), limit(200)));
    setReservations(s.docs.map(d => ({ id: d.id, ...d.data() })));
  };
  const fetchDeletedReservations = async () => {
    const s = await getDocs(query(collection(db, "deletedReservations"), limit(50)));
    setDeletedReservations(s.docs.map(d => ({ id: d.id, ...d.data() })));
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

        setReservations(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    };
    const handleDeleteReservation = async (id) => {
        if(!confirm("Pindahkan pesanan ini ke riwayat hapus?")) return;
        const currentReservation = reservations.find(r => r.id === id);
        if (!currentReservation) return;

        await setDoc(doc(db, "deletedReservations", id), sanitizeFirestoreData({
            ...currentReservation,
            originalReservationId: id,
            deletedAt: new Date(),
            deletedReason: "manual"
        }), { merge: true });

        await deleteDoc(doc(db, "reservations", id));

        if (currentReservation?.date && currentReservation?.spotId) {
            await releaseReservationLockIfOwned({
                reservationId: id,
                date: currentReservation.date,
                spotId: currentReservation.spotId
            });
        }

        setReservations(prev => prev.filter(r => r.id !== id));
        setDeletedReservations(prev => [{ id, ...currentReservation, originalReservationId: id, deletedAt: new Date(), deletedReason: "manual" }, ...prev]);
    };

    const hasReservationConflict = async ({ reservationId, date, time, spotId }) => {
        if (!date || !time || !spotId) return false;

        const conflictQuery = query(
            collection(db, "reservations"),
            where("date", "==", date),
            where("time", "==", time),
            where("spotId", "==", spotId)
        );
        const conflictSnap = await getDocs(conflictQuery);

        return conflictSnap.docs.some(d => {
            const data = d.data();
            return d.id !== reservationId && data.status !== "rejected";
        });
    };

    const handlePermanentDeleteFromTrash = async (id) => {
        if (!confirm("Hapus permanen dari riwayat hapus? Tindakan ini tidak bisa dibatalkan.")) return;
        await deleteDoc(doc(db, "deletedReservations", id));
        setDeletedReservations(prev => prev.filter(r => r.id !== id));
        setSelectedDeletedReservationIds(prev => prev.filter((itemId) => itemId !== id));
        setRestoreDatesById((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
        });
    };

    const handleToggleDeletedReservationSelection = (id) => {
        setSelectedDeletedReservationIds((prev) => {
            if (prev.includes(id)) {
                return prev.filter((itemId) => itemId !== id);
            }
            return [...prev, id];
        });
    };

    const handleToggleSelectAllDeletedReservations = () => {
        if (selectedDeletedReservationIds.length === deletedReservations.length) {
            setSelectedDeletedReservationIds([]);
            return;
        }

        setSelectedDeletedReservationIds(deletedReservations.map((reservation) => reservation.id));
    };

    const handleBulkPermanentDeleteFromTrash = async () => {
        if (!selectedDeletedReservationIds.length) {
            alert("Pilih minimal 1 pesanan untuk dihapus permanen.");
            return;
        }

        if (!confirm(`Hapus permanen ${selectedDeletedReservationIds.length} pesanan dari riwayat hapus?`)) return;

        await Promise.all(
            selectedDeletedReservationIds.map((id) => deleteDoc(doc(db, "deletedReservations", id)))
        );

        const selectedSet = new Set(selectedDeletedReservationIds);
        setDeletedReservations((prev) => prev.filter((reservation) => !selectedSet.has(reservation.id)));
        setSelectedDeletedReservationIds([]);
        setRestoreDatesById((prev) => {
            const next = { ...prev };
            selectedDeletedReservationIds.forEach((id) => {
                delete next[id];
            });
            return next;
        });
    };

    const handleRestoreDeletedReservation = async (id) => {
        const deletedReservation = deletedReservations.find(r => r.id === id);
        if (!deletedReservation) return;

        const selectedRestoreDate = restoreDatesById[id] || deletedReservation.date || "";
        if (!selectedRestoreDate) {
            alert("Tanggal restore wajib diisi.");
            return;
        }

        const isConflict = await hasReservationConflict({
            reservationId: id,
            date: selectedRestoreDate,
            time: deletedReservation.time,
            spotId: deletedReservation.spotId
        });

        if (isConflict) {
            alert(`Tanggal ${selectedRestoreDate} bentrok: tempat ${deletedReservation.spotName || "terpilih"} jam ${deletedReservation.time} sudah terisi.`);
            return;
        }

        const { deletedAt, deletedReason, originalReservationId, ...restReservationData } = deletedReservation;

        await setDoc(doc(db, "reservations", id), sanitizeFirestoreData({
            ...restReservationData,
            date: selectedRestoreDate,
            restoredAt: new Date()
        }));

        if (deletedReservation?.spotId) {
            await syncReservationLock({
                reservationId: id,
                date: selectedRestoreDate,
                time: deletedReservation.time,
                spotId: deletedReservation.spotId,
                spotName: deletedReservation.spotName,
                status: deletedReservation.status || "pending"
            });
        }

        await deleteDoc(doc(db, "deletedReservations", id));
        setRestoreDatesById((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
        });

        const restoredEntry = { id, ...restReservationData, date: selectedRestoreDate, restoredAt: new Date() };
        setDeletedReservations(prev => prev.filter(r => r.id !== id));
        setSelectedDeletedReservationIds(prev => prev.filter((itemId) => itemId !== id));
        setReservations(prev => [restoredEntry, ...prev]);
    };

    const handleCleanupPastReservations = async (pastReservationList = []) => {
        if (!pastReservationList.length) return;

        try {
            // Arsipkan dan hapus semua reservasi secara paralel
            await Promise.all(pastReservationList.map(reservation =>
                Promise.all([
                    setDoc(doc(db, "deletedReservations", reservation.id), sanitizeFirestoreData({
                        ...reservation,
                        originalReservationId: reservation.id,
                        deletedAt: new Date(),
                        deletedReason: "past-day-cleanup"
                    }), { merge: true }),
                    deleteDoc(doc(db, "reservations", reservation.id))
                ])
            ));

            // Lepas lock semua reservasi lama tanpa baca (tanggal sudah lewat, aman dirilis langsung)
            await Promise.all(
                pastReservationList
                    .filter(r => r?.date && r?.spotId)
                    .map(r => setDoc(
                        doc(db, "reservationLocks", buildReservationLockId(r.date, r.spotId)),
                        { status: "rejected", updatedAt: new Date() },
                        { merge: true }
                    ))
            );

            const cleanedIds = new Set(pastReservationList.map(r => r.id));
            const cleanupNow = new Date();
            setReservations(prev => prev.filter(r => !cleanedIds.has(r.id)));
            setDeletedReservations(prev => [
                ...pastReservationList.map(r => ({ ...r, originalReservationId: r.id, deletedAt: cleanupNow, deletedReason: "past-day-cleanup" })),
                ...prev
            ]);
            alert(`${pastReservationList.length} pesanan beda hari dipindah ke riwayat hapus.`);
        } catch (error) {
            alert("Gagal memindahkan pesanan beda hari ke riwayat hapus. Coba lagi.");
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

        setReservations(prev => prev.map(r => r.id === id ? { ...r, date: newDate } : r));
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

            setReservations(prev => prev.map(r => r.id === id ? { ...r, spotId: spot.id, spotName: spot.name } : r));
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

        setReservations(prev => prev.map(r => r.id === id ? { ...r, spotId: spot.id, spotName: spot.name } : r));
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
        const updatedReservationData = {
            items: normalizedItems,
            totalPrice: newTotalPrice
        };

        await updateDoc(doc(db, "reservations", editingReservation.id), updatedReservationData);

        // Update UI segera agar ringkasan item ikut berubah tanpa menunggu fetch ulang.
        setReservations((prev) =>
            prev.map((reservation) =>
                reservation.id === editingReservation.id
                    ? { ...reservation, ...updatedReservationData }
                    : reservation
            )
        );

        setIsOrderMenuModalOpen(false);
        setEditingReservation(null);
        setOrderMenuItems([]);
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

    useEffect(() => {
        setSelectedDeletedReservationIds((prev) => {
            if (!prev.length) return prev;
            const deletedIdSet = new Set(deletedReservations.map((reservation) => reservation.id));
            return prev.filter((id) => deletedIdSet.has(id));
        });
    }, [deletedReservations]);

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

    if (editingItem) {
        await updateDoc(doc(db, collectionName, editingItem.id), payload);

        if (modalType === 'menu') {
            setProducts((prev) =>
                prev.map((product) =>
                    product.id === editingItem.id ? { ...product, ...payload } : product
                )
            );
        }
    } else {
        const newDocRef = await addDoc(collection(db, collectionName), payload);

        if (modalType === 'menu') {
            setProducts((prev) => [{ id: newDocRef.id, ...payload }, ...prev]);
        }
    }
    
    setIsModalOpen(false);

    if (modalType === 'package') {
        fetchPackages();
    } else if (modalType === 'spot') {
        fetchSpots();
    } else {
        // Menu master: tunda sync agar tidak overwrite perubahan lokal saat Firestore belum konsisten.
        setTimeout(() => {
            fetchProducts();
        }, 600);
    }
  };

  const getProductNames = (ids) => {
      if(!ids || ids.length === 0) return "-";
      return ids.map(id => products.find(p => p.id === id)?.name).filter(Boolean).join(", ");
  };

    const normalizeCategory = (value) => String(value || "").trim().toLowerCase();

    const packageFoodProducts = products.filter((product) => {
        const category = normalizeCategory(product?.category);
        return category === "food" || category === "snack";
    });

    const packageDrinkProducts = products.filter((product) => {
        const category = normalizeCategory(product?.category);
        return category === "coffee"
            || category === "non-coffee"
            || category === "non coffee"
            || category === "non-coffe";
    });

    const formatCurrency = (amount) => `Rp ${Number(amount || 0).toLocaleString("id-ID")}`;

    const getReservationStatusMeta = (status) => {
        if (status === "confirmed") {
            return {
                badgeClass: "badge-green",
                label: "Diterima"
            };
        }

        if (status === "rejected") {
            return {
                badgeClass: "badge-red",
                label: "Ditolak"
            };
        }

        return {
            badgeClass: "badge-yellow",
            label: "Menunggu"
        };
    };

    const pastReservations = reservations.filter(isReservationPastDay);
    const activeReservations = reservations.filter((reservation) => !isReservationPastDay(reservation));

    const sortedReservations = [...activeReservations].sort((a, b) => {
        const aTs = getReservationTimestamp(a);
        const bTs = getReservationTimestamp(b);
        const primaryDiff = dateSort === "oldest" ? aTs - bTs : bTs - aTs;
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

    const summaryReservations = filteredReservations.filter(
        (reservation) => reservation.status !== "rejected"
    );

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

    const getReservationItemSummary = (reservation) => {
        const items = reservation?.items || [];

        let subMenuTypes = 0;
        let subMenuQty = 0;

        items.forEach((item) => {
            const qty = parseItemQty(item?.qty);
            if (qty > 0) {
                const subMenus = extractSubMenusFromItem(item);
                subMenuTypes += subMenus.length;
                subMenuQty += subMenus.length * qty;
            }
        });

        const mainItemTypes = items.length;
        const mainQty = items.reduce((sum, item) => sum + parseItemQty(item?.qty), 0);

        return {
            itemTypes: mainItemTypes + subMenuTypes,
            totalQty: mainQty + subMenuQty
        };
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

    const menuTotalsMap = summaryReservations.reduce((acc, reservation) => {
        (reservation.items || []).forEach((item) => {
            const itemName = String(item?.name || "").trim();
            const qty = parseItemQty(item?.qty);
            if (!qty) return;
            if (!itemName) return;
            acc[itemName] = (acc[itemName] || 0) + qty;
        });
        return acc;
    }, {});

    const menuTotals = Object.entries(menuTotalsMap).sort((a, b) => b[1] - a[1]);
    const productCategoryByName = products.reduce((acc, product) => {
        const productName = String(product?.name || "").trim().toLowerCase();
        if (!productName) return acc;
        acc[productName] = String(product?.category || "").trim().toLowerCase();
        return acc;
    }, {});

    const foodSubMenuTotalsMap = {};
    const drinkSubMenuTotalsMap = {};

    const categorizeSelectionName = (selectionName, indexInSelections, totalSelections) => {
        const normalizedName = String(selectionName || "").trim().toLowerCase();
        const category = productCategoryByName[normalizedName] || "";

        if (category === "coffee" || category === "non-coffee" || category === "non-coffe") {
            return "drink";
        }

        if (category === "food" || category === "snack") {
            return "food";
        }

        if (totalSelections === 2 && indexInSelections === 1) {
            return "drink";
        }

        return "food";
    };

    summaryReservations.forEach((reservation) => {
        (reservation.items || []).forEach((item) => {
            const qty = parseItemQty(item?.qty);
            if (!qty) return;
            const subMenus = extractSubMenusFromItem(item);
            if (!subMenus.length) return;

            subMenus.forEach((subMenu, index) => {
                const categoryType = categorizeSelectionName(subMenu, index, subMenus.length);

                if (categoryType === "drink") {
                    drinkSubMenuTotalsMap[subMenu] = (drinkSubMenuTotalsMap[subMenu] || 0) + qty;
                    return;
                }

                foodSubMenuTotalsMap[subMenu] = (foodSubMenuTotalsMap[subMenu] || 0) + qty;
            });
        });
    });

    const foodSubMenuTotals = Object.entries(foodSubMenuTotalsMap).sort((a, b) => b[1] - a[1]);
    const drinkSubMenuTotals = Object.entries(drinkSubMenuTotalsMap).sort((a, b) => b[1] - a[1]);

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
                                                                <span style={{color:'#92400e', fontWeight:600}}>⚠️ Ada {pastReservations.length} pesanan beda hari (disembunyikan dari daftar aktif).</span>
                                                                <button
                                                                    onClick={() => {
                                                                        if (!confirm(`Pindahkan ${pastReservations.length} pesanan beda hari ke riwayat hapus?`)) return;
                                                                        handleCleanupPastReservations(pastReservations);
                                                                    }}
                                                                    className="btn btn-ghost"
                                                                    style={{padding:'8px 12px'}}
                                                                >
                                                                    Pindahkan ke Riwayat Hapus
                                                                </button>
                                                        </div>
                                                )}

                    {pastReservations.length > 0 && (
                        <div className="card" style={{marginBottom:'15px', padding:'14px 16px'}}>
                            <div style={{fontWeight:700, color:'#92400e', marginBottom:'10px'}}>Preview Pesanan Beda Hari</div>
                            <div style={{display:'grid', gap:'8px'}}>
                                {pastReservations.map((res) => (
                                    <div
                                        key={res.id}
                                        style={{display:'grid', gridTemplateColumns:'1.2fr 1fr 1fr auto', gap:'10px', alignItems:'center', border:'1px solid #f3f4f6', borderRadius:'8px', padding:'10px'}}
                                    >
                                        <div>
                                            <b>{res.customerName || "Tanpa Nama"}</b>
                                            <div style={{fontSize:'0.85em', color:'#6b7280'}}>{res.customerPhone || "-"}</div>
                                        </div>
                                        <div>
                                            <div style={{fontWeight:600}}>{res.date || "-"}</div>
                                            <div style={{fontSize:'0.85em', color:'#6b7280'}}>{res.time || "-"}</div>
                                        </div>
                                        <div style={{fontSize:'0.9em'}}>{res.spotName || "Meja Standar"}</div>
                                        <button onClick={() => handleDeleteReservation(res.id)} className="btn btn-danger" style={{padding:'6px 10px'}}>
                                            Arsipkan
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="card" style={{marginBottom:'15px', padding:'14px 16px'}}>
                        <div style={{fontWeight:700, color:'#334155', marginBottom:'10px'}}>Riwayat Hapus (Bisa Restore)</div>
                        {deletedReservations.length === 0 ? (
                            <div style={{fontSize:'0.9em', color:'#6b7280'}}>Belum ada pesanan di riwayat hapus.</div>
                        ) : (
                            <div style={{display:'grid', gap:'10px'}}>
                                <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:'10px', flexWrap:'wrap', border:'1px solid #e5e7eb', background:'#f8fafc', borderRadius:'8px', padding:'10px 12px'}}>
                                    <label style={{display:'flex', alignItems:'center', gap:'8px', fontSize:'0.9em', cursor:'pointer'}}>
                                        <input
                                            type="checkbox"
                                            checked={deletedReservations.length > 0 && selectedDeletedReservationIds.length === deletedReservations.length}
                                            onChange={handleToggleSelectAllDeletedReservations}
                                        />
                                        Pilih Semua ({selectedDeletedReservationIds.length}/{deletedReservations.length})
                                    </label>
                                    <button
                                        onClick={handleBulkPermanentDeleteFromTrash}
                                        className="btn btn-danger"
                                        style={{padding:'8px 12px'}}
                                        disabled={selectedDeletedReservationIds.length === 0}
                                    >
                                        Hapus Permanen Terpilih
                                    </button>
                                </div>
                                {deletedReservations
                                    .sort((a, b) => {
                                        const aTs = a?.deletedAt?.toMillis?.() || 0;
                                        const bTs = b?.deletedAt?.toMillis?.() || 0;
                                        return bTs - aTs;
                                    })
                                    .map((res) => (
                                        <div key={res.id} style={{border:'1px solid #e5e7eb', borderRadius:'8px', padding:'10px'}}>
                                            <div style={{display:'flex', justifyContent:'space-between', gap:'8px', alignItems:'center', flexWrap:'wrap'}}>
                                                <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedDeletedReservationIds.includes(res.id)}
                                                        onChange={() => handleToggleDeletedReservationSelection(res.id)}
                                                        aria-label={`Pilih pesanan ${res.customerName || "Tanpa Nama"}`}
                                                    />
                                                    <div>
                                                    <b>{res.customerName || "Tanpa Nama"}</b>
                                                    <div style={{fontSize:'0.85em', color:'#6b7280'}}>
                                                        {res.time || "-"} | {res.date || "-"} | {res.spotName || "Meja Standar"}
                                                    </div>
                                                    </div>
                                                </div>
                                                <span className="badge badge-red">Terhapus</span>
                                            </div>
                                            <div style={{display:'flex', gap:'8px', marginTop:'10px', flexWrap:'wrap', alignItems:'center'}}>
                                                <input
                                                    type="date"
                                                    className="input"
                                                    value={restoreDatesById[res.id] ?? (res.date || "")}
                                                    onChange={(e) => setRestoreDatesById((prev) => ({ ...prev, [res.id]: e.target.value }))}
                                                    style={{maxWidth:'180px', height:'40px'}}
                                                />
                                                <button onClick={() => handleRestoreDeletedReservation(res.id)} className="btn btn-primary" style={{padding:'8px 12px'}}>
                                                    Restore
                                                </button>
                                                <button onClick={() => handlePermanentDeleteFromTrash(res.id)} className="btn btn-danger" style={{padding:'8px 12px'}}>
                                                    Hapus Permanen
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        )}
                    </div>

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
                    <div className="card" style={{marginBottom:'15px', padding:'14px 16px'}}>
                        <div style={{fontWeight:700, color:'#047857', marginBottom:'10px'}}>
                            Ringkasan Menu {dateFilter ? `(${dateFilter})` : "(semua tanggal aktif)"}
                        </div>
                        <div style={{fontSize:'0.85em', color:'#6b7280', marginBottom:'10px'}}>
                            Perhitungan ringkasan tidak memasukkan pesanan berstatus Ditolak.
                        </div>
                        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(250px, 1fr))', gap:'12px'}}>
                            <div style={{background:'#f9fafb', border:'1px solid #e5e7eb', borderRadius:'8px', padding:'12px'}}>
                                <div style={{fontWeight:600, marginBottom:'8px'}}>Total Menu</div>
                                {menuTotals.length > 0 ? (
                                    menuTotals.map(([name, qty]) => (
                                        <div key={name} style={{display:'flex', justifyContent:'space-between', gap:'10px', fontSize:'0.9em', marginBottom:'4px'}}>
                                            <span>{name}</span>
                                            <b>{qty}</b>
                                        </div>
                                    ))
                                ) : (
                                    <div style={{color:'#6b7280', fontSize:'0.9em'}}>Belum ada menu pada filter tanggal ini.</div>
                                )}
                            </div>
                            <div style={{background:'#f9fafb', border:'1px solid #e5e7eb', borderRadius:'8px', padding:'12px'}}>
                                <div style={{fontWeight:600, marginBottom:'8px'}}>Opsional Makanan</div>
                                {foodSubMenuTotals.length > 0 ? (
                                    foodSubMenuTotals.map(([name, qty]) => (
                                        <div key={name} style={{display:'flex', justifyContent:'space-between', gap:'10px', fontSize:'0.9em', marginBottom:'4px'}}>
                                            <span>{name}</span>
                                            <b>{qty}</b>
                                        </div>
                                    ))
                                ) : (
                                    <div style={{color:'#6b7280', fontSize:'0.9em'}}>Belum ada item opsional makanan pada filter tanggal ini.</div>
                                )}
                            </div>
                            <div style={{background:'#f9fafb', border:'1px solid #e5e7eb', borderRadius:'8px', padding:'12px'}}>
                                <div style={{fontWeight:600, marginBottom:'8px'}}>Opsional Minuman</div>
                                {drinkSubMenuTotals.length > 0 ? (
                                    drinkSubMenuTotals.map(([name, qty]) => (
                                        <div key={name} style={{display:'flex', justifyContent:'space-between', gap:'10px', fontSize:'0.9em', marginBottom:'4px'}}>
                                            <span>{name}</span>
                                            <b>{qty}</b>
                                        </div>
                                    ))
                                ) : (
                                    <div style={{color:'#6b7280', fontSize:'0.9em'}}>Belum ada item opsional minuman pada filter tanggal ini.</div>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="reservation-list">
                        {filteredReservations.map((res) => {
                            const statusMeta = getReservationStatusMeta(res.status);
                            const reservationSubMenuTotals = getReservationSubMenuTotals(res);
                            const reservationItemSummary = getReservationItemSummary(res);
                            const reservationMenuTotals = getReservationMenuTotals(res);

                            return (
                                <div key={res.id} className="reservation-card">
                                    <div className="reservation-card-header">
                                        <div className="reservation-card-title-wrap">
                                            <div className="reservation-card-time">{res.time || "-"}</div>
                                            <div className="reservation-card-customer">{res.customerName || "Tanpa Nama"}</div>
                                            <div className="reservation-card-phone">{res.customerPhone || "-"}</div>
                                        </div>

                                        <div className="reservation-card-summary">
                                            <span className={`badge ${statusMeta.badgeClass}`}>{statusMeta.label}</span>
                                            <div className="reservation-card-total-label">Total</div>
                                            <div className="reservation-card-total">{formatCurrency(res.totalPrice)}</div>
                                        </div>
                                    </div>

                                    <div className="reservation-card-meta">
                                        <div className="reservation-meta-box reservation-meta-box-accent">
                                            <div className="reservation-meta-label">Tanggal Reservasi</div>
                                            <input
                                                type="date"
                                                className="input reservation-date-input"
                                                value={res.date || ""}
                                                onChange={(e) => handleUpdateReservationDate(res.id, e.target.value)}
                                            />
                                            <div className="reservation-meta-stats">
                                                <span className="reservation-meta-stat-chip">Jam {res.time || "-"}</span>
                                            </div>
                                        </div>

                                        <div className="reservation-meta-box">
                                            <div className="reservation-meta-label">Tempat & Pax</div>
                                            <select
                                                className="select reservation-spot-select"
                                                value={res.spotId || ""}
                                                onChange={(e) => handleUpdateSpot(res.id, e.target.value)}
                                            >
                                                <option value="" disabled>-- Atur Tempat --</option>
                                                {spots.map((spot) => (
                                                    <option key={spot.id} value={spot.id}>{spot.name}</option>
                                                ))}
                                            </select>
                                            <div className="reservation-meta-stats">
                                                <span className="reservation-meta-stat-chip">
                                                    {res.partySize ? `${res.partySize} Orang` : "Data Lama"}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="reservation-meta-box">
                                            <div className="reservation-meta-label">Ringkasan Menu</div>
                                            {reservationSubMenuTotals.length > 0 ? (() => {
                                                const foodOps = [];
                                                const drinkOps = [];

                                                reservationSubMenuTotals.forEach(([subMenuName, totalQty]) => {
                                                    const categoryOrEmpty = productCategoryByName[String(subMenuName).toLowerCase()] || "";
                                                    const isDrink = categoryOrEmpty === "coffee" || categoryOrEmpty === "non-coffee" || categoryOrEmpty === "non-coffe";
                                                    if (isDrink) {
                                                        drinkOps.push({name: subMenuName, qty: totalQty});
                                                    } else {
                                                        foodOps.push({name: subMenuName, qty: totalQty});
                                                    }
                                                });

                                                return (
                                                    <div style={{display:'flex', flexDirection:'column', gap:'8px', marginTop:'8px'}}>
                                                        {foodOps.length > 0 && (
                                                            <div>
                                                                <div style={{fontSize:'0.75em', fontWeight:600, color:'#b45309', marginBottom:'4px'}}>MAKANAN</div>
                                                                <div className="reservation-submenu-summary" style={{marginTop:0}}>
                                                                    {foodOps.map(op => (
                                                                        <span key={op.name} className="reservation-submenu-summary-chip">
                                                                            {op.name} x{op.qty}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                        
                                                        {drinkOps.length > 0 && (
                                                            <div>
                                                                <div style={{fontSize:'0.75em', fontWeight:600, color:'#0369a1', marginBottom:'4px'}}>MINUMAN</div>
                                                                <div className="reservation-submenu-summary" style={{marginTop:0}}>
                                                                    {drinkOps.map(op => (
                                                                        <span key={op.name} className="reservation-submenu-summary-chip" style={{background:'#e0f2fe', color:'#0284c7', borderColor:'#bae6fd'}}>
                                                                            {op.name} x{op.qty}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })() : (
                                                 <div className="reservation-meta-note">Menu tidak menggunakan item opsional.</div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="reservation-items-panel">
                                        <div className="reservation-section-title">Detail Pesanan</div>
                                        {(res.items || []).length > 0 ? (
                                            <div className="reservation-items-grid">
                                                {(res.items || []).map((item, index) => {
                                                    const itemSubMenus = extractSubMenusFromItem(item);
                                                    const itemQty = parseItemQty(item?.qty);
                                                    const itemPrice = Number(item?.price) || 0;
                                                    const itemSubtotal = itemQty * itemPrice;

                                                    return (
                                                        <div key={index} className="reservation-item-card">
                                                            <div className="reservation-item-head">
                                                                <div>
                                                                    <div className="reservation-item-name">
                                                                        <span className="reservation-item-qty">{item.qty}x</span> {item.name}
                                                                    </div>
                                                                    <div className="reservation-item-price">{formatCurrency(itemPrice)} / item</div>
                                                                </div>
                                                                <div className="reservation-item-subtotal">{formatCurrency(itemSubtotal)}</div>
                                                            </div>

                                                            {itemSubMenus.length > 0 && (
                                                                <div className="reservation-item-submenus">
                                                                    {itemSubMenus.map((subMenu, subMenuIndex) => (
                                                                        <span key={`${subMenu}-${subMenuIndex}`} className="reservation-submenu-chip">
                                                                            {subMenu}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            )}

                                                            {item.note && (
                                                                <div className="reservation-item-note">📝 {item.note}</div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div className="reservation-empty-items">Belum ada item pesanan.</div>
                                        )}
                                    </div>

                                    <div className="reservation-actions">
                                        {res.status === 'pending' ? (
                                            <>
                                                <button onClick={() => handleStatus(res.id, 'confirmed')} className="btn btn-primary reservation-action-btn">✔ Terima</button>
                                                <button onClick={() => handleStatus(res.id, 'rejected')} className="btn btn-danger reservation-action-btn">✖ Tolak</button>
                                                <button onClick={() => handleOpenOrderMenuModal(res)} className="btn btn-ghost reservation-action-btn reservation-action-outline">✏️ Edit Menu</button>
                                            </>
                                        ) : (
                                            <>
                                                <button onClick={() => handleOpenOrderMenuModal(res)} className="btn btn-ghost reservation-action-btn reservation-action-outline">✏️ Edit Menu</button>
                                                <button onClick={() => handleDeleteReservation(res.id)} className="btn btn-ghost reservation-action-btn reservation-action-danger">🗑 Hapus</button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })}

                        {filteredReservations.length === 0 && (
                            <div className="card" style={{textAlign:'center', color:'#777', padding:'24px'}}>
                                {dateFilter
                                    ? "Tidak ada pesanan untuk tanggal yang dipilih."
                                    : "Belum ada pesanan aktif untuk hari ini atau setelahnya."}
                            </div>
                        )}
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
                                    {packageFoodProducts.map(p => (
                                        <label key={p.id} style={{display:'flex', alignItems:'center', gap:'10px', marginBottom:'5px'}}><input type="checkbox" checked={formData.foodOptions?.includes(p.id)} onChange={(e) => handleOptionChange('foodOptions', p.id, e.target.checked)} />{p.name}</label>
                                    ))}
                                    {packageFoodProducts.length === 0 && (
                                        <div style={{fontSize:'0.85em', color:'#6b7280'}}>Belum ada menu kategori Food/Snack yang tersedia.</div>
                                    )}
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="label">Opsi Minuman (Pelanggan boleh pilih apa saja?)</label>
                                <div style={{maxHeight:'150px', overflowY:'auto', border:'1px solid #ddd', padding:'10px', borderRadius:'8px'}}>
                                    {packageDrinkProducts.map(p => (
                                        <label key={p.id} style={{display:'flex', alignItems:'center', gap:'10px', marginBottom:'5px'}}><input type="checkbox" checked={formData.drinkOptions?.includes(p.id)} onChange={(e) => handleOptionChange('drinkOptions', p.id, e.target.checked)} />{p.name}</label>
                                    ))}
                                    {packageDrinkProducts.length === 0 && (
                                        <div style={{fontSize:'0.85em', color:'#6b7280'}}>Belum ada menu kategori Coffee/Non-Coffee yang tersedia.</div>
                                    )}
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
                                        <label className="label">Pilihan (opsional dari Menu Master)</label>
                                        <div style={{maxHeight:'150px', overflowY:'auto', border:'1px solid #ddd', padding:'10px', borderRadius:'8px', background:'#fff'}}>
                                            {products.length > 0 ? products.map(p => {
                                                const selectedList = extractSubMenusFromItem(item);
                                                const isSelected = selectedList.includes(p.name);
                                                return (
                                                    <label key={p.id} style={{display:'flex', alignItems:'center', gap:'10px', marginBottom:'5px', fontSize:'0.9em', cursor:'pointer'}}>
                                                        <input 
                                                            type="checkbox" 
                                                            checked={isSelected}
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    handleOrderMenuItemChange(index, "selections", [...selectedList, p.name].join(", "));
                                                                } else {
                                                                    handleOrderMenuItemChange(index, "selections", selectedList.filter(n => n !== p.name).join(", "));
                                                                }
                                                            }}
                                                        />
                                                        {p.name}
                                                    </label>
                                                );
                                            }) : (
                                                <div style={{fontSize:'0.85em', color:'#6b7280'}}>Belum ada data menu master.</div>
                                            )}
                                        </div>
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