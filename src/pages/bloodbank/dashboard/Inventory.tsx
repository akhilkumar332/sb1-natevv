import { useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  ClipboardList,
  Package,
  Plus,
  QrCode,
  ScanLine,
  Send,
  X,
} from 'lucide-react';
import {
  Timestamp,
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  limit,
} from 'firebase/firestore';
import { db } from '../../../firebase';
import type { BloodBankDashboardContext } from '../BloodBankDashboard';
import AdminRefreshButton from '../../../components/admin/AdminRefreshButton';

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const calculateStatus = (units: number, lowLevel: number, criticalLevel: number) => {
  if (units <= 0) return 'critical';
  if (units <= criticalLevel) return 'critical';
  if (units <= lowLevel) return 'low';
  if (units > lowLevel * 3) return 'surplus';
  return 'adequate';
};

const toDateInput = (value?: Date) => (value ? value.toISOString().slice(0, 10) : '');

const defaultExpiryDate = () => new Date(Date.now() + 42 * 24 * 60 * 60 * 1000);

type InventoryTransaction = {
  id: string;
  bloodType: string;
  type: string;
  deltaUnits: number;
  previousUnits: number;
  newUnits: number;
  reason?: string;
  batchId?: string;
  reservationId?: string;
  createdAt?: Date;
};

type InventoryTransfer = {
  id: string;
  fromHospitalId: string;
  toHospitalId: string;
  fromHospitalName?: string;
  toHospitalName?: string;
  fromBranchId?: string;
  toBranchId?: string;
  bloodType: string;
  units: number;
  status: 'pending' | 'sent' | 'received' | 'rejected' | 'cancelled';
  notes?: string;
  collectionDate?: Date;
  expiryDate?: Date;
  createdAt?: Date;
  updatedAt?: Date;
};

type InventoryAlert = {
  id: string;
  bloodType: string;
  batchId: string;
  daysToExpiry: number;
  status: 'open' | 'dismissed' | 'resolved';
  message?: string;
  createdAt?: Date;
};

type InventoryReservation = {
  id: string;
  bloodType: string;
  units: number;
  requestId: string;
  requestStatus?: string;
  status: 'active' | 'released' | 'fulfilled' | 'expired';
  reservedBatchIds: string[];
  branchId?: string;
  createdAt?: Date;
  updatedAt?: Date;
};

type BloodBankBranch = {
  id: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  phone?: string;
  isPrimary?: boolean;
};

function BloodBankInventory() {
  const {
    user,
    inventory,
    bloodRequests,
    getInventoryStatusColor,
    refreshData,
  } = useOutletContext<BloodBankDashboardContext>();
  const baseHospitalId = user?.parentHospitalId || user?.uid || '';
  const staffRole = user?.staffRole || 'manager';
  const canEdit = staffRole !== 'viewer';
  const canManage = staffRole === 'manager';

  const [filter, setFilter] = useState<'all' | 'critical' | 'low' | 'adequate' | 'surplus'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showBatches, setShowBatches] = useState(false);
  const [showEditBatch, setShowEditBatch] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showReserveModal, setShowReserveModal] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [selectedInventoryId, setSelectedInventoryId] = useState<string | null>(null);
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState(false);
  const [scanValue, setScanValue] = useState('');
  const [scanMode, setScanMode] = useState<'manual' | 'camera'>('manual');
  const [scanError, setScanError] = useState<string | null>(null);
  const [qrBatch, setQrBatch] = useState<any | null>(null);
  const [highlightBatchId, setHighlightBatchId] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scanStreamRef = useRef<MediaStream | null>(null);
  const scanRafRef = useRef<number | null>(null);
  const scanActiveRef = useRef(false);

  const [batchForm, setBatchForm] = useState({
    bloodType: '',
    units: '',
    collectionDate: '',
    expiryDate: '',
    source: 'donation',
    testedStatus: 'pending',
    notes: '',
    branchId: '',
  });

  const [editBatchForm, setEditBatchForm] = useState({
    units: '',
    collectionDate: '',
    expiryDate: '',
    source: 'donation',
    testedStatus: 'pending',
    notes: '',
  });

  const [adjustForm, setAdjustForm] = useState({
    bloodType: '',
    mode: 'add',
    units: '',
    reason: '',
    branchId: '',
  });

  const [transferForm, setTransferForm] = useState({
    bloodType: '',
    units: '',
    toHospitalId: '',
    collectionDate: '',
    expiryDate: '',
    notes: '',
    transferType: 'external',
    fromBranchId: '',
    toBranchId: '',
  });

  const [reserveForm, setReserveForm] = useState({
    requestId: '',
    bloodType: '',
    units: '',
    branchId: '',
  });

  const [branchForm, setBranchForm] = useState({
    name: '',
    address: '',
    city: '',
    state: '',
    phone: '',
    isPrimary: false,
  });

  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [outgoingTransfers, setOutgoingTransfers] = useState<InventoryTransfer[]>([]);
  const [incomingTransfers, setIncomingTransfers] = useState<InventoryTransfer[]>([]);
  const [bloodbanks, setBloodbanks] = useState<Array<{ id: string; name: string; bhId?: string }>>([]);
  const [alerts, setAlerts] = useState<InventoryAlert[]>([]);
  const [reservations, setReservations] = useState<InventoryReservation[]>([]);
  const [branches, setBranches] = useState<BloodBankBranch[]>([]);
  const [branchFilter, setBranchFilter] = useState<string>('all');

  const branchScopedInventory = useMemo(() => {
    if (branchFilter === 'all') return inventory;
    return inventory.filter((item) => (item.branchId || item.hospitalId) === branchFilter);
  }, [inventory, branchFilter]);

  const filteredInventory = useMemo(() => {
    if (filter === 'all') return branchScopedInventory;
    return branchScopedInventory.filter((item) => item.status === filter);
  }, [branchScopedInventory, filter]);

  const selectedInventory = useMemo(
    () => inventory.find((item) => item.id === selectedInventoryId) || null,
    [inventory, selectedInventoryId]
  );

  const selectedBatch = useMemo(() => {
    if (!selectedInventory || !editingBatchId) return null;
    return selectedInventory.batches.find((batch) => batch.batchId === editingBatchId) || null;
  }, [selectedInventory, editingBatchId]);

  const activeBranchId = branchFilter === 'all' ? baseHospitalId : branchFilter;

  const summary = useMemo(() => {
    const now = new Date();
    const in7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const summarySource = branchScopedInventory;
    const totalUnits = summarySource.reduce((sum, item) => sum + (item.units || 0), 0);
    const criticalTypes = summarySource.filter((item) => item.status === 'critical').length;
    const lowTypes = summarySource.filter((item) => item.status === 'low').length;

    const expiring7Units = summarySource.reduce((sum, item) => {
      const count = item.batches
        .filter((batch) => {
          const status = batch.status;
          const expiry = batch.expiryDate;
          return (status === 'available' || status === 'reserved') && expiry <= in7;
        })
        .reduce((acc, batch) => acc + batch.units, 0);
      return sum + count;
    }, 0);

    const expiring30Units = summarySource.reduce((sum, item) => {
      const count = item.batches
        .filter((batch) => {
          const status = batch.status;
          const expiry = batch.expiryDate;
          return (status === 'available' || status === 'reserved') && expiry <= in30;
        })
        .reduce((acc, batch) => acc + batch.units, 0);
      return sum + count;
    }, 0);

    const availableUnits = summarySource.reduce((sum, item) => {
      const count = item.batches
        .filter((batch) => batch.status === 'available')
        .reduce((acc, batch) => acc + batch.units, 0);
      return sum + count;
    }, 0);

    const reservedUnits = summarySource.reduce((sum, item) => {
      const count = item.batches
        .filter((batch) => batch.status === 'reserved')
        .reduce((acc, batch) => acc + batch.units, 0);
      return sum + count;
    }, 0);

    return {
      totalUnits,
      criticalTypes,
      lowTypes,
      expiring7Units,
      expiring30Units,
      availableUnits,
      reservedUnits,
    };
  }, [branchScopedInventory]);

  const branchOptions = useMemo(() => {
    const map = new Map<string, BloodBankBranch>();
    if (baseHospitalId) {
      map.set(baseHospitalId, { id: baseHospitalId, name: 'Main branch', isPrimary: true });
    }
    branches.forEach((branch) => {
      if (!map.has(branch.id)) {
        map.set(branch.id, branch);
      }
    });
    return Array.from(map.values());
  }, [branches, baseHospitalId]);

  const activeRequests = useMemo(
    () => bloodRequests.filter((request) => request.status === 'active' || request.status === 'partially_fulfilled'),
    [bloodRequests]
  );

  useEffect(() => {
    const initialType = branchScopedInventory[0]?.bloodType || BLOOD_TYPES[0];
    setBatchForm((prev) => ({
      ...prev,
      bloodType: prev.bloodType || initialType,
      collectionDate: prev.collectionDate || new Date().toISOString().slice(0, 10),
      expiryDate: prev.expiryDate || defaultExpiryDate().toISOString().slice(0, 10),
      branchId: prev.branchId || activeBranchId,
    }));
    setAdjustForm((prev) => ({
      ...prev,
      bloodType: prev.bloodType || initialType,
      branchId: prev.branchId || activeBranchId,
    }));
    setTransferForm((prev) => ({
      ...prev,
      bloodType: prev.bloodType || initialType,
      collectionDate: prev.collectionDate || new Date().toISOString().slice(0, 10),
      expiryDate: prev.expiryDate || defaultExpiryDate().toISOString().slice(0, 10),
      fromBranchId: prev.fromBranchId || activeBranchId,
    }));
    setReserveForm((prev) => ({
      ...prev,
      bloodType: prev.bloodType || initialType,
      branchId: prev.branchId || activeBranchId,
    }));
  }, [branchScopedInventory, activeBranchId]);

  useEffect(() => {
    if (!selectedBatch) return;
    setEditBatchForm({
      units: String(selectedBatch.units ?? ''),
      collectionDate: toDateInput(selectedBatch.collectionDate),
      expiryDate: toDateInput(selectedBatch.expiryDate),
      source: selectedBatch.source || 'donation',
      testedStatus: selectedBatch.testedStatus || 'pending',
      notes: selectedBatch.notes || '',
    });
  }, [selectedBatch]);

  useEffect(() => {
    if (!baseHospitalId) return;
    const q = query(
      collection(db, 'inventoryTransactions'),
      where('hospitalId', '==', baseHospitalId),
      orderBy('createdAt', 'desc'),
      limit(15)
    );
    return onSnapshot(q, (snapshot) => {
      const rows = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          bloodType: data.bloodType || '',
          type: data.type || '',
          deltaUnits: data.deltaUnits || 0,
          previousUnits: data.previousUnits || 0,
          newUnits: data.newUnits || 0,
          reason: data.reason,
          batchId: data.batchId,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : undefined,
        } as InventoryTransaction;
      });
      setTransactions(rows);
    });
  }, [baseHospitalId]);

  useEffect(() => {
    if (!baseHospitalId) return;

    const outgoingQuery = query(
      collection(db, 'inventoryTransfers'),
      where('fromHospitalId', '==', baseHospitalId),
      orderBy('createdAt', 'desc'),
      limit(10)
    );
    const incomingQuery = query(
      collection(db, 'inventoryTransfers'),
      where('toHospitalId', '==', baseHospitalId),
      orderBy('createdAt', 'desc'),
      limit(10)
    );

    const unsubscribeOutgoing = onSnapshot(outgoingQuery, (snapshot) => {
      const rows = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          fromHospitalId: data.fromHospitalId,
          toHospitalId: data.toHospitalId,
          fromHospitalName: data.fromHospitalName,
          toHospitalName: data.toHospitalName,
          fromBranchId: data.fromBranchId,
          toBranchId: data.toBranchId,
          bloodType: data.bloodType,
          units: data.units,
          status: data.status || 'pending',
          notes: data.notes,
          collectionDate: data.collectionDate?.toDate ? data.collectionDate.toDate() : undefined,
          expiryDate: data.expiryDate?.toDate ? data.expiryDate.toDate() : undefined,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : undefined,
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : undefined,
        } as InventoryTransfer;
      });
      setOutgoingTransfers(rows);
    });

    const unsubscribeIncoming = onSnapshot(incomingQuery, (snapshot) => {
      const rows = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          fromHospitalId: data.fromHospitalId,
          toHospitalId: data.toHospitalId,
          fromHospitalName: data.fromHospitalName,
          toHospitalName: data.toHospitalName,
          fromBranchId: data.fromBranchId,
          toBranchId: data.toBranchId,
          bloodType: data.bloodType,
          units: data.units,
          status: data.status || 'pending',
          notes: data.notes,
          collectionDate: data.collectionDate?.toDate ? data.collectionDate.toDate() : undefined,
          expiryDate: data.expiryDate?.toDate ? data.expiryDate.toDate() : undefined,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : undefined,
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : undefined,
        } as InventoryTransfer;
      });
      setIncomingTransfers(rows);
    });

    return () => {
      unsubscribeOutgoing();
      unsubscribeIncoming();
    };
  }, [baseHospitalId]);

  useEffect(() => {
    if (!baseHospitalId) return;
    const loadBloodbanks = async () => {
      try {
        const q = query(
          collection(db, 'users'),
          where('role', 'in', ['bloodbank', 'hospital'])
        );
        const snapshot = await getDocs(q);
        const list = snapshot.docs
          .map((docSnap) => {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              name: data.bloodBankName || data.hospitalName || data.organizationName || data.displayName || 'BloodBank',
              bhId: data.bhId,
            };
          })
          .filter((entry) => entry.id !== baseHospitalId);
        setBloodbanks(list);
      } catch (error) {
        console.warn('Failed to load bloodbank list', error);
      }
    };
    loadBloodbanks();
  }, [baseHospitalId]);

  useEffect(() => {
    if (!baseHospitalId) return;
    const q = query(
      collection(db, 'bloodbankBranches'),
      where('parentHospitalId', '==', baseHospitalId),
      orderBy('createdAt', 'asc')
    );
    return onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        setBranches([
          {
            id: baseHospitalId,
            name: 'Main branch',
            isPrimary: true,
          },
        ]);
        return;
      }
      const rows = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          name: data.name || 'Branch',
          address: data.address,
          city: data.city,
          state: data.state,
          phone: data.phone,
          isPrimary: data.isPrimary,
        } as BloodBankBranch;
      });
      setBranches(rows);
    });
  }, [baseHospitalId]);

  useEffect(() => {
    if (!baseHospitalId) return;
    const q = query(
      collection(db, 'inventoryAlerts'),
      where('hospitalId', '==', baseHospitalId),
      orderBy('createdAt', 'desc'),
      limit(10)
    );
    return onSnapshot(q, (snapshot) => {
      const rows = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          bloodType: data.bloodType || '',
          batchId: data.batchId || '',
          daysToExpiry: data.daysToExpiry || 0,
          status: data.status || 'open',
          message: data.message,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : undefined,
        } as InventoryAlert;
      });
      setAlerts(rows);
    });
  }, [baseHospitalId]);

  useEffect(() => {
    if (!baseHospitalId) return;
    const q = query(
      collection(db, 'inventoryReservations'),
      where('hospitalId', '==', baseHospitalId),
      orderBy('createdAt', 'desc'),
      limit(12)
    );
    return onSnapshot(q, (snapshot) => {
      const rows = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          bloodType: data.bloodType || '',
          units: data.units || 0,
          requestId: data.requestId || '',
          requestStatus: data.requestStatus,
          status: data.status || 'active',
          reservedBatchIds: data.reservedBatchIds || [],
          branchId: data.branchId,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : undefined,
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : undefined,
        } as InventoryReservation;
      });
      setReservations(rows);
    });
  }, [baseHospitalId]);

  useEffect(() => {
    if (!showScanModal) return;
    const supported = !!(window as any).BarcodeDetector;
    setScanMode(supported ? 'camera' : 'manual');
    setScanError(null);
    setScanValue('');
  }, [showScanModal]);

  useEffect(() => {
    if (!showScanModal || scanMode !== 'camera') {
      stopScan();
      return;
    }

    const startScan = async () => {
      setScanError(null);
      if (!(window as any).BarcodeDetector) {
        setScanError('Camera scanning is not supported on this browser.');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        scanStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
        scanActiveRef.current = true;

        const tick = async () => {
          if (!scanActiveRef.current) return;
          try {
            const video = videoRef.current;
            if (video && video.readyState >= 2) {
              const barcodes = await detector.detect(video);
              if (barcodes?.length) {
                const payload = barcodes[0]?.rawValue || barcodes[0]?.data || '';
                if (payload) {
                  handleScanPayload(String(payload));
                  return;
                }
              }
            }
          } catch (error) {
            console.warn('Barcode scan failed', error);
          }
          scanRafRef.current = requestAnimationFrame(tick);
        };

        scanRafRef.current = requestAnimationFrame(tick);
      } catch (error) {
        console.warn('Camera permission error', error);
        setScanError('Camera permission denied. Use manual entry instead.');
      }
    };

    startScan();
    return () => {
      stopScan();
    };
  }, [showScanModal, scanMode]);

  const logTransaction = async (payload: Omit<InventoryTransaction, 'id' | 'createdAt'> & { inventoryId: string }) => {
    if (!user?.uid || !baseHospitalId) return;
    await addDoc(collection(db, 'inventoryTransactions'), {
      hospitalId: baseHospitalId,
      inventoryId: payload.inventoryId,
      bloodType: payload.bloodType,
      type: payload.type,
      deltaUnits: payload.deltaUnits,
      previousUnits: payload.previousUnits,
      newUnits: payload.newUnits,
      reason: payload.reason || '',
      batchId: payload.batchId || '',
      reservationId: payload.reservationId || '',
      createdAt: serverTimestamp(),
      createdBy: user.uid,
    });
  };

  const resolveBranchId = (branchId?: string) => branchId || baseHospitalId;

  const getInventoryByType = (bloodType: string, branchId?: string) =>
    inventory.find((item) =>
      item.bloodType === bloodType && (item.branchId || item.hospitalId) === resolveBranchId(branchId)
    ) || null;

  const ensureInventory = async (bloodType: string, branchId?: string) => {
    const resolvedBranchId = resolveBranchId(branchId);
    const existing = getInventoryByType(bloodType, resolvedBranchId);
    if (existing?.id) {
      return existing.id;
    }
    const ref = doc(collection(db, 'bloodInventory'));
    await setDoc(ref, {
      hospitalId: baseHospitalId,
      branchId: resolvedBranchId,
      bloodType,
      units: 0,
      status: 'critical',
      batches: [],
      criticalLevel: 5,
      lowLevel: 10,
      averageMonthlyUsage: 0,
      lastRestocked: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  };

  const applyInventoryDelta = async ({
    bloodType,
    delta,
    reason,
    transactionType,
    batchId,
    attachBatch,
    branchId,
  }: {
    bloodType: string;
    delta: number;
    reason?: string;
    transactionType: string;
    batchId?: string;
    attachBatch?: any;
    branchId?: string;
  }) => {
    const target = getInventoryByType(bloodType, branchId);
    const inventoryId = target?.id || (delta > 0 ? await ensureInventory(bloodType, branchId) : null);
    if (!inventoryId) return;

    const currentUnits = target?.units || 0;
    const lowLevel = target?.lowLevel || 10;
    const criticalLevel = target?.criticalLevel || 5;
    const nextUnits = Math.max(0, currentUnits + delta);
    const status = calculateStatus(nextUnits, lowLevel, criticalLevel);
    const nextBatches = attachBatch
      ? [...(target?.batches || []), attachBatch]
      : undefined;

    await updateDoc(doc(db, 'bloodInventory', inventoryId), {
      units: nextUnits,
      status,
      ...(nextBatches ? { batches: nextBatches } : {}),
      updatedAt: serverTimestamp(),
    });

      await logTransaction({
        inventoryId,
        bloodType,
        type: transactionType,
        deltaUnits: delta,
        previousUnits: currentUnits,
        newUnits: nextUnits,
        batchId,
        reason,
      });
  };

  const handleAddBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.uid || !baseHospitalId) return;
    const units = Number(batchForm.units);
    if (!batchForm.bloodType || !units || units <= 0) return;
    if (!batchForm.collectionDate || !batchForm.expiryDate) return;

    setBusyAction(true);
    try {
      const inventoryId = await ensureInventory(batchForm.bloodType, batchForm.branchId);
      const target = getInventoryByType(batchForm.bloodType, batchForm.branchId);
      const currentUnits = target?.units || 0;
      const lowLevel = target?.lowLevel || 10;
      const criticalLevel = target?.criticalLevel || 5;
      const nextUnits = currentUnits + units;
      const status = calculateStatus(nextUnits, lowLevel, criticalLevel);
      const batchId = `BB-${batchForm.bloodType}-${Date.now().toString().slice(-6)}`;

      const newBatch = {
        batchId,
        units,
        collectionDate: Timestamp.fromDate(new Date(batchForm.collectionDate)),
        expiryDate: Timestamp.fromDate(new Date(batchForm.expiryDate)),
        status: 'available',
        source: batchForm.source,
        testedStatus: batchForm.testedStatus,
        notes: batchForm.notes,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const nextBatches = [...(target?.batches || []), newBatch];

      await updateDoc(doc(db, 'bloodInventory', inventoryId), {
        batches: nextBatches,
        units: nextUnits,
        status,
        lastRestocked: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await logTransaction({
        inventoryId,
        bloodType: batchForm.bloodType,
        type: 'add_batch',
        deltaUnits: units,
        previousUnits: currentUnits,
        newUnits: nextUnits,
        batchId,
        reason: batchForm.notes,
      });

      setShowAddModal(false);
      setBatchForm((prev) => ({
        ...prev,
        units: '',
        notes: '',
      }));
    } finally {
      setBusyAction(false);
    }
  };

  const handleAdjustUnits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.uid || !baseHospitalId) return;
    const target = getInventoryByType(adjustForm.bloodType, adjustForm.branchId);
    if (!target?.id) return;
    const unitsValue = Number(adjustForm.units);
    if (Number.isNaN(unitsValue) || unitsValue < 0) return;
    if (adjustForm.mode !== 'set' && unitsValue === 0) return;

    let nextUnits = target.units;
    if (adjustForm.mode === 'set') {
      nextUnits = unitsValue;
    } else if (adjustForm.mode === 'add') {
      nextUnits = target.units + unitsValue;
    } else {
      nextUnits = Math.max(0, target.units - unitsValue);
    }

    const delta = nextUnits - target.units;
    const status = calculateStatus(nextUnits, target.lowLevel, target.criticalLevel);

    setBusyAction(true);
    try {
      await updateDoc(doc(db, 'bloodInventory', target.id), {
        units: nextUnits,
        status,
        updatedAt: serverTimestamp(),
      });

      await logTransaction({
        inventoryId: target.id,
        bloodType: target.bloodType,
        type: 'adjust',
        deltaUnits: delta,
        previousUnits: target.units,
        newUnits: nextUnits,
        reason: adjustForm.reason,
      });

      setShowAdjustModal(false);
      setAdjustForm((prev) => ({
        ...prev,
        units: '',
        reason: '',
      }));
    } finally {
      setBusyAction(false);
    }
  };

  const updateBatchStatus = async (batchId: string, nextStatus: 'used' | 'expired') => {
    if (!selectedInventory?.id) return;
    const target = selectedInventory;
    const batch = target.batches.find((b) => b.batchId === batchId);
    if (!batch) return;

    const wasCounted = batch.status === 'available' || batch.status === 'reserved';
    const delta = wasCounted ? -batch.units : 0;
    const nextUnits = Math.max(0, target.units + delta);
    const nextBatches = target.batches.map((b) =>
      b.batchId === batchId
        ? { ...b, status: nextStatus, updatedAt: new Date() }
        : b
    );
    const status = calculateStatus(nextUnits, target.lowLevel, target.criticalLevel);

    setBusyAction(true);
    try {
      await updateDoc(doc(db, 'bloodInventory', target.id), {
        batches: nextBatches,
        units: nextUnits,
        status,
        updatedAt: serverTimestamp(),
      });

      await logTransaction({
        inventoryId: target.id,
        bloodType: target.bloodType,
        type: nextStatus === 'expired' ? 'expire' : 'consume',
        deltaUnits: delta,
        previousUnits: target.units,
        newUnits: nextUnits,
        batchId,
        reason: nextStatus === 'expired' ? 'Batch expired' : 'Batch used',
      });
    } finally {
      setBusyAction(false);
    }
  };

  const deleteBatch = async (batchId: string) => {
    if (!selectedInventory?.id) return;
    const target = selectedInventory;
    const batch = target.batches.find((b) => b.batchId === batchId);
    if (!batch) return;
    const wasCounted = batch.status === 'available' || batch.status === 'reserved';
    const delta = wasCounted ? -batch.units : 0;
    const nextUnits = Math.max(0, target.units + delta);
    const nextBatches = target.batches.filter((b) => b.batchId !== batchId);
    const status = calculateStatus(nextUnits, target.lowLevel, target.criticalLevel);

    setBusyAction(true);
    try {
      await updateDoc(doc(db, 'bloodInventory', target.id), {
        batches: nextBatches,
        units: nextUnits,
        status,
        updatedAt: serverTimestamp(),
      });

      await logTransaction({
        inventoryId: target.id,
        bloodType: target.bloodType,
        type: 'delete_batch',
        deltaUnits: delta,
        previousUnits: target.units,
        newUnits: nextUnits,
        batchId,
        reason: 'Batch deleted',
      });
    } finally {
      setBusyAction(false);
    }
  };

  const handleEditBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInventory?.id || !selectedBatch) return;
    const units = Number(editBatchForm.units);
    if (!units || units <= 0) return;
    if (!editBatchForm.collectionDate || !editBatchForm.expiryDate) return;

    const wasCounted = selectedBatch.status === 'available' || selectedBatch.status === 'reserved';
    const delta = wasCounted ? units - selectedBatch.units : 0;
    const nextUnits = Math.max(0, selectedInventory.units + delta);
    const status = calculateStatus(nextUnits, selectedInventory.lowLevel, selectedInventory.criticalLevel);

    const nextBatches = selectedInventory.batches.map((batch) => {
      if (batch.batchId !== selectedBatch.batchId) return batch;
      return {
        ...batch,
        units,
        collectionDate: new Date(editBatchForm.collectionDate),
        expiryDate: new Date(editBatchForm.expiryDate),
        source: editBatchForm.source,
        testedStatus: editBatchForm.testedStatus,
        notes: editBatchForm.notes,
        updatedAt: new Date(),
      };
    });

    setBusyAction(true);
    try {
      await updateDoc(doc(db, 'bloodInventory', selectedInventory.id), {
        batches: nextBatches,
        units: nextUnits,
        status,
        updatedAt: serverTimestamp(),
      });

      await logTransaction({
        inventoryId: selectedInventory.id,
        bloodType: selectedInventory.bloodType,
        type: 'adjust',
        deltaUnits: delta,
        previousUnits: selectedInventory.units,
        newUnits: nextUnits,
        batchId: selectedBatch.batchId,
        reason: 'Batch edited',
      });

      setShowEditBatch(false);
      setEditingBatchId(null);
    } finally {
      setBusyAction(false);
    }
  };

  const handleExpireAll = async () => {
    if (!branchScopedInventory.length) return;
    setBusyAction(true);
    try {
      const now = new Date();
      await Promise.all(branchScopedInventory.map(async (item) => {
        const expiring = item.batches.filter((batch) =>
          (batch.status === 'available' || batch.status === 'reserved') && batch.expiryDate <= now
        );
        if (expiring.length === 0) return;
        const removedUnits = expiring.reduce((sum, batch) => sum + batch.units, 0);
        const nextBatches = item.batches.map((batch) =>
          batch.expiryDate <= now && (batch.status === 'available' || batch.status === 'reserved')
            ? { ...batch, status: 'expired', updatedAt: new Date() }
            : batch
        );
        const nextUnits = Math.max(0, item.units - removedUnits);
        const status = calculateStatus(nextUnits, item.lowLevel, item.criticalLevel);
        await updateDoc(doc(db, 'bloodInventory', item.id), {
          batches: nextBatches,
          units: nextUnits,
          status,
          updatedAt: serverTimestamp(),
        });
        await logTransaction({
          inventoryId: item.id,
          bloodType: item.bloodType,
          type: 'expire',
          deltaUnits: -removedUnits,
          previousUnits: item.units,
          newUnits: nextUnits,
          reason: 'Expired batch cleanup',
        });
      }));
    } finally {
      setBusyAction(false);
    }
  };

  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.uid || !baseHospitalId) return;
    const units = Number(transferForm.units);
    const isInternal = transferForm.transferType === 'internal';
    const fromBranchId = transferForm.fromBranchId || activeBranchId;
    const toHospitalId = isInternal ? baseHospitalId : transferForm.toHospitalId;
    if (!transferForm.bloodType || !toHospitalId || !units || units <= 0) return;
    if (isInternal && (!transferForm.toBranchId || transferForm.toBranchId === fromBranchId)) return;

    const toEntry = bloodbanks.find((entry) => entry.id === transferForm.toHospitalId);
    const toBranch = branches.find((branch) => branch.id === transferForm.toBranchId);
    const fromBranch = branches.find((branch) => branch.id === fromBranchId);

    setBusyAction(true);
    try {
      await addDoc(collection(db, 'inventoryTransfers'), {
        fromHospitalId: baseHospitalId,
        toHospitalId,
        fromHospitalName: user.bloodBankName || user.hospitalName || user.displayName || 'BloodBank',
        toHospitalName: isInternal ? (user.bloodBankName || user.hospitalName || 'BloodBank') : (toEntry?.name || 'BloodBank'),
        fromBranchId,
        toBranchId: isInternal ? transferForm.toBranchId : transferForm.toBranchId || null,
        fromBranchName: fromBranch?.name,
        toBranchName: toBranch?.name,
        bloodType: transferForm.bloodType,
        units,
        status: 'pending',
        notes: transferForm.notes,
        collectionDate: transferForm.collectionDate
          ? Timestamp.fromDate(new Date(transferForm.collectionDate))
          : null,
        expiryDate: transferForm.expiryDate
          ? Timestamp.fromDate(new Date(transferForm.expiryDate))
          : null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setShowTransferModal(false);
      setTransferForm((prev) => ({
        ...prev,
        units: '',
        notes: '',
      }));
    } finally {
      setBusyAction(false);
    }
  };

  const markTransferSent = async (transfer: InventoryTransfer) => {
    if (!transfer || transfer.status !== 'pending') return;
    const target = getInventoryByType(transfer.bloodType, transfer.fromBranchId || activeBranchId);
    if (!target) return;
    const availableUnits = target.batches
      .filter((batch) => batch.status === 'available')
      .reduce((sum, batch) => sum + batch.units, 0);
    if (availableUnits < transfer.units) return;
    setBusyAction(true);
    try {
      const reason = `Transfer to ${transfer.toHospitalName || 'BloodBank'}`;
      const sortedBatches = [...target.batches]
        .filter((batch) => batch.status === 'available')
        .sort((a, b) => a.expiryDate.getTime() - b.expiryDate.getTime());

      let remaining = transfer.units;
      let consumedUnits = 0;
      const nextBatches = [...target.batches];

      sortedBatches.forEach((batch) => {
        if (remaining <= 0) return;
        const index = nextBatches.findIndex((item) => item.batchId === batch.batchId);
        if (index === -1) return;
        const current = nextBatches[index];
        if (current.units <= remaining) {
          nextBatches[index] = {
            ...current,
            status: 'used',
            notes: current.notes ? `${current.notes} • ${reason}` : reason,
            updatedAt: new Date(),
          };
          remaining -= current.units;
          consumedUnits += current.units;
        } else {
          nextBatches[index] = {
            ...current,
            units: current.units - remaining,
            updatedAt: new Date(),
          };
          const transferBatchId = `${current.batchId}-T${Date.now().toString().slice(-4)}`;
          nextBatches.push({
            ...current,
            batchId: transferBatchId,
            units: remaining,
            status: 'used',
            notes: current.notes ? `${current.notes} • ${reason}` : reason,
            updatedAt: new Date(),
          });
          consumedUnits += remaining;
          remaining = 0;
        }
      });

      const nextUnits = Math.max(0, target.units - consumedUnits);
      const status = calculateStatus(nextUnits, target.lowLevel, target.criticalLevel);

      await updateDoc(doc(db, 'bloodInventory', target.id), {
        batches: nextBatches,
        units: nextUnits,
        status,
        updatedAt: serverTimestamp(),
      });

      await logTransaction({
        inventoryId: target.id,
        bloodType: transfer.bloodType,
        type: 'transfer_out',
        deltaUnits: -consumedUnits,
        previousUnits: target.units,
        newUnits: nextUnits,
        reason,
      });

      await updateDoc(doc(db, 'inventoryTransfers', transfer.id), {
        status: 'sent',
        updatedAt: serverTimestamp(),
      });
    } finally {
      setBusyAction(false);
    }
  };

  const markTransferReceived = async (transfer: InventoryTransfer) => {
    if (!transfer || transfer.status === 'received' || transfer.status === 'rejected' || transfer.status === 'cancelled') return;
    const batchId = `TR-${transfer.id.slice(-6)}`;
    const collectionDate = transfer.collectionDate || new Date();
    const expiryDate = transfer.expiryDate || defaultExpiryDate();
    const attachBatch = {
      batchId,
      units: transfer.units,
      collectionDate: Timestamp.fromDate(collectionDate),
      expiryDate: Timestamp.fromDate(expiryDate),
      status: 'available',
      source: 'transfer',
      testedStatus: 'pending',
      notes: `Transfer from ${transfer.fromHospitalName || 'BloodBank'}`,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    setBusyAction(true);
    try {
      await applyInventoryDelta({
        bloodType: transfer.bloodType,
        delta: transfer.units,
        reason: `Transfer received from ${transfer.fromHospitalName || 'BloodBank'}`,
        transactionType: 'transfer_in',
        batchId,
        attachBatch,
        branchId: transfer.toBranchId || activeBranchId,
      });
      await updateDoc(doc(db, 'inventoryTransfers', transfer.id), {
        status: 'received',
        updatedAt: serverTimestamp(),
      });
    } finally {
      setBusyAction(false);
    }
  };

  const cancelTransfer = async (transfer: InventoryTransfer) => {
    if (transfer.status !== 'pending') return;
    await updateDoc(doc(db, 'inventoryTransfers', transfer.id), {
      status: 'cancelled',
      updatedAt: serverTimestamp(),
    });
  };

  const rejectTransfer = async (transfer: InventoryTransfer) => {
    if (transfer.status !== 'pending' && transfer.status !== 'sent') return;
    await updateDoc(doc(db, 'inventoryTransfers', transfer.id), {
      status: 'rejected',
      updatedAt: serverTimestamp(),
    });
  };

  const openBatchList = (inventoryId: string) => {
    setSelectedInventoryId(inventoryId);
    setShowBatches(true);
    setHighlightBatchId(null);
  };

  const openEditBatch = (batchId: string) => {
    setEditingBatchId(batchId);
    setShowEditBatch(true);
  };

  const expiringCountFor = (item: typeof inventory[number], days: number) => {
    const threshold = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    return item.batches.filter((batch) =>
      (batch.status === 'available' || batch.status === 'reserved') && batch.expiryDate <= threshold
    ).length;
  };

  const stopScan = () => {
    scanActiveRef.current = false;
    if (scanRafRef.current) {
      cancelAnimationFrame(scanRafRef.current);
      scanRafRef.current = null;
    }
    if (scanStreamRef.current) {
      scanStreamRef.current.getTracks().forEach((track) => track.stop());
      scanStreamRef.current = null;
    }
  };

  const parseScanPayload = (value: string) => {
    let batchId = value.trim();
    if (!batchId) return null;
    try {
      if (batchId.startsWith('{')) {
        const parsed = JSON.parse(batchId);
        if (parsed?.batchId) {
          batchId = parsed.batchId;
        }
      }
    } catch (error) {
      console.warn('Failed to parse scan payload', error);
    }
    return batchId;
  };

  const handleScanPayload = (payload: string) => {
    const batchId = parseScanPayload(payload);
    if (!batchId) return;
    const foundInventory = inventory.find((item) =>
      item.batches.some((batch) => batch.batchId === batchId)
    );
    if (!foundInventory) {
      setScanError('Batch not found. Try another code.');
      return;
    }
    setSelectedInventoryId(foundInventory.id);
    setHighlightBatchId(batchId);
    setShowBatches(true);
    setShowScanModal(false);
    stopScan();
  };

  const availableUnitsFor = (bloodType: string, branchId?: string) => {
    const target = getInventoryByType(bloodType, branchId);
    if (!target) return 0;
    return target.batches
      .filter((batch) => batch.status === 'available')
      .reduce((sum, batch) => sum + batch.units, 0);
  };

  const dismissAlert = async (alertId: string) => {
    if (!alertId) return;
    await updateDoc(doc(db, 'inventoryAlerts', alertId), {
      status: 'dismissed',
      updatedAt: serverTimestamp(),
    });
  };

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!baseHospitalId || !branchForm.name.trim()) return;
    setBusyAction(true);
    try {
      await addDoc(collection(db, 'bloodbankBranches'), {
        parentHospitalId: baseHospitalId,
        name: branchForm.name.trim(),
        address: branchForm.address.trim(),
        city: branchForm.city.trim(),
        state: branchForm.state.trim(),
        phone: branchForm.phone.trim(),
        isPrimary: branchForm.isPrimary,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setShowBranchModal(false);
      setBranchForm({
        name: '',
        address: '',
        city: '',
        state: '',
        phone: '',
        isPrimary: false,
      });
    } finally {
      setBusyAction(false);
    }
  };

  const handleCreateReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.uid || !baseHospitalId) return;
    const units = Number(reserveForm.units);
    const branchId = reserveForm.branchId || activeBranchId;
    if (!reserveForm.requestId || !reserveForm.bloodType || !units || units <= 0) return;

    const target = getInventoryByType(reserveForm.bloodType, branchId);
    if (!target) return;
    const availableUnits = availableUnitsFor(reserveForm.bloodType, branchId);
    if (availableUnits < units) return;

    const reservationRef = doc(collection(db, 'inventoryReservations'));
    const reservationId = reservationRef.id;

    const sortedBatches = [...target.batches]
      .filter((batch) => batch.status === 'available')
      .sort((a, b) => a.expiryDate.getTime() - b.expiryDate.getTime());

    let remaining = units;
    const nextBatches = [...target.batches];
    const reservedBatchIds: string[] = [];

    sortedBatches.forEach((batch) => {
      if (remaining <= 0) return;
      const index = nextBatches.findIndex((item) => item.batchId === batch.batchId);
      if (index === -1) return;
      const current = nextBatches[index];
      if (current.units <= remaining) {
        nextBatches[index] = {
          ...current,
          status: 'reserved',
          reservationId,
          reservedForRequestId: reserveForm.requestId,
          reservedByUid: user.uid,
          updatedAt: new Date(),
        };
        reservedBatchIds.push(current.batchId);
        remaining -= current.units;
      } else {
        const reservedBatchId = `${current.batchId}-R${Date.now().toString().slice(-4)}`;
        nextBatches[index] = {
          ...current,
          units: current.units - remaining,
          updatedAt: new Date(),
        };
        nextBatches.push({
          ...current,
          batchId: reservedBatchId,
          units: remaining,
          status: 'reserved',
          reservationId,
          reservedForRequestId: reserveForm.requestId,
          reservedByUid: user.uid,
          updatedAt: new Date(),
        });
        reservedBatchIds.push(reservedBatchId);
        remaining = 0;
      }
    });

    setBusyAction(true);
    try {
      await updateDoc(doc(db, 'bloodInventory', target.id), {
        batches: nextBatches,
        updatedAt: serverTimestamp(),
      });

      await setDoc(reservationRef, {
        hospitalId: baseHospitalId,
        branchId,
        inventoryId: target.id,
        bloodType: reserveForm.bloodType,
        units,
        requestId: reserveForm.requestId,
        requestStatus: 'active',
        status: 'active',
        reservedBatchIds,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: user.uid,
      });

      await logTransaction({
        inventoryId: target.id,
        bloodType: reserveForm.bloodType,
        type: 'reserve',
        deltaUnits: 0,
        previousUnits: target.units,
        newUnits: target.units,
        reservationId,
        reason: `Reserved for request ${reserveForm.requestId}`,
      });

      setShowReserveModal(false);
      setReserveForm((prev) => ({
        ...prev,
        units: '',
      }));
    } finally {
      setBusyAction(false);
    }
  };

  const releaseReservation = async (reservation: InventoryReservation) => {
    if (!reservation || reservation.status !== 'active') return;
    const target = getInventoryByType(reservation.bloodType, reservation.branchId);
    if (!target) return;

    const nextBatches = target.batches.map((batch) => {
      if (!reservation.reservedBatchIds.includes(batch.batchId)) return batch;
      return {
        ...batch,
        status: 'available',
        reservationId: '',
        reservedForRequestId: '',
        reservedByUid: '',
        updatedAt: new Date(),
      };
    });

    setBusyAction(true);
    try {
      await updateDoc(doc(db, 'bloodInventory', target.id), {
        batches: nextBatches,
        updatedAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'inventoryReservations', reservation.id), {
        status: 'released',
        releasedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await logTransaction({
        inventoryId: target.id,
        bloodType: reservation.bloodType,
        type: 'release',
        deltaUnits: 0,
        previousUnits: target.units,
        newUnits: target.units,
        reservationId: reservation.id,
        reason: 'Reservation released',
      });
    } finally {
      setBusyAction(false);
    }
  };

  const fulfillReservation = async (reservation: InventoryReservation) => {
    if (!reservation || reservation.status !== 'active') return;
    const target = getInventoryByType(reservation.bloodType, reservation.branchId);
    if (!target) return;

    const batchesToUse = target.batches.filter((batch) =>
      reservation.reservedBatchIds.includes(batch.batchId) && batch.status === 'reserved'
    );
    if (batchesToUse.length === 0) return;

    const usedUnits = batchesToUse.reduce((sum, batch) => sum + batch.units, 0);
    const nextUnits = Math.max(0, target.units - usedUnits);
    const status = calculateStatus(nextUnits, target.lowLevel, target.criticalLevel);
    const nextBatches = target.batches.map((batch) => {
      if (!reservation.reservedBatchIds.includes(batch.batchId)) return batch;
      return {
        ...batch,
        status: 'used',
        updatedAt: new Date(),
      };
    });

    setBusyAction(true);
    try {
      await updateDoc(doc(db, 'bloodInventory', target.id), {
        batches: nextBatches,
        units: nextUnits,
        status,
        updatedAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'inventoryReservations', reservation.id), {
        status: 'fulfilled',
        fulfilledAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await logTransaction({
        inventoryId: target.id,
        bloodType: reservation.bloodType,
        type: 'consume',
        deltaUnits: -usedUnits,
        previousUnits: target.units,
        newUnits: nextUnits,
        reservationId: reservation.id,
        reason: 'Reservation fulfilled',
      });
    } finally {
      setBusyAction(false);
    }
  };

  const openQrModal = (batch: any, bloodType: string) => {
    setQrBatch({ ...batch, bloodType });
    setShowQrModal(true);
  };

  const handleScanLookup = () => {
    if (!scanValue.trim()) return;
    handleScanPayload(scanValue);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-red-600">Inventory</p>
          <h2 className="text-2xl font-bold text-gray-900">Blood inventory CRM</h2>
          <p className="text-sm text-gray-500 mt-1">Track, adjust, and audit blood units by batch.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2">
            <Building2 className="w-4 h-4 text-gray-500" />
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="text-sm font-semibold text-gray-700 focus:outline-none"
            >
              <option value="all">All branches</option>
              {branchOptions.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </div>
          {canManage && (
            <button
              type="button"
              onClick={() => setShowBranchModal(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
            >
              <Building2 className="w-4 h-4" />
              Manage branches
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setReserveForm((prev) => ({ ...prev, branchId: activeBranchId }));
              setShowReserveModal(true);
            }}
            disabled={!canEdit}
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
          >
            <ClipboardList className="w-4 h-4" />
            Reserve units
          </button>
          <button
            type="button"
            onClick={() => setShowScanModal(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
          >
            <ScanLine className="w-4 h-4" />
            Scan QR
          </button>
          <button
            type="button"
            onClick={() => {
              setBatchForm((prev) => ({ ...prev, branchId: activeBranchId }));
              setShowAddModal(true);
            }}
            disabled={!canEdit}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-yellow-600 px-4 py-2 text-sm font-semibold text-white shadow-lg disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            Add batch
          </button>
          <button
            type="button"
            onClick={() => {
              setAdjustForm((prev) => ({ ...prev, branchId: activeBranchId }));
              setShowAdjustModal(true);
            }}
            disabled={!canEdit}
            className="inline-flex items-center gap-2 rounded-xl border border-red-100 bg-white px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            <ClipboardList className="w-4 h-4" />
            Adjust units
          </button>
          <button
            type="button"
            onClick={() => {
              setTransferForm((prev) => ({ ...prev, fromBranchId: activeBranchId }));
              setShowTransferModal(true);
            }}
            disabled={!canEdit}
            className="inline-flex items-center gap-2 rounded-xl border border-yellow-200 bg-white px-4 py-2 text-sm font-semibold text-yellow-700 hover:bg-yellow-50 disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            Transfer
          </button>
          <button
            type="button"
            onClick={handleExpireAll}
            disabled={busyAction || !canEdit}
            className="inline-flex items-center gap-2 rounded-xl border border-yellow-200 bg-white px-4 py-2 text-sm font-semibold text-yellow-700 hover:bg-yellow-50 disabled:opacity-50"
          >
            <CalendarClock className="w-4 h-4" />
            Cleanup expired
          </button>
          <AdminRefreshButton
            onClick={() => void refreshData()}
            label="Refresh inventory"
            className="border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
        <div className="bg-white rounded-2xl shadow-xl p-6 border border-red-100">
          <p className="text-xs text-gray-500">Total units</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{summary.totalUnits}</p>
          <p className="text-xs text-gray-500 mt-2">Available {summary.availableUnits} • Reserved {summary.reservedUnits}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-xl p-6 border border-yellow-100">
          <p className="text-xs text-gray-500">Expiring (7d)</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{summary.expiring7Units}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-xl p-6 border border-red-100">
          <p className="text-xs text-gray-500">Critical types</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{summary.criticalTypes}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-xl p-6 border border-yellow-100">
          <p className="text-xs text-gray-500">Low stock types</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{summary.lowTypes}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-bold text-gray-900">Inventory by blood type</h3>
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            {[
              { id: 'all', label: 'All' },
              { id: 'critical', label: 'Critical' },
              { id: 'low', label: 'Low' },
              { id: 'adequate', label: 'Adequate' },
              { id: 'surplus', label: 'Surplus' },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id as typeof filter)}
                className={`rounded-full border px-3 py-1 transition-all ${
                  filter === item.id
                    ? 'border-red-200 bg-red-50 text-red-600'
                    : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {filteredInventory.length === 0 ? (
          <div className="mt-6 text-center text-gray-500">
            <Package className="w-10 h-10 text-red-200 mx-auto mb-2" />
            <p>No inventory items match this filter.</p>
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="py-3 px-4 font-semibold">Blood type</th>
                  {branchOptions.length > 1 && (
                    <th className="py-3 px-4 font-semibold">Branch</th>
                  )}
                  <th className="py-3 px-4 font-semibold">Units</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold">Thresholds</th>
                  <th className="py-3 px-4 font-semibold">Expiring (7d)</th>
                  <th className="py-3 px-4 font-semibold">Last restock</th>
                  <th className="py-3 px-4 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInventory.map((item) => (
                  <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-4 px-4 font-semibold text-gray-900">{item.bloodType}</td>
                    {branchOptions.length > 1 && (
                      <td className="py-4 px-4 text-xs text-gray-600">
                        {branchOptions.find((branch) => branch.id === (item.branchId || item.hospitalId))?.name || 'Main branch'}
                      </td>
                    )}
                    <td className="py-4 px-4 text-sm text-gray-700">{item.units}</td>
                    <td className="py-4 px-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getInventoryStatusColor(item.status)}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-xs text-gray-600">
                      Low: {item.lowLevel} / Critical: {item.criticalLevel}
                    </td>
                    <td className="py-4 px-4 text-sm text-gray-700">
                      {expiringCountFor(item, 7)} batches
                    </td>
                    <td className="py-4 px-4 text-sm text-gray-600">
                      {item.lastRestocked ? item.lastRestocked.toLocaleDateString() : '—'}
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => openBatchList(item.id)}
                          className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                        >
                          View batches
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setBatchForm((prev) => ({
                              ...prev,
                              bloodType: item.bloodType,
                              branchId: item.branchId || item.hospitalId,
                            }));
                            setShowAddModal(true);
                          }}
                          disabled={!canEdit}
                          className="rounded-lg border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          Add batch
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAdjustForm((prev) => ({
                              ...prev,
                              bloodType: item.bloodType,
                              branchId: item.branchId || item.hospitalId,
                            }));
                            setShowAdjustModal(true);
                          }}
                          disabled={!canEdit}
                          className="rounded-lg border border-yellow-200 px-3 py-1 text-xs font-semibold text-yellow-700 hover:bg-yellow-50 disabled:opacity-50"
                        >
                          Adjust
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900">Expiry alerts</h3>
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
          </div>
          {alerts.filter((alert) => alert.status === 'open').length === 0 ? (
            <div className="text-center py-6 text-gray-500">No expiry alerts right now.</div>
          ) : (
            <div className="space-y-3">
              {alerts.filter((alert) => alert.status === 'open').map((alert) => (
                <div key={alert.id} className="rounded-xl border border-yellow-100 bg-yellow-50 px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-semibold text-gray-900">
                      {alert.bloodType} · Batch {alert.batchId}
                    </div>
                    <span className="text-xs font-semibold text-yellow-700">{alert.daysToExpiry}d to expiry</span>
                  </div>
                  <div className="mt-1 text-xs text-gray-600">
                    {alert.message || 'Upcoming expiry alert.'}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => dismissAlert(alert.id)}
                      className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900">Reservations</h3>
            <ClipboardList className="w-5 h-5 text-emerald-500" />
          </div>
          {reservations.length === 0 ? (
            <div className="text-center py-6 text-gray-500">No active reservations yet.</div>
          ) : (
            <div className="space-y-3">
              {reservations.map((reservation) => (
                <div key={reservation.id} className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-semibold text-gray-900">
                      {reservation.bloodType} · {reservation.units} units
                    </div>
                    <span className="text-xs font-semibold text-gray-600">{reservation.status}</span>
                  </div>
                  <div className="mt-1 text-xs text-gray-500">Request {reservation.requestId}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {reservation.status === 'active' && (
                      <>
                        <button
                          type="button"
                          onClick={() => fulfillReservation(reservation)}
                          disabled={!canEdit || busyAction}
                          className="rounded-lg border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                        >
                          Mark fulfilled
                        </button>
                        <button
                          type="button"
                          onClick={() => releaseReservation(reservation)}
                          disabled={!canEdit || busyAction}
                          className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                        >
                          Release
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900">Inventory activity</h3>
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
          </div>
          {transactions.length === 0 ? (
            <div className="text-center py-6 text-gray-500">No inventory activity yet.</div>
          ) : (
            <div className="space-y-3">
              {transactions.map((entry) => (
                <div key={entry.id} className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="font-semibold text-gray-900">
                      {entry.bloodType} · {entry.type.replace('_', ' ')}
                    </div>
                    <div className={`text-xs font-semibold ${entry.deltaUnits >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {entry.deltaUnits >= 0 ? '+' : ''}{entry.deltaUnits} units
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {entry.reason || 'No reason provided'}
                    {entry.createdAt ? ` • ${entry.createdAt.toLocaleString()}` : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900">Transfers</h3>
            <Send className="w-5 h-5 text-yellow-500" />
          </div>

          <div className="space-y-5">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Outgoing</p>
              {outgoingTransfers.length === 0 ? (
                <p className="mt-2 text-sm text-gray-500">No outgoing transfers yet.</p>
              ) : (
                <div className="mt-3 space-y-3">
                  {outgoingTransfers.map((transfer) => (
                    <div key={transfer.id} className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <div className="font-semibold text-gray-900">
                          {transfer.bloodType} · {transfer.units} units
                        </div>
                        <span className="text-xs font-semibold text-gray-600">{transfer.status}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">To {transfer.toHospitalName || 'BloodBank'}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {transfer.status === 'pending' && (
                          <>
                            <button
                              type="button"
                              onClick={() => markTransferSent(transfer)}
                              disabled={busyAction}
                              className="rounded-lg border border-yellow-200 px-3 py-1 text-xs font-semibold text-yellow-700 hover:bg-yellow-50"
                            >
                              Mark sent
                            </button>
                            <button
                              type="button"
                              onClick={() => cancelTransfer(transfer)}
                              className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                            >
                              Cancel
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Incoming</p>
              {incomingTransfers.length === 0 ? (
                <p className="mt-2 text-sm text-gray-500">No incoming transfers.</p>
              ) : (
                <div className="mt-3 space-y-3">
                  {incomingTransfers.map((transfer) => (
                    <div key={transfer.id} className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <div className="font-semibold text-gray-900">
                          {transfer.bloodType} · {transfer.units} units
                        </div>
                        <span className="text-xs font-semibold text-gray-600">{transfer.status}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">From {transfer.fromHospitalName || 'BloodBank'}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(transfer.status === 'pending' || transfer.status === 'sent') && (
                          <>
                            <button
                              type="button"
                              onClick={() => markTransferReceived(transfer)}
                              disabled={busyAction}
                              className="rounded-lg border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                            >
                              Mark received
                            </button>
                            <button
                              type="button"
                              onClick={() => rejectTransfer(transfer)}
                              className="rounded-lg border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                            >
                              Reject
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h3 className="text-lg font-bold text-gray-900">Add batch</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="rounded-full p-2 hover:bg-gray-100"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <form onSubmit={handleAddBatch} className="p-6 space-y-4 overflow-y-auto">
              {branchOptions.length > 1 && (
                <div>
                  <label className="text-sm font-semibold text-gray-700">Branch</label>
                  <select
                    value={batchForm.branchId}
                    onChange={(e) => setBatchForm((prev) => ({ ...prev, branchId: e.target.value }))}
                    className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                    required
                  >
                    {branchOptions.map((branch) => (
                      <option key={branch.id} value={branch.id}>{branch.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-semibold text-gray-700">Blood type</label>
                  <select
                    value={batchForm.bloodType}
                    onChange={(e) => setBatchForm((prev) => ({ ...prev, bloodType: e.target.value }))}
                    className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                    required
                  >
                    {BLOOD_TYPES.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700">Units</label>
                  <input
                    type="number"
                    min="1"
                    value={batchForm.units}
                    onChange={(e) => setBatchForm((prev) => ({ ...prev, units: e.target.value }))}
                    className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-semibold text-gray-700">Collection date</label>
                  <input
                    type="date"
                    value={batchForm.collectionDate}
                    onChange={(e) => setBatchForm((prev) => ({ ...prev, collectionDate: e.target.value }))}
                    className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700">Expiry date</label>
                  <input
                    type="date"
                    value={batchForm.expiryDate}
                    onChange={(e) => setBatchForm((prev) => ({ ...prev, expiryDate: e.target.value }))}
                    className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-semibold text-gray-700">Source</label>
                  <select
                    value={batchForm.source}
                    onChange={(e) => setBatchForm((prev) => ({ ...prev, source: e.target.value }))}
                    className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  >
                    <option value="donation">Donation</option>
                    <option value="camp">Campaign</option>
                    <option value="transfer">Transfer</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700">Test status</label>
                  <select
                    value={batchForm.testedStatus}
                    onChange={(e) => setBatchForm((prev) => ({ ...prev, testedStatus: e.target.value }))}
                    className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  >
                    <option value="pending">Pending</option>
                    <option value="passed">Passed</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700">Notes</label>
                <textarea
                  rows={3}
                  value={batchForm.notes}
                  onChange={(e) => setBatchForm((prev) => ({ ...prev, notes: e.target.value }))}
                  className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busyAction}
                  className="rounded-xl bg-gradient-to-r from-red-600 to-yellow-600 px-4 py-2 text-sm font-semibold text-white shadow-lg disabled:opacity-50"
                >
                  Save batch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAdjustModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h3 className="text-lg font-bold text-gray-900">Adjust units</h3>
              <button
                type="button"
                onClick={() => setShowAdjustModal(false)}
                className="rounded-full p-2 hover:bg-gray-100"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <form onSubmit={handleAdjustUnits} className="p-6 space-y-4 overflow-y-auto">
              {branchOptions.length > 1 && (
                <div>
                  <label className="text-sm font-semibold text-gray-700">Branch</label>
                  <select
                    value={adjustForm.branchId}
                    onChange={(e) => setAdjustForm((prev) => ({ ...prev, branchId: e.target.value }))}
                    className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                    required
                  >
                    {branchOptions.map((branch) => (
                      <option key={branch.id} value={branch.id}>{branch.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="text-sm font-semibold text-gray-700">Blood type</label>
                <select
                  value={adjustForm.bloodType}
                  onChange={(e) => setAdjustForm((prev) => ({ ...prev, bloodType: e.target.value }))}
                  className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  required
                >
                  {BLOOD_TYPES.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-semibold text-gray-700">Mode</label>
                  <select
                    value={adjustForm.mode}
                    onChange={(e) => setAdjustForm((prev) => ({ ...prev, mode: e.target.value }))}
                    className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  >
                    <option value="add">Add units</option>
                    <option value="remove">Remove units</option>
                    <option value="set">Set exact units</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700">Units</label>
                  <input
                    type="number"
                    min="0"
                    value={adjustForm.units}
                    onChange={(e) => setAdjustForm((prev) => ({ ...prev, units: e.target.value }))}
                    className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700">Reason</label>
                <input
                  value={adjustForm.reason}
                  onChange={(e) => setAdjustForm((prev) => ({ ...prev, reason: e.target.value }))}
                  className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  placeholder="Audit reason"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busyAction}
                  className="rounded-xl bg-gradient-to-r from-red-600 to-yellow-600 px-4 py-2 text-sm font-semibold text-white shadow-lg disabled:opacity-50"
                >
                  Apply
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h3 className="text-lg font-bold text-gray-900">Transfer to another blood bank</h3>
              <button
                type="button"
                onClick={() => setShowTransferModal(false)}
                className="rounded-full p-2 hover:bg-gray-100"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <form onSubmit={handleCreateTransfer} className="p-6 space-y-4 overflow-y-auto">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-semibold text-gray-700">Transfer type</label>
                  <select
                    value={transferForm.transferType}
                    onChange={(e) => {
                      const nextType = e.target.value;
                      setTransferForm((prev) => ({
                        ...prev,
                        transferType: nextType,
                        toHospitalId: '',
                        toBranchId: '',
                      }));
                    }}
                    className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  >
                    <option value="external">External blood bank</option>
                    <option value="internal">Internal branch transfer</option>
                  </select>
                </div>
                {branchOptions.length > 1 && (
                  <div>
                    <label className="text-sm font-semibold text-gray-700">From branch</label>
                    <select
                      value={transferForm.fromBranchId}
                      onChange={(e) => setTransferForm((prev) => ({ ...prev, fromBranchId: e.target.value }))}
                      className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                      required
                    >
                      {branchOptions.map((branch) => (
                        <option key={branch.id} value={branch.id}>{branch.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {transferForm.transferType === 'external' ? (
                <div>
                  <label className="text-sm font-semibold text-gray-700">Recipient blood bank</label>
                  <select
                    value={transferForm.toHospitalId}
                    onChange={(e) => setTransferForm((prev) => ({ ...prev, toHospitalId: e.target.value }))}
                    className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                    required
                  >
                    <option value="">Select blood bank</option>
                    {bloodbanks.map((bank) => (
                      <option key={bank.id} value={bank.id}>
                        {bank.name}{bank.bhId ? ` · ${bank.bhId}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="text-sm font-semibold text-gray-700">Recipient branch</label>
                  <select
                    value={transferForm.toBranchId}
                    onChange={(e) => setTransferForm((prev) => ({ ...prev, toBranchId: e.target.value }))}
                    className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                    required
                  >
                    <option value="">Select branch</option>
                    {branchOptions
                      .filter((branch) => branch.id !== (transferForm.fromBranchId || activeBranchId))
                      .map((branch) => (
                        <option key={branch.id} value={branch.id}>{branch.name}</option>
                      ))}
                  </select>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-semibold text-gray-700">Blood type</label>
                  <select
                    value={transferForm.bloodType}
                    onChange={(e) => setTransferForm((prev) => ({ ...prev, bloodType: e.target.value }))}
                    className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                    required
                  >
                    {BLOOD_TYPES.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700">Units</label>
                  <input
                    type="number"
                    min="1"
                    value={transferForm.units}
                    onChange={(e) => setTransferForm((prev) => ({ ...prev, units: e.target.value }))}
                    className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-semibold text-gray-700">Collection date</label>
                  <input
                    type="date"
                    value={transferForm.collectionDate}
                    onChange={(e) => setTransferForm((prev) => ({ ...prev, collectionDate: e.target.value }))}
                    className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700">Expiry date</label>
                  <input
                    type="date"
                    value={transferForm.expiryDate}
                    onChange={(e) => setTransferForm((prev) => ({ ...prev, expiryDate: e.target.value }))}
                    className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700">Notes</label>
                <textarea
                  rows={3}
                  value={transferForm.notes}
                  onChange={(e) => setTransferForm((prev) => ({ ...prev, notes: e.target.value }))}
                  className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busyAction}
                  className="rounded-xl bg-gradient-to-r from-red-600 to-yellow-600 px-4 py-2 text-sm font-semibold text-white shadow-lg disabled:opacity-50"
                >
                  Create transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showReserveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h3 className="text-lg font-bold text-gray-900">Reserve units</h3>
              <button
                type="button"
                onClick={() => setShowReserveModal(false)}
                className="rounded-full p-2 hover:bg-gray-100"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <form onSubmit={handleCreateReservation} className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="text-sm font-semibold text-gray-700">Request</label>
                <select
                  value={reserveForm.requestId}
                  onChange={(e) => {
                    const request = activeRequests.find((item) => item.id === e.target.value);
                    const remaining = request ? Math.max(1, request.units - (request.unitsReceived || 0)) : '';
                    setReserveForm((prev) => ({
                      ...prev,
                      requestId: e.target.value,
                      bloodType: request?.bloodType || prev.bloodType,
                      units: request ? String(remaining) : prev.units,
                    }));
                  }}
                  className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  required
                >
                  <option value="">Select request</option>
                  {activeRequests.map((request) => (
                    <option key={request.id} value={request.id}>
                      {request.bloodType} · {request.units} units · {request.urgency}
                    </option>
                  ))}
                </select>
              </div>

              {branchOptions.length > 1 && (
                <div>
                  <label className="text-sm font-semibold text-gray-700">Branch</label>
                  <select
                    value={reserveForm.branchId}
                    onChange={(e) => setReserveForm((prev) => ({ ...prev, branchId: e.target.value }))}
                    className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    required
                  >
                    {branchOptions.map((branch) => (
                      <option key={branch.id} value={branch.id}>{branch.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-semibold text-gray-700">Blood type</label>
                  <select
                    value={reserveForm.bloodType}
                    onChange={(e) => setReserveForm((prev) => ({ ...prev, bloodType: e.target.value }))}
                    className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    required
                  >
                    {BLOOD_TYPES.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700">Units</label>
                  <input
                    type="number"
                    min="1"
                    value={reserveForm.units}
                    onChange={(e) => setReserveForm((prev) => ({ ...prev, units: e.target.value }))}
                    className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>

              <p className="text-xs text-gray-500">
                Available units: {availableUnitsFor(reserveForm.bloodType, reserveForm.branchId || activeBranchId)}
              </p>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowReserveModal(false)}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busyAction || !canEdit}
                  className="rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-lg disabled:opacity-50"
                >
                  Reserve
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showScanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h3 className="text-lg font-bold text-gray-900">Scan batch QR</h3>
              <button
                type="button"
                onClick={() => setShowScanModal(false)}
                className="rounded-full p-2 hover:bg-gray-100"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-2 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => {
                    setScanMode('camera');
                    setScanError(null);
                  }}
                  className={`rounded-full border px-3 py-1 ${
                    scanMode === 'camera'
                      ? 'border-red-200 bg-red-50 text-red-600'
                      : 'border-gray-200 text-gray-500'
                  }`}
                >
                  Camera scan
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setScanMode('manual');
                    setScanError(null);
                  }}
                  className={`rounded-full border px-3 py-1 ${
                    scanMode === 'manual'
                      ? 'border-red-200 bg-red-50 text-red-600'
                      : 'border-gray-200 text-gray-500'
                  }`}
                >
                  Manual entry
                </button>
              </div>

              {scanMode === 'camera' ? (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 overflow-hidden">
                    <video ref={videoRef} className="w-full h-56 object-cover" muted playsInline />
                  </div>
                  {scanError ? (
                    <p className="text-sm text-rose-600">{scanError}</p>
                  ) : (
                    <p className="text-xs text-gray-500">
                      Point the camera at the batch QR code. Scanning starts automatically.
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">Paste the QR payload or batch ID to locate the batch.</p>
                  <input
                    value={scanValue}
                    onChange={(e) => {
                      setScanValue(e.target.value);
                      setScanError(null);
                    }}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                    placeholder="BB-A+-123456 or QR payload"
                  />
                  {scanError && <p className="text-xs text-rose-600">{scanError}</p>}
                </div>
              )}

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowScanModal(false)}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
                >
                  Close
                </button>
                {scanMode === 'manual' && (
                  <button
                    type="button"
                    onClick={handleScanLookup}
                    className="rounded-xl bg-gradient-to-r from-red-600 to-yellow-600 px-4 py-2 text-sm font-semibold text-white shadow-lg"
                  >
                    Lookup
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showQrModal && qrBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h3 className="text-lg font-bold text-gray-900">Batch QR</h3>
              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                className="rounded-full p-2 hover:bg-gray-100"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <div className="p-6 space-y-4 text-center">
              <div className="mx-auto w-40 h-40 rounded-2xl border border-gray-100 flex items-center justify-center bg-gray-50">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(
                    JSON.stringify({
                      batchId: qrBatch.batchId,
                      bloodType: qrBatch.bloodType,
                      units: qrBatch.units,
                      branchId: selectedInventory?.branchId || selectedInventory?.hospitalId || baseHospitalId,
                    })
                  )}`}
                  alt="Batch QR"
                  className="w-32 h-32"
                />
              </div>
              <div className="text-sm text-gray-600">
                Batch {qrBatch.batchId} · {qrBatch.bloodType} · {qrBatch.units} units
              </div>
            </div>
          </div>
        </div>
      )}

      {showBranchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h3 className="text-lg font-bold text-gray-900">Manage branches</h3>
              <button
                type="button"
                onClick={() => setShowBranchModal(false)}
                className="rounded-full p-2 hover:bg-gray-100"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <div className="p-6 grid gap-6 lg:grid-cols-2 overflow-y-auto">
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Existing branches</h4>
                <div className="space-y-3">
                  {branchOptions.map((branch) => (
                    <div key={branch.id} className="rounded-xl border border-gray-100 p-3 text-sm">
                      <div className="font-semibold text-gray-900">{branch.name}</div>
                      <div className="text-xs text-gray-500">
                        {branch.city || branch.state ? `${branch.city || ''} ${branch.state || ''}`.trim() : '—'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <form onSubmit={handleCreateBranch} className="space-y-4">
                <h4 className="text-sm font-semibold text-gray-700">Add new branch</h4>
                <div>
                  <label className="text-sm font-semibold text-gray-700">Branch name</label>
                  <input
                    value={branchForm.name}
                    onChange={(e) => setBranchForm((prev) => ({ ...prev, name: e.target.value }))}
                    className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700">Address</label>
                  <input
                    value={branchForm.address}
                    onChange={(e) => setBranchForm((prev) => ({ ...prev, address: e.target.value }))}
                    className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm font-semibold text-gray-700">City</label>
                    <input
                      value={branchForm.city}
                      onChange={(e) => setBranchForm((prev) => ({ ...prev, city: e.target.value }))}
                      className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-700">State</label>
                    <input
                      value={branchForm.state}
                      onChange={(e) => setBranchForm((prev) => ({ ...prev, state: e.target.value }))}
                      className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700">Phone</label>
                  <input
                    value={branchForm.phone}
                    onChange={(e) => setBranchForm((prev) => ({ ...prev, phone: e.target.value }))}
                    className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  />
                </div>
                <button
                  type="submit"
                  disabled={busyAction || !canManage}
                  className="w-full rounded-xl bg-gradient-to-r from-red-600 to-yellow-600 px-4 py-2 text-sm font-semibold text-white shadow-lg disabled:opacity-50"
                >
                  Save branch
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {showBatches && selectedInventory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Batches · {selectedInventory.bloodType}</h3>
                <p className="text-xs text-gray-500">Manage batch status and expiry.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowBatches(false);
                  setHighlightBatchId(null);
                }}
                className="rounded-full p-2 hover:bg-gray-100"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <div className="p-6 space-y-3 overflow-y-auto">
              {selectedInventory.batches.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No batches recorded yet.</div>
              ) : (
                selectedInventory.batches.map((batch) => (
                  <div
                    key={batch.batchId}
                    className={`rounded-xl border p-4 ${
                      batch.batchId === highlightBatchId
                        ? 'border-yellow-300 bg-yellow-50'
                        : 'border-gray-100 bg-gray-50'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-gray-900">Batch {batch.batchId}</p>
                        <p className="text-xs text-gray-500">{batch.units} units · {batch.status}</p>
                        {batch.status === 'used' && batch.notes?.includes('Transfer to') ? (
                          <p className="text-[11px] text-gray-400 mt-1">Transfer-out used units</p>
                        ) : null}
                        <p className="text-xs text-gray-500">Collected {batch.collectionDate.toLocaleDateString()} · Expires {batch.expiryDate.toLocaleDateString()}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => openEditBatch(batch.batchId)}
                          className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                          disabled={busyAction || !canEdit}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => openQrModal(batch, selectedInventory.bloodType)}
                          className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-100"
                        >
                          <span className="inline-flex items-center gap-1">
                            <QrCode className="w-3.5 h-3.5" />
                            QR
                          </span>
                        </button>
                        {batch.status === 'available' || batch.status === 'reserved' ? (
                          <>
                            <button
                              type="button"
                              onClick={() => updateBatchStatus(batch.batchId, 'used')}
                              className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                              disabled={busyAction || !canEdit}
                            >
                              Mark used
                            </button>
                            <button
                              type="button"
                              onClick={() => updateBatchStatus(batch.batchId, 'expired')}
                              className="rounded-lg border border-yellow-200 px-3 py-1 text-xs font-semibold text-yellow-700 hover:bg-yellow-50 disabled:opacity-50"
                              disabled={busyAction || !canEdit}
                            >
                              Mark expired
                            </button>
                          </>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => deleteBatch(batch.batchId)}
                          className="rounded-lg border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                          disabled={busyAction || !canEdit}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {showEditBatch && selectedBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h3 className="text-lg font-bold text-gray-900">Edit batch</h3>
              <button
                type="button"
                onClick={() => setShowEditBatch(false)}
                className="rounded-full p-2 hover:bg-gray-100"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <form onSubmit={handleEditBatch} className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="text-sm font-semibold text-gray-700">Units</label>
                <input
                  type="number"
                  min="1"
                  value={editBatchForm.units}
                  onChange={(e) => setEditBatchForm((prev) => ({ ...prev, units: e.target.value }))}
                  className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  required
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-semibold text-gray-700">Collection date</label>
                  <input
                    type="date"
                    value={editBatchForm.collectionDate}
                    onChange={(e) => setEditBatchForm((prev) => ({ ...prev, collectionDate: e.target.value }))}
                    className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700">Expiry date</label>
                  <input
                    type="date"
                    value={editBatchForm.expiryDate}
                    onChange={(e) => setEditBatchForm((prev) => ({ ...prev, expiryDate: e.target.value }))}
                    className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-semibold text-gray-700">Source</label>
                  <select
                    value={editBatchForm.source}
                    onChange={(e) => setEditBatchForm((prev) => ({ ...prev, source: e.target.value }))}
                    className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  >
                    <option value="donation">Donation</option>
                    <option value="camp">Campaign</option>
                    <option value="transfer">Transfer</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700">Test status</label>
                  <select
                    value={editBatchForm.testedStatus}
                    onChange={(e) => setEditBatchForm((prev) => ({ ...prev, testedStatus: e.target.value }))}
                    className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  >
                    <option value="pending">Pending</option>
                    <option value="passed">Passed</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700">Notes</label>
                <textarea
                  rows={3}
                  value={editBatchForm.notes}
                  onChange={(e) => setEditBatchForm((prev) => ({ ...prev, notes: e.target.value }))}
                  className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditBatch(false)}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busyAction}
                  className="rounded-xl bg-gradient-to-r from-red-600 to-yellow-600 px-4 py-2 text-sm font-semibold text-white shadow-lg disabled:opacity-50"
                >
                  Save changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default BloodBankInventory;
