/**
 * BenchmarkBox - Storage Module
 * Gestion du stockage local avec API unifiée cross-browser
 */

// Détection de l'API browser (Firefox) ou chrome (Chrome/Edge)
// Using var to make it globally accessible across scripts
var browserAPI = typeof browser !== 'undefined' ? browser : chrome;
console.log('Storage: browserAPI loaded:', typeof browserAPI !== 'undefined' ? 'OK' : 'MISSING');

/**
 * Structure des données:
 * {
 *   folders: [],
 *   tags: [],
 *   products: [],
 *   shoppingLists: [],
 *   settings: {}
 * }
 */

const DEFAULT_DATA = {
  folders: [
    {
      id: 'default-unclassified',
      name: 'Non classé',
      color: '#6b7280',
      description: 'Produits non classés',
      isDefault: true,
      isSystem: true,
      createdAt: new Date().toISOString()
    }
  ],
  tags: [],
  products: [],
  shoppingLists: [],
  settings: {
    defaultFolderId: 'default-unclassified',
    sortBy: 'date',
    sortOrder: 'desc'
  }
};

/**
 * Génère un UUID v4
 */
function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Récupère toutes les données
 */
async function getAllData() {
  try {
    console.log('Storage: Getting all data...');
    const result = await browserAPI.storage.local.get('benchmarkbox');
    console.log('Storage: Raw result:', result);
    
    if (!result || !result.benchmarkbox) {
      console.log('Storage: No existing data, initializing with defaults');
      await browserAPI.storage.local.set({ benchmarkbox: DEFAULT_DATA });
      return { ...DEFAULT_DATA };
    }
    return result.benchmarkbox;
  } catch (error) {
    console.error('Storage: Error in getAllData:', error);
    return { ...DEFAULT_DATA };
  }
}

/**
 * Sauvegarde toutes les données
 */
async function saveAllData(data) {
  try {
    await browserAPI.storage.local.set({ benchmarkbox: data });
    return true;
  } catch (error) {
    console.error('Erreur saveAllData:', error);
    return false;
  }
}

// ============================================
// FOLDERS CRUD
// ============================================

async function getFolders() {
  const data = await getAllData();
  return data.folders;
}

async function getFolder(id) {
  const folders = await getFolders();
  return folders.find(f => f.id === id);
}

async function createFolder({ name, color = '#f97316', description = '' }) {
  const data = await getAllData();
  const folder = {
    id: generateId(),
    name,
    color,
    description,
    isDefault: false,
    isSystem: false,
    createdAt: new Date().toISOString()
  };
  data.folders.push(folder);
  await saveAllData(data);
  return folder;
}

async function updateFolder(id, updates) {
  const data = await getAllData();
  const index = data.folders.findIndex(f => f.id === id);
  if (index === -1) return null;
  
  // Ne pas permettre la modification du dossier système
  if (data.folders[index].isSystem && updates.name) {
    delete updates.name;
  }
  
  data.folders[index] = { ...data.folders[index], ...updates };
  await saveAllData(data);
  return data.folders[index];
}

async function deleteFolder(id, moveProductsTo = 'default-unclassified') {
  const data = await getAllData();
  const folder = data.folders.find(f => f.id === id);
  
  if (!folder || folder.isSystem) return false;
  
  // Déplacer les produits
  data.products = data.products.map(p => {
    if (p.folderId === id) {
      return { ...p, folderId: moveProductsTo };
    }
    return p;
  });
  
  // Supprimer le dossier
  data.folders = data.folders.filter(f => f.id !== id);
  
  // Si c'était le dossier par défaut, remettre "Non classé"
  if (data.settings.defaultFolderId === id) {
    data.settings.defaultFolderId = 'default-unclassified';
  }
  
  await saveAllData(data);
  return true;
}

async function setDefaultFolder(id) {
  const data = await getAllData();
  
  // Enlever l'ancien défaut
  data.folders = data.folders.map(f => ({ ...f, isDefault: f.id === id }));
  data.settings.defaultFolderId = id;
  
  await saveAllData(data);
  return true;
}

async function getDefaultFolder() {
  const data = await getAllData();
  return data.folders.find(f => f.id === data.settings.defaultFolderId) || data.folders[0];
}

// ============================================
// TAGS CRUD
// ============================================

async function getTags() {
  const data = await getAllData();
  return data.tags;
}

async function getTag(id) {
  const tags = await getTags();
  return tags.find(t => t.id === id);
}

async function createTag({ name, color = '#f97316' }) {
  const data = await getAllData();
  
  // Vérifier si le tag existe déjà
  const existing = data.tags.find(t => t.name.toLowerCase() === name.toLowerCase());
  if (existing) return existing;
  
  const tag = {
    id: generateId(),
    name,
    color
  };
  data.tags.push(tag);
  await saveAllData(data);
  return tag;
}

async function updateTag(id, updates) {
  const data = await getAllData();
  const index = data.tags.findIndex(t => t.id === id);
  if (index === -1) return null;
  
  data.tags[index] = { ...data.tags[index], ...updates };
  await saveAllData(data);
  return data.tags[index];
}

async function deleteTag(id) {
  const data = await getAllData();
  
  // Retirer le tag de tous les produits
  data.products = data.products.map(p => ({
    ...p,
    tagIds: p.tagIds.filter(tid => tid !== id)
  }));
  
  // Supprimer le tag
  data.tags = data.tags.filter(t => t.id !== id);
  
  await saveAllData(data);
  return true;
}

// ============================================
// PRODUCTS CRUD
// ============================================

async function getProducts(filters = {}) {
  const data = await getAllData();
  let products = [...data.products];
  
  // Filtre par dossier
  if (filters.folderId) {
    products = products.filter(p => p.folderId === filters.folderId);
  }
  
  // Filtre par tag(s)
  if (filters.tagIds && filters.tagIds.length > 0) {
    products = products.filter(p => 
      filters.tagIds.some(tid => p.tagIds.includes(tid))
    );
  }
  
  // Filtre par site
  if (filters.site) {
    products = products.filter(p => p.site === filters.site);
  }
  
  // Filtre par prix
  if (filters.priceMin !== undefined) {
    products = products.filter(p => p.price >= filters.priceMin);
  }
  if (filters.priceMax !== undefined) {
    products = products.filter(p => p.price <= filters.priceMax);
  }
  
  // Filtre par date
  if (filters.dateFrom) {
    products = products.filter(p => new Date(p.createdAt) >= new Date(filters.dateFrom));
  }
  if (filters.dateTo) {
    products = products.filter(p => new Date(p.createdAt) <= new Date(filters.dateTo));
  }
  
  // Recherche textuelle
  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    const tags = data.tags;
    products = products.filter(p => {
      const nameMatch = p.name.toLowerCase().includes(searchLower);
      const notesMatch = p.notes && p.notes.toLowerCase().includes(searchLower);
      const tagMatch = p.tagIds.some(tid => {
        const tag = tags.find(t => t.id === tid);
        return tag && tag.name.toLowerCase().includes(searchLower);
      });
      return nameMatch || notesMatch || tagMatch;
    });
  }
  
  // Tri
  const sortBy = filters.sortBy || data.settings.sortBy || 'date';
  const sortOrder = filters.sortOrder || data.settings.sortOrder || 'desc';
  
  products.sort((a, b) => {
    let comparison = 0;
    switch (sortBy) {
      case 'price':
        comparison = a.price - b.price;
        break;
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'site':
        comparison = a.site.localeCompare(b.site);
        break;
      case 'date':
      default:
        comparison = new Date(a.createdAt) - new Date(b.createdAt);
    }
    return sortOrder === 'desc' ? -comparison : comparison;
  });
  
  return products;
}

async function getProduct(id) {
  const data = await getAllData();
  return data.products.find(p => p.id === id);
}

async function getProductByUrl(url) {
  const data = await getAllData();
  return data.products.find(p => p.url === url);
}

async function createProduct({ name, price, currency = 'EUR', url, site, folderId, tagIds = [], notes = '' }) {
  const data = await getAllData();
  
  // Utiliser le dossier par défaut si non spécifié
  const finalFolderId = folderId || data.settings.defaultFolderId;
  
  const product = {
    id: generateId(),
    name,
    price: parseFloat(price) || 0,
    currency,
    url,
    site,
    folderId: finalFolderId,
    tagIds,
    notes,
    createdAt: new Date().toISOString()
  };
  
  data.products.push(product);
  await saveAllData(data);
  return product;
}

async function updateProduct(id, updates) {
  const data = await getAllData();
  const index = data.products.findIndex(p => p.id === id);
  if (index === -1) return null;
  
  if (updates.price !== undefined) {
    updates.price = parseFloat(updates.price) || 0;
  }
  
  data.products[index] = { ...data.products[index], ...updates };
  await saveAllData(data);
  return data.products[index];
}

async function deleteProduct(id) {
  const data = await getAllData();
  data.products = data.products.filter(p => p.id !== id);
  await saveAllData(data);
  return true;
}

async function moveProduct(id, newFolderId) {
  return updateProduct(id, { folderId: newFolderId });
}

async function duplicateProduct(id, toFolderId) {
  const product = await getProduct(id);
  if (!product) return null;
  
  const { id: _, createdAt, ...productData } = product;
  return createProduct({ ...productData, folderId: toFolderId });
}

async function clearFolderProducts(folderId) {
  const data = await getAllData();
  data.products = data.products.filter(p => p.folderId !== folderId);
  await saveAllData(data);
  return true;
}

// ============================================
// SHOPPING LISTS CRUD
// ============================================

async function getShoppingLists() {
  const data = await getAllData();
  return data.shoppingLists || [];
}

async function getShoppingList(id) {
  const lists = await getShoppingLists();
  return lists.find(l => l.id === id);
}

async function createShoppingList(listData) {
  const data = await getAllData();
  if (!data.shoppingLists) {
    data.shoppingLists = [];
  }
  
  const newList = {
    id: generateId(),
    name: listData.name || 'Nouvelle liste',
    budgetMax: listData.budgetMax || null,
    currency: listData.currency || 'EUR',
    plannedDate: listData.plannedDate || null,
    plannedDateType: listData.plannedDateType || 'none',
    productIds: listData.productIds || [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  data.shoppingLists.push(newList);
  await saveAllData(data);
  return newList;
}

async function updateShoppingList(id, updates) {
  const data = await getAllData();
  if (!data.shoppingLists) return null;
  
  const index = data.shoppingLists.findIndex(l => l.id === id);
  if (index === -1) return null;
  
  data.shoppingLists[index] = { 
    ...data.shoppingLists[index], 
    ...updates,
    updatedAt: new Date().toISOString()
  };
  await saveAllData(data);
  return data.shoppingLists[index];
}

async function deleteShoppingList(id) {
  const data = await getAllData();
  if (!data.shoppingLists) return false;
  
  data.shoppingLists = data.shoppingLists.filter(l => l.id !== id);
  await saveAllData(data);
  return true;
}

async function addProductToShoppingList(listId, productId) {
  const data = await getAllData();
  if (!data.shoppingLists) return false;
  
  const listIndex = data.shoppingLists.findIndex(l => l.id === listId);
  if (listIndex === -1) return false;
  
  // Avoid duplicates
  if (!data.shoppingLists[listIndex].productIds.includes(productId)) {
    data.shoppingLists[listIndex].productIds.push(productId);
    data.shoppingLists[listIndex].updatedAt = new Date().toISOString();
    await saveAllData(data);
  }
  return true;
}

async function removeProductFromShoppingList(listId, productId) {
  const data = await getAllData();
  if (!data.shoppingLists) return false;
  
  const listIndex = data.shoppingLists.findIndex(l => l.id === listId);
  if (listIndex === -1) return false;
  
  data.shoppingLists[listIndex].productIds = 
    data.shoppingLists[listIndex].productIds.filter(id => id !== productId);
  data.shoppingLists[listIndex].updatedAt = new Date().toISOString();
  await saveAllData(data);
  return true;
}

async function clearShoppingList(listId) {
  const data = await getAllData();
  if (!data.shoppingLists) return false;
  
  const listIndex = data.shoppingLists.findIndex(l => l.id === listId);
  if (listIndex === -1) return false;
  
  data.shoppingLists[listIndex].productIds = [];
  data.shoppingLists[listIndex].updatedAt = new Date().toISOString();
  await saveAllData(data);
  return true;
}

async function getProductShoppingLists(productId) {
  const data = await getAllData();
  if (!data.shoppingLists) return [];
  
  return data.shoppingLists.filter(l => l.productIds.includes(productId));
}

async function getShoppingListTotal(listId) {
  const data = await getAllData();
  const list = data.shoppingLists?.find(l => l.id === listId);
  if (!list) return { total: 0, currency: 'EUR', hasMixedCurrencies: false };
  
  const products = data.products.filter(p => list.productIds.includes(p.id));
  
  // Check for mixed currencies
  const currencies = [...new Set(products.map(p => p.currency || 'EUR'))];
  const hasMixedCurrencies = currencies.length > 1;
  
  // Sum all prices (converting to EUR conceptually - just summing for now)
  const total = products.reduce((sum, p) => sum + (p.price || 0), 0);
  
  return {
    total,
    currency: list.currency || 'EUR',
    hasMixedCurrencies,
    productCount: products.length
  };
}

// ============================================
// SETTINGS
// ============================================

async function getSettings() {
  const data = await getAllData();
  return data.settings;
}

async function updateSettings(updates) {
  const data = await getAllData();
  data.settings = { ...data.settings, ...updates };
  await saveAllData(data);
  return data.settings;
}

// ============================================
// UTILITIES
// ============================================

async function getAllSites() {
  const data = await getAllData();
  const sites = [...new Set(data.products.map(p => p.site))];
  return sites.sort();
}

async function getProductCountByFolder(folderId) {
  const data = await getAllData();
  return data.products.filter(p => p.folderId === folderId).length;
}

async function exportData() {
  const data = await getAllData();
  return JSON.stringify(data, null, 2);
}

async function importData(jsonString) {
  try {
    const data = JSON.parse(jsonString);
    if (data.folders && data.tags && data.products) {
      await saveAllData(data);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

async function resetData() {
  await saveAllData({ ...DEFAULT_DATA });
  return true;
}

// Export pour utilisation dans d'autres modules
if (typeof window !== 'undefined') {
  window.Storage = {
    // Data
    getAllData,
    saveAllData,
    
    // Folders
    getFolders,
    getFolder,
    createFolder,
    updateFolder,
    deleteFolder,
    setDefaultFolder,
    getDefaultFolder,
    
    // Tags
    getTags,
    getTag,
    createTag,
    updateTag,
    deleteTag,
    
    // Products
    getProducts,
    getProduct,
    getProductByUrl,
    createProduct,
    updateProduct,
    deleteProduct,
    moveProduct,
    duplicateProduct,
    clearFolderProducts,
    
    // Shopping Lists
    getShoppingLists,
    getShoppingList,
    createShoppingList,
    updateShoppingList,
    deleteShoppingList,
    addProductToShoppingList,
    removeProductFromShoppingList,
    clearShoppingList,
    getProductShoppingLists,
    getShoppingListTotal,
    
    // Settings
    getSettings,
    updateSettings,
    
    // Utilities
    getAllSites,
    getProductCountByFolder,
    exportData,
    importData,
    resetData,
    generateId
  };
  console.log('Storage: Module loaded and exported to window.Storage');
}
