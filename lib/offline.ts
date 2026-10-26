'use client'

// A simple key-value store using localStorage
export const localDB = {
  get: (key: string) => {
    if (typeof window === 'undefined') return null;
    const item = window.localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  },
  set: (key: string, value: any) => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(key, JSON.stringify(value));
  },
  remove: (key: string) => {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(key);
  }
};

// Specific functions for our offline feature

const VENDORS_CACHE_KEY = 'offline_vendors';
const PRODUCTS_CACHE_KEY = 'offline_products';
const UNSYNCED_RETURNS_KEY = 'unsynced_purchase_returns';

// --- Vendors Cache ---
export const getCachedVendors = () => localDB.get(VENDORS_CACHE_KEY) || [];
export const cacheVendors = (vendors: any[]) => localDB.set(VENDORS_CACHE_KEY, vendors);

// --- Products Cache ---
export const getCachedProducts = () => localDB.get(PRODUCTS_CACHE_KEY) || [];
export const cacheProducts = (products: any[]) => localDB.set(PRODUCTS_CACHE_KEY, products);


// --- Unsynced Purchase Returns ---
export const getUnsyncedReturns = () => localDB.get(UNSYNCED_RETURNS_KEY) || [];

export const saveReturnForSync = (newReturn: any) => {
  const returns = getUnsyncedReturns();
  // Add a status property for tracking
  newReturn.syncStatus = 'pending';
  newReturn.syncedAt = null;
  localDB.set(UNSYNCED_RETURNS_KEY, [...returns, newReturn]);
};

export const updateUnsyncedReturn = (invoiceNo: string, updates: Partial<{ syncStatus: string, error: string }>) => {
  const returns = getUnsyncedReturns();
  const returnIndex = returns.findIndex((r: any) => r.invoiceNo === invoiceNo);
  if (returnIndex > -1) {
    returns[returnIndex] = { ...returns[returnIndex], ...updates };
    localDB.set(UNSYNCED_RETURNS_KEY, returns);
  }
  return returns;
};

export const removeReturnFromSyncQueue = (invoiceNo: string) => {
    const returns = getUnsyncedReturns();
    const updatedReturns = returns.filter((r: any) => r.invoiceNo !== invoiceNo);
    localDB.set(UNSYNCED_RETURNS_KEY, updatedReturns);
    return updatedReturns;
};
