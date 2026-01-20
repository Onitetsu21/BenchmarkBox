/**
 * BenchmarkBox - Background Service Worker
 * Gestion des événements en arrière-plan
 */

const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

// Injection du content script à la demande
async function injectContentScript(tabId) {
  try {
    await browserAPI.scripting.executeScript({
      target: { tabId },
      files: ['content/extractor.js']
    });
    return true;
  } catch (error) {
    console.error('Erreur injection script:', error);
    return false;
  }
}

// Extraction des infos produit depuis l'onglet actif
async function extractFromTab(tabId) {
  try {
    // Injecter le script si nécessaire
    await injectContentScript(tabId);
    
    // Attendre un peu pour l'injection
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Demander l'extraction
    const response = await browserAPI.tabs.sendMessage(tabId, {
      action: 'extractProductInfo'
    });
    
    return response;
  } catch (error) {
    console.error('Erreur extraction:', error);
    
    // Fallback: récupérer au moins l'URL et le titre
    try {
      const tab = await browserAPI.tabs.get(tabId);
      return {
        name: tab.title?.split(/\s*[-|–—:]\s*/)[0]?.trim() || '',
        price: null,
        currency: 'EUR',
        url: tab.url,
        site: new URL(tab.url).hostname.replace('www.', '')
      };
    } catch {
      return null;
    }
  }
}

// Afficher une notification
function showNotification(title, message) {
  browserAPI.notifications.create({
    type: 'basic',
    iconUrl: browserAPI.runtime.getURL('icons/icon-96.png'),
    title,
    message
  });
}

// Écouter les raccourcis clavier
browserAPI.commands.onCommand.addListener(async (command) => {
  if (command === 'save-product') {
    try {
      // Récupérer l'onglet actif
      const [tab] = await browserAPI.tabs.query({ active: true, currentWindow: true });
      if (!tab) return;
      
      // Vérifier que c'est une page web
      if (!tab.url?.startsWith('http')) {
        showNotification('BenchmarkBox', 'Cette page ne peut pas être sauvegardée.');
        return;
      }
      
      // Extraire les infos
      const productInfo = await extractFromTab(tab.id);
      if (!productInfo) {
        showNotification('BenchmarkBox', 'Impossible d\'extraire les informations.');
        return;
      }
      
      // Stocker temporairement pour le popup
      await browserAPI.storage.local.set({
        pendingProduct: productInfo,
        pendingTimestamp: Date.now()
      });
      
      // Ouvrir le popup
      browserAPI.action.openPopup();
      
    } catch (error) {
      console.error('Erreur commande save-product:', error);
      showNotification('BenchmarkBox', 'Une erreur est survenue.');
    }
  }
});

// Écouter les messages du popup
browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'extractCurrentTab') {
    (async () => {
      const [tab] = await browserAPI.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.url?.startsWith('http')) {
        const info = await extractFromTab(tab.id);
        sendResponse(info);
      } else {
        sendResponse(null);
      }
    })();
    return true;
  }
  
  if (message.action === 'openTab') {
    browserAPI.tabs.create({ url: message.url });
    sendResponse({ success: true });
    return true;
  }
  
  if (message.action === 'showNotification') {
    showNotification(message.title, message.message);
    sendResponse({ success: true });
    return true;
  }
});

// Installation / Mise à jour
browserAPI.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('BenchmarkBox installé');
    // Initialiser le stockage si nécessaire
    browserAPI.storage.local.get('benchmarkbox', (result) => {
      if (!result.benchmarkbox) {
        browserAPI.storage.local.set({
          benchmarkbox: {
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
            settings: {
              defaultFolderId: 'default-unclassified',
              sortBy: 'date',
              sortOrder: 'desc'
            }
          }
        });
      }
    });
  }
});
