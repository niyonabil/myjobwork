import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import {join} from 'node:path';
import { GoogleGenAI, Type } from '@google/genai';
import {
  loadDatabase,
  saveDatabase,
  resetDatabase,
  logAction,
  User,
  AppDatabase,
  PartnerCustomer,
  Service,
  Order,
  Quote,
  Invoice,
  Payment,
  OrderFile,
  OrderMessage,
  OrderTask,
  QualityChecklist,
} from './server-db';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
app.use(express.json({ limit: '50mb' }));

const angularApp = new AngularNodeAppEngine();

// --- NOTIFICATION HELPERS ---
async function dispatchNotificationToUsers(
  db: AppDatabase,
  userIds: string[],
  order: { id: string; reference: string },
  title: string,
  message: string
) {
  try {
    if (!db.notifications) {
      db.notifications = [];
    }
    const cleanIds = Array.from(new Set(userIds.filter(id => Boolean(id) && id.trim().length > 0)));
    for (const uid of cleanIds) {
      db.notifications.unshift({
        id: 'not-' + Math.random().toString(36).substring(2, 9),
        userId: uid,
        orderId: order.id,
        orderReference: order.reference,
        title,
        message,
        read: false,
        createdAt: new Date().toISOString()
      });
    }
  } catch (err) {
    console.error('Error dispatching notification:', err);
  }
}

async function notifyOrderStakeholders(
  db: AppDatabase,
  order: Order,
  title: string,
  message: string,
  options: { includeClient?: boolean; includePartner?: boolean; includeAdmins?: boolean; includeAssigned?: boolean } = {
    includeClient: true,
    includePartner: true,
    includeAdmins: true,
    includeAssigned: true
  }
) {
  const targetIds: string[] = [];

  // Direct client
  if (options.includeClient !== false && order.customerDetails?.email) {
    const clientUser = db.users.find((u: User) => u.email.toLowerCase() === order.customerDetails?.email.toLowerCase());
    if (clientUser) {
      targetIds.push(clientUser.id);
    }
  }

  // Partner
  if (options.includePartner !== false && order.partnerId) {
    targetIds.push(order.partnerId);
  }

  // Admins
  if (options.includeAdmins) {
    const adminUsers = db.users.filter((u: User) => u.role === 'admin' && u.active);
    adminUsers.forEach(a => targetIds.push(a.id));
  }

  // Assigned Operator & QA
  if (options.includeAssigned) {
    order.tasks?.forEach(t => {
      if (t.operatorId) targetIds.push(t.operatorId);
      if (t.qaId) targetIds.push(t.qaId);
    });
  }

  await dispatchNotificationToUsers(db, targetIds, order, title, message);
}

// --- REST API ENDPOINTS ---

// Notifications Endpoints
app.get('/api/notifications', async (req, res) => {
  try {
    const { userId } = req.query;
    const db = await loadDatabase();
    let notifications = db.notifications || [];
    if (userId) {
      notifications = notifications.filter(n => n.userId === userId);
    }
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/notifications/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    const db = await loadDatabase();
    if (db.notifications) {
      const notification = db.notifications.find(n => n.id === id);
      if (notification) {
        notification.read = true;
        await saveDatabase(db);
      }
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/notifications/read-all', async (req, res) => {
  try {
    const { userId } = req.body;
    const db = await loadDatabase();
    if (db.notifications && userId) {
      db.notifications.forEach(n => {
        if (n.userId === userId) {
          n.read = true;
        }
      });
      await saveDatabase(db);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.delete('/api/notifications/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = await loadDatabase();
    if (db.notifications) {
      const idx = db.notifications.findIndex(n => n.id === id);
      if (idx >= 0) {
        db.notifications.splice(idx, 1);
        await saveDatabase(db);
      }
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.delete('/api/notifications', async (req, res) => {
  try {
    const { userId } = req.query;
    const db = await loadDatabase();
    if (db.notifications && userId) {
      db.notifications = db.notifications.filter(n => n.userId !== userId || !n.read);
      await saveDatabase(db);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Auth Endpoints
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, username, identifier, password } = req.body;
    const loginId = (identifier || email || username || '').toString().trim().toLowerCase();
    
    if (!loginId) {
      res.status(400).json({ error: 'Nom d\'utilisateur ou adresse e-mail requis.' });
      return;
    }

    if (!password) {
      res.status(400).json({ error: 'Mot de passe requis.' });
      return;
    }

    const db = await loadDatabase();
    const user = db.users.find(u => 
      u.email.toLowerCase() === loginId || 
      (u.username && u.username.toLowerCase() === loginId)
    );

    if (!user) {
      res.status(401).json({ error: 'Compte introuvable pour cet identifiant (nom d\'utilisateur ou e-mail).' });
      return;
    }

    // Check password if set on user record
    if (user.password && user.password !== password.trim()) {
      res.status(401).json({ error: 'Mot de passe incorrect. Veuillez réessayer.' });
      return;
    }

    // If user has no password yet (legacy), initialize it
    if (!user.password && password) {
      user.password = password.trim();
      await saveDatabase(db);
    }

    res.json({ user, token: 'token-' + user.id });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, username, email, password, role, phone, city, address, company, ice, createdByUserId, createdByRole } = req.body;
    if (!name || !email || !role || !password) {
      res.status(400).json({ error: 'Champs requis manquants (Nom, Email, Mot de passe, Rôle).' });
      return;
    }
    
    const db = await loadDatabase();
    const normalizedEmail = email.toLowerCase().trim();
    const normalizedUsername = (username || email.split('@')[0] || '').toLowerCase().trim();

    const existingEmail = db.users.find(u => u.email.toLowerCase() === normalizedEmail);
    if (existingEmail) {
      res.status(400).json({ error: 'Un utilisateur avec cette adresse e-mail existe déjà.' });
      return;
    }

    const existingUsername = db.users.find(u => u.username && u.username.toLowerCase() === normalizedUsername);
    if (existingUsername) {
      res.status(400).json({ error: 'Ce nom d\'utilisateur est déjà utilisé. Veuillez en choisir un autre.' });
      return;
    }

    const newUser: User = {
      id: 'usr-' + Math.random().toString(36).substring(2, 9),
      name,
      username: normalizedUsername,
      email: normalizedEmail,
      password: password.trim(),
      role,
      phone: phone || '',
      city: city || 'Casablanca',
      address: address || '',
      company: company || '',
      ice: ice || '',
      active: true,
      createdByUserId: createdByUserId || undefined,
      createdByRole: createdByRole || undefined
    };

    db.users.push(newUser);
    await saveDatabase(db);
    res.json({ user: newUser, token: 'token-' + newUser.id });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/users', async (req, res) => {
  try {
    const { createdByUserId, role } = req.query;
    const db = await loadDatabase();
    let users = db.users;

    if (createdByUserId) {
      users = users.filter(u => u.createdByUserId === createdByUserId);
    } else if (role === 'admin') {
      // Platform admin can see any operator or QA
      users = users.filter(u => u.role === 'operator' || u.role === 'qa');
    } else {
      users = users.filter(u => u.role === 'operator' || u.role === 'qa');
    }

    res.json(users);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Services Catalog Endpoints
app.get('/api/services', async (req, res) => {
  try {
    const db = await loadDatabase();
    res.json(db.services);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/services', async (req, res) => {
  try {
    const service: Service = req.body;
    const { userId, userName } = req.query;
    const db = await loadDatabase();
    if (!service.name || !service.category) {
      res.status(400).json({ error: 'Le nom et la catégorie du service sont obligatoires.' });
      return;
    }
    const existingIdx = db.services.findIndex(s => s.id === service.id);
    if (existingIdx >= 0) {
      db.services[existingIdx] = { ...db.services[existingIdx], ...service };
    } else {
      service.id = service.id || ('srv-' + Math.random().toString(36).substring(2, 9));
      if (typeof service.isActive === 'undefined') {
        service.isActive = true;
      }
      if (!service.options) {
        service.options = [];
      }
      db.services.push(service);
    }
    await saveDatabase(db);
    await logAction(
      (userId as string) || 'system',
      (userName as string) || 'Administrateur',
      'Mise à jour catalogue',
      `Service "${service.name}" (${service.id}) enregistré dans le catalogue.`
    );
    res.json(service);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.put('/api/services/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData: Partial<Service> = req.body;
    const { userId, userName } = req.query;
    const db = await loadDatabase();
    const idx = db.services.findIndex(s => s.id === id);
    if (idx === -1) {
      res.status(404).json({ error: 'Service non trouvé.' });
      return;
    }
    db.services[idx] = {
      ...db.services[idx],
      ...updateData,
      id
    };
    await saveDatabase(db);
    await logAction(
      (userId as string) || 'system',
      (userName as string) || 'Administrateur',
      'Modification Service',
      `Service "${db.services[idx].name}" (${id}) modifié.`
    );
    res.json(db.services[idx]);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.delete('/api/services/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, userName } = req.query;
    const db = await loadDatabase();
    const idx = db.services.findIndex(s => s.id === id);
    if (idx === -1) {
      res.status(404).json({ error: 'Service non trouvé.' });
      return;
    }
    const removedService = db.services.splice(idx, 1)[0];
    await saveDatabase(db);
    await logAction(
      (userId as string) || 'system',
      (userName as string) || 'Administrateur',
      'Suppression Service',
      `Service "${removedService?.name || id}" supprimé du catalogue.`
    );
    res.json({ success: true, id, message: 'Service supprimé avec succès.' });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Partner Customers Endpoints
app.get('/api/partners/customers', async (req, res) => {
  try {
    const { partnerId } = req.query;
    const db = await loadDatabase();
    let customers = db.partnerCustomers;
    if (partnerId) {
      customers = customers.filter(c => c.partnerId === partnerId);
    }
    res.json(customers);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/partners/customers', async (req, res) => {
  try {
    const customer: PartnerCustomer = req.body;
    const db = await loadDatabase();
    if (!customer.id) {
      customer.id = 'cust-' + Math.random().toString(36).substring(2, 9);
      customer.createdAt = new Date().toISOString();
      db.partnerCustomers.push(customer);
    } else {
      const idx = db.partnerCustomers.findIndex(c => c.id === customer.id);
      if (idx >= 0) {
        db.partnerCustomers[idx] = customer;
      }
    }
    await saveDatabase(db);
    await logAction(
      customer.partnerId,
      'Partenaire',
      'Création Client',
      `Client "${customer.name}" enregistré pour ce partenaire.`
    );
    res.json(customer);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Orders Endpoints
app.get('/api/orders', async (req, res) => {
  try {
    const { partnerId, clientId, operatorId, qaId } = req.query;
    const db = await loadDatabase();
    let orders = db.orders;

    if (partnerId) {
      orders = orders.filter(o => o.partnerId === partnerId);
    } else if (clientId) {
      // Direct client orders (we find by client email or id)
      const user = db.users.find(u => u.id === clientId);
      if (user) {
        orders = orders.filter(o => o.customerDetails.email === user.email);
      }
    } else if (operatorId) {
      orders = orders.filter(o => o.tasks.some(t => t.operatorId === operatorId));
    } else if (qaId) {
      orders = orders.filter(o => o.tasks.some(t => t.qaId === qaId));
    }

    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = await loadDatabase();
    const order = db.orders.find(o => o.id === id || o.reference === id);
    if (!order) {
      res.status(404).json({ error: 'Commande introuvable.' });
      return;
    }
    // Fetch attached structures
    const quote = db.quotes.find(q => q.orderId === order.id);
    const invoice = db.invoices.filter(i => i.orderId === order.id);
    const payment = db.payments.filter(p => p.orderId === order.id);

    res.json({ order, quote, invoices: invoice, payments: payment });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/orders', async (req, res) => {
  try {
    const orderData = req.body;
    const db = await loadDatabase();

    const refNumber = db.orders.length + 1;
    const reference = `CMD-2026-${refNumber.toString().padStart(4, '0')}`;

    const newOrder: Order = {
      id: 'ord-' + Math.random().toString(36).substring(2, 9),
      reference,
      customerType: orderData.customerType || 'particular',
      customerDetails: orderData.customerDetails,
      partnerId: orderData.partnerId || undefined,
      serviceId: orderData.serviceId,
      serviceName: orderData.serviceName || 'Service personnalisé',
      serviceCategory: orderData.serviceCategory || 'saisie',
      description: orderData.description,
      quantity: orderData.quantity || 1,
      urgency: orderData.urgency || 'normal',
      status: orderData.status || 'DEMANDE_ENVOYEE',
      files: orderData.files || [],
      messages: orderData.messages || [],
      tasks: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Calculate preliminary deadline based on urgency
    const days = newOrder.urgency === 'normal' ? 5 : newOrder.urgency === 'fast' ? 3 : newOrder.urgency === 'urgent' ? 2 : 1;
    const deadlineDate = new Date();
    deadlineDate.setDate(deadlineDate.getDate() + days);
    newOrder.deadline = deadlineDate.toISOString();

    db.orders.unshift(newOrder);

    // Notify client/partner and admins about the new order
    await notifyOrderStakeholders(
      db,
      newOrder,
      'Nouvelle commande enregistrée',
      `La commande ${reference} (${newOrder.serviceName}) a été enregistrée avec succès. Statut: En attente d'analyse.`,
      { includeClient: true, includePartner: true, includeAdmins: true, includeAssigned: false }
    );

    await saveDatabase(db);

    const actorId = orderData.partnerId || 'client-direct';
    const actorName = orderData.customerDetails.name;
    await logAction(actorId, actorName, 'Création Commande', `Commande ${reference} créée pour le service ${newOrder.serviceName}.`);

    res.json(newOrder);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/orders/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, userId, userName } = req.body;
    const db = await loadDatabase();
    const order = db.orders.find(o => o.id === id);
    if (!order) {
      res.status(404).json({ error: 'Commande introuvable.' });
      return;
    }

    const oldStatus = order.status;
    order.status = status;
    order.updatedAt = new Date().toISOString();

    // Map rich status change notifications
    const statusMessages: Record<string, { title: string; message: string }> = {
      DEMANDE_ENVOYEE: {
        title: 'Demande enregistrée',
        message: `La commande ${order.reference} a été enregistrée.`
      },
      EN_ATTENTE_ANALYSE: {
        title: 'Analyse en cours',
        message: `L'équipe technique analyse les documents de la commande ${order.reference}.`
      },
      DEVIS_EN_PREPARATION: {
        title: 'Devis en cours de préparation',
        message: `Votre devis pour la commande ${order.reference} est en préparation.`
      },
      DEVIS_ENVOYE: {
        title: 'Devis disponible',
        message: `Un devis a été émis pour votre commande ${order.reference}. Veuillez le consulter et le valider.`
      },
      EN_ATTENTE_ACOMPTE: {
        title: 'En attente d\'acompte',
        message: `Le devis pour la commande ${order.reference} est accepté. En attente du règlement de l'acompte.`
      },
      ACOMPTE_PAYE: {
        title: 'Acompte validé',
        message: `L'acompte de la commande ${order.reference} a été validé. La commande passe en production.`
      },
      EN_FILE_ATTENTE: {
        title: 'En file d\'attente',
        message: `La commande ${order.reference} est assignée et placée en file d'attente de traitement.`
      },
      EN_TRAITEMENT: {
        title: 'Traitement en cours',
        message: `Le travail de numérisation / traitement pour ${order.reference} est en cours de réalisation.`
      },
      CONTROLE_QUALITE: {
        title: 'Contrôle qualité en cours',
        message: `Le travail final de la commande ${order.reference} est en cours de vérification de conformité.`
      },
      TRAVAIL_TERMINE: {
        title: 'Travail terminé & validé',
        message: `Le travail pour la commande ${order.reference} a été validé avec succès par le contrôle qualité.`
      },
      EN_ATTENTE_SOLDE: {
        title: 'En attente du solde',
        message: `Le travail ${order.reference} est prêt. Veuillez régler le solde pour accéder à la version finale.`
      },
      SOLDE_PAYE: {
        title: 'Solde validé',
        message: `Paiement du solde reçu pour ${order.reference}. Le document est prêt pour livraison / téléchargement.`
      },
      PRET_A_LIVRER: {
        title: 'Prêt pour livraison',
        message: `La commande ${order.reference} est prête pour remise ou expédition.`
      },
      LIVRE: {
        title: 'Travail livré',
        message: `Le travail pour votre commande ${order.reference} a été livré avec succès.`
      },
      TERMINE: {
        title: 'Commande clôturée',
        message: `Votre commande ${order.reference} est désormais clôturée.`
      },
      ANNULE: {
        title: 'Commande annulée',
        message: `La commande ${order.reference} a été annulée.`
      },
      REFUSE: {
        title: 'Commande refusée',
        message: `La commande ${order.reference} a été refusée.`
      },
      BLOQUE: {
        title: 'Commande bloquée',
        message: `La commande ${order.reference} nécessite des informations complémentaires de votre part.`
      }
    };

    const notifInfo = statusMessages[status] || {
      title: 'Statut mis à jour',
      message: `Le statut de la commande ${order.reference} est maintenant "${status.replace(/_/g, ' ')}".`
    };

    await notifyOrderStakeholders(
      db,
      order,
      notifInfo.title,
      notifInfo.message,
      { includeClient: true, includePartner: true, includeAdmins: true, includeAssigned: true }
    );

    await saveDatabase(db);

    await logAction(
      userId || 'system',
      userName || 'Système',
      'Changement Statut',
      `Commande ${order.reference} passée de "${oldStatus}" à "${status}".`
    );

    res.json(order);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Quote Endpoints
app.post('/api/orders/:id/quote', async (req, res) => {
  try {
    const { id } = req.params;
    const quoteData = req.body; // basePrice, optionsPrice, urgencySurcharge, printingPrice, deliveryPrice, totalAmount, depositPercent, items
    const { userId, userName } = req.query;
    const db = await loadDatabase();

    const order = db.orders.find(o => o.id === id);
    if (!order) {
      res.status(404).json({ error: 'Commande introuvable.' });
      return;
    }

    // Reference
    const quoteRef = `DEV-2026-${(db.quotes.length + 1).toString().padStart(4, '0')}`;
    const quoteId = quoteData.id || 'qte-' + Math.random().toString(36).substring(2, 9);

    const newQuote: Quote = {
      id: quoteId,
      reference: quoteRef,
      orderId: order.id,
      basePrice: quoteData.basePrice || 0,
      optionsPrice: quoteData.optionsPrice || 0,
      urgencySurcharge: quoteData.urgencySurcharge || 0,
      printingPrice: quoteData.printingPrice || 0,
      deliveryPrice: quoteData.deliveryPrice || 0,
      totalAmount: quoteData.totalAmount || 0,
      depositPercent: quoteData.depositPercent || 50,
      depositAmount: quoteData.depositAmount || 0,
      balanceAmount: quoteData.balanceAmount || 0,
      status: quoteData.status || 'sent',
      validityDate: quoteData.validityDate || new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
      items: quoteData.items || []
    };

    const existingIdx = db.quotes.findIndex(q => q.orderId === order.id);
    if (existingIdx >= 0) {
      db.quotes[existingIdx] = newQuote;
    } else {
      db.quotes.push(newQuote);
    }

    order.quoteId = newQuote.id;
    order.status = 'DEVIS_ENVOYE';
    order.updatedAt = new Date().toISOString();

    await notifyOrderStakeholders(
      db,
      order,
      'Devis disponible',
      `Le devis ${quoteRef} (${newQuote.totalAmount} DH) a été émis pour votre commande ${order.reference}.`,
      { includeClient: true, includePartner: true, includeAdmins: true, includeAssigned: false }
    );

    await saveDatabase(db);

    await logAction(
      (userId as string) || 'admin',
      (userName as string) || 'Administrateur',
      'Émission Devis',
      `Devis ${quoteRef} émis pour la commande ${order.reference} d'un montant de ${newQuote.totalAmount} DH.`
    );

    res.json({ order, quote: newQuote });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/orders/:id/quote/action', async (req, res) => {
  try {
    const { id } = req.params;
    const { action, userId, userName } = req.body; // action: 'accept' or 'refuse'
    const db = await loadDatabase();

    const order = db.orders.find(o => o.id === id);
    if (!order) {
      res.status(404).json({ error: 'Commande introuvable.' });
      return;
    }

    const quote = db.quotes.find(q => q.orderId === order.id);
    if (!quote) {
      res.status(404).json({ error: 'Devis introuvable.' });
      return;
    }

    if (action === 'accept') {
      quote.status = 'accepted';
      order.status = 'EN_ATTENTE_ACOMPTE';

      // Auto generate deposit invoice
      const invoiceRef = `FAC-2026-${(db.invoices.length + 1).toString().padStart(4, '0')}`;
      const newInvoice: Invoice = {
        id: 'inv-' + Math.random().toString(36).substring(2, 9),
        reference: invoiceRef,
        orderId: order.id,
        quoteId: quote.id,
        amount: quote.depositAmount,
        type: 'deposit',
        status: 'unpaid',
        date: new Date().toISOString()
      };
      db.invoices.push(newInvoice);

      await notifyOrderStakeholders(
        db,
        order,
        'Devis accepté',
        `Le devis pour la commande ${order.reference} a été accepté. Facture d'acompte émise (${quote.depositAmount} DH).`,
        { includeClient: true, includePartner: true, includeAdmins: true, includeAssigned: false }
      );

      await logAction(userId, userName, 'Acceptation Devis', `Devis ${quote.reference} accepté par le client. Facture d'acompte ${invoiceRef} émise.`);
    } else {
      quote.status = 'refused';
      order.status = 'REFUSE';

      await notifyOrderStakeholders(
        db,
        order,
        'Devis refusé',
        `Le devis pour la commande ${order.reference} a été refusé.`,
        { includeClient: true, includePartner: true, includeAdmins: true, includeAssigned: false }
      );

      await logAction(userId, userName, 'Refus Devis', `Devis ${quote.reference} refusé par le client.`);
    }

    order.updatedAt = new Date().toISOString();
    await saveDatabase(db);

    res.json({ order, quote });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Assignment Endpoint
app.post('/api/orders/:id/assign', async (req, res) => {
  try {
    const { id } = req.params;
    const { operatorId, operatorName, qaId, qaName, deadline, priority, notes, userId, userName } = req.body;
    const db = await loadDatabase();

    const order = db.orders.find(o => o.id === id);
    if (!order) {
      res.status(404).json({ error: 'Commande introuvable.' });
      return;
    }

    const task: OrderTask = {
      id: 'tsk-' + Math.random().toString(36).substring(2, 9),
      operatorId,
      operatorName,
      qaId,
      qaName,
      deadline: deadline || order.deadline || new Date().toISOString(),
      priority: priority || 'NORMAL',
      completed: false,
      notes
    };

    order.tasks = [task]; // assign or replace
    order.status = 'EN_FILE_ATTENTE';
    order.updatedAt = new Date().toISOString();

    // Notify assigned operator and QA as well as admins & client
    await notifyOrderStakeholders(
      db,
      order,
      'Commande assignée',
      `La commande ${order.reference} a été assignée à ${operatorName} (Contrôleur: ${qaName || 'Non défini'}).`,
      { includeClient: true, includePartner: true, includeAdmins: true, includeAssigned: true }
    );

    await saveDatabase(db);

    await logAction(
      userId,
      userName,
      'Assignation Travail',
      `Commande ${order.reference} assignée à l'opérateur ${operatorName} (Contrôleur: ${qaName || 'Non défini'}).`
    );

    res.json(order);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Upload Document Endpoint
app.post('/api/orders/:id/upload', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, size, folder, base64Data, uploadedBy } = req.body;
    const db = await loadDatabase();

    const order = db.orders.find(o => o.id === id);
    if (!order) {
      res.status(404).json({ error: 'Commande introuvable.' });
      return;
    }

    // Determine next version of file if same name exists
    const existingCount = order.files.filter(f => f.name === name && f.folder === folder).length;
    const version = existingCount + 1;

    const newFile: OrderFile = {
      id: 'fil-' + Math.random().toString(36).substring(2, 9),
      name,
      type,
      size,
      folder,
      version,
      uploadedBy,
      uploadedAt: new Date().toISOString(),
      base64Data
    };

    order.files.push(newFile);
    order.updatedAt = new Date().toISOString();

    // Side effect: If operator uploads to 05_VERSION_FINALE, progress the order to QC
    if (folder === '05_VERSION_FINALE' && order.status === 'EN_TRAITEMENT') {
      order.status = 'CONTROLE_QUALITE';
      // Create empty QA checklist if none exists
      if (!order.qualityChecklist) {
        order.qualityChecklist = {
          allPagesProcessed: false,
          noMissingDocs: false,
          spellingVerified: false,
          layoutVerified: false,
          numberingVerified: false,
          filesOpenCorrectly: false,
          formatRespected: false,
          fileNamesCorrect: false,
          finalVersionValidated: false
        };
      }
    }

    await saveDatabase(db);

    await logAction(
      uploadedBy,
      'Utilisateur',
      'Fichier déposé',
      `Fichier "${name}" (v${version}) ajouté dans le dossier [${folder}] pour la commande ${order.reference}.`
    );

    res.json(order);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Messages & Chat Endpoints
app.post('/api/orders/:id/messages', async (req, res) => {
  try {
    const { id } = req.params;
    const { senderName, senderRole, message, isInternal, fileName, fileBase64 } = req.body;
    const db = await loadDatabase();

    const order = db.orders.find(o => o.id === id);
    if (!order) {
      res.status(404).json({ error: 'Commande introuvable.' });
      return;
    }

    const newMessage: OrderMessage = {
      id: 'msg-' + Math.random().toString(36).substring(2, 9),
      senderName,
      senderRole,
      message,
      timestamp: new Date().toISOString(),
      isInternal: !!isInternal,
      fileName,
      fileBase64
    };

    order.messages.push(newMessage);
    order.updatedAt = new Date().toISOString();
    await saveDatabase(db);

    res.json(order);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Quality Control Verification Checklist
app.post('/api/orders/:id/qa', async (req, res) => {
  try {
    const { id } = req.params;
    const { checklist, validatedBy, action } = req.body; // action: 'approve' or 'reject'
    const db = await loadDatabase();

    const order = db.orders.find(o => o.id === id);
    if (!order) {
      res.status(404).json({ error: 'Commande introuvable.' });
      return;
    }

    const previousChecklist = order.qualityChecklist || {} as QualityChecklist;
    const updatedChecklist: QualityChecklist = {
      ...previousChecklist,
      ...checklist,
      validatedBy: action === 'approve' ? validatedBy : undefined,
      validatedAt: action === 'approve' ? new Date().toISOString() : undefined
    };

    order.qualityChecklist = updatedChecklist;
    order.updatedAt = new Date().toISOString();

    if (action === 'approve') {
      order.status = 'TRAVAIL_TERMINE';
      if (order.tasks[0]) {
        order.tasks[0].completed = true;
      }

      // Trigger notification
      await notifyOrderStakeholders(
        db,
        order,
        'Travail terminé & validé',
        `Le contrôle de qualité a été validé avec succès pour votre commande ${order.reference}. Le travail est prêt.`,
        { includeClient: true, includePartner: true, includeAdmins: true, includeAssigned: true }
      );

      // Generate Balance Invoice (Solde)
      const quote = db.quotes.find(q => q.orderId === order.id);
      if (quote) {
        const balanceRef = `FAC-2026-${(db.invoices.length + 1).toString().padStart(4, '0')}`;
        const balanceInvoice: Invoice = {
          id: 'inv-' + Math.random().toString(36).substring(2, 9),
          reference: balanceRef,
          orderId: order.id,
          quoteId: quote.id,
          amount: quote.balanceAmount,
          type: 'balance',
          status: 'unpaid',
          date: new Date().toISOString()
        };
        db.invoices.push(balanceInvoice);

        await logAction(
          validatedBy,
          'Contrôle Qualité',
          'Validation Qualité OK',
          `Contrôle qualité validé pour ${order.reference}. Commande passe en "TRAVAIL_TERMINE", facture de solde ${balanceRef} émise.`
        );
      }
    } else if (action === 'reject') {
      order.status = 'EN_TRAITEMENT'; // Redirection to Treatment

      await notifyOrderStakeholders(
        db,
        order,
        'Travail retourné pour corrections',
        `Le contrôle qualité a relevé des points à corriger sur la commande ${order.reference}.`,
        { includeClient: false, includePartner: false, includeAdmins: true, includeAssigned: true }
      );

      await logAction(
        validatedBy,
        'Contrôle Qualité',
        'Contrôle Qualité Échec',
        `Travail refusé lors du contrôle qualité pour ${order.reference}. Retourné en traitement avec corrections requises.`
      );
    }

    await saveDatabase(db);
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Manual Payment Recording and Verification
app.post('/api/orders/:id/pay', async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, type, method, proofFileName, proofFileBase64, userId, userName, action } = req.body;
    const db = await loadDatabase();

    const order = db.orders.find(o => o.id === id);
    if (!order) {
      res.status(404).json({ error: 'Commande introuvable.' });
      return;
    }

    const quote = db.quotes.find(q => q.orderId === order.id);
    if (!quote) {
      res.status(404).json({ error: 'Devis introuvable.' });
      return;
    }

    if (action === 'submit_proof') {
      // Client submits payment proof
      const paymentRef = `REC-2026-${(db.payments.length + 1).toString().padStart(4, '0')}`;
      const newPayment: Payment = {
        id: 'pay-' + Math.random().toString(36).substring(2, 9),
        reference: paymentRef,
        orderId: order.id,
        amount,
        type, // 'deposit' | 'balance'
        method,
        status: 'pending',
        proofFileName,
        proofFileBase64,
        date: new Date().toISOString(),
        notes: `Preuve soumise par le client. Attente validation.`
      };
      db.payments.push(newPayment);

      // Save files representation
      if (proofFileName) {
        order.files.push({
          id: 'fil-' + Math.random().toString(36).substring(2, 9),
          name: proofFileName,
          type: 'image/jpeg',
          size: 200000,
          folder: '07_PREUVES',
          version: 1,
          uploadedBy: userName,
          uploadedAt: new Date().toISOString(),
          base64Data: proofFileBase64
        });
      }

      order.status = type === 'deposit' ? 'EN_ATTENTE_ACOMPTE' : 'EN_ATTENTE_SOLDE';
      order.updatedAt = new Date().toISOString();

      await notifyOrderStakeholders(
        db,
        order,
        'Preuve de paiement soumise',
        `Preuve de paiement de l'${type === 'deposit' ? 'acompte' : 'solde'} (${amount} DH) déposée pour ${order.reference}. En attente de validation administrative.`,
        { includeClient: true, includePartner: true, includeAdmins: true, includeAssigned: false }
      );

      await logAction(userId, userName, 'Preuve paiement', `Preuve de paiement de l'${type === 'deposit' ? 'acompte' : 'solde'} (${amount} DH) soumise pour ${order.reference}.`);
    } else if (action === 'verify_payment') {
      // Admin approves or rejects the payment
      const { paymentId, approve } = req.body;
      const paymentObj = db.payments.find(p => p.id === paymentId);
      if (!paymentObj) {
        res.status(404).json({ error: 'Paiement introuvable.' });
        return;
      }

      if (approve) {
        paymentObj.status = 'verified';
        paymentObj.notes = `Paiement vérifié et approuvé par ${userName}.`;

        // Update invoices associated
        const invoiceObj = db.invoices.find(i => i.orderId === order.id && i.type === paymentObj.type);
        if (invoiceObj) {
          invoiceObj.status = 'paid';
        }

        if (paymentObj.type === 'deposit') {
          order.status = 'ACOMPTE_PAYE'; // triggers readiness for production!
          await notifyOrderStakeholders(
            db,
            order,
            'Acompte validé',
            `Le paiement de l'acompte (${paymentObj.amount} DH) pour votre commande ${order.reference} a été validé. La production démarre.`,
            { includeClient: true, includePartner: true, includeAdmins: true, includeAssigned: true }
          );
        } else {
          order.status = 'SOLDE_PAYE'; // ready for delivery!
          await notifyOrderStakeholders(
            db,
            order,
            'Solde validé',
            `Le paiement du solde (${paymentObj.amount} DH) pour votre commande ${order.reference} a été validé. Commande prête pour livraison.`,
            { includeClient: true, includePartner: true, includeAdmins: true, includeAssigned: true }
          );
        }

        await logAction(userId, userName, 'Validation paiement', `Paiement ${paymentObj.reference} de ${paymentObj.amount} DH validé pour la commande ${order.reference}.`);
      } else {
        paymentObj.status = 'rejected';
        paymentObj.notes = `Refusé par l'administrateur.`;
        await notifyOrderStakeholders(
          db,
          order,
          'Paiement rejeté',
          `Le paiement de ${paymentObj.amount} DH pour votre commande ${order.reference} a été rejeté. Veuillez vérifier vos justificatifs.`,
          { includeClient: true, includePartner: true, includeAdmins: true, includeAssigned: false }
        );
        await logAction(userId, userName, 'Refus paiement', `Paiement ${paymentObj.reference} refusé pour la commande ${order.reference}.`);
      }

      order.updatedAt = new Date().toISOString();
    }

    await saveDatabase(db);
    res.json({ order, quote, payments: db.payments.filter(p => p.orderId === order.id) });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Dashboard statistics
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const { role, userId } = req.query;
    const db = await loadDatabase();

    let filteredOrders = db.orders;
    if (role === 'partner') {
      filteredOrders = db.orders.filter(o => o.partnerId === userId);
    } else if (role === 'client') {
      const userObj = db.users.find(u => u.id === userId);
      if (userObj) {
        filteredOrders = db.orders.filter(o => o.customerDetails.email === userObj.email);
      }
    } else if (role === 'operator') {
      filteredOrders = db.orders.filter(o => o.tasks.some(t => t.operatorId === userId));
    } else if (role === 'qa') {
      filteredOrders = db.orders.filter(o => o.tasks.some(t => t.qaId === userId));
    }

    // Counts
    const stats = {
      total: filteredOrders.length,
      brouillon: filteredOrders.filter(o => o.status === 'BROUILLON').length,
      demandes: filteredOrders.filter(o => o.status === 'DEMANDE_ENVOYEE' || o.status === 'EN_ATTENTE_ANALYSE').length,
      devis: filteredOrders.filter(o => o.status === 'DEVIS_EN_PREPARATION' || o.status === 'DEVIS_ENVOYE').length,
      enCours: filteredOrders.filter(o => o.status === 'ACOMPTE_PAYE' || o.status === 'EN_FILE_ATTENTE' || o.status === 'EN_TRAITEMENT').length,
      qualityControl: filteredOrders.filter(o => o.status === 'CONTROLE_QUALITE').length,
      completed: filteredOrders.filter(o => o.status === 'TRAVAIL_TERMINE' || o.status === 'SOLDE_PAYE' || o.status === 'PRET_A_LIVRER').length,
      done: filteredOrders.filter(o => o.status === 'TERMINE' || o.status === 'LIVRE').length,
      annules: filteredOrders.filter(o => o.status === 'ANNULE' || o.status === 'REFUSE').length,
      urgent: filteredOrders.filter(o => o.urgency === 'urgent' || o.urgency === 'very_urgent').length,
      // Finances
      caTotal: 0,
      acomptesRecus: 0,
      soldesAttente: 0,
      commissionTotal: 0
    };

    // Calculate finances
    const allQuotes = db.quotes;
    const orderIdsFiltered = new Set(filteredOrders.map(o => o.id));

    allQuotes.forEach(q => {
      if (orderIdsFiltered.has(q.orderId)) {
        if (q.status === 'accepted') {
          stats.caTotal += q.totalAmount;
          stats.acomptesRecus += q.depositAmount;
          stats.soldesAttente += q.balanceAmount;
          if (role === 'partner') {
            stats.commissionTotal += q.totalAmount * 0.20; // 20% partner commission simulated
          }
        }
      }
    });

    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Audit Logs Endpoint
app.get('/api/audit-logs', async (req, res) => {
  try {
    const db = await loadDatabase();
    res.json(db.auditLogs);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Settings Endpoints
app.get('/api/settings', async (req, res) => {
  try {
    const db = await loadDatabase();
    res.json(db.settings);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/settings', async (req, res) => {
  try {
    const settings = req.body;
    const { userId, userName } = req.query;
    const db = await loadDatabase();
    db.settings = { ...db.settings, ...settings };
    await saveDatabase(db);
    await logAction(
      (userId as string) || 'admin',
      (userName as string) || 'Administrateur',
      'Mise à jour paramètres',
      'Paramètres système mis à jour.'
    );
    res.json(db.settings);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Reset Database Endpoint
app.post('/api/reset', async (req, res) => {
  try {
    const { userId, userName } = req.body;
    await resetDatabase();
    await logAction(userId || 'system', userName || 'Système', 'Réinitialisation', 'Base de données réinitialisée aux valeurs de démonstration.');
    res.json({ success: true, message: 'Base de données réinitialisée.' });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// --- SMART AI ASSISTANT ENDPOINTS (GEMINI INTEGRATION) ---

let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env['GEMINI_API_KEY'];
    if (!key) {
      throw new Error("Clé GEMINI_API_KEY non configurée. Veuillez ajouter votre clé API Gemini dans l'onglet Paramètres > Secrets d'AI Studio.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

function parseBase64Part(base64WithHeader: string) {
  if (!base64WithHeader) return null;
  const match = base64WithHeader.match(/^data:([^;]+);base64,(.+)$/);
  if (match) {
    return {
      inlineData: {
        mimeType: match[1],
        data: match[2]
      }
    };
  }
  return {
    inlineData: {
      mimeType: "application/octet-stream",
      data: base64WithHeader
    }
  };
}

// Route 1: Document & Instructions Analysis
app.post('/api/ai/analyze-document', async (req, res) => {
  try {
    const { fileName, fileBase64, description } = req.body;
    
    // 1. Initialize Gemini Client
    let ai;
    try {
      ai = getAiClient();
    } catch (apiErr) {
      res.status(400).json({ error: (apiErr as Error).message });
      return;
    }

    // 2. Load Services to let Gemini choose the correct service
    const db = await loadDatabase();
    const services = db.services || [];
    const servicesListStr = services
      .filter(s => s.isActive)
      .map(s => `- ID: ${s.id} | Nom: ${s.name} | Catégorie: ${s.category} | Description: ${s.description} | Prix: ${s.unitPrice} DH par ${s.unitPriceName}`)
      .join('\n');

    // 3. Formulate Prompt & Part list
    const parts: ({ text: string } | { inlineData: { mimeType: string; data: string } })[] = [];
    
    if (fileBase64) {
      const filePart = parseBase64Part(fileBase64);
      if (filePart) {
        parts.push(filePart);
      }
    }

    const promptText = `Analyse l'élément joint (fichier: ${fileName || 'inconnu'}) et les consignes utilisateur fournies pour recommander le service le plus adapté et extraire les métadonnées de volume et de configuration.
Consignes écrites de l'utilisateur :
"${description || '(Aucune consigne écrite fournie. Analyse le document directement.)'}"

Catalogue des services disponibles (Sélectionne strictement un ID parmi ceux-là) :
${servicesListStr}

Instructions pour l'extraction :
1. Détecte la langue principale.
2. Estime le nombre de pages (Page count) ou de mots à traiter.
3. Analyse la lisibilité générale (FACILE, MOYEN, DIFFICILE, ILLISIBLE).
4. Sélectionne l'ID exact du service recommandé (ex: "srv-saisie-1").
5. Rédige un descriptif clair, structuré et professionnel ("optimizedDescription") destiné à l'opérateur en français.
6. Recommande 2 ou 3 options de mise en page.`;

    parts.push({ text: promptText });

    // 4. Call Gemini 3.7 Flash with JSON schema
    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: parts,
      config: {
        systemInstruction: "Tu es un expert en traitement de documents et numérisation. Tu analyses avec précision les scans, manuscrits et consignes.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            detectedLanguage: { type: Type.STRING, description: "Langue principale du texte" },
            estimatedPageCount: { type: Type.INTEGER, description: "Estimation réaliste du nombre de pages" },
            estimatedWordCount: { type: Type.INTEGER, description: "Estimation réaliste du nombre de mots" },
            readability: { type: Type.STRING, description: "FACILE, MOYEN, DIFFICILE ou ILLISIBLE" },
            recommendedServiceId: { type: Type.STRING, description: "ID exact du service choisi dans la liste" },
            optimizedDescription: { type: Type.STRING, description: "Détail structuré en français pour l'opérateur" },
            optionsRecommended: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "Options conseillées" 
            }
          },
          required: ["detectedLanguage", "estimatedPageCount", "estimatedWordCount", "readability", "recommendedServiceId", "optimizedDescription", "optionsRecommended"]
        }
      }
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("L'IA n'a pas retourné de réponse valide.");
    }

    const analysisResult = JSON.parse(resultText.trim());
    res.json(analysisResult);

  } catch (err) {
    console.error('Error during AI analysis:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

// Route 2: Spec Sheet (Cahier des charges) Generation for Operator
app.post('/api/ai/draft-spec', async (req, res) => {
  try {
    const { orderId } = req.body;
    if (!orderId) {
      res.status(400).json({ error: "L'ID de la commande est requis." });
      return;
    }

    // Initialize Gemini
    let ai;
    try {
      ai = getAiClient();
    } catch (apiErr) {
      res.status(400).json({ error: (apiErr as Error).message });
      return;
    }

    const db = await loadDatabase();
    const order = db.orders.find(o => o.id === orderId);
    if (!order) {
      res.status(404).json({ error: "Commande introuvable." });
      return;
    }

    const promptText = `Génère un Cahier des Charges (Spec Sheet) complet et ultra-professionnel au format Markdown pour l'opérateur qui va traiter cette commande à distance.
Référence de la commande : ${order.reference}
Service demandé : ${order.serviceName} (Catégorie : ${order.serviceCategory})
Volume : ${order.quantity} unités
Urgence : ${order.urgency}
Description originale :
"${order.description}"

Le document Markdown doit obligatoirement inclure :
- # CAHIER DES CHARGES - [RÉFÉRENCE]
- ## 1. Objectifs & Attendus du Client
- ## 2. Règles d'Or Typographiques & Orthographiques (spécifiques à la catégorie de service: ${order.serviceCategory})
- ## 3. Étapes de Production Recommandées (pas à pas précis)
- ## 4. Liste de Contrôle d'Autovérification (Checklist) avant soumission au QA.

Rends le texte engageant, précis, et rédigé dans un français impeccable. Ne mets aucun texte introductif avant le titre H1 Markdown.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: promptText,
    });

    res.json({ specSheet: response.text });

  } catch (err) {
    console.error('Error drafting spec sheet:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

// Route 3: AI Copywriter / Assistant for Client Communications & Team Notes
app.post('/api/ai/message-assistant', async (req, res) => {
  try {
    const { orderId, instruction } = req.body;
    if (!orderId || !instruction) {
      res.status(400).json({ error: "L'ID de la commande et l'instruction de rédaction sont requis." });
      return;
    }

    // Initialize Gemini
    let ai;
    try {
      ai = getAiClient();
    } catch (apiErr) {
      res.status(400).json({ error: (apiErr as Error).message });
      return;
    }

    const db = await loadDatabase();
    const order = db.orders.find(o => o.id === orderId);
    if (!order) {
      res.status(404).json({ error: "Commande introuvable." });
      return;
    }

    // Get message history context
    const messagesContext = (order.messages || [])
      .map(m => `[${m.senderRole.toUpperCase()}] ${m.senderName}: ${m.message}`)
      .join('\n');

    const promptText = `Tu es l'assistant de communication intelligent de "Remix Gestion de Travaux Numériques à Distance". Ton but est de rédiger un message de réponse ou une note interne selon l'instruction suivante de l'équipe de production.

Commande : ${order.reference} | Service : ${order.serviceName} | Statut actuel : ${order.status}
Instruction de rédaction : "${instruction}"

Historique de la conversation :
${messagesContext || '(Aucun message préalable)'}

Rédige uniquement le message final suggéré. Le ton doit être professionnel, courtois, clair et constructif.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: promptText,
    });

    res.json({ reply: response.text });

  } catch (err) {
    console.error('Error in message assistant:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

// --- STATIC FILES & ROUTING ---

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);

