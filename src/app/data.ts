import { Injectable, signal } from '@angular/core';

// --- TYPES REPLICATED FROM BACKEND ---

export interface User {
  id: string;
  name: string;
  email: string;
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

@Injectable({
  providedIn: 'root'
})
export class Data {
  // --- SIGNALS FOR GLOBAL STATE ---
  currentUser = signal<User | null>(null);
  activeRole = signal<'public' | 'client' | 'partner' | 'operator' | 'qa' | 'admin'>('public');

  services = signal<Service[]>([]);
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

  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  constructor() {
    this.initFromLocalStorage();
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

  private async apiCall<T>(url: string, options?: RequestInit): Promise<T> {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    try {
      const res = await fetch(url, {
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
      this.errorMessage.set(msg);
      throw err;
    } finally {
      this.isLoading.set(false);
    }
  }

  // --- CORE SERVICES ---

  async login(email: string): Promise<User> {
    const res = await this.apiCall<{ user: User; token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email })
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
    email: string;
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
    if (typeof window !== 'undefined') {
      localStorage.removeItem('digidocs_user');
      localStorage.removeItem('digidocs_role');
    }
  }

  // Load everything needed according to active role
  async loadAll() {
    try {
      await this.loadServices();
      await this.loadSettings();

      const user = this.currentUser();
      const role = this.activeRole();

      if (role !== 'public' && user) {
        await this.loadOrders();
        await this.loadStats();
        if (role === 'admin') {
          await this.loadAuditLogs();
        }
        if (role === 'partner') {
          await this.loadPartnerCustomers();
        }
        if (role === 'admin' || role === 'partner' || role === 'client') {
          await this.loadTeamUsers();
        }
      }
    } catch (err) {
      console.error('Failed to load initial workspace data:', err);
    }
  }

  async loadTeamUsers() {
    const user = this.currentUser();
    if (!user) return;
    const url = user.role === 'admin' 
      ? `/api/users?role=admin` 
      : `/api/users?createdByUserId=${user.id}`;
    const members = await this.apiCall<User[]>(url);
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

  async loadServices() {
    const s = await this.apiCall<Service[]>('/api/services');
    this.services.set(s);
  }

  async loadSettings() {
    const s = await this.apiCall<SystemSettings>('/api/settings');
    this.settings.set(s);
  }

  async loadPartnerCustomers() {
    const user = this.currentUser();
    if (!user) return;
    const c = await this.apiCall<PartnerCustomer[]>(`/api/partners/customers?partnerId=${user.id}`);
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

  async loadOrders() {
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

    const o = await this.apiCall<Order[]>(`/api/orders${queryParam}`);
    this.orders.set(o);
  }

  async loadOrderDetails(id: string) {
    const d = await this.apiCall<{
      order: Order;
      quote?: Quote;
      invoices: Invoice[];
      payments: Payment[];
    }>(`/api/orders/${id}`);
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
    this.loadStats();
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
    this.loadStats();
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
    this.loadOrders();
    this.loadStats();
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
    this.loadOrders();
    this.loadStats();
    await this.loadOrderDetails(orderId); // refresh invoices/payments
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
    this.loadOrders();
    this.loadStats();
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
    this.loadOrders();
    this.loadStats();
    await this.loadOrderDetails(orderId);
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
    this.loadOrders();
    this.loadStats();
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
    this.loadOrders();
    this.loadStats();
    await this.loadOrderDetails(orderId);
  }

  async loadStats() {
    const user = this.currentUser();
    const stats = await this.apiCall<DashboardStats>(`/api/dashboard/stats?role=${this.activeRole()}&userId=${user?.id || ''}`);
    this.dashboardStats.set(stats);
  }

  async loadAuditLogs() {
    const logs = await this.apiCall<AuditLog[]>('/api/audit-logs');
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
