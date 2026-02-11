
/**
 * BTMS IndexedDB wrapper (no backend)
 */
const DB_NAME = 'btms';
const DB_VERSION = 1;

function uuid() {
  if (window.crypto?.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}
function genAccNo() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2,'0');
  const stamp = String(d.getFullYear()).slice(2) + pad(d.getMonth()+1) + pad(d.getDate());
  const rand = Math.floor(10000 + Math.random()*90000);
  return `ACC${stamp}${rand}`;
}

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('customers')) {
        const s = db.createObjectStore('customers', { keyPath: 'id' });
        s.createIndex('by_phone', 'phone', { unique: true });
      }
      if (!db.objectStoreNames.contains('accounts')) {
        const s = db.createObjectStore('accounts', { keyPath: 'accNo' });
        s.createIndex('by_customer', 'customerId', { unique: false });
      }
      if (!db.objectStoreNames.contains('txns')) {
        const s = db.createObjectStore('txns', { keyPath: 'id' });
        s.createIndex('by_accNo', 'accNo', { unique: false });
        s.createIndex('by_date', 'date', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function withStore(store, mode, fn) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const st = tx.objectStore(store);
    const result = fn(st);
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
  }));
}

// Customers
async function registerCustomer(name, phone, password) {
  if (!name || !phone || !password) throw new Error('All fields are required');
  const existing = await getCustomerByPhone(phone);
  if (existing) throw new Error('Phone already registered');
  const c = { id: uuid(), name, phone, password };
  await withStore('customers','readwrite', st => st.add(c));
  return c;
}
async function getCustomerByPhone(phone) {
  return withStore('customers','readonly', st => new Promise((resolve, reject) => {
    const idx = st.index('by_phone');
    const req = idx.get(phone);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  }));
}
async function loginCustomer(phone, password) {
  const c = await getCustomerByPhone(phone);
  if (!c || c.password !== password) throw new Error('Invalid credentials');
  return c;
}

// Accounts
async function getAccountsByCustomerId(customerId) {
  if (!customerId) return [];
  return withStore('accounts','readonly', st => new Promise((resolve, reject) => {
    const idx = st.index('by_customer');
    const req = idx.getAll(customerId);
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  }));
}
async function createAccount(customerId, type='SAVINGS') {
  if (!customerId) throw new Error('Missing customerId');
  // Check if user already has an account (one account per user policy)
  const existingAccounts = await getAccountsByCustomerId(customerId);
  if (existingAccounts.length > 0) {
    throw new Error('You already have an account. One account per user policy.');
  }
  const accNo = genAccNo();
  const a = { accNo, customerId, balance: 0, type };
  await withStore('accounts','readwrite', st => st.add(a));
  return a;
}
async function getAccount(accNo) {
  if (!accNo) return null;
  return withStore('accounts','readonly', st => new Promise((resolve, reject) => {
    const req = st.get(accNo);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  }));
}
async function updateAccount(a) {
  return withStore('accounts','readwrite', st => st.put(a));
}

// Transactions
async function addTxn(accNo, type, amount) {
  const t = { id: uuid(), accNo, type, amount: Number(amount), date: new Date().toISOString() };
  await withStore('txns','readwrite', st => st.add(t));
  return t;
}
async function listTxns(accNo) {
  return withStore('txns','readonly', st => new Promise((resolve, reject) => {
    const idx = st.index('by_accNo');
    const req = idx.getAll(IDBKeyRange.only(accNo));
    req.onsuccess = () => {
      const items = req.result || [];
      items.sort((a,b) => new Date(b.date) - new Date(a.date));
      resolve(items);
    };
    req.onerror = () => reject(req.error);
  }));
}

// Operations
async function deposit(accNo, amount) {
  amount = Number(amount);
  if (!accNo || !(amount > 0)) throw new Error('Invalid account or amount');
  const acc = await getAccount(accNo);
  if (!acc) throw new Error('Account not found');
  acc.balance = Number((acc.balance + amount).toFixed(2));
  await updateAccount(acc);
  await addTxn(accNo, 'DEPOSIT', amount);
  return acc;
}
async function withdraw(accNo, amount) {
  amount = Number(amount);
  if (!accNo || !(amount > 0)) throw new Error('Invalid account or amount');
  const acc = await getAccount(accNo);
  if (!acc) throw new Error('Account not found');
  if (acc.balance < amount) throw new Error('Insufficient balance');
  acc.balance = Number((acc.balance - amount).toFixed(2));
  await updateAccount(acc);
  await addTxn(accNo, 'WITHDRAW', amount);
  return acc;
}
async function transfer(fromAccNo, toAccNo, amount) {
  amount = Number(amount);
  if (!fromAccNo || !toAccNo || fromAccNo === toAccNo) throw new Error('Invalid accounts');
  if (!(amount > 0)) throw new Error('Invalid amount');
  const from = await getAccount(fromAccNo);
  const to   = await getAccount(toAccNo);
  if (!from || !to) throw new Error('Account not found');
  if (from.balance < amount) throw new Error('Insufficient balance');
  from.balance = Number((from.balance - amount).toFixed(2));
  to.balance   = Number((to.balance + amount).toFixed(2));
  await withStore('accounts','readwrite', st => { st.put(from); st.put(to); });
  await addTxn(fromAccNo, 'TRANSFER_OUT', amount);
  await addTxn(toAccNo,   'TRANSFER_IN',  amount);
  return { from, to };
}
async function accountTransfer(customerId, fromAccNo, toAccNo, amount) {
  amount = Number(amount);
  if (!customerId || !fromAccNo || !toAccNo || fromAccNo === toAccNo) throw new Error('Invalid accounts');
  if (!(amount > 0)) throw new Error('Invalid amount');
  const from = await getAccount(fromAccNo);
  const to   = await getAccount(toAccNo);
  if (!from || !to) throw new Error('Account not found');
  // Verify both accounts belong to the same customer
  if (from.customerId !== customerId || to.customerId !== customerId) {
    throw new Error('Both accounts must belong to your profile');
  }
  if (from.balance < amount) throw new Error('Insufficient balance');
  from.balance = Number((from.balance - amount).toFixed(2));
  to.balance   = Number((to.balance + amount).toFixed(2));
  await withStore('accounts','readwrite', st => { st.put(from); st.put(to); });
  await addTxn(fromAccNo, 'ACCOUNT_TRANSFER_OUT', amount);
  await addTxn(toAccNo,   'ACCOUNT_TRANSFER_IN',  amount);
  return { from, to };
}

window.BTMS = {
  registerCustomer, loginCustomer,
  createAccount, getAccount, getAccountsByCustomerId, deposit, withdraw, transfer, accountTransfer, listTxns
};
