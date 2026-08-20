import { ChangeDetectionStrategy, Component, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { Data, Service, Order, PartnerCustomer, OrderFile, Quote, AppNotification } from './data';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-root',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  readonly data = inject(Data);

  // --- UI NAVIGATION & ACTIVE VIEWS ---
  activeTab = signal<string>('dashboard'); // e.g. dashboard, orders, new_order, services, clients, reports, settings, audit_logs
  selectedOrderId = signal<string | null>(null);

  // --- NOTIFICATIONS UI STATE ---
  showNotificationsDropdown = signal<boolean>(false);
  notificationsFilter = signal<'all' | 'unread'>('all');
  notificationsTypeFilter = signal<string>('all');
  notificationsSearchQuery = signal<string>('');
  
  filteredNotifications = computed(() => {
    let list = this.data.notifications();
    if (this.notificationsFilter() === 'unread') {
      list = list.filter(n => !n.read);
    }
    const type = this.notificationsTypeFilter();
    if (type !== 'all') {
      list = list.filter(n => {
        const text = (n.title + ' ' + n.message).toLowerCase();
        if (type === 'orders') return text.includes('commande') || text.includes('créée');
        if (type === 'payments') return text.includes('devis') || text.includes('acompte') || text.includes('solde') || text.includes('paiement');
        if (type === 'qa') return text.includes('qualité') || text.includes('tâche') || text.includes('assign') || text.includes('validé');
        return true;
      });
    }
    const q = this.notificationsSearchQuery().toLowerCase().trim();
    if (q) {
      list = list.filter(n => 
        n.title.toLowerCase().includes(q) || 
        n.message.toLowerCase().includes(q) || 
        (n.orderId && n.orderId.toLowerCase().includes(q))
      );
    }
    return list;
  });

  // --- REACTIVE FORMS ---
  orderForm!: FormGroup;
  customerForm!: FormGroup;
  quoteForm!: FormGroup;
  assignForm!: FormGroup;
  paymentForm!: FormGroup;
  authForm!: FormGroup;
  teamUserForm!: FormGroup;
  serviceForm!: FormGroup;

  showAuthModal = signal<'login' | 'register' | null>(null);
  showPassword = signal<boolean>(false);

  // --- SERVICE CATALOG MANAGEMENT STATE ---
  showServiceModal = signal<boolean>(false);
  editingServiceId = signal<string | null>(null);
  serviceImageBase64 = signal<string | null>(null);
  serviceOptionsList = signal<{ id: string; name: string; price: number }[]>([]);
  newOptionName = signal<string>('');
  newOptionPrice = signal<number>(0);

  // --- LOCAL COMPONENT STATES ---
  activeCategoryFilter = signal<string>('all');
  searchQuery = signal<string>('');
  statusFilter = signal<string>('all');

  // --- CHAT MESSAGE STATE ---
  chatMessage = signal<string>('');
  chatFileBase64 = signal<string | null>(null);
  chatFileName = signal<string | null>(null);
  isChatInternal = signal<boolean>(false);

  // --- FILE UPLOAD TEMP STATE ---
  selectedFolderForUpload = signal<string>('01_DOCUMENTS_ORIGINAUX');
  uploadFileBase64 = signal<string | null>(null);
  uploadFileName = signal<string | null>(null);
  uploadFileType = signal<string | null>(null);
  uploadFileSize = signal<number>(0);

  // --- NEW CLIENT OPTION IN NEW ORDER ---
  isCreatingNewCustomer = signal<boolean>(false);

  // --- AI ASSISTANT COMPONENT STATE ---
  isAnalyzingDoc = signal<boolean>(false);
  isDraftingSpec = signal<boolean>(false);
  isDraftingReply = signal<boolean>(false);
  specSheetDraft = signal<string | null>(null);
  aiMessageInstruction = signal<string>('');
  suggestedMessage = signal<string | null>(null);
  showAiSpecModal = signal<boolean>(false);
  showAiDraftModal = signal<boolean>(false);
  aiFeedbackMsg = signal<string | null>(null);

  // --- ESTIMATOR (LANDING PAGE) ---
  estServiceId = signal<string>('srv-1');
  estQuantity = signal<number>(20);
  estUrgency = signal<string>('normal');
  estOptionsSelected = signal<string[]>([]);
  estPrintOption = signal<boolean>(false);
  estPrintColor = signal<string>('nb');
  estPrintPages = signal<number>(20);
  estDeliveryOption = signal<boolean>(false);

  activeEstService = computed(() => {
    const sId = this.estServiceId();
    return this.data.services().find(srv => srv.id === sId);
  });

  constructor() {
    this.initForms();
    if (typeof window !== 'undefined') {
      this.data.loadAll();
    }

    // Effect to auto-load order details if selectedOrderId changes
    effect(() => {
      const orderId = this.selectedOrderId();
      if (orderId && typeof window !== 'undefined') {
        this.data.loadOrderDetails(orderId);
      }
    });

    // Effect to handle state changes on role switches
    effect(() => {
      const role = this.data.activeRole();
      if (role === 'public') {
        this.activeTab.set('landing');
      } else if (role === 'operator' || role === 'qa') {
        this.activeTab.set('orders'); // Operator/QA go straight to tasks
      } else {
        this.activeTab.set('dashboard');
      }
      this.selectedOrderId.set(null);
    });
  }

  // --- FORMS INITIALIZATION ---
  initForms() {
    this.orderForm = new FormGroup({
      customerType: new FormControl('particular'),
      customerDetails: new FormGroup({
        name: new FormControl('', Validators.required),
        email: new FormControl('', [Validators.required, Validators.email]),
        phone: new FormControl('', Validators.required),
        company: new FormControl(''),
        city: new FormControl('Casablanca', Validators.required),
        address: new FormControl(''),
        remarks: new FormControl(''),
      }),
      serviceId: new FormControl('', Validators.required),
      description: new FormControl('', Validators.required),
      quantity: new FormControl(1, [Validators.required, Validators.min(1)]),
      urgency: new FormControl('normal', Validators.required),
      selectedOptions: new FormControl([]),
    });

    this.customerForm = new FormGroup({
      name: new FormControl('', Validators.required),
      email: new FormControl('', [Validators.required, Validators.email]),
      phone: new FormControl('', Validators.required),
      company: new FormControl(''),
      city: new FormControl('Casablanca', Validators.required),
      address: new FormControl(''),
      notes: new FormControl(''),
    });

    this.quoteForm = new FormGroup({
      basePrice: new FormControl(0, Validators.required),
      optionsPrice: new FormControl(0),
      urgencySurcharge: new FormControl(0),
      printingPrice: new FormControl(0),
      deliveryPrice: new FormControl(0),
      depositPercent: new FormControl(50, [Validators.required, Validators.min(10), Validators.max(100)]),
      itemsJson: new FormControl('[]'),
    });

    this.assignForm = new FormGroup({
      operatorId: new FormControl('usr-operator-1', Validators.required),
      qaId: new FormControl('usr-qa-1', Validators.required),
      priority: new FormControl('NORMAL', Validators.required),
      notes: new FormControl(''),
      deadline: new FormControl(''),
    });

    this.paymentForm = new FormGroup({
      amount: new FormControl(0, [Validators.required, Validators.min(1)]),
      type: new FormControl('deposit', Validators.required),
      method: new FormControl('transfer', Validators.required),
      notes: new FormControl(''),
    });

    this.authForm = new FormGroup({
      identifier: new FormControl('', Validators.required),
      username: new FormControl(''),
      email: new FormControl('', [Validators.email]),
      password: new FormControl('', [Validators.required, Validators.minLength(4)]),
      name: new FormControl(''),
      role: new FormControl('client', Validators.required),
      phone: new FormControl(''),
      city: new FormControl('Casablanca'),
      address: new FormControl(''),
      company: new FormControl(''),
      ice: new FormControl(''),
    });

    this.teamUserForm = new FormGroup({
      name: new FormControl('', Validators.required),
      username: new FormControl(''),
      email: new FormControl('', [Validators.required, Validators.email]),
      password: new FormControl('123456', [Validators.required, Validators.minLength(4)]),
      role: new FormControl('operator', Validators.required),
      phone: new FormControl(''),
      city: new FormControl('Casablanca'),
      address: new FormControl(''),
    });

    this.serviceForm = new FormGroup({
      name: new FormControl('', Validators.required),
      category: new FormControl('saisie', Validators.required),
      description: new FormControl('', Validators.required),
      priceMethod: new FormControl('per_page', Validators.required),
      basePrice: new FormControl(0, [Validators.required, Validators.min(0)]),
      unitPriceName: new FormControl('Page', Validators.required),
      unitPrice: new FormControl(2.0, [Validators.required, Validators.min(0)]),
      isActive: new FormControl(true),
      imageUrl: new FormControl(''),
    });
  }

  // --- HELPER DYNAMIC COMPUTATIONS ---

  get activeServiceForForm(): Service | undefined {
    const sId = this.orderForm.get('serviceId')?.value;
    return this.data.services().find(s => s.id === sId);
  }

  // Calculate order price estimate in form real-time
  get calculatedFormEstimate() {
    const sId = this.orderForm.get('serviceId')?.value;
    const quantity = this.orderForm.get('quantity')?.value || 1;
    const urgency = this.orderForm.get('urgency')?.value || 'normal';
    const selectedOpts: string[] = this.orderForm.get('selectedOptions')?.value || [];

    const service = this.data.services().find(s => s.id === sId);
    if (!service) return { total: 0, deposit: 0 };

    const base = service.priceMethod === 'fixed' ? service.basePrice : service.basePrice + (service.unitPrice * quantity);
    
    // Add options price
    let optionsSum = 0;
    selectedOpts.forEach(optName => {
      const opt = service.options.find(o => o.name === optName);
      if (opt) {
        if (service.priceMethod === 'per_page') {
          optionsSum += opt.price * quantity;
        } else {
          optionsSum += opt.price;
        }
      }
    });

    // Add urgency surcharge
    const multiplier = urgency === 'normal' ? 0 : urgency === 'fast' ? 0.3 : urgency === 'urgent' ? 0.6 : 1.0;
    const surcharge = (base + optionsSum) * multiplier;

    const total = base + optionsSum + surcharge;

    // Deposit percent
    const depPercent = urgency === 'normal' ? 50 : urgency === 'fast' ? 60 : urgency === 'urgent' ? 70 : 80;
    const deposit = total * (depPercent / 100);

    return {
      base,
      options: optionsSum,
      urgency: surcharge,
      total,
      deposit,
      depositPercent: depPercent,
      balance: total - deposit
    };
  }

  // Calculate landing page estimator price
  get landingEstimate() {
    const sId = this.estServiceId();
    const quantity = this.estQuantity();
    const urgency = this.estUrgency();
    const selectedOpts = this.estOptionsSelected();

    const service = this.data.services().find(s => s.id === sId);
    if (!service) return {
      base: 0,
      options: 0,
      urgency: 0,
      printing: 0,
      delivery: 0,
      total: 0,
      deposit: 0,
      balance: 0,
      depositPercent: 50
    };

    const base = service.priceMethod === 'fixed' ? service.basePrice : service.basePrice + (service.unitPrice * quantity);
    
    let optionsSum = 0;
    selectedOpts.forEach(optId => {
      const opt = service.options.find(o => o.id === optId);
      if (opt) {
        if (service.priceMethod === 'per_page') {
          optionsSum += opt.price * quantity;
        } else {
          optionsSum += opt.price;
        }
      }
    });

    const multiplier = urgency === 'normal' ? 0 : urgency === 'fast' ? 0.3 : urgency === 'urgent' ? 0.6 : 1.0;
    const surcharge = (base + optionsSum) * multiplier;

    let printing = 0;
    if (this.estPrintOption()) {
      printing = (this.estPrintColor() === 'nb' ? 0.50 : 2.00) * this.estPrintPages();
    }

    let delivery = 0;
    if (this.estDeliveryOption()) {
      delivery = 30.00; // Physical shipping flat rate
    }

    const total = base + optionsSum + surcharge + printing + delivery;
    const depPercent = urgency === 'normal' ? 50 : urgency === 'fast' ? 60 : urgency === 'urgent' ? 70 : 80;

    return {
      base,
      options: optionsSum,
      urgency: surcharge,
      printing,
      delivery,
      total,
      deposit: total * (depPercent / 100),
      balance: total - (total * (depPercent / 100)),
      depositPercent: depPercent
    };
  }

  toggleEstOption(optId: string) {
    const current = this.estOptionsSelected();
    if (current.includes(optId)) {
      this.estOptionsSelected.set(current.filter(id => id !== optId));
    } else {
      this.estOptionsSelected.set([...current, optId]);
    }
  }

  // Filter and search orders
  filteredOrders = computed(() => {
    let orders = this.data.orders();
    const search = this.searchQuery().toLowerCase().trim();
    const status = this.statusFilter();
    const category = this.activeCategoryFilter();

    if (search) {
      orders = orders.filter(o => 
        o.reference.toLowerCase().includes(search) ||
        o.customerDetails.name.toLowerCase().includes(search) ||
        o.customerDetails.email.toLowerCase().includes(search) ||
        o.serviceName.toLowerCase().includes(search)
      );
    }

    if (status !== 'all') {
      orders = orders.filter(o => o.status === status);
    }

    if (category !== 'all') {
      orders = orders.filter(o => o.serviceCategory === category);
    }

    return orders;
  });

  // --- ACTIONS & SUBMISSIONS ---

  async onOrderSubmit() {
    const user = this.data.currentUser();
    if (!user) {
      this.data.errorMessage.set('Authentification obligatoire pour déposer une demande.');
      this.showAuthModal.set('login');
      return;
    }
    if (this.orderForm.invalid) {
      this.data.errorMessage.set('Veuillez remplir correctement tous les champs obligatoires.');
      return;
    }

    try {
      const formValue = this.orderForm.value;
      const service = this.data.services().find(s => s.id === formValue.serviceId);

      // Construct order payload
      const payload: Partial<Order> = {
        serviceId: formValue.serviceId,
        serviceName: service?.name,
        serviceCategory: service?.category,
        description: formValue.description,
        quantity: formValue.quantity,
        urgency: formValue.urgency,
        customerType: formValue.customerType,
        customerDetails: {
          name: formValue.customerDetails.name,
          email: formValue.customerDetails.email,
          phone: formValue.customerDetails.phone,
          company: formValue.customerDetails.company || '',
          city: formValue.customerDetails.city,
          address: formValue.customerDetails.address || '',
          remarks: formValue.customerDetails.remarks || ''
        },
        files: []
      };

      // Handle attached files
      if (this.uploadFileName() && this.uploadFileBase64()) {
        payload.files = [{
          id: 'fil-' + Math.random().toString(36).substring(2, 9),
          name: this.uploadFileName()!,
          type: this.uploadFileType() || 'application/octet-stream',
          size: this.uploadFileSize(),
          folder: '01_DOCUMENTS_ORIGINAUX',
          version: 1,
          uploadedBy: this.data.currentUser()?.name || 'Client',
          uploadedAt: new Date().toISOString(),
          base64Data: this.uploadFileBase64() || undefined
        }];
      }

      const created = await this.data.createOrder(payload);
      if (created) {
        this.selectedOrderId.set(created.id);
        this.activeTab.set('orders');
        this.orderForm.reset({
          customerType: 'particular',
          urgency: 'normal',
          quantity: 1,
          customerDetails: { city: 'Casablanca' }
        });
        this.clearUploadFile();
      }
    } catch (err) {
      console.error('Error submitting order:', err);
    }
  }

  async onAddCustomer() {
    if (this.customerForm.invalid) return;
    try {
      const added = await this.data.addPartnerCustomer(this.customerForm.value);
      if (added) {
        // Auto fill new order customer fields with this client
        this.orderForm.patchValue({
          customerDetails: {
            name: added.name,
            email: added.email,
            phone: added.phone,
            company: added.company || '',
            city: added.city,
            address: added.address || ''
          }
        });
        this.isCreatingNewCustomer.set(false);
        this.customerForm.reset({ city: 'Casablanca' });
      }
    } catch (err) {
      console.error('Error adding customer:', err);
    }
  }

  selectPartnerCustomer(c: PartnerCustomer) {
    this.orderForm.patchValue({
      customerDetails: {
        name: c.name,
        email: c.email,
        phone: c.phone,
        company: c.company || '',
        city: c.city,
        address: c.address || ''
      }
    });
    this.isCreatingNewCustomer.set(false);
    this.data.successMessage.set(`Client B2B sélectionné : ${c.name}`);
  }

  getFilesByFolder(files: OrderFile[], folder: string): OrderFile[] {
    return (files || []).filter(f => f.folder === folder);
  }

  async acceptRefuseQuote(orderId: string, action: 'accept' | 'refuse') {
    try {
      await this.data.acceptRefuseQuote(orderId, action);
    } catch (err) {
      console.error('Error with quote action:', err);
    }
  }

  // Start quote drafting based on order details
  initQuoteDraft(order: Order) {
    const service = this.data.services().find(s => s.id === order.serviceId);
    if (!service) return;

    const base = service.priceMethod === 'fixed' ? service.basePrice : service.basePrice + (service.unitPrice * order.quantity);
    const multiplier = order.urgency === 'normal' ? 0 : order.urgency === 'fast' ? 0.3 : order.urgency === 'urgent' ? 0.6 : 1.0;
    const urgency = base * multiplier;

    this.quoteForm.patchValue({
      basePrice: base,
      optionsPrice: 0,
      urgencySurcharge: urgency,
      printingPrice: 0,
      deliveryPrice: 0,
      depositPercent: order.urgency === 'normal' ? 50 : order.urgency === 'fast' ? 60 : order.urgency === 'urgent' ? 70 : 80
    });

    this.updateQuoteItemsJson();
  }

  updateQuoteItemsJson() {
    const base = Number(this.quoteForm.get('basePrice')?.value || 0);
    const options = Number(this.quoteForm.get('optionsPrice')?.value || 0);
    const urgency = Number(this.quoteForm.get('urgencySurcharge')?.value || 0);
    const printing = Number(this.quoteForm.get('printingPrice')?.value || 0);
    const delivery = Number(this.quoteForm.get('deliveryPrice')?.value || 0);

    const items = [
      { description: 'Travail de base / Saisie principale', quantity: 1, unitPrice: base, total: base }
    ];

    if (options > 0) {
      items.push({ description: 'Options de traitement et relecture', quantity: 1, unitPrice: options, total: options });
    }
    if (urgency > 0) {
      items.push({ description: 'Majoration de délai (Urgence)', quantity: 1, unitPrice: urgency, total: urgency });
    }
    if (printing > 0) {
      items.push({ description: 'Service d\'impression physique', quantity: 1, unitPrice: printing, total: printing });
    }
    if (delivery > 0) {
      items.push({ description: 'Frais d\'expédition physique', quantity: 1, unitPrice: delivery, total: delivery });
    }

    this.quoteForm.patchValue({ itemsJson: JSON.stringify(items) });
  }

  async onSendQuote(orderId: string) {
    this.updateQuoteItemsJson();
    const formVal = this.quoteForm.value;
    const total = Number(formVal.basePrice) + Number(formVal.optionsPrice) + Number(formVal.urgencySurcharge) + Number(formVal.printingPrice) + Number(formVal.deliveryPrice);
    const depositAmount = total * (formVal.depositPercent / 100);

    const quotePayload: Partial<Quote> = {
      basePrice: formVal.basePrice,
      optionsPrice: formVal.optionsPrice,
      urgencySurcharge: formVal.urgencySurcharge,
      printingPrice: formVal.printingPrice,
      deliveryPrice: formVal.deliveryPrice,
      totalAmount: total,
      depositPercent: formVal.depositPercent,
      depositAmount: depositAmount,
      balanceAmount: total - depositAmount,
      items: JSON.parse(formVal.itemsJson),
      status: 'sent' as 'sent' | 'draft' | 'accepted' | 'refused'
    };

    try {
      await this.data.submitQuote(orderId, quotePayload);
    } catch (err) {
      console.error('Error sending quote:', err);
    }
  }

  async onAssignSubmit(orderId: string) {
    if (this.assignForm.invalid) return;
    try {
      const val = this.assignForm.value;
      await this.data.assignOperator(orderId, {
        operatorId: val.operatorId,
        operatorName: val.operatorId === 'usr-operator-1' ? 'Nabil Niyo' : 'Opérateur Externe',
        qaId: val.qaId,
        qaName: val.qaId === 'usr-qa-1' ? 'Khadija Benani' : 'Superviseur Qualité',
        priority: val.priority,
        notes: val.notes,
        deadline: val.deadline
      });
      this.assignForm.reset({ operatorId: 'usr-operator-1', qaId: 'usr-qa-1', priority: 'NORMAL' });
    } catch (err) {
      console.error('Error assigning operator:', err);
    }
  }

  // Convert uploaded file to base64
  onFileSelected(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      this.uploadFileBase64.set(reader.result as string);
      this.uploadFileName.set(file.name);
      this.uploadFileType.set(file.type);
      this.uploadFileSize.set(file.size);
    };
    reader.readAsDataURL(file);
  }

  clearUploadFile() {
    this.uploadFileBase64.set(null);
    this.uploadFileName.set(null);
    this.uploadFileType.set(null);
    this.uploadFileSize.set(0);
  }

  async onUploadSubmit(orderId: string) {
    const user = this.data.currentUser();
    if (!user) {
      this.data.errorMessage.set('Authentification obligatoire pour livrer un travail.');
      this.showAuthModal.set('login');
      return;
    }
    const base64 = this.uploadFileBase64();
    const name = this.uploadFileName();
    const type = this.uploadFileType();
    const size = this.uploadFileSize();
    const folder = this.selectedFolderForUpload();

    if (!base64 || !name) return;

    try {
      await this.data.uploadFile(orderId, name, type || 'application/octet-stream', size, folder, base64);
      this.clearUploadFile();
    } catch (err) {
      console.error('Error uploading file:', err);
    }
  }

  onChatFileSelected(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      this.chatFileBase64.set(reader.result as string);
      this.chatFileName.set(file.name);
    };
    reader.readAsDataURL(file);
  }

  async onSendMessage(orderId: string) {
    const msg = this.chatMessage().trim();
    if (!msg && !this.chatFileBase64()) return;

    try {
      await this.data.sendMessage(
        orderId,
        msg,
        this.isChatInternal(),
        this.chatFileName() || undefined,
        this.chatFileBase64() || undefined
      );
      this.chatMessage.set('');
      this.chatFileBase64.set(null);
      this.chatFileName.set(null);
    } catch (err) {
      console.error('Error sending message:', err);
    }
  }

  async onQaSubmit(orderId: string, action: 'approve' | 'reject') {
    const checklist = {
      allPagesProcessed: true,
      noMissingDocs: true,
      spellingVerified: true,
      layoutVerified: true,
      numberingVerified: true,
      filesOpenCorrectly: true,
      formatRespected: true,
      fileNamesCorrect: true,
      finalVersionValidated: action === 'approve'
    };

    try {
      await this.data.submitQaChecklist(orderId, checklist, action);
    } catch (err) {
      console.error('Error submitting QA checklist:', err);
    }
  }

  onPaymentProofSelected(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      this.chatFileBase64.set(reader.result as string); // use chat base64 signal for temporary storage
      this.chatFileName.set(file.name);
    };
    reader.readAsDataURL(file);
  }

  async onPaymentSubmit(orderId: string) {
    if (this.paymentForm.invalid) return;

    const formVal = this.paymentForm.value;
    try {
      await this.data.submitPaymentProof(orderId, {
        amount: formVal.amount,
        type: formVal.type,
        method: formVal.method,
        proofFileName: this.chatFileName() || undefined,
        proofFileBase64: this.chatFileBase64() || undefined
      });
      this.paymentForm.reset({ type: 'deposit', method: 'transfer' });
      this.chatFileName.set(null);
      this.chatFileBase64.set(null);
    } catch (err) {
      console.error('Error submitting payment proof:', err);
    }
  }

  private syncEstimatorToOrderForm() {
    const currentUser = this.data.currentUser();
    if (currentUser) {
      // Auto pre-fill the order creation form with their landing page estimator parameters
      this.orderForm.patchValue({
        serviceId: this.estServiceId(),
        quantity: this.estQuantity(),
        urgency: this.estUrgency(),
        selectedOptions: this.estOptionsSelected(),
        customerDetails: {
          name: currentUser.name,
          email: currentUser.email,
          phone: currentUser.phone || '',
          city: currentUser.city || 'Casablanca',
          company: currentUser.company || '',
        }
      });
      if (currentUser.role === 'partner') {
        this.orderForm.patchValue({ customerType: 'partner' });
      } else {
        this.orderForm.patchValue({ customerType: 'particular' });
      }
      // Redirect to the new order page so they can finalize and submit
      this.activeTab.set('new_order');
    }
  }

  // --- CLIENT SIDE GEMINI ASSISTANT API ACTIONS ---

  async onAnalyzeDocument() {
    const fileBase64 = this.uploadFileBase64();
    const fileName = this.uploadFileName();
    const currentDescription = this.orderForm.get('description')?.value || '';

    if (!fileBase64 && !currentDescription) {
      this.data.errorMessage.set("Veuillez téléverser un fichier original ou décrire les travaux dans le champ de consigne pour que l'IA puisse analyser vos besoins.");
      return;
    }

    this.isAnalyzingDoc.set(true);
    this.aiFeedbackMsg.set(null);

    try {
      const result = await this.data.analyzeDocumentWithAi(
        fileName || 'consignes.txt',
        fileBase64 || '',
        currentDescription
      );

      // Auto-fill the form fields
      this.orderForm.patchValue({
        serviceId: result.recommendedServiceId || 'srv-saisie-1',
        description: result.optimizedDescription || currentDescription,
        quantity: result.estimatedPageCount || 1,
      });

      this.data.successMessage.set("L'analyse IA a réussi ! Le formulaire a été pré-rempli.");
      this.aiFeedbackMsg.set(`Analyse IA terminée :\n• Langue : ${result.detectedLanguage}\n• Lisibilité : ${result.readability}\n• Pages estimées : ${result.estimatedPageCount}\n• Mots : ${result.estimatedWordCount}\n• Recommandation : ${result.optionsRecommended.join(', ')}`);

    } catch (err: unknown) {
      console.error(err);
      this.data.errorMessage.set((err as Error).message || "Une erreur est survenue lors de l'analyse IA.");
    } finally {
      this.isAnalyzingDoc.set(false);
    }
  }

  async onGenerateSpecSheet(orderId: string) {
    this.isDraftingSpec.set(true);
    this.specSheetDraft.set(null);
    try {
      const result = await this.data.draftSpecSheetWithAi(orderId);
      this.specSheetDraft.set(result.specSheet);
      this.showAiSpecModal.set(true);
      this.data.successMessage.set("Cahier des charges IA généré avec succès !");
    } catch (err: unknown) {
      console.error(err);
      this.data.errorMessage.set((err as Error).message || "Une erreur est survenue lors de la génération du cahier des charges.");
    } finally {
      this.isDraftingSpec.set(false);
    }
  }

  async onGenerateChatSuggestion(orderId: string) {
    const instruction = this.aiMessageInstruction();
    if (!instruction) {
      this.data.errorMessage.set("Veuillez saisir des consignes ou une idée pour générer une réponse (ex: 'Rédiger une confirmation de bonne réception').");
      return;
    }

    this.isDraftingReply.set(true);
    this.suggestedMessage.set(null);
    try {
      const result = await this.data.draftChatReplyWithAi(orderId, instruction);
      this.suggestedMessage.set(result.reply);
      this.showAiDraftModal.set(true);
      this.data.successMessage.set("Suggestion de message IA générée avec succès !");
    } catch (err: unknown) {
      console.error(err);
      this.data.errorMessage.set((err as Error).message || "Une erreur est survenue lors de la génération de la suggestion.");
    } finally {
      this.isDraftingReply.set(false);
    }
  }

  applyAiChatSuggestion() {
    const suggested = this.suggestedMessage();
    if (suggested) {
      this.chatMessage.set(suggested);
      this.showAiDraftModal.set(false);
      this.aiMessageInstruction.set('');
      this.suggestedMessage.set(null);
      this.data.successMessage.set("La suggestion a été copiée dans la zone de saisie du chat.");
    }
  }

  togglePasswordVisibility() {
    this.showPassword.update(v => !v);
  }

  fillDemoCredentials(role: 'admin' | 'partner' | 'operator' | 'qa' | 'client') {
    const creds: Record<string, { identifier: string; password: string; name: string }> = {
      admin: { identifier: 'boguiman', password: 'admin123', name: 'Administrateur Principal' },
      partner: { identifier: 'partenaire', password: 'partner123', name: 'Partenaire Librairie' },
      operator: { identifier: 'operateur', password: 'operator123', name: 'Opérateur Saisie' },
      qa: { identifier: 'qa', password: 'qa123', name: 'Contrôle Qualité' },
      client: { identifier: 'client', password: 'client123', name: 'Client Final' },
    };

    const c = creds[role];
    if (c) {
      this.authForm.patchValue({
        identifier: c.identifier,
        username: c.identifier,
        email: c.identifier.includes('@') ? c.identifier : `${c.identifier}@digidocs.ma`,
        password: c.password,
        name: c.name,
        role: role === 'admin' ? 'client' : role
      });
      this.data.errorMessage.set(null);
    }
  }

  async handleLogin() {
    const identifier = (this.authForm.get('identifier')?.value || this.authForm.get('username')?.value || this.authForm.get('email')?.value || '').trim();
    const password = (this.authForm.get('password')?.value || '').trim();

    if (!identifier) {
      this.data.errorMessage.set("Veuillez saisir votre nom d'utilisateur ou votre adresse e-mail.");
      return;
    }
    if (!password) {
      this.data.errorMessage.set('Veuillez saisir votre mot de passe.');
      return;
    }

    try {
      await this.data.login(identifier, password);
      this.showAuthModal.set(null);
      this.syncEstimatorToOrderForm();
      this.authForm.reset({ role: 'client', city: 'Casablanca' });
    } catch {
      // Error is handled on data service
    }
  }

  async handleRegister() {
    const name = this.authForm.get('name')?.value;
    const email = this.authForm.get('email')?.value;
    const password = this.authForm.get('password')?.value;
    const role = this.authForm.get('role')?.value;

    if (!name || !email || !password || !role) {
      this.data.errorMessage.set('Veuillez remplir les champs obligatoires (Nom, Email, Mot de passe, Rôle).');
      return;
    }

    const payload = {
      ...this.authForm.value,
      username: this.authForm.get('username')?.value || email.split('@')[0]
    };

    try {
      await this.data.register(payload);
      this.showAuthModal.set(null);
      this.syncEstimatorToOrderForm();
      this.authForm.reset({ role: 'client', city: 'Casablanca' });
    } catch {
      // Error is handled on data service
    }
  }

  async onAddTeamUser() {
    if (this.teamUserForm.invalid) {
      this.data.errorMessage.set('Veuillez remplir les champs obligatoires (Nom, Email, Rôle).');
      return;
    }
    try {
      await this.data.createTeamUser(this.teamUserForm.value);
      this.teamUserForm.reset({ role: 'operator', city: 'Casablanca' });
    } catch {
      // Error is set on data service
    }
  }

  // --- SERVICE CATALOG MANAGEMENT METHODS ---

  openNewServiceModal() {
    this.editingServiceId.set(null);
    this.serviceImageBase64.set(null);
    this.serviceOptionsList.set([]);
    this.newOptionName.set('');
    this.newOptionPrice.set(0);
    this.serviceForm.reset({
      name: '',
      category: 'saisie',
      description: '',
      priceMethod: 'per_page',
      basePrice: 0,
      unitPriceName: 'Page',
      unitPrice: 2.0,
      isActive: true,
      imageUrl: ''
    });
    this.showServiceModal.set(true);
  }

  openEditServiceModal(service: Service) {
    this.editingServiceId.set(service.id);
    this.serviceImageBase64.set(service.imageUrl || null);
    this.serviceOptionsList.set(service.options ? [...service.options] : []);
    this.newOptionName.set('');
    this.newOptionPrice.set(0);
    this.serviceForm.patchValue({
      name: service.name,
      category: service.category,
      description: service.description,
      priceMethod: service.priceMethod,
      basePrice: service.basePrice,
      unitPriceName: service.unitPriceName,
      unitPrice: service.unitPrice,
      isActive: service.isActive,
      imageUrl: service.imageUrl || ''
    });
    this.showServiceModal.set(true);
  }

  onServiceImageSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        this.serviceImageBase64.set(base64);
        this.serviceForm.patchValue({ imageUrl: base64 });
      };
      reader.readAsDataURL(file);
    }
  }

  removeServiceImage() {
    this.serviceImageBase64.set(null);
    this.serviceForm.patchValue({ imageUrl: '' });
  }

  addServiceOption() {
    const name = this.newOptionName().trim();
    const price = Number(this.newOptionPrice()) || 0;
    if (!name) {
      this.data.errorMessage.set("Veuillez saisir l'intitulé de l'option.");
      return;
    }
    const newOpt = {
      id: 'opt-' + Math.random().toString(36).substring(2, 9),
      name,
      price
    };
    this.serviceOptionsList.update(list => [...list, newOpt]);
    this.newOptionName.set('');
    this.newOptionPrice.set(0);
  }

  removeServiceOption(optId: string) {
    this.serviceOptionsList.update(list => list.filter(o => o.id !== optId));
  }

  async handleSaveService() {
    if (this.serviceForm.invalid) {
      this.data.errorMessage.set('Veuillez renseigner le nom, la catégorie et les tarifs du service.');
      return;
    }

    const val = this.serviceForm.value;
    const payload: Partial<Service> = {
      id: this.editingServiceId() || undefined,
      name: val.name.trim(),
      category: val.category,
      description: val.description.trim(),
      priceMethod: val.priceMethod,
      basePrice: Number(val.basePrice) || 0,
      unitPriceName: val.unitPriceName.trim() || 'Unité',
      unitPrice: Number(val.unitPrice) || 0,
      isActive: val.isActive !== false,
      imageUrl: this.serviceImageBase64() || val.imageUrl || undefined,
      options: this.serviceOptionsList()
    };

    try {
      await this.data.saveService(payload);
      this.showServiceModal.set(false);
      this.editingServiceId.set(null);
      this.serviceImageBase64.set(null);
    } catch {
      // Handled by data service
    }
  }

  async handleDeleteService(service: Service) {
    if (confirm(`Êtes-vous certain de vouloir supprimer le service "${service.name}" du catalogue ?`)) {
      try {
        await this.data.deleteService(service.id);
      } catch {
        // Handled by data service
      }
    }
  }

  async toggleServiceActive(service: Service) {
    try {
      await this.data.saveService({
        ...service,
        isActive: !service.isActive
      });
    } catch {
      // Handled by data service
    }
  }

  // --- NOTIFICATION HELPERS ---

  toggleNotificationsDropdown() {
    this.showNotificationsDropdown.update(v => !v);
  }

  closeNotificationsDropdown() {
    this.showNotificationsDropdown.set(false);
  }

  openNotificationOrder(notification: AppNotification) {
    if (!notification.read) {
      this.data.markNotificationAsRead(notification.id);
    }
    this.showNotificationsDropdown.set(false);
    if (notification.orderId) {
      this.activeTab.set('orders');
      this.selectedOrderId.set(notification.orderId);
    }
  }

  formatRelativeTime(isoString: string): string {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);
      const diffHours = Math.floor(diffMin / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffSec < 60) return "À l'instant";
      if (diffMin < 60) return `Il y a ${diffMin} min`;
      if (diffHours < 24) return `Il y a ${diffHours} h`;
      if (diffDays === 1) return `Hier à ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      return `${date.toLocaleDateString([], { day: '2-digit', month: '2-digit' })} à ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } catch {
      return isoString;
    }
  }

  getNotificationIcon(title: string, message: string): { icon: string; bg: string; text: string } {
    const t = (title + ' ' + message).toLowerCase();
    if (t.includes('créée') || t.includes('nouvelle commande') || t.includes('enregistrée')) {
      return { icon: 'add_shopping_cart', bg: 'bg-emerald-50 text-emerald-600 border-emerald-200', text: 'text-emerald-700' };
    }
    if (t.includes('devis')) {
      return { icon: 'request_quote', bg: 'bg-indigo-50 text-indigo-600 border-indigo-200', text: 'text-indigo-700' };
    }
    if (t.includes('acompte') || t.includes('solde') || t.includes('paiement') || t.includes('reçu')) {
      return { icon: 'payments', bg: 'bg-amber-50 text-amber-600 border-amber-200', text: 'text-amber-700' };
    }
    if (t.includes('assign') || t.includes('tâche')) {
      return { icon: 'assignment_ind', bg: 'bg-blue-50 text-blue-600 border-blue-200', text: 'text-blue-700' };
    }
    if (t.includes('qualité') || t.includes('validé')) {
      return { icon: 'verified', bg: 'bg-teal-50 text-teal-600 border-teal-200', text: 'text-teal-700' };
    }
    if (t.includes('livr') || t.includes('terminé') || t.includes('expéd')) {
      return { icon: 'local_shipping', bg: 'bg-purple-50 text-purple-600 border-purple-200', text: 'text-purple-700' };
    }
    if (t.includes('rejet') || t.includes('refus') || t.includes('annul')) {
      return { icon: 'warning', bg: 'bg-rose-50 text-rose-600 border-rose-200', text: 'text-rose-700' };
    }
    if (t.includes('message')) {
      return { icon: 'chat', bg: 'bg-sky-50 text-sky-600 border-sky-200', text: 'text-sky-700' };
    }
    return { icon: 'notifications', bg: 'bg-stone-100 text-stone-700 border-stone-200', text: 'text-stone-700' };
  }
}
