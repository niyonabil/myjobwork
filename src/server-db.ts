import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDoc, getDocs, setDoc, collection, deleteDoc } from 'firebase/firestore';

// --- DATABASE INTERFACES ---

export interface User {
  id: string;
  name: string;
  username?: string;
  email: string;
  password?: string;
  role: 'admin' | 'partner' | 'operator' | 'qa' | 'client';
  company?: string;
  ice?: string;
  phone?: string;
  address?: string;
  city?: string;
  active: boolean;
  createdByUserId?: string;
  createdByRole?: 'client' | 'partner' | 'admin';
}

export interface PartnerCustomer {
  id: string;
  partnerId: string;
  name: string;
  email: string;
  phone: string;
  company?: string;
  city: string;
  address?: string;
  notes?: string;
  createdAt: string;
}

export interface ServiceOption {
  id: string;
  name: string;
  price: number;
}

export interface Service {
  id: string;
  name: string;
  category: 'saisie' | 'conversion' | 'mise_en_forme' | 'traitement' | 'impression' | 'livraison';
  description: string;
  priceMethod: 'fixed' | 'per_page' | 'per_word' | 'per_hour' | 'hybrid';
  basePrice: number;
  unitPriceName: string; // e.g., 'Page', 'Mot', 'Heure'
  unitPrice: number;
  isActive: boolean;
  options: ServiceOption[];
  imageUrl?: string;
}

export interface OrderFile {
  id: string;
  name: string;
  type: string;
  size: number;
  folder: '01_DOCUMENTS_ORIGINAUX' | '02_DOCUMENTS_SUPPLEMENTAIRES' | '03_TRAVAIL_EN_COURS' | '04_PREVISUALISATION' | '05_VERSION_FINALE' | '06_FACTURES' | '07_PREUVES' | '08_LIVRAISON';
  version: number;
  uploadedBy: string;
  uploadedAt: string;
  base64Data?: string; // Stored locally for simulation
}

export interface OrderMessage {
  id: string;
  senderName: string;
  senderRole: string;
  message: string;
  timestamp: string;
  isInternal: boolean; // separate client chat from internal team notes
  fileName?: string;
  fileBase64?: string;
}

export interface OrderTask {
  id: string;
  operatorId: string;
  operatorName: string;
  qaId?: string;
  qaName?: string;
  deadline: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' | 'CRITICAL';
  completed: boolean;
  notes?: string;
}

export interface QuoteItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Quote {
  id: string;
  reference: string;
  orderId: string;
  basePrice: number;
  optionsPrice: number;
  urgencySurcharge: number;
  printingPrice: number;
  deliveryPrice: number;
  totalAmount: number;
  depositPercent: number;
  depositAmount: number;
  balanceAmount: number;
  status: 'draft' | 'sent' | 'accepted' | 'refused';
  validityDate: string;
  items: QuoteItem[];
}

export interface Invoice {
  id: string;
  reference: string;
  orderId: string;
  quoteId: string;
  amount: number;
  type: 'deposit' | 'balance' | 'full';
  status: 'unpaid' | 'paid';
  date: string;
}

export interface Payment {
  id: string;
  reference: string;
  orderId: string;
  amount: number;
  type: 'deposit' | 'balance';
  method: 'cash' | 'transfer' | 'online' | 'manual';
  status: 'pending' | 'verified' | 'rejected';
  proofFileName?: string;
  proofFileBase64?: string;
  date: string;
  notes?: string;
}

export interface DeliveryDetails {
  method: 'digital' | 'email' | 'physical_partner' | 'physical_shipper';
  name?: string;
  phone?: string;
  address?: string;
  city?: string;
  district?: string;
  trackingNumber?: string;
  status: 'preparation' | 'shipped' | 'delivering' | 'delivered';
}

export interface QualityChecklist {
  allPagesProcessed: boolean;
  noMissingDocs: boolean;
  spellingVerified: boolean;
  layoutVerified: boolean;
  numberingVerified: boolean;
  filesOpenCorrectly: boolean;
  formatRespected: boolean;
  fileNamesCorrect: boolean;
  finalVersionValidated: boolean;
  validatedBy?: string;
  validatedAt?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: string;
  details: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  orderId: string;
  orderReference: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface SystemSettings {
  companyName: string;
  logoUrl?: string;
  address: string;
  phone: string;
  email: string;
  currency: string; // default DH
  taxRate: number; // default 0
  depositRules: {
    normal: number; // e.g. 50
    fast: number; // e.g. 60
    urgent: number; // e.g. 70
    very_urgent: number; // e.g. 80
  };
  urgencySurcharges: {
    normal: number; // 0%
    fast: number; // 30%
    urgent: number; // 60%
    very_urgent: number; // 100%
  };
}

export interface Order {
  id: string;
  reference: string;
  customerType: 'particular' | 'company' | 'partner';
  customerDetails: {
    name: string;
    email: string;
    phone: string;
    company?: string;
    city: string;
    address?: string;
    remarks?: string;
  };
  partnerId?: string; // if created by partner
  serviceId: string;
  serviceName: string;
  serviceCategory: string;
  description: string;
  quantity: number; // pages, hours, etc.
  urgency: 'normal' | 'fast' | 'urgent' | 'very_urgent';
  status:
    | 'BROUILLON'
    | 'DEMANDE_ENVOYEE'
    | 'EN_ATTENTE_ANALYSE'
    | 'DEVIS_EN_PREPARATION'
    | 'DEVIS_ENVOYE'
    | 'EN_ATTENTE_ACCEPTATION'
    | 'ACCEPTE'
    | 'EN_ATTENTE_ACOMPTE'
    | 'ACOMPTE_PAYE'
    | 'DOCUMENTS_RECLUS'
    | 'EN_FILE_ATTENTE'
    | 'EN_TRAITEMENT'
    | 'CONTROLE_QUALITE'
    | 'TRAVAIL_TERMINE'
    | 'EN_ATTENTE_SOLDE'
    | 'SOLDE_PAYE'
    | 'PRET_A_LIVRER'
    | 'LIVRE'
    | 'TERMINE'
    | 'ANNULE'
    | 'REFUSE'
    | 'BLOQUE'
    | 'EN_ATTENTE_INFOS'
    | 'EN_ATTENTE_DOCUMENT';
  files: OrderFile[];
  messages: OrderMessage[];
  tasks: OrderTask[];
  quoteId?: string;
  delivery?: DeliveryDetails;
  qualityChecklist?: QualityChecklist;
  createdAt: string;
  updatedAt: string;
  deadline?: string;
}

export interface AppDatabase {
  users: User[];
  partners: User[];
  partnerCustomers: PartnerCustomer[];
  services: Service[];
  orders: Order[];
  quotes: Quote[];
  invoices: Invoice[];
  payments: Payment[];
  auditLogs: AuditLog[];
  notifications: AppNotification[];
  settings: SystemSettings;
}

// --- FIREBASE INITIALIZATION ---

const configPath = join(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(readFileSync(configPath, 'utf-8'));

const firebaseApp = initializeApp(firebaseConfig);
export const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(firebaseApp);

async function ensureAuthenticated() {
  // Server runs in a secure backend environment; no client-side anonymous auth is required.
  return Promise.resolve();
}

// --- ERROR HANDLING ---

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- DB STORAGE LOGIC VIA FIRESTORE ---

export async function loadDatabase(): Promise<AppDatabase> {
  await ensureAuthenticated();
  try {
    const [
      usersSnap,
      partnerCustomersSnap,
      servicesSnap,
      ordersSnap,
      quotesSnap,
      invoicesSnap,
      paymentsSnap,
      auditLogsSnap,
      notificationsSnap,
      settingsSnap
    ] = await Promise.all([
      getDocs(collection(db, 'users')),
      getDocs(collection(db, 'partnerCustomers')),
      getDocs(collection(db, 'services')),
      getDocs(collection(db, 'orders')),
      getDocs(collection(db, 'quotes')),
      getDocs(collection(db, 'invoices')),
      getDocs(collection(db, 'payments')),
      getDocs(collection(db, 'auditLogs')),
      getDocs(collection(db, 'notifications')),
      getDoc(doc(db, 'settings', 'global'))
    ]);

    const users: User[] = [];
    usersSnap.forEach(d => users.push(d.data() as User));

    const partnerCustomers: PartnerCustomer[] = [];
    partnerCustomersSnap.forEach(d => partnerCustomers.push(d.data() as PartnerCustomer));

    const services: Service[] = [];
    servicesSnap.forEach(d => services.push(d.data() as Service));

    const orders: Order[] = [];
    ordersSnap.forEach(d => orders.push(d.data() as Order));

    const quotes: Quote[] = [];
    quotesSnap.forEach(d => quotes.push(d.data() as Quote));

    const invoices: Invoice[] = [];
    invoicesSnap.forEach(d => invoices.push(d.data() as Invoice));

    const payments: Payment[] = [];
    paymentsSnap.forEach(d => payments.push(d.data() as Payment));

    const auditLogs: AuditLog[] = [];
    auditLogsSnap.forEach(d => auditLogs.push(d.data() as AuditLog));

    const notifications: AppNotification[] = [];
    notificationsSnap.forEach(d => notifications.push(d.data() as AppNotification));

    let settings: SystemSettings;
    if (settingsSnap.exists()) {
      settings = settingsSnap.data() as SystemSettings;
    } else {
      const seeded = getSeededDatabase();
      settings = seeded.settings;
      await setDoc(doc(db, 'settings', 'global'), settings);
    }

    if (users.length === 0 && services.length === 0 && orders.length === 0) {
      console.log("Database is empty, seeding Firestore database...");
      const seeded = getSeededDatabase();
      await saveDatabase(seeded);
      return seeded;
    }

    // Ensure administrator accounts are always present
    const defaultAdmins: User[] = [
      {
        id: "usr-admin-1",
        name: "Administrateur Principal (Boguiman)",
        username: "boguiman",
        email: "boguiman@gmail.com",
        password: "admin123",
        role: "admin",
        phone: "+212 661-000001",
        city: "Casablanca",
        active: true
      },
      {
        id: "usr-admin-2",
        name: "Administrateur (Nabil)",
        username: "nabil",
        email: "nabilniyo122@gmail.com",
        password: "admin123",
        role: "admin",
        phone: "+212 661-112233",
        city: "Casablanca",
        active: true
      },
      {
        id: "usr-admin-3",
        name: "Administrateur Système",
        username: "admin",
        email: "admin@remix.ma",
        password: "admin123",
        role: "admin",
        phone: "+212 522-123456",
        city: "Casablanca",
        active: true
      }
    ];

    for (const admin of defaultAdmins) {
      const existing = users.find(u => 
        u.email.toLowerCase() === admin.email.toLowerCase() || 
        (u.username && admin.username && u.username.toLowerCase() === admin.username.toLowerCase())
      );
      if (!existing) {
        users.push(admin);
        await setDoc(doc(db, 'users', admin.id), admin);
      } else if (!existing.password || !existing.username) {
        existing.password = existing.password || admin.password;
        existing.username = existing.username || admin.username;
        await setDoc(doc(db, 'users', existing.id), existing);
      }
    }

    return {
      users,
      partners: users.filter(u => u.role === 'partner'),
      partnerCustomers,
      services,
      orders,
      quotes,
      invoices,
      payments,
      auditLogs,
      notifications,
      settings
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, 'database_load');
    throw err;
  }
}

export async function saveDatabase(databaseState: AppDatabase): Promise<void> {
  await ensureAuthenticated();
  try {
    const promises: Promise<void>[] = [];

    databaseState.users.forEach(u => {
      promises.push(setDoc(doc(db, 'users', u.id), u));
    });
    databaseState.partnerCustomers.forEach(pc => {
      promises.push(setDoc(doc(db, 'partnerCustomers', pc.id), pc));
    });
    databaseState.services.forEach(s => {
      promises.push(setDoc(doc(db, 'services', s.id), s));
    });
    databaseState.orders.forEach(o => {
      promises.push(setDoc(doc(db, 'orders', o.id), o));
    });
    databaseState.quotes.forEach(q => {
      promises.push(setDoc(doc(db, 'quotes', q.id), q));
    });
    databaseState.invoices.forEach(i => {
      promises.push(setDoc(doc(db, 'invoices', i.id), i));
    });
    databaseState.payments.forEach(p => {
      promises.push(setDoc(doc(db, 'payments', p.id), p));
    });
    databaseState.auditLogs.forEach(al => {
      promises.push(setDoc(doc(db, 'auditLogs', al.id), al));
    });
    if (databaseState.notifications) {
      databaseState.notifications.forEach(n => {
        promises.push(setDoc(doc(db, 'notifications', n.id), n));
      });
    }

    promises.push(setDoc(doc(db, 'settings', 'global'), databaseState.settings));

    await Promise.all(promises);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'database_save');
    throw err;
  }
}

export async function resetDatabase(): Promise<void> {
  await ensureAuthenticated();
  try {
    const [
      usersSnap,
      partnerCustomersSnap,
      servicesSnap,
      ordersSnap,
      quotesSnap,
      invoicesSnap,
      paymentsSnap,
      auditLogsSnap,
      notificationsSnap
    ] = await Promise.all([
      getDocs(collection(db, 'users')),
      getDocs(collection(db, 'partnerCustomers')),
      getDocs(collection(db, 'services')),
      getDocs(collection(db, 'orders')),
      getDocs(collection(db, 'quotes')),
      getDocs(collection(db, 'invoices')),
      getDocs(collection(db, 'payments')),
      getDocs(collection(db, 'auditLogs')),
      getDocs(collection(db, 'notifications'))
    ]);

    const deletePromises: Promise<void>[] = [];
    usersSnap.forEach(d => deletePromises.push(deleteDoc(d.ref)));
    partnerCustomersSnap.forEach(d => deletePromises.push(deleteDoc(d.ref)));
    servicesSnap.forEach(d => deletePromises.push(deleteDoc(d.ref)));
    ordersSnap.forEach(d => deletePromises.push(deleteDoc(d.ref)));
    quotesSnap.forEach(d => deletePromises.push(deleteDoc(d.ref)));
    invoicesSnap.forEach(d => deletePromises.push(deleteDoc(d.ref)));
    paymentsSnap.forEach(d => deletePromises.push(deleteDoc(d.ref)));
    auditLogsSnap.forEach(d => deletePromises.push(deleteDoc(d.ref)));
    notificationsSnap.forEach(d => deletePromises.push(deleteDoc(d.ref)));

    await Promise.all(deletePromises);

    const seeded = getSeededDatabase();
    await saveDatabase(seeded);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, 'database_reset');
    throw err;
  }
}

export async function logAction(userId: string, userName: string, action: string, details: string): Promise<void> {
  await ensureAuthenticated();
  try {
    const log: AuditLog = {
      id: 'LOG-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
      timestamp: new Date().toISOString(),
      userId,
      userName,
      action,
      details
    };
    await setDoc(doc(db, 'auditLogs', log.id), log);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'auditLogs');
  }
}

// --- INITIAL DATA SEEDING ---

function getSeededDatabase(): AppDatabase {
  const defaultSettings: SystemSettings = {
    companyName: "DigiDocs Services SARL",
    logoUrl: "",
    address: "14 Boulevard d'Anfa, Étage 3, Casablanca, Maroc",
    phone: "+212 522-123456",
    email: "contact@digidocs.ma",
    currency: "DH",
    taxRate: 20, // 20% VAT in Morocco
    depositRules: {
      normal: 50,
      fast: 60,
      urgent: 70,
      very_urgent: 80
    },
    urgencySurcharges: {
      normal: 0,
      fast: 30,
      urgent: 60,
      very_urgent: 100
    }
  };

  const services: Service[] = [
    {
      id: "srv-1",
      name: "Saisie de manuscrit manuscrit vers Word",
      category: "saisie",
      description: "Transformation de manuscrits rédigés à la main en documents Word parfaitement formatés.",
      priceMethod: "per_page",
      basePrice: 0,
      unitPriceName: "Page",
      unitPrice: 2.00, // 2 DH per page
      isActive: true,
      options: [
        { id: "opt-1-1", name: "Correction de texte avancée (+0.5 DH/Page)", price: 0.50 },
        { id: "opt-1-2", name: "Mise en page professionnelle complexe (+0.5 DH/Page)", price: 0.50 },
        { id: "opt-1-3", name: "Insertion de table des matières et index (+20 DH fixe)", price: 20.00 }
      ]
    },
    {
      id: "srv-2",
      name: "Saisie de listes et tableaux Excel",
      category: "saisie",
      description: "Saisie, tri et classement de données manuscrites ou scannées dans des tableaux Excel complexes.",
      priceMethod: "per_hour",
      basePrice: 50,
      unitPriceName: "Heure",
      unitPrice: 80.00, // 80 DH per hour
      isActive: true,
      options: [
        { id: "opt-2-1", name: "Formatage conditionnel & formules de calcul (+30 DH fixe)", price: 30.00 }
      ]
    },
    {
      id: "srv-3",
      name: "Conversion PDF vers Word/Excel avec OCR",
      category: "conversion",
      description: "Extraction de texte à partir de documents PDF ou scans non-éditables via un traitement OCR avancé et relecture.",
      priceMethod: "per_page",
      basePrice: 0,
      unitPriceName: "Page",
      unitPrice: 3.00,
      isActive: true,
      options: [
        { id: "opt-3-1", name: "Conservation stricte de la mise en page d'origine (+1 DH/Page)", price: 1.00 }
      ]
    },
    {
      id: "srv-4",
      name: "Mise en page Word de Mémoire/Livre",
      category: "mise_en_forme",
      description: "Mise aux normes académiques et éditoriales de rapports, mémoires ou livres (polices, marges, pagination, titres).",
      priceMethod: "per_page",
      basePrice: 50.00,
      unitPriceName: "Page",
      unitPrice: 1.50,
      isActive: true,
      options: [
        { id: "opt-4-1", name: "Pagination et gestion des en-têtes (+15 DH fixe)", price: 15.00 },
        { id: "opt-4-2", name: "Génération de sommaire dynamique (+10 DH fixe)", price: 10.00 }
      ]
    },
    {
      id: "srv-5",
      name: "Correction orthographique et relecture",
      category: "traitement",
      description: "Relecture approfondie pour correction de l'orthographe, de la syntaxe, de la grammaire et de la ponctuation.",
      priceMethod: "per_word",
      basePrice: 0,
      unitPriceName: "Mot",
      unitPrice: 0.05, // 0.05 DH per word
      isActive: true,
      options: []
    },
    {
      id: "srv-6",
      name: "Fusion, Découpage et Indexation PDF",
      category: "traitement",
      description: "Regroupement de several fichiers PDF, réorganisation de l'ordre des pages et création de signets d'indexation.",
      priceMethod: "fixed",
      basePrice: 50.00,
      unitPriceName: "Travail",
      unitPrice: 0,
      isActive: true,
      options: [
        { id: "opt-6-1", name: "Indexation et signets cliquables (+20 DH)", price: 20.00 }
      ]
    }
  ];

  const users: User[] = [
    {
      id: "usr-admin-1",
      name: "Administrateur Principal (Boguiman)",
      username: "boguiman",
      email: "boguiman@gmail.com",
      password: "admin123",
      role: "admin",
      phone: "+212 661-000001",
      city: "Casablanca",
      active: true
    },
    {
      id: "usr-admin-2",
      name: "Administrateur (Nabil)",
      username: "nabil",
      email: "nabilniyo122@gmail.com",
      password: "admin123",
      role: "admin",
      phone: "+212 661-112233",
      city: "Casablanca",
      active: true
    },
    {
      id: "usr-admin-3",
      name: "Administrateur Système",
      username: "admin",
      email: "admin@remix.ma",
      password: "admin123",
      role: "admin",
      phone: "+212 522-123456",
      city: "Casablanca",
      active: true
    }
  ];

  return {
    users,
    partners: [],
    partnerCustomers: [],
    services,
    orders: [],
    quotes: [],
    invoices: [],
    payments: [],
    auditLogs: [],
    notifications: [],
    settings: defaultSettings
  };
}
