/**
 * BenchmarkBox - Popup Script
 * Version 1.3.0 - Single file, well organized
 */

// ============================================
// GLOBAL STATE
// ============================================

const state = {
  folders: [],
  tags: [],
  products: [],
  shoppingLists: [],
  settings: {},
  currentFolderId: null,
  currentShoppingListId: null,
  currentTab: 'folders',
  filters: {
    search: '',
    tagIds: [],
    site: '',
    priceMin: null,
    priceMax: null
  },
  sort: {
    by: 'date',
    order: 'desc'
  }
};

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
  console.log('BenchmarkBox: Initializing...');
  
  try {
    setupEventListeners();
    console.log('BenchmarkBox: Event listeners ready');
    
    await loadData();
    console.log('BenchmarkBox: Data loaded', state);
    
    renderFolders();
    renderProducts();
    renderShoppingLists();
    
    checkPendingProduct();
    console.log('BenchmarkBox: Ready!');
  } catch (error) {
    console.error('BenchmarkBox: Initialization error:', error);
  }
});

async function loadData() {
  try {
    const data = await Storage.getAllData();
    state.folders = data.folders || [];
    state.tags = data.tags || [];
    state.products = data.products || [];
    state.shoppingLists = data.shoppingLists || [];
    state.settings = data.settings || {};
    state.sort.by = state.settings.sortBy || 'date';
    state.sort.order = state.settings.sortOrder || 'desc';
    
    const sortSelect = document.getElementById('sort-select');
    if (sortSelect) {
      sortSelect.value = `${state.sort.by}-${state.sort.order}`;
    }
  } catch (error) {
    console.error('BenchmarkBox: Error loading data:', error);
    state.folders = [{
      id: 'default-unclassified',
      name: 'Non classé',
      color: '#6b7280',
      description: 'Produits non classés',
      isDefault: true,
      isSystem: true,
      createdAt: new Date().toISOString()
    }];
    state.tags = [];
    state.products = [];
    state.shoppingLists = [];
    state.settings = { defaultFolderId: 'default-unclassified', sortBy: 'date', sortOrder: 'desc' };
  }
}

async function checkPendingProduct() {
  const result = await browserAPI.storage.local.get(['pendingProduct', 'pendingTimestamp']);
  if (result.pendingProduct && result.pendingTimestamp) {
    if (Date.now() - result.pendingTimestamp < 5000) {
      openProductModal(null, result.pendingProduct);
    }
    await browserAPI.storage.local.remove(['pendingProduct', 'pendingTimestamp']);
  }
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
  // Header buttons
  document.getElementById('btn-settings').addEventListener('click', openSettingsModal);
  document.getElementById('btn-add-product').addEventListener('click', () => extractAndAddProduct());
  document.getElementById('btn-add-folder').addEventListener('click', () => openFolderModal());
  
  // Tabs
  document.getElementById('tab-folders').addEventListener('click', () => switchTab('folders'));
  document.getElementById('tab-shopping').addEventListener('click', () => switchTab('shopping'));
  
  // Search
  const searchInput = document.getElementById('search-input');
  searchInput.addEventListener('input', Utils.debounce((e) => {
    state.filters.search = e.target.value;
    renderProducts();
  }, 200));
  
  // Filters
  document.getElementById('btn-filters').addEventListener('click', () => {
    const panel = document.getElementById('filters-panel');
    panel.classList.toggle('bb-hidden');
    if (!panel.classList.contains('bb-hidden')) {
      populateFilters();
    }
  });
  
  document.getElementById('btn-apply-filters').addEventListener('click', applyFilters);
  document.getElementById('btn-clear-filters').addEventListener('click', clearFilters);
  
  // Sort
  document.getElementById('sort-select').addEventListener('change', (e) => {
    const [by, order] = e.target.value.split('-');
    state.sort.by = by;
    state.sort.order = order;
    Storage.updateSettings({ sortBy: by, sortOrder: order });
    renderProducts();
  });
  
  // Forms
  document.getElementById('form-product').addEventListener('submit', handleProductSubmit);
  document.getElementById('form-folder').addEventListener('submit', handleFolderSubmit);
  
  // Folder actions
  const btnClearFolder = document.getElementById('btn-clear-folder');
  if (btnClearFolder) btnClearFolder.addEventListener('click', handleClearFolder);
  
  const btnOpenAllFolder = document.getElementById('btn-open-all-folder-links');
  if (btnOpenAllFolder) btnOpenAllFolder.addEventListener('click', handleOpenAllFolderLinks);
  
  const btnOpenAllList = document.getElementById('btn-open-all-list-links');
  if (btnOpenAllList) btnOpenAllList.addEventListener('click', handleOpenAllListLinks);
  
  // Color presets
  document.querySelectorAll('.bb-color-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('folder-color').value = btn.dataset.color;
    });
  });
  
  // Modal close
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const modal = e.target.closest('.bb-modal-overlay');
      if (modal) modal.classList.add('bb-hidden');
    });
  });
  
  document.querySelectorAll('.bb-modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.add('bb-hidden');
    });
  });
  
  // Context menu
  document.addEventListener('click', () => {
    document.getElementById('context-menu').classList.add('bb-hidden');
  });
  
  // Setup sub-modules
  setupTagsInput();
  setupSettingsListeners();
  setupShoppingListsListeners();
}

// ============================================
// TABS
// ============================================

function switchTab(tabName) {
  state.currentTab = tabName;
  
  document.querySelectorAll('.bb-tab').forEach(tab => {
    tab.classList.toggle('bb-tab-active', tab.dataset.tab === tabName);
  });
  
  document.querySelectorAll('.bb-tab-content').forEach(content => {
    content.classList.remove('bb-tab-content-active');
  });
  document.getElementById(`tab-content-${tabName}`).classList.add('bb-tab-content-active');
  
  if (tabName === 'shopping') {
    showShoppingListsOverview();
  }
}

// ============================================
// FILTERS
// ============================================

function populateFilters() {
  const tagsContainer = document.getElementById('filter-tags');
  tagsContainer.innerHTML = state.tags.map(tag => `
    <label class="bb-filter-tag">
      <input type="checkbox" value="${tag.id}" ${state.filters.tagIds.includes(tag.id) ? 'checked' : ''}>
      <span class="bb-tag-dot" style="background: ${tag.color}"></span>
      ${Utils.escapeHtml(tag.name)}
    </label>
  `).join('') || '<span class="bb-text-muted">Aucun tag</span>';
  
  const sites = [...new Set(state.products.map(p => p.site).filter(Boolean))];
  const siteSelect = document.getElementById('filter-site');
  siteSelect.innerHTML = '<option value="">Tous les sites</option>' +
    sites.map(site => `<option value="${site}" ${state.filters.site === site ? 'selected' : ''}>${site}</option>`).join('');
  
  document.getElementById('filter-price-min').value = state.filters.priceMin || '';
  document.getElementById('filter-price-max').value = state.filters.priceMax || '';
}

function applyFilters() {
  const tagsContainer = document.getElementById('filter-tags');
  state.filters.tagIds = [...tagsContainer.querySelectorAll('input:checked')].map(cb => cb.value);
  state.filters.site = document.getElementById('filter-site').value;
  state.filters.priceMin = parseFloat(document.getElementById('filter-price-min').value) || null;
  state.filters.priceMax = parseFloat(document.getElementById('filter-price-max').value) || null;
  
  renderProducts();
  document.getElementById('filters-panel').classList.add('bb-hidden');
}

function clearFilters() {
  state.filters = { search: '', tagIds: [], site: '', priceMin: null, priceMax: null };
  document.getElementById('search-input').value = '';
  renderProducts();
  document.getElementById('filters-panel').classList.add('bb-hidden');
}

// ============================================
// FOLDERS
// ============================================

function renderFolders() {
  const container = document.getElementById('folders-list');
  container.innerHTML = '';
  
  // "Tous" item
  const allItem = document.createElement('div');
  allItem.className = `bb-folder-item${!state.currentFolderId ? ' active' : ''}`;
  allItem.innerHTML = `
    <div class="bb-folder-item-color" style="background: var(--primary)"></div>
    <div class="bb-folder-item-info">
      <span class="bb-folder-item-name">Tous</span>
    </div>
    <div class="bb-folder-item-meta">
      <span class="bb-folder-item-count">${state.products.length}</span>
    </div>
  `;
  allItem.addEventListener('click', () => {
    state.currentFolderId = null;
    renderFolders();
    renderProducts();
  });
  container.appendChild(allItem);
  
  // Each folder
  state.folders.forEach(folder => {
    const count = state.products.filter(p => p.folderId === folder.id).length;
    const isActive = state.currentFolderId === folder.id;
    
    const folderProducts = state.products.filter(p => p.folderId === folder.id);
    let lastUpdate = folder.updatedAt || folder.createdAt;
    if (folderProducts.length > 0) {
      const dates = folderProducts.map(p => new Date(p.updatedAt || p.createdAt));
      lastUpdate = new Date(Math.max(...dates));
    }
    
    const el = document.createElement('div');
    el.className = `bb-folder-item${isActive ? ' active' : ''}`;
    el.dataset.folderId = folder.id;
    
    el.innerHTML = `
      <div class="bb-folder-item-color" style="background: ${folder.color}"></div>
      <div class="bb-folder-item-info">
        <span class="bb-folder-item-name">${folder.isDefault ? '⭐ ' : ''}${Utils.escapeHtml(folder.name)}</span>
      </div>
      <div class="bb-folder-item-meta">
        <span class="bb-folder-item-date">${Utils.formatRelativeDate(lastUpdate)}</span>
        <span class="bb-folder-item-count">${count}</span>
      </div>
    `;
    
    el.addEventListener('click', () => {
      state.currentFolderId = state.currentFolderId === folder.id ? null : folder.id;
      renderFolders();
      renderProducts();
    });
    
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (!folder.isSystem) showFolderContextMenu(e, folder);
    });
    
    container.appendChild(el);
  });
}

function showFolderContextMenu(e, folder) {
  const menu = document.getElementById('context-menu');
  menu.innerHTML = `
    <button class="bb-context-menu-item" data-action="edit-folder">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
      </svg>
      Modifier
    </button>
    <button class="bb-context-menu-item danger" data-action="delete-folder">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="3 6 5 6 21 6"/>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
      </svg>
      Supprimer
    </button>
  `;
  
  menu.style.left = `${Math.min(e.pageX, window.innerWidth - 180)}px`;
  menu.style.top = `${Math.min(e.pageY, window.innerHeight - 100)}px`;
  menu.classList.remove('bb-hidden');
  
  menu.querySelector('[data-action="edit-folder"]').onclick = () => {
    menu.classList.add('bb-hidden');
    openFolderModal(folder);
  };
  
  menu.querySelector('[data-action="delete-folder"]').onclick = async () => {
    menu.classList.add('bb-hidden');
    Utils.showConfirm(`Supprimer "${folder.name}" ?`, async () => {
      await Storage.deleteFolder(folder.id);
      if (state.currentFolderId === folder.id) state.currentFolderId = null;
      await loadData();
      renderFolders();
      renderProducts();
      Utils.showToast('Dossier supprimé');
    });
  };
}

function openFolderModal(folder = null) {
  const modal = document.getElementById('modal-folder');
  const title = document.getElementById('modal-folder-title');
  const form = document.getElementById('form-folder');
  
  form.reset();
  
  if (folder) {
    title.textContent = 'Modifier le dossier';
    document.getElementById('folder-id').value = folder.id;
    document.getElementById('folder-name').value = folder.name;
    document.getElementById('folder-color').value = folder.color;
    document.getElementById('folder-description').value = folder.description || '';
    document.getElementById('folder-is-default').checked = folder.isDefault;
  } else {
    title.textContent = 'Nouveau dossier';
    document.getElementById('folder-id').value = '';
    document.getElementById('folder-color').value = Utils.generateRandomColor();
    document.getElementById('folder-is-default').checked = false;
  }
  
  modal.classList.remove('bb-hidden');
  document.getElementById('folder-name').focus();
}

async function handleFolderSubmit(e) {
  e.preventDefault();
  
  const id = document.getElementById('folder-id').value;
  const name = document.getElementById('folder-name').value.trim();
  const color = document.getElementById('folder-color').value;
  const description = document.getElementById('folder-description').value.trim();
  const isDefault = document.getElementById('folder-is-default').checked;
  
  if (!name) {
    Utils.showToast('Le nom est requis', 'error');
    return;
  }
  
  try {
    if (id) {
      await Storage.updateFolder(id, { name, color, description, isDefault });
    } else {
      await Storage.createFolder({ name, color, description, isDefault });
    }
    
    await loadData();
    renderFolders();
    document.getElementById('modal-folder').classList.add('bb-hidden');
    Utils.showToast(id ? 'Dossier modifié' : 'Dossier créé');
  } catch (error) {
    console.error('Erreur:', error);
    Utils.showToast('Une erreur est survenue', 'error');
  }
}

async function handleClearFolder() {
  if (!state.currentFolderId) return;
  
  const folder = state.folders.find(f => f.id === state.currentFolderId);
  if (!folder) return;
  
  const count = state.products.filter(p => p.folderId === state.currentFolderId).length;
  
  Utils.showConfirm(`Supprimer les ${count} produit(s) du dossier "${folder.name}" ?`, async () => {
    const productsToDelete = state.products.filter(p => p.folderId === state.currentFolderId);
    for (const product of productsToDelete) {
      await Storage.deleteProduct(product.id);
    }
    await loadData();
    renderFolders();
    renderProducts();
    Utils.showToast(`${count} produit(s) supprimé(s)`);
  });
}

async function handleOpenAllFolderLinks() {
  let products = state.products;
  if (state.currentFolderId) {
    products = products.filter(p => p.folderId === state.currentFolderId);
  }
  
  const urls = products.filter(p => p.url).map(p => p.url);
  
  if (urls.length === 0) {
    Utils.showToast('Aucun lien à ouvrir', 'warning');
    return;
  }
  
  if (urls.length > 10) {
    Utils.showConfirm(`Ouvrir ${urls.length} onglets ?`, () => {
      urls.forEach(url => browserAPI.runtime.sendMessage({ action: 'openTab', url }));
    });
  } else {
    urls.forEach(url => browserAPI.runtime.sendMessage({ action: 'openTab', url }));
  }
}

// ============================================
// PRODUCTS
// ============================================

function renderProducts() {
  console.log('renderProducts: Starting...', { productsCount: state.products.length, currentFolderId: state.currentFolderId });

  const container = document.getElementById('products-list');
  const emptyState = document.getElementById('products-empty');
  const titleSpan = document.getElementById('products-folder-name');
  const clearBtn = document.getElementById('btn-clear-folder');
  const openAllBtn = document.getElementById('btn-open-all-folder-links');

  if (!container) {
    console.error('renderProducts: products-list container not found!');
    return;
  }

  // Update title
  if (state.currentFolderId) {
    const folder = state.folders.find(f => f.id === state.currentFolderId);
    titleSpan.textContent = folder ? folder.name : 'Produits';
  } else {
    titleSpan.textContent = 'Tous les produits';
  }

  // Filter
  let products = [...state.products];
  console.log('renderProducts: Initial products:', products.length);
  
  if (state.currentFolderId) {
    products = products.filter(p => p.folderId === state.currentFolderId);
  }
  
  if (clearBtn) {
    clearBtn.classList.toggle('bb-hidden', !(state.currentFolderId && products.length > 0));
  }
  
  if (openAllBtn) {
    openAllBtn.classList.toggle('bb-hidden', products.length === 0);
  }
  
  if (state.filters.search) {
    const searchLower = state.filters.search.toLowerCase();
    products = products.filter(p => {
      return p.name.toLowerCase().includes(searchLower) ||
             p.notes?.toLowerCase().includes(searchLower) ||
             (p.tagIds || []).some(tid => {
               const tag = state.tags.find(t => t.id === tid);
               return tag?.name.toLowerCase().includes(searchLower);
             });
    });
  }
  
  if (state.filters.tagIds?.length > 0) {
    products = products.filter(p => state.filters.tagIds.some(tid => (p.tagIds || []).includes(tid)));
  }
  
  if (state.filters.site) {
    products = products.filter(p => p.site === state.filters.site);
  }
  
  if (state.filters.priceMin !== null) {
    products = products.filter(p => p.price >= state.filters.priceMin);
  }
  
  if (state.filters.priceMax !== null) {
    products = products.filter(p => p.price <= state.filters.priceMax);
  }
  
  // Sort
  products.sort((a, b) => {
    let cmp = 0;
    switch (state.sort.by) {
      case 'price': cmp = a.price - b.price; break;
      case 'name': cmp = a.name.localeCompare(b.name); break;
      case 'site': cmp = a.site.localeCompare(b.site); break;
      default: cmp = new Date(a.createdAt) - new Date(b.createdAt);
    }
    return state.sort.order === 'desc' ? -cmp : cmp;
  });
  
  // Render
  console.log('renderProducts: After filters, products to render:', products.length);

  if (products.length === 0) {
    console.log('renderProducts: No products to show, displaying empty state');
    container.innerHTML = '';
    if (emptyState) emptyState.classList.remove('bb-hidden');
    return;
  }

  if (emptyState) emptyState.classList.add('bb-hidden');
  container.innerHTML = '';

  console.log('renderProducts: Rendering', products.length, 'products');
  products.forEach(product => {
    const el = document.createElement('div');
    el.className = 'bb-product-card';
    el.dataset.productId = product.id;
    
    const productTags = (product.tagIds || []).map(tid => state.tags.find(t => t.id === tid)).filter(Boolean);
    const listInfo = getProductShoppingListInfo(product.id);
    const folder = state.folders.find(f => f.id === product.folderId);
    const showFolderBadge = !state.currentFolderId && folder;
    
    let locationHtml = '';
    if (showFolderBadge || listInfo.count > 0) {
      locationHtml = '<div class="bb-product-location">';
      if (showFolderBadge) {
        locationHtml += `<span class="bb-product-badge bb-product-badge-folder"><span class="badge-dot" style="background:${folder.color}"></span>${Utils.escapeHtml(folder.name)}</span>`;
      }
      if (listInfo.count > 0) {
        locationHtml += `<span class="bb-product-badge bb-product-badge-list">🛒 ${listInfo.count}</span>`;
      }
      locationHtml += '</div>';
    }
    
    el.innerHTML = `
      <div class="bb-product-header">
        <span class="bb-product-name">${Utils.escapeHtml(Utils.truncate(product.name, 50))}</span>
        <span class="bb-product-price">${Utils.formatPrice(product.price, product.currency)}</span>
      </div>
      <div class="bb-product-meta">
        <span class="bb-product-site">🌐 ${product.site || 'N/A'}</span>
        <span class="bb-product-date">📅 ${Utils.formatRelativeDate(product.createdAt)}</span>
      </div>
      ${locationHtml}
      ${productTags.length > 0 ? `<div class="bb-product-tags">${productTags.map(tag => `<span class="bb-tag-mini" style="background:${tag.color}20;color:${tag.color}">${Utils.escapeHtml(tag.name)}</span>`).join('')}</div>` : ''}
      <div class="bb-product-actions">
        <button class="bb-product-action-btn${listInfo.count > 0 ? ' in-list' : ''}" data-action="cart" title="Ajouter au panier">🛒${listInfo.count > 0 ? `<span class="bb-cart-badge">${listInfo.count}</span>` : ''}</button>
        <button class="bb-product-action-btn" data-action="open" title="Ouvrir">🔗</button>
      </div>
    `;
    
    el.addEventListener('click', (e) => {
      if (!e.target.closest('button')) openProductModal(product);
    });
    
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showProductContextMenu(e, product);
    });
    
    el.querySelector('[data-action="cart"]').addEventListener('click', (e) => {
      e.stopPropagation();
      openAddToListModal(product);
    });
    
    el.querySelector('[data-action="open"]').addEventListener('click', (e) => {
      e.stopPropagation();
      if (product.url) {
        browserAPI.runtime.sendMessage({ action: 'openTab', url: product.url });
      } else {
        Utils.showToast('Aucun lien', 'warning');
      }
    });
    
    container.appendChild(el);
  });
}

async function extractAndAddProduct() {
  const addBtn = document.getElementById('btn-add-product');
  const originalHtml = addBtn.innerHTML;
  
  addBtn.innerHTML = `<span class="bb-spin">⏳</span> Extraction...`;
  addBtn.disabled = true;
  
  try {
    const tabs = await browserAPI.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    
    if (!tab || tab.url.startsWith('about:') || tab.url.startsWith('chrome:') || tab.url.startsWith('moz-extension:')) {
      Utils.showToast('Page non supportée', 'warning');
      openProductModal(null, { url: '' });
      return;
    }
    
    const response = await browserAPI.tabs.sendMessage(tab.id, { action: 'extract' });
    
    if (response?.success && response.data) {
      openProductModal(null, response.data);
    } else {
      openProductModal(null, { url: tab.url, name: tab.title || '' });
    }
  } catch (error) {
    console.error('Extraction error:', error);
    try {
      const tabs = await browserAPI.tabs.query({ active: true, currentWindow: true });
      openProductModal(null, { url: tabs[0]?.url || '', name: tabs[0]?.title || '' });
    } catch (e) {
      openProductModal();
    }
  } finally {
    addBtn.innerHTML = originalHtml;
    addBtn.disabled = false;
  }
}

function showProductContextMenu(e, product) {
  const menu = document.getElementById('context-menu');
  
  menu.innerHTML = `
    <button class="bb-context-menu-item" data-action="open">🔗 Ouvrir</button>
    <button class="bb-context-menu-item" data-action="edit">✏️ Modifier</button>
    <button class="bb-context-menu-item" data-action="move">📁 Déplacer</button>
    <button class="bb-context-menu-item" data-action="duplicate">📋 Dupliquer</button>
    <div class="bb-context-menu-divider"></div>
    <button class="bb-context-menu-item danger" data-action="delete">🗑️ Supprimer</button>
  `;
  
  menu.style.left = `${Math.min(e.clientX, window.innerWidth - 170)}px`;
  menu.style.top = `${Math.min(e.clientY, window.innerHeight - 200)}px`;
  menu.classList.remove('bb-hidden');
  
  menu.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      menu.classList.add('bb-hidden');
      
      switch (btn.dataset.action) {
        case 'open':
          if (product.url) browserAPI.runtime.sendMessage({ action: 'openTab', url: product.url });
          break;
        case 'edit':
          openProductModal(product);
          break;
        case 'move':
          openMoveModal(product, 'move');
          break;
        case 'duplicate':
          openMoveModal(product, 'duplicate');
          break;
        case 'delete':
          Utils.showConfirm(`Supprimer "${Utils.truncate(product.name, 30)}" ?`, async () => {
            await Storage.deleteProduct(product.id);
            await loadData();
            renderFolders();
            renderProducts();
            Utils.showToast('Produit supprimé');
          });
          break;
      }
    });
  });
}

function getProductShoppingListInfo(productId) {
  const lists = state.shoppingLists.filter(list => {
    if (!list.items || !Array.isArray(list.items)) return false;
    return list.items.some(item => item.productId === productId);
  });
  return { count: lists.length, lists };
}

// ============================================
// PRODUCT MODAL
// ============================================

function openProductModal(product = null, extractedData = null) {
  const modal = document.getElementById('modal-product');
  const title = document.getElementById('modal-product-title');
  const form = document.getElementById('form-product');
  
  form.reset();
  window.selectedTagIds = [];
  renderTagsInput([]);
  
  const folderSelect = document.getElementById('product-folder');
  const defaultFolderId = state.settings.defaultFolderId || state.folders[0]?.id;
  folderSelect.innerHTML = state.folders.map(f => `
    <option value="${f.id}" ${f.id === defaultFolderId ? 'selected' : ''}>
      ${f.isDefault ? '⭐ ' : ''}${Utils.escapeHtml(f.name)}
    </option>
  `).join('');
  
  if (product) {
    title.textContent = 'Modifier le produit';
    document.getElementById('product-id').value = product.id;
    document.getElementById('product-name').value = product.name;
    document.getElementById('product-price').value = product.price;
    document.getElementById('product-currency').value = product.currency || 'EUR';
    document.getElementById('product-url').value = product.url || '';
    document.getElementById('product-folder').value = product.folderId;
    document.getElementById('product-notes').value = product.notes || '';
    window.selectedTagIds = [...(product.tagIds || [])];
    renderTagsInput(product.tagIds || []);
  } else if (extractedData) {
    title.textContent = 'Ajouter un produit';
    document.getElementById('product-id').value = '';
    document.getElementById('product-name').value = extractedData.name || '';
    document.getElementById('product-price').value = extractedData.price || '';
    document.getElementById('product-currency').value = extractedData.currency || 'EUR';
    document.getElementById('product-url').value = extractedData.url || '';
    document.getElementById('product-notes').value = '';
    if (state.currentFolderId) {
      document.getElementById('product-folder').value = state.currentFolderId;
    }
  } else {
    title.textContent = 'Ajouter un produit';
    document.getElementById('product-id').value = '';
    if (state.currentFolderId) {
      document.getElementById('product-folder').value = state.currentFolderId;
    }
  }
  
  modal.classList.remove('bb-hidden');
  document.getElementById('product-name').focus();
}

async function handleProductSubmit(e) {
  e.preventDefault();
  
  const id = document.getElementById('product-id').value;
  const name = document.getElementById('product-name').value.trim();
  const price = parseFloat(document.getElementById('product-price').value) || 0;
  const currency = document.getElementById('product-currency').value;
  const url = document.getElementById('product-url').value.trim();
  const folderId = document.getElementById('product-folder').value;
  const notes = document.getElementById('product-notes').value.trim();
  const tagIds = window.selectedTagIds || [];
  
  if (!name) {
    Utils.showToast('Le nom est requis', 'error');
    return;
  }
  
  const site = url ? Utils.extractDomain(url) : 'manuel';
  
  try {
    if (id) {
      await Storage.updateProduct(id, { name, price, currency, url, site, folderId, tagIds, notes });
    } else {
      await Storage.createProduct({ name, price, currency, url, site, folderId, tagIds, notes });
    }
    
    await loadData();
    renderFolders();
    renderProducts();
    document.getElementById('modal-product').classList.add('bb-hidden');
    
    if (!id) {
      const addBtn = document.getElementById('btn-add-product');
      addBtn.classList.add('success');
      addBtn.innerHTML = `✓ Ajouté !`;
      setTimeout(() => {
        addBtn.classList.remove('success');
        addBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Ajouter`;
      }, 1500);
    }
    
    Utils.showToast(id ? 'Produit modifié' : 'Produit ajouté ✓', 'success');
  } catch (error) {
    console.error('Erreur:', error);
    Utils.showToast('Une erreur est survenue', 'error');
  }
}

// ============================================
// MOVE MODAL
// ============================================

function openMoveModal(product, action) {
  const modal = document.getElementById('modal-move');
  const title = document.getElementById('modal-move-title');
  const list = document.getElementById('move-folders-list');
  
  document.getElementById('move-product-id').value = product.id;
  document.getElementById('move-action').value = action;
  
  title.textContent = action === 'move' ? 'Déplacer vers' : 'Dupliquer dans';
  
  list.innerHTML = state.folders.map(folder => {
    const isCurrent = folder.id === product.folderId && action === 'move';
    return `
      <button class="bb-move-folder-item${isCurrent ? ' disabled' : ''}" data-folder-id="${folder.id}" ${isCurrent ? 'disabled' : ''}>
        <span class="bb-folder-dot" style="background:${folder.color}"></span>
        ${Utils.escapeHtml(folder.name)}
        ${isCurrent ? '<span class="bb-badge">Actuel</span>' : ''}
      </button>
    `;
  }).join('');
  
  list.querySelectorAll('.bb-move-folder-item:not(.disabled)').forEach(btn => {
    btn.addEventListener('click', async () => {
      const productId = document.getElementById('move-product-id').value;
      const folderId = btn.dataset.folderId;
      const moveAction = document.getElementById('move-action').value;
      
      try {
        if (moveAction === 'move') {
          await Storage.updateProduct(productId, { folderId });
          Utils.showToast('Produit déplacé');
        } else {
          const original = state.products.find(p => p.id === productId);
          if (original) {
            const { id, createdAt, updatedAt, ...data } = original;
            await Storage.createProduct({ ...data, folderId });
            Utils.showToast('Produit dupliqué');
          }
        }
        
        await loadData();
        renderFolders();
        renderProducts();
        modal.classList.add('bb-hidden');
      } catch (error) {
        Utils.showToast('Erreur', 'error');
      }
    });
  });
  
  modal.classList.remove('bb-hidden');
}

// ============================================
// TAGS INPUT
// ============================================

function setupTagsInput() {
  const input = document.getElementById('product-tags-input');
  const dropdown = document.getElementById('tags-dropdown');
  
  if (!input || !dropdown) return;
  
  input.addEventListener('focus', () => {
    renderTagsDropdown();
    dropdown.classList.remove('bb-hidden');
  });
  
  input.addEventListener('input', () => renderTagsDropdown(input.value));
  
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const value = input.value.trim();
      if (value) {
        createAndAddTag(value);
        input.value = '';
      }
    }
  });
  
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.bb-tags-input-wrapper')) {
      dropdown.classList.add('bb-hidden');
    }
  });
}

function renderTagsDropdown(search = '') {
  const dropdown = document.getElementById('tags-dropdown');
  const selectedIds = window.selectedTagIds || [];
  
  let tags = state.tags.filter(t => !selectedIds.includes(t.id));
  
  if (search) {
    tags = tags.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));
  }
  
  if (tags.length === 0) {
    dropdown.innerHTML = search 
      ? `<div class="bb-tags-dropdown-empty">Entrée pour créer "${search}"</div>`
      : '<div class="bb-tags-dropdown-empty">Aucun tag</div>';
    return;
  }
  
  dropdown.innerHTML = tags.map(tag => `
    <button type="button" class="bb-tags-dropdown-item" data-tag-id="${tag.id}">
      <span class="bb-tag-dot" style="background:${tag.color}"></span>
      ${Utils.escapeHtml(tag.name)}
    </button>
  `).join('');
  
  dropdown.querySelectorAll('.bb-tags-dropdown-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const tagId = btn.dataset.tagId;
      if (!window.selectedTagIds.includes(tagId)) {
        window.selectedTagIds.push(tagId);
        renderTagsInput(window.selectedTagIds);
        renderTagsDropdown();
      }
    });
  });
}

function renderTagsInput(tagIds) {
  const container = document.getElementById('selected-tags');
  if (!container) return;
  
  container.innerHTML = '';
  
  tagIds.forEach(tagId => {
    const tag = state.tags.find(t => t.id === tagId);
    if (tag) {
      const el = document.createElement('span');
      el.className = 'bb-selected-tag';
      el.style.background = `${tag.color}20`;
      el.style.color = tag.color;
      el.innerHTML = `${Utils.escapeHtml(tag.name)} <button type="button" data-tag-id="${tag.id}">&times;</button>`;
      
      el.querySelector('button').addEventListener('click', () => {
        window.selectedTagIds = window.selectedTagIds.filter(id => id !== tagId);
        renderTagsInput(window.selectedTagIds);
      });
      
      container.appendChild(el);
    }
  });
}

async function createAndAddTag(name) {
  try {
    const tag = await Storage.createTag({ name, color: Utils.generateRandomColor() });
    await loadData();
    
    if (!window.selectedTagIds.includes(tag.id)) {
      window.selectedTagIds.push(tag.id);
      renderTagsInput(window.selectedTagIds);
    }
    
    document.getElementById('tags-dropdown').classList.add('bb-hidden');
  } catch (error) {
    Utils.showToast('Erreur création tag', 'error');
  }
}

// ============================================
// SHOPPING LISTS
// ============================================

function setupShoppingListsListeners() {
  const btnAddList = document.getElementById('btn-add-shopping-list');
  if (btnAddList) btnAddList.addEventListener('click', () => openShoppingListModal());
  
  const formList = document.getElementById('form-shopping-list');
  if (formList) formList.addEventListener('submit', handleShoppingListSubmit);
  
  document.querySelectorAll('input[name="planned-date-type"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      const customDateInput = document.getElementById('shopping-list-custom-date');
      if (customDateInput) customDateInput.classList.toggle('bb-hidden', e.target.value !== 'custom');
    });
  });
  
  const btnClear = document.getElementById('btn-clear-shopping-list');
  if (btnClear) btnClear.addEventListener('click', handleClearShoppingList);
  
  const btnCreateFromModal = document.getElementById('btn-create-list-from-modal');
  if (btnCreateFromModal) {
    btnCreateFromModal.addEventListener('click', () => {
      document.getElementById('modal-add-to-list').classList.add('bb-hidden');
      openShoppingListModal();
    });
  }
  
  const btnConfirmAdd = document.getElementById('btn-confirm-add-to-list');
  if (btnConfirmAdd) btnConfirmAdd.addEventListener('click', handleConfirmAddToList);
}

function renderShoppingLists() {
  const container = document.getElementById('shopping-lists-container');
  if (!container) return;

  container.innerHTML = '';

  // "Tous" item
  const allItem = document.createElement('div');
  allItem.className = `bb-shopping-list-item${!state.currentShoppingListId ? ' active' : ''}`;

  const allItemsCount = state.shoppingLists.reduce((sum, list) => {
    const items = list.items || [];
    return sum + items.length;
  }, 0);

  allItem.innerHTML = `
    <div class="bb-shopping-list-item-info">
      <span class="bb-shopping-list-item-name">Toutes les listes</span>
    </div>
    <div class="bb-shopping-list-item-meta">
      <span class="bb-shopping-list-item-count">${allItemsCount}</span>
    </div>
  `;
  allItem.addEventListener('click', () => {
    state.currentShoppingListId = null;
    renderShoppingLists();
    renderShoppingListItems(null);
  });
  container.appendChild(allItem);

  // Each shopping list
  state.shoppingLists.forEach(list => {
    const items = list.items || [];
    const isActive = state.currentShoppingListId === list.id;

    const el = document.createElement('div');
    el.className = `bb-shopping-list-item${isActive ? ' active' : ''}`;
    el.dataset.listId = list.id;

    const total = items.reduce((sum, item) => {
      const product = state.products.find(p => p.id === item.productId);
      return sum + (product?.price || 0);
    }, 0);

    el.innerHTML = `
      <div class="bb-shopping-list-item-info">
        <span class="bb-shopping-list-item-name">${Utils.escapeHtml(list.name)}</span>
        <span class="bb-shopping-list-item-total">${Utils.formatPrice(total, list.currency || 'EUR')}</span>
      </div>
      <div class="bb-shopping-list-item-meta">
        <span class="bb-shopping-list-item-date">${list.plannedDate ? Utils.formatRelativeDate(list.plannedDate) : 'Pas de date'}</span>
        <span class="bb-shopping-list-item-count">${items.length}</span>
      </div>
    `;

    el.addEventListener('click', () => {
      state.currentShoppingListId = state.currentShoppingListId === list.id ? null : list.id;
      renderShoppingLists();
      renderShoppingListItems(list);
    });

    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showShoppingListContextMenu(e, list);
    });

    container.appendChild(el);
  });
}

async function handleClearShoppingList() {
  if (!state.currentShoppingListId) return;

  const list = state.shoppingLists.find(l => l.id === state.currentShoppingListId);
  if (!list) return;

  Utils.showConfirm(`Vider la liste "${list.name}" ?`, async () => {
    await Storage.clearShoppingList(list.id);
    await loadData();
    renderShoppingLists();
    const updatedList = state.shoppingLists.find(l => l.id === state.currentShoppingListId);
    if (updatedList) {
      renderShoppingListItems(updatedList);
    }
    Utils.showToast('Liste vidée');
  });
}

function renderShoppingListItems(list) {
  const container = document.getElementById('shopping-list-items');
  const emptyState = document.getElementById('shopping-list-items-empty');
  const titleSpan = document.getElementById('shopping-products-list-name');
  const clearBtn = document.getElementById('btn-clear-shopping-list');
  const openAllBtn = document.getElementById('btn-open-all-list-links');

  if (!container) return;

  // Update title
  if (titleSpan) {
    if (list) {
      titleSpan.textContent = list.name;
    } else {
      titleSpan.textContent = 'Tous les produits';
    }
  }

  // Get products
  let products = [];
  if (list) {
    const items = list.items || [];
    products = items.map(item => state.products.find(p => p.id === item.productId)).filter(Boolean);
  } else {
    // Show all products from all lists
    const allProductIds = new Set();
    state.shoppingLists.forEach(sl => {
      const items = sl.items || [];
      items.forEach(item => allProductIds.add(item.productId));
    });
    products = state.products.filter(p => allProductIds.has(p.id));
  }

  // Show/hide buttons
  if (clearBtn) {
    clearBtn.classList.toggle('bb-hidden', !list || products.length === 0);
  }

  if (openAllBtn) {
    openAllBtn.classList.toggle('bb-hidden', products.length === 0);
  }

  // Render
  if (products.length === 0) {
    container.innerHTML = '';
    if (emptyState) emptyState.classList.remove('bb-hidden');
    return;
  }

  if (emptyState) emptyState.classList.add('bb-hidden');
  container.innerHTML = '';

  products.forEach(product => {
    const el = document.createElement('div');
    el.className = 'bb-shopping-product-card';
    el.dataset.productId = product.id;

    // Find which lists contain this product
    const listsWithProduct = state.shoppingLists.filter(sl => {
      const items = sl.items || [];
      return items.some(item => item.productId === product.id);
    });

    el.innerHTML = `
      <div class="bb-shopping-product-header">
        <span class="bb-shopping-product-name">${Utils.escapeHtml(Utils.truncate(product.name, 40))}</span>
        <span class="bb-shopping-product-price">${Utils.formatPrice(product.price, product.currency)}</span>
      </div>
      <div class="bb-shopping-product-meta">
        <span class="bb-shopping-product-site">🌐 ${product.site || 'N/A'}</span>
        ${listsWithProduct.length > 1 ? `<span class="bb-shopping-product-lists">📋 ${listsWithProduct.length} listes</span>` : ''}
      </div>
      <div class="bb-shopping-product-actions">
        <button class="bb-shopping-product-action-btn" data-action="open" title="Ouvrir">🔗</button>
        ${list ? `<button class="bb-shopping-product-action-btn bb-btn-danger" data-action="remove" title="Retirer de la liste">✕</button>` : ''}
      </div>
    `;

    el.addEventListener('click', (e) => {
      if (!e.target.closest('button')) openProductModal(product);
    });

    el.querySelector('[data-action="open"]').addEventListener('click', (e) => {
      e.stopPropagation();
      if (product.url) {
        browserAPI.runtime.sendMessage({ action: 'openTab', url: product.url });
      } else {
        Utils.showToast('Aucun lien', 'warning');
      }
    });

    if (list) {
      const removeBtn = el.querySelector('[data-action="remove"]');
      if (removeBtn) {
        removeBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          await Storage.removeProductFromShoppingList(list.id, product.id);
          await loadData();
          renderShoppingLists();
          renderShoppingListItems(list);
          Utils.showToast('Produit retiré');
        });
      }
    }

    container.appendChild(el);
  });
}

function openShoppingListModal(list = null) {
  const modal = document.getElementById('modal-shopping-list');
  const title = document.getElementById('modal-shopping-list-title');
  const form = document.getElementById('form-shopping-list');
  
  form.reset();
  
  if (list) {
    title.textContent = 'Modifier la liste';
    document.getElementById('shopping-list-id').value = list.id;
    document.getElementById('shopping-list-name').value = list.name;
    document.getElementById('shopping-list-budget').value = list.maxBudget || '';
    document.getElementById('shopping-list-currency').value = list.currency || 'EUR';
    if (list.plannedDate) {
      document.getElementById('date-type-custom').checked = true;
      document.getElementById('shopping-list-custom-date').classList.remove('bb-hidden');
      document.getElementById('shopping-list-custom-date').value = list.plannedDate.split('T')[0];
    } else {
      document.getElementById('date-type-none').checked = true;
      document.getElementById('shopping-list-custom-date').classList.add('bb-hidden');
    }
  } else {
    title.textContent = 'Nouvelle liste';
    document.getElementById('shopping-list-id').value = '';
    document.getElementById('date-type-none').checked = true;
    document.getElementById('shopping-list-custom-date').classList.add('bb-hidden');
  }
  
  modal.classList.remove('bb-hidden');
  document.getElementById('shopping-list-name').focus();
}

async function handleShoppingListSubmit(e) {
  e.preventDefault();

  const id = document.getElementById('shopping-list-id').value;
  const name = document.getElementById('shopping-list-name').value.trim();
  const budgetInput = document.getElementById('shopping-list-budget').value;
  const maxBudget = budgetInput ? parseFloat(budgetInput) : null;
  const currency = document.getElementById('shopping-list-currency').value;

  const dateType = document.querySelector('input[name="planned-date-type"]:checked')?.value;
  let plannedDate = null;

  if (dateType === 'this_week') {
    const endOfWeek = new Date();
    endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay()));
    plannedDate = endOfWeek.toISOString();
  } else if (dateType === 'next_week') {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + (7 - nextWeek.getDay()) + 7);
    plannedDate = nextWeek.toISOString();
  } else if (dateType === 'this_month') {
    const endOfMonth = new Date();
    endOfMonth.setMonth(endOfMonth.getMonth() + 1, 0);
    plannedDate = endOfMonth.toISOString();
  } else if (dateType === 'next_month') {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 2, 0);
    plannedDate = nextMonth.toISOString();
  } else if (dateType === 'custom') {
    const customDate = document.getElementById('shopping-list-custom-date').value;
    if (customDate) plannedDate = new Date(customDate).toISOString();
  }

  if (!name) {
    Utils.showToast('Le nom est requis', 'error');
    return;
  }

  try {
    if (id) {
      await Storage.updateShoppingList(id, { name, maxBudget, currency, plannedDate });
    } else {
      await Storage.createShoppingList({ name, maxBudget, currency, plannedDate });
    }

    await loadData();
    renderShoppingLists();
    document.getElementById('modal-shopping-list').classList.add('bb-hidden');
    Utils.showToast(id ? 'Liste modifiée' : 'Liste créée');
  } catch (error) {
    console.error('Erreur:', error);
    Utils.showToast('Une erreur est survenue', 'error');
  }
}

function showShoppingListContextMenu(e, list) {
  const menu = document.getElementById('context-menu');
  menu.innerHTML = `
    <button class="bb-context-menu-item" data-action="edit">✏️ Modifier</button>
    <button class="bb-context-menu-item danger" data-action="delete">🗑️ Supprimer</button>
  `;
  
  menu.style.left = `${Math.min(e.pageX, window.innerWidth - 180)}px`;
  menu.style.top = `${Math.min(e.pageY, window.innerHeight - 100)}px`;
  menu.classList.remove('bb-hidden');
  
  menu.querySelector('[data-action="edit"]').onclick = () => {
    menu.classList.add('bb-hidden');
    openShoppingListModal(list);
  };
  
  menu.querySelector('[data-action="delete"]').onclick = () => {
    menu.classList.add('bb-hidden');
    Utils.showConfirm(`Supprimer "${list.name}" ?`, async () => {
      await Storage.deleteShoppingList(list.id);
      await loadData();
      renderShoppingLists();
      renderProducts();
      Utils.showToast('Liste supprimée');
    });
  };
}

async function handleClearShoppingList() {
  if (!state.currentShoppingListId) return;
  const list = state.shoppingLists.find(l => l.id === state.currentShoppingListId);
  if (!list) return;
  
  Utils.showConfirm(`Vider "${list.name}" ?`, async () => {
    for (const item of list.items) {
      await Storage.removeProductFromShoppingList(list.id, item.productId);
    }
    await loadData();
    const updatedList = state.shoppingLists.find(l => l.id === list.id);
    if (updatedList) {
      renderShoppingListItems(updatedList);
      renderProducts();
    }
    Utils.showToast('Liste vidée');
  });
}

async function handleOpenAllListLinks() {
  if (!state.currentShoppingListId) return;
  const list = state.shoppingLists.find(l => l.id === state.currentShoppingListId);
  if (!list) return;
  
  const urls = list.items
    .map(item => state.products.find(p => p.id === item.productId))
    .filter(p => p?.url)
    .map(p => p.url);
  
  if (urls.length === 0) {
    Utils.showToast('Aucun lien', 'warning');
    return;
  }
  
  if (urls.length > 10) {
    Utils.showConfirm(`Ouvrir ${urls.length} onglets ?`, () => {
      urls.forEach(url => browserAPI.runtime.sendMessage({ action: 'openTab', url }));
    });
  } else {
    urls.forEach(url => browserAPI.runtime.sendMessage({ action: 'openTab', url }));
  }
}

// ============================================
// ADD TO LIST MODAL
// ============================================

function openAddToListModal(product) {
  const modal = document.getElementById('modal-add-to-list');
  const list = document.getElementById('add-to-list-options');
  
  document.getElementById('add-to-list-product-id').value = product.id;
  
  if (state.shoppingLists.length === 0) {
    list.innerHTML = '<p class="bb-text-muted">Aucune liste. Créez-en une !</p>';
  } else {
    list.innerHTML = state.shoppingLists.map(sl => {
      const items = sl.items || [];
      const isInList = items.some(item => item.productId === product.id);
      return `
        <label class="bb-list-option">
          <input type="checkbox" value="${sl.id}" ${isInList ? 'checked' : ''}>
          <span class="bb-list-option-info">
            <span class="bb-list-option-name">${Utils.escapeHtml(sl.name)}</span>
            <span class="bb-list-option-meta">${items.length} produit(s)</span>
          </span>
        </label>
      `;
    }).join('');
  }
  
  modal.classList.remove('bb-hidden');
}

async function handleConfirmAddToList() {
  const productId = document.getElementById('add-to-list-product-id').value;
  const checkboxes = document.querySelectorAll('#add-to-list-options input[type="checkbox"]');
  
  let added = 0, removed = 0;
  
  for (const cb of checkboxes) {
    const listId = cb.value;
    const list = state.shoppingLists.find(l => l.id === listId);
    if (!list) continue;

    const items = list.items || [];
    const isIn = items.some(item => item.productId === productId);

    if (cb.checked && !isIn) {
      await Storage.addProductToShoppingList(listId, productId);
      added++;
    } else if (!cb.checked && isIn) {
      await Storage.removeProductFromShoppingList(listId, productId);
      removed++;
    }
  }
  
  await loadData();
  renderProducts();
  renderShoppingLists();
  document.getElementById('modal-add-to-list').classList.add('bb-hidden');
  
  if (added > 0 || removed > 0) {
    const msg = [];
    if (added > 0) msg.push(`Ajouté à ${added} liste(s)`);
    if (removed > 0) msg.push(`Retiré de ${removed} liste(s)`);
    Utils.showToast(msg.join(', '));
  }
}

// ============================================
// SETTINGS
// ============================================

function openSettingsModal() {
  const modal = document.getElementById('modal-settings');
  
  const defaultFolderSelect = document.getElementById('settings-default-folder');
  defaultFolderSelect.innerHTML = state.folders.map(f => `
    <option value="${f.id}" ${f.id === state.settings.defaultFolderId ? 'selected' : ''}>
      ${f.isDefault ? '⭐ ' : ''}${Utils.escapeHtml(f.name)}
    </option>
  `).join('');
  
  renderSettingsTags();
  
  document.getElementById('stats-folders').textContent = state.folders.length;
  document.getElementById('stats-products').textContent = state.products.length;
  document.getElementById('stats-tags').textContent = state.tags.length;
  document.getElementById('stats-lists').textContent = state.shoppingLists.length;
  
  modal.classList.remove('bb-hidden');
}

function renderSettingsTags() {
  const container = document.getElementById('settings-tags-list');
  
  if (state.tags.length === 0) {
    container.innerHTML = '<p class="bb-text-muted">Aucun tag</p>';
    return;
  }
  
  container.innerHTML = state.tags.map(tag => `
    <div class="bb-settings-tag-item" data-tag-id="${tag.id}">
      <span class="bb-tag-dot" style="background:${tag.color}"></span>
      <span>${Utils.escapeHtml(tag.name)}</span>
      <button type="button" title="Supprimer">✕</button>
    </div>
  `).join('');
  
  container.querySelectorAll('.bb-settings-tag-item button').forEach(btn => {
    btn.addEventListener('click', async () => {
      const tagId = btn.closest('.bb-settings-tag-item').dataset.tagId;
      const tag = state.tags.find(t => t.id === tagId);
      Utils.showConfirm(`Supprimer "${tag.name}" ?`, async () => {
        await Storage.deleteTag(tagId);
        await loadData();
        renderSettingsTags();
        renderProducts();
      });
    });
  });
}

function setupSettingsListeners() {
  const defaultFolderSelect = document.getElementById('settings-default-folder');
  if (defaultFolderSelect) {
    defaultFolderSelect.addEventListener('change', async (e) => {
      await Storage.updateSettings({ defaultFolderId: e.target.value });
      state.settings.defaultFolderId = e.target.value;
    });
  }
  
  document.getElementById('btn-add-tag').addEventListener('click', async () => {
    const nameInput = document.getElementById('settings-new-tag');
    const colorInput = document.getElementById('settings-new-tag-color');
    const name = nameInput.value.trim();
    if (!name) return;
    
    await Storage.createTag({ name, color: colorInput.value });
    await loadData();
    renderSettingsTags();
    nameInput.value = '';
    colorInput.value = Utils.generateRandomColor();
  });
  
  document.getElementById('btn-export').addEventListener('click', async () => {
    const data = await Storage.exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `benchmarkbox-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    Utils.showToast('Exporté');
  });
  
  document.getElementById('btn-import').addEventListener('click', () => {
    document.getElementById('import-file').click();
  });
  
  document.getElementById('import-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      const success = await Storage.importData(text);
      if (success) {
        await loadData();
        renderFolders();
        renderProducts();
        renderShoppingLists();
        Utils.showToast('Importé');
      } else {
        Utils.showToast('Fichier invalide', 'error');
      }
    } catch (error) {
      Utils.showToast('Erreur import', 'error');
    }
    e.target.value = '';
  });
  
  document.getElementById('btn-reset').addEventListener('click', () => {
    Utils.showConfirm('Supprimer TOUTES les données ?', async () => {
      await Storage.resetData();
      await loadData();
      state.currentFolderId = null;
      state.filters = { search: '', tagIds: [], site: '', priceMin: null, priceMax: null };
      renderFolders();
      renderProducts();
      renderShoppingLists();
      document.getElementById('modal-settings').classList.add('bb-hidden');
      Utils.showToast('Réinitialisé');
    });
  });
}
