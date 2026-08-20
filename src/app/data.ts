import { Injectable, signal, computed } from '@angular/core';

// --- TYPES REPLICATED FROM BACKEND ---

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
  unitPriceName: string;
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
  base64Data?: string;
}

export interface OrderMessage {
  id: string;
  senderName: string;
  senderRole: string;
  message: string;
  timestamp: string;
  isInternal: boolean;
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
  currency: string;
  taxRate: number;
  depositRules: {
    normal: number;
    fast: number;
    urgent: number;
    very_urgent: number;
  };
  urgencySurcharges: {
    normal: number;
    fast: number;
    urgent: number;
    very_urgent: number;
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
  partnerId?: string;
  serviceId: string;
  serviceName: string;
  serviceCategory: string;
  description: string;
  quantity: number;
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

export interface DashboardStats {
  total: number;
  brouillon: number;
  demandes: number;
  devis: number;
  enCours: number;
  qualityControl: number;
  completed: number;
  done: number;
  annules: number;
  urgent: number;
  caTotal: number;
  acomptesRecus: number;
  soldesAttente: number;
  commissionTotal: number;
}

export const DEFAULT_SERVICES: Service[] = [
  {
    id: "srv-1",
    name: "Saisie de manuscrit manuscrit vers Word",
    category: "saisie",
    description: "Transformation de manuscrits rédigés à la main en documents Word parfaitement formatés.",
    priceMethod: "per_page",
    basePrice: 0,
    unitPriceName: "Page",
    unitPrice: 2.00,
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
    unitPrice: 80.00,
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
    unitPrice: 0.05,
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

@Injectable({
  providedIn: 'root'
})
export class Data {
  // --- SIGNALS FOR GLOBAL STATE ---
  currentUser = signal<User | null>(null);
  activeRole = signal<'public' | 'client' | 'partner' | 'operator' | 'qa' | 'admin'>('public');

  services = signal<Service[]>(DEFAULT_SERVICES);
  orders = signal<Order[]>([]);
  activeOrderDetails = signal<{
    order: Order;
    quote?: Quote;
    invoices: Invoice[];
    payments: Payment[];
  } | null>(null);

  partnerCustomers = signal<PartnerCustomer[]>([]);
  teamUsers = signal<User[]>([]);
  auditLogs = signal<AuditLog[]>([]);
  settings = signal<SystemSettings | null>(null);
  dashboardStats = signal<DashboardStats | null>(null);
  notifications = signal<AppNotification[]>([]);
  toastNotifications = signal<AppNotification[]>([]);
  unreadNotificationsCount = computed(() => this.notifications().filter(n => !n.read).length);

  private pollingTimer: ReturnType<typeof setInterval> | null = null;
  private knownNotificationIds = new Set<string>();

  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  constructor() {
    this.initFromLocalStorage();
    this.startPolling();
  }

  private initFromLocalStorage() {
    if (typeof window !== 'undefined') {
      const storedUser = localStorage.getItem('digidocs_user');
      const storedRole = localStorage.getItem('digidocs_role');
      if (storedUser) {
        try {
          const userObj = JSON.parse(storedUser);
          this.currentUser.set(userObj);
          if (storedRole) {
            this.activeRole.set(storedRole as 'public' | 'client' | 'partner' | 'operator' | 'qa' | 'admin');
          } else {
            this.activeRole.set(userObj.role);
          }
        } catch (err) {
          console.error('Error parsing stored user:', err);
        }
      }
    }
  }

  // --- API CALL HELPERS ---

  private async apiCall<T>(url: string, options?: RequestInit, silent = false): Promise<T> {
    if (!silent) {
      this.isLoading.set(true);
      this.errorMessage.set(null);
    }
    try {
      let resolvedUrl = url;
      if (typeof window === 'undefined') {
        if (url.startsWith('/')) {
          resolvedUrl = `http://127.0.0.1:3000${url}`;
        }
      }
      const res = await fetch(resolvedUrl, {
        headers: {
          'Content-Type': 'application/json',
          ...(options?.headers || {})
        },
        ...options
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Erreur HTTP ${res.status}`);
      }
      return await res.json() as T;
    } catch (err) {
      const msg = (err as Error).message || 'Erreur inconnue';
      // Only set UI error message on client-side if not silent
      if (typeof window !== 'undefined' && !silent) {
        this.errorMessage.set(msg);
      }
      throw err;
    } finally {
      if (!silent) {
        this.isLoading.set(false);
      }
    }
  }

  // --- CORE SERVICES ---

  async login(identifier: string, password?: string): Promise<User> {
    const res = await this.apiCall<{ user: User; token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, email: identifier, username: identifier, password })
    });
    this.currentUser.set(res.user);
    this.activeRole.set(res.user.role);
    if (typeof window !== 'undefined') {
      localStorage.setItem('digidocs_user', JSON.stringify(res.user));
      localStorage.setItem('digidocs_role', res.user.role);
    }
    this.successMessage.set(`Bienvenue, ${res.user.name}`);
    this.loadAll();
    return res.user;
  }

  async register(formData: {
    name: string;
    username?: string;
    email: string;
    password?: string;
    role: 'client' | 'partner' | 'operator' | 'qa';
    phone?: string;
    city?: string;
    address?: string;
    company?: string;
    ice?: string;
  }): Promise<User> {
    const res = await this.apiCall<{ user: User; token: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(formData)
    });
    this.currentUser.set(res.user);
    this.activeRole.set(res.user.role);
    if (typeof window !== 'undefined') {
      localStorage.setItem('digidocs_user', JSON.stringify(res.user));
      localStorage.setItem('digidocs_role', res.user.role);
    }
    this.successMessage.set(`Inscription réussie ! Bienvenue, ${res.user.name}`);
    this.loadAll();
    return res.user;
  }

  logout() {
    this.currentUser.set(null);
    this.activeRole.set('public');
    this.notifications.set([]);
    this.toastNotifications.set([]);
    this.knownNotificationIds.clear();
    if (typeof window !== 'undefined') {
      localStorage.removeItem('digidocs_user');
      localStorage.removeItem('digidocs_role');
    }
  }

  startPolling() {
    if (typeof window === 'undefined') return;
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
    }
    // Poll every 8 seconds for new notifications & order updates
    this.pollingTimer = setInterval(() => {
      const user = this.currentUser();
      if (user && this.activeRole() !== 'public') {
        this.loadNotifications(true);
      }
    }, 8000);
  }

  stopPolling() {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  async loadNotifications(isPolling = false) {
    const user = this.currentUser();
    if (!user) return;
    try {
      // Notifications loading is always silent to avoid popup interruption
      const list = await this.apiCall<AppNotification[]>(`/api/notifications?userId=${user.id}`, undefined, true);
      
      // If polling and we find brand new unread notifications that were not seen before, trigger toasts!
      if (isPolling && this.knownNotificationIds.size > 0) {
        const brandNew = list.filter(n => !n.read && !this.knownNotificationIds.has(n.id));
        if (brandNew.length > 0) {
          // Add to toast notifications
          this.toastNotifications.update(prev => [...brandNew, ...prev].slice(0, 4));
          
          // Also refresh orders and dashboard stats silently in background
          this.loadOrders(true);
          this.loadStats(true);
          if (this.activeOrderDetails()) {
            const activeId = this.activeOrderDetails()!.order.id;
            if (brandNew.some(n => n.orderId === activeId)) {
              this.loadOrderDetails(activeId, true);
            }
          }

          // Auto-dismiss toasts after 7 seconds
          setTimeout(() => {
            brandNew.forEach(bn => this.dismissToast(bn.id));
          }, 7000);
        }
      }

      // Update known notifications set
      list.forEach(n => this.knownNotificationIds.add(n.id));
      this.notifications.set(list);
    } catch (err) {
      // Ignore background notification polling errors silently
      if (!isPolling) {
        console.warn('Failed to load notifications:', err);
      }
    }
  }

  dismissToast(notificationId: string) {
    this.toastNotifications.update(list => list.filter(t => t.id !== notificationId));
  }

  async markNotificationAsRead(notificationId: string) {
    await this.apiCall<{ success: boolean }>(`/api/notifications/${notificationId}/read`, {
      method: 'POST'
    }, true);
    this.notifications.update(list => list.map(n => n.id === notificationId ? { ...n, read: true } : n));
    this.dismissToast(notificationId);
  }

  async markAllNotificationsAsRead() {
    const user = this.currentUser();
    if (!user) return;
    await this.apiCall<{ success: boolean }>(`/api/notifications/read-all`, {
      method: 'POST',
      body: JSON.stringify({ userId: user.id })
    }, true);
    this.notifications.update(list => list.map(n => ({ ...n, read: true })));
    this.toastNotifications.set([]);
    this.successMessage.set('Toutes les notifications ont été marquées comme lues.');
  }

  async deleteNotification(notificationId: string) {
    await this.apiCall<{ success: boolean }>(`/api/notifications/${notificationId}`, {
      method: 'DELETE'
    }, true);
    this.notifications.update(list => list.filter(n => n.id !== notificationId));
    this.dismissToast(notificationId);
  }

  async clearReadNotifications() {
    const user = this.currentUser();
    if (!user) return;
    await this.apiCall<{ success: boolean }>(`/api/notifications?userId=${user.id}`, {
      method: 'DELETE'
    }, true);
    this.notifications.update(list => list.filter(n => !n.read));
    this.successMessage.set('Notifications lues supprimées.');
  }

  // Load everything needed according to active role
  async loadAll() {
    try {
      await this.loadServices(true);
      await this.loadSettings(true);

      const user = this.currentUser();
      const role = this.activeRole();

      if (role !== 'public' && user) {
        await this.loadOrders(true);
        await this.loadStats(true);
        await this.loadNotifications(false);
        if (role === 'admin') {
          await this.loadAuditLogs(true);
        }
        if (role === 'partner') {
          await this.loadPartnerCustomers(true);
        }
        if (role === 'admin' || role === 'partner' || role === 'client') {
          await this.loadTeamUsers(true);
        }
      }
    } catch (err) {
      console.error('Failed to load initial workspace data:', err);
    }
  }

  async loadTeamUsers(silent = false) {
    const user = this.currentUser();
    if (!user) return;
    const url = user.role === 'admin' 
      ? `/api/users?role=admin` 
      : `/api/users?createdByUserId=${user.id}`;
    const members = await this.apiCall<User[]>(url, undefined, silent);
    this.teamUsers.set(members);
  }

  async createTeamUser(userData: {
    name: string;
    email: string;
    role: 'operator' | 'qa';
    phone?: string;
    city?: string;
    address?: string;
  }) {
    const user = this.currentUser();
    if (!user) return;
    const payload = {
      ...userData,
      createdByUserId: user.id,
      createdByRole: user.role
    };
    const res = await this.apiCall<{ user: User }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    this.teamUsers.update(prev => [...prev, res.user]);
    this.successMessage.set(`Membre d'équipe "${res.user.name}" créé avec succès.`);
    return res.user;
  }

  async loadServices(silent = false) {
    try {
      const s = await this.apiCall<Service[]>('/api/services', undefined, silent);
      if (s && Array.isArray(s)) {
        this.services.set(s);
      }
    } catch (err) {
      if (!silent) console.warn('Could not refresh remote services:', err);
    }
  }

  async saveService(serviceData: Partial<Service>) {
    const user = this.currentUser();
    const isEdit = !!serviceData.id;
    const url = isEdit
      ? `/api/services/${serviceData.id}?userId=${user?.id || ''}&userName=${encodeURIComponent(user?.name || '')}`
      : `/api/services?userId=${user?.id || ''}&userName=${encodeURIComponent(user?.name || '')}`;
    
    const saved = await this.apiCall<Service>(url, {
      method: isEdit ? 'PUT' : 'POST',
      body: JSON.stringify(serviceData)
    });

    if (isEdit) {
      this.services.update(list => list.map(s => s.id === saved.id ? saved : s));
      this.successMessage.set(`Service "${saved.name}" mis à jour avec succès.`);
    } else {
      this.services.update(list => [...list, saved]);
      this.successMessage.set(`Nouveau service "${saved.name}" ajouté au catalogue.`);
    }
    return saved;
  }

  async deleteService(serviceId: string) {
    const user = this.currentUser();
    await this.apiCall<{ success: boolean; id: string }>(`/api/services/${serviceId}?userId=${user?.id || ''}&userName=${encodeURIComponent(user?.name || '')}`, {
      method: 'DELETE'
    });
    this.services.update(list => list.filter(s => s.id !== serviceId));
    this.successMessage.set('Service supprimé du catalogue avec succès.');
  }

  async loadSettings(silent = false) {
    const s = await this.apiCall<SystemSettings>('/api/settings', undefined, silent);
    this.settings.set(s);
  }

  async loadPartnerCustomers(silent = false) {
    const user = this.currentUser();
    if (!user) return;
    const c = await this.apiCall<PartnerCustomer[]>(`/api/partners/customers?partnerId=${user.id}`, undefined, silent);
    this.partnerCustomers.set(c);
  }

  async addPartnerCustomer(customer: Partial<PartnerCustomer>) {
    const user = this.currentUser();
    if (!user) return;
    customer.partnerId = user.id;
    const added = await this.apiCall<PartnerCustomer>('/api/partners/customers', {
      method: 'POST',
      body: JSON.stringify(customer)
    });
    this.partnerCustomers.update(prev => [...prev, added]);
    this.successMessage.set(`Client "${added.name}" créé avec succès.`);
    return added;
  }

  async loadOrders(silent = false) {
    const user = this.currentUser();
    if (!user) return;
    const role = this.activeRole();

    let queryParam = '';
    if (role === 'partner') {
      queryParam = `?partnerId=${user.id}`;
    } else if (role === 'client') {
      queryParam = `?clientId=${user.id}`;
    } else if (role === 'operator') {
      queryParam = `?operatorId=${user.id}`;
    } else if (role === 'qa') {
      queryParam = `?qaId=${user.id}`;
    }

    const o = await this.apiCall<Order[]>(`/api/orders${queryParam}`, undefined, silent);
    this.orders.set(o);
  }

  async loadOrderDetails(id: string, silent = false) {
    const d = await this.apiCall<{
      order: Order;
      quote?: Quote;
      invoices: Invoice[];
      payments: Payment[];
    }>(`/api/orders/${id}`, undefined, silent);
    this.activeOrderDetails.set(d);
    return d;
  }

  async createOrder(order: Partial<Order>) {
    const user = this.currentUser();
    if (user && this.activeRole() === 'partner') {
      order.partnerId = user.id;
      order.customerType = 'partner';
    } else if (user && this.activeRole() === 'client') {
      order.customerType = 'particular';
      order.customerDetails = {
        name: user.name,
        email: user.email,
        phone: user.phone || '',
        city: user.city || 'Rabat',
        address: user.address || ''
      };
    }
    const created = await this.apiCall<Order>('/api/orders', {
      method: 'POST',
      body: JSON.stringify(order)
    });
    this.orders.update(prev => [created, ...prev]);
    this.successMessage.set(`Commande ${created.reference} soumise avec succès.`);
    this.loadStats(true);
    this.loadNotifications(true);
    return created;
  }

  async updateOrderStatus(id: string, status: string) {
    const user = this.currentUser();
    const updated = await this.apiCall<Order>(`/api/orders/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({
        status,
        userId: user?.id || 'system',
        userName: user?.name || 'Système'
      })
    });
    this.orders.update(prev => prev.map(o => o.id === id ? { ...o, status: updated.status } : o));
    if (this.activeOrderDetails()?.order.id === id) {
      this.activeOrderDetails.update(prev => prev ? { ...prev, order: { ...prev.order, status: updated.status } } : null);
    }
    this.successMessage.set(`Statut mis à jour : ${status.replace(/_/g, ' ')}`);
    this.loadStats(true);
    this.loadNotifications(true);
  }

  async submitQuote(orderId: string, quoteData: Partial<Quote>) {
    const user = this.currentUser();
    const res = await this.apiCall<{ order: Order; quote: Quote }>(`/api/orders/${orderId}/quote?userId=${user?.id}&userName=${user?.name}`, {
      method: 'POST',
      body: JSON.stringify(quoteData)
    });
    if (this.activeOrderDetails()?.order.id === orderId) {
      this.activeOrderDetails.update(prev => prev ? { ...prev, order: res.order, quote: res.quote } : null);
    }
    this.successMessage.set(`Devis ${res.quote.reference} envoyé avec succès.`);
    this.loadOrders(true);
    this.loadStats(true);
    this.loadNotifications(true);
  }

  async acceptRefuseQuote(orderId: string, action: 'accept' | 'refuse') {
    const user = this.currentUser();
    const res = await this.apiCall<{ order: Order; quote: Quote }>(`/api/orders/${orderId}/quote/action`, {
      method: 'POST',
      body: JSON.stringify({
        action,
        userId: user?.id || 'client',
        userName: user?.name || 'Client'
      })
    });
    if (this.activeOrderDetails()?.order.id === orderId) {
      this.activeOrderDetails.update(prev => prev ? { ...prev, order: res.order, quote: res.quote } : null);
    }
    this.successMessage.set(action === 'accept' ? 'Devis accepté ! En attente du paiement de l\'acompte.' : 'Devis refusé.');
    this.loadOrders(true);
    this.loadStats(true);
    this.loadNotifications(true);
    await this.loadOrderDetails(orderId, true); // refresh invoices/payments
  }

  async assignOperator(orderId: string, assignData: Record<string, unknown>) {
    const user = this.currentUser();
    const order = await this.apiCall<Order>(`/api/orders/${orderId}/assign`, {
      method: 'POST',
      body: JSON.stringify({
        ...assignData,
        userId: user?.id,
        userName: user?.name
      })
    });
    if (this.activeOrderDetails()?.order.id === orderId) {
      this.activeOrderDetails.update(prev => prev ? { ...prev, order } : null);
    }
    this.successMessage.set(`Commande assignée à l'opérateur.`);
    this.loadOrders(true);
    this.loadStats(true);
    this.loadNotifications(true);
  }

  async uploadFile(orderId: string, name: string, type: string, size: number, folder: string, base64Data: string) {
    const user = this.currentUser();
    const order = await this.apiCall<Order>(`/api/orders/${orderId}/upload`, {
      method: 'POST',
      body: JSON.stringify({
        name,
        type,
        size,
        folder,
        base64Data,
        uploadedBy: user?.name || 'Inconnu'
      })
    });
    if (this.activeOrderDetails()?.order.id === orderId) {
      this.activeOrderDetails.update(prev => prev ? { ...prev, order } : null);
    }
    this.successMessage.set(`Fichier "${name}" ajouté dans ${folder.replace(/_/g, ' ')}`);
  }

  async sendMessage(orderId: string, message: string, isInternal = false, fileName?: string, fileBase64?: string) {
    const user = this.currentUser();
    const order = await this.apiCall<Order>(`/api/orders/${orderId}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        senderName: user?.name || 'Client',
        senderRole: this.activeRole(),
        message,
        isInternal,
        fileName,
        fileBase64
      })
    });
    if (this.activeOrderDetails()?.order.id === orderId) {
      this.activeOrderDetails.update(prev => prev ? { ...prev, order } : null);
    }
  }

  async submitQaChecklist(orderId: string, checklist: Partial<QualityChecklist>, action: 'approve' | 'reject') {
    const user = this.currentUser();
    const order = await this.apiCall<Order>(`/api/orders/${orderId}/qa`, {
      method: 'POST',
      body: JSON.stringify({
        checklist,
        validatedBy: user?.name || 'Qualiticien',
        action
      })
    });
    if (this.activeOrderDetails()?.order.id === orderId) {
      this.activeOrderDetails.update(prev => prev ? { ...prev, order } : null);
    }
    this.successMessage.set(action === 'approve' ? 'Contrôle qualité approuvé !' : 'Travail refusé et renvoyé pour corrections.');
    this.loadOrders(true);
    this.loadStats(true);
    this.loadNotifications(true);
    await this.loadOrderDetails(orderId, true);
  }

  async submitPaymentProof(orderId: string, payload: { amount: number; type: 'deposit' | 'balance'; method: string; proofFileName?: string; proofFileBase64?: string }) {
    const user = this.currentUser();
    const res = await this.apiCall<{ order: Order; quote: Quote; payments: Payment[] }>(`/api/orders/${orderId}/pay`, {
      method: 'POST',
      body: JSON.stringify({
        ...payload,
        userId: user?.id,
        userName: user?.name,
        action: 'submit_proof'
      })
    });
    if (this.activeOrderDetails()?.order.id === orderId) {
      this.activeOrderDetails.update(prev => prev ? { ...prev, order: res.order, quote: res.quote, payments: res.payments } : null);
    }
    this.successMessage.set(`Preuve de paiement soumise. Un administrateur va la valider.`);
    this.loadOrders(true);
    this.loadStats(true);
    this.loadNotifications(true);
  }

  async verifyPayment(orderId: string, paymentId: string, approve: boolean) {
    const user = this.currentUser();
    const res = await this.apiCall<{ order: Order; quote: Quote; payments: Payment[] }>(`/api/orders/${orderId}/pay`, {
      method: 'POST',
      body: JSON.stringify({
        paymentId,
        approve,
        userId: user?.id,
        userName: user?.name,
        action: 'verify_payment'
      })
    });
    if (this.activeOrderDetails()?.order.id === orderId) {
      this.activeOrderDetails.update(prev => prev ? { ...prev, order: res.order, quote: res.quote, payments: res.payments } : null);
    }
    this.successMessage.set(approve ? 'Paiement validé avec succès.' : 'Paiement refusé.');
    this.loadOrders(true);
    this.loadStats(true);
    this.loadNotifications(true);
    await this.loadOrderDetails(orderId, true);
  }

  async loadStats(silent = false) {
    const user = this.currentUser();
    const stats = await this.apiCall<DashboardStats>(`/api/dashboard/stats?role=${this.activeRole()}&userId=${user?.id || ''}`, undefined, silent);
    this.dashboardStats.set(stats);
  }

  async loadAuditLogs(silent = false) {
    const logs = await this.apiCall<AuditLog[]>('/api/audit-logs', undefined, silent);
    this.auditLogs.set(logs);
  }

  async saveSettings(settingsData: Partial<SystemSettings>) {
    const user = this.currentUser();
    const s = await this.apiCall<SystemSettings>(`/api/settings?userId=${user?.id || ''}&userName=${user?.name || ''}`, {
      method: 'POST',
      body: JSON.stringify(settingsData)
    });
    this.settings.set(s);
    this.successMessage.set('Paramètres mis à jour.');
  }

  async resetDb() {
    const user = this.currentUser();
    await this.apiCall<{ success: boolean }>('/api/reset', {
      method: 'POST',
      body: JSON.stringify({
        userId: user?.id,
        userName: user?.name
      })
    });
    this.successMessage.set('Base de données réinitialisée aux valeurs démo.');
    await this.loadAll();
    if (this.activeOrderDetails()) {
      const activeId = this.activeOrderDetails()!.order.id;
      await this.loadOrderDetails(activeId);
    }
  }

  // --- CLIENT SIDE GEMINI ASSISTANT API CALLS ---

  async analyzeDocumentWithAi(fileName: string, fileBase64: string, description: string) {
    return await this.apiCall<{
      detectedLanguage: string;
      estimatedPageCount: number;
      estimatedWordCount: number;
      readability: string;
      recommendedServiceId: string;
      optimizedDescription: string;
      optionsRecommended: string[];
    }>('/api/ai/analyze-document', {
      method: 'POST',
      body: JSON.stringify({ fileName, fileBase64, description })
    });
  }

  async draftSpecSheetWithAi(orderId: string) {
    return await this.apiCall<{ specSheet: string }>('/api/ai/draft-spec', {
      method: 'POST',
      body: JSON.stringify({ orderId })
    });
  }

  async draftChatReplyWithAi(orderId: string, instruction: string) {
    return await this.apiCall<{ reply: string }>('/api/ai/message-assistant', {
      method: 'POST',
      body: JSON.stringify({ orderId, instruction })
    });
  }
}
