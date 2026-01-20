/**
 * BenchmarkBox - Content Script Extractor
 * Extraction intelligente des informations produit depuis la page
 */

(function() {
  /**
   * Stratégies d'extraction par ordre de priorité
   */
  const extractionStrategies = {
    
    // 1. Schema.org JSON-LD
    schemaOrg: () => {
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (const script of scripts) {
        try {
          const data = JSON.parse(script.textContent);
          const products = findProducts(data);
          if (products.length > 0) {
            const product = products[0];
            return {
              name: product.name,
              price: extractPrice(product.offers),
              currency: extractCurrency(product.offers)
            };
          }
        } catch (e) {
          continue;
        }
      }
      return null;
    },
    
    // 2. Open Graph
    openGraph: () => {
      const ogTitle = document.querySelector('meta[property="og:title"]');
      const ogPrice = document.querySelector('meta[property="product:price:amount"], meta[property="og:price:amount"]');
      const ogCurrency = document.querySelector('meta[property="product:price:currency"], meta[property="og:price:currency"]');
      
      if (ogTitle || ogPrice) {
        return {
          name: ogTitle?.content || null,
          price: ogPrice?.content ? parseFloat(ogPrice.content) : null,
          currency: ogCurrency?.content || 'EUR'
        };
      }
      return null;
    },
    
    // 3. Meta tags standard
    metaTags: () => {
      const title = document.querySelector('meta[name="title"]')?.content ||
                   document.querySelector('meta[name="product:name"]')?.content;
      const price = document.querySelector('meta[name="price"]')?.content ||
                   document.querySelector('meta[name="product:price"]')?.content;
      
      if (title || price) {
        return {
          name: title || null,
          price: price ? parseFloat(price.replace(/[^\d.,]/g, '').replace(',', '.')) : null,
          currency: 'EUR'
        };
      }
      return null;
    },
    
    // 4. Microdata
    microdata: () => {
      const productElement = document.querySelector('[itemtype*="schema.org/Product"], [itemtype*="Product"]');
      if (productElement) {
        const name = productElement.querySelector('[itemprop="name"]');
        const price = productElement.querySelector('[itemprop="price"]');
        const currency = productElement.querySelector('[itemprop="priceCurrency"]');
        
        return {
          name: name?.textContent?.trim() || name?.content || null,
          price: price?.content || price?.textContent?.trim() || null,
          currency: currency?.content || currency?.textContent?.trim() || 'EUR'
        };
      }
      return null;
    },
    
    // 5. Sélecteurs communs e-commerce
    commonSelectors: () => {
      // Sélecteurs de noms de produits courants
      const nameSelectors = [
        'h1[class*="product"]',
        'h1[class*="title"]',
        '[class*="product-title"]',
        '[class*="product-name"]',
        '[class*="productTitle"]',
        '[class*="productName"]',
        '[data-testid*="product-title"]',
        '[data-testid*="productTitle"]',
        '#productTitle',
        '#title',
        '.product-title',
        '.product-name',
        'h1'
      ];
      
      // Sélecteurs de prix courants
      const priceSelectors = [
        '[class*="price"]:not([class*="old"]):not([class*="was"]):not([class*="crossed"])',
        '[class*="Price"]:not([class*="old"]):not([class*="was"])',
        '[data-testid*="price"]',
        '[id*="price"]',
        '.price',
        '.product-price',
        '.current-price',
        '.sale-price',
        '.final-price'
      ];
      
      let name = null;
      let price = null;
      
      // Trouver le nom
      for (const selector of nameSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          const text = element.textContent?.trim();
          if (text && text.length > 3 && text.length < 300) {
            name = text;
            break;
          }
        }
      }
      
      // Trouver le prix
      for (const selector of priceSelectors) {
        const elements = document.querySelectorAll(selector);
        for (const element of elements) {
          const text = element.textContent?.trim();
          if (text && /\d/.test(text)) {
            const extracted = extractPriceFromText(text);
            if (extracted > 0 && extracted < 1000000) {
              price = extracted;
              break;
            }
          }
        }
        if (price) break;
      }
      
      if (name || price) {
        return { name, price, currency: 'EUR' };
      }
      return null;
    },
    
    // 6. Titre de la page (fallback)
    pageTitle: () => {
      let title = document.title;
      
      // Nettoyer le titre (retirer le nom du site souvent à la fin)
      title = title.split(/\s*[-|–—:]\s*/)[0].trim();
      
      return {
        name: title || null,
        price: null,
        currency: 'EUR'
      };
    }
  };
  
  /**
   * Trouve les objets Product dans un JSON-LD (peut être imbriqué)
   */
  function findProducts(data, results = []) {
    if (Array.isArray(data)) {
      data.forEach(item => findProducts(item, results));
    } else if (data && typeof data === 'object') {
      if (data['@type'] === 'Product' || data['@type']?.includes?.('Product')) {
        results.push(data);
      }
      Object.values(data).forEach(value => findProducts(value, results));
    }
    return results;
  }
  
  /**
   * Extrait le prix depuis un objet offers
   */
  function extractPrice(offers) {
    if (!offers) return null;
    
    if (Array.isArray(offers)) {
      offers = offers[0];
    }
    
    if (offers.price) {
      return parseFloat(offers.price);
    }
    if (offers.lowPrice) {
      return parseFloat(offers.lowPrice);
    }
    if (offers.highPrice) {
      return parseFloat(offers.highPrice);
    }
    
    return null;
  }
  
  /**
   * Extrait la devise depuis un objet offers
   */
  function extractCurrency(offers) {
    if (!offers) return 'EUR';
    
    if (Array.isArray(offers)) {
      offers = offers[0];
    }
    
    return offers.priceCurrency || 'EUR';
  }
  
  /**
   * Extrait un prix depuis du texte
   */
  function extractPriceFromText(text) {
    if (!text) return 0;
    
    // Patterns de prix
    const patterns = [
      /(\d{1,3}(?:[\s.,]\d{3})*(?:[.,]\d{2}))\s*€/,     // 1 234,56 €
      /€\s*(\d{1,3}(?:[\s.,]\d{3})*(?:[.,]\d{2})?)/,    // € 1234.56
      /(\d{1,3}(?:[\s.,]\d{3})*(?:[.,]\d{2})?)\s*EUR/i, // 1234.56 EUR
      /(\d+(?:[.,]\d{2})?)/                              // Simple: 1234.56
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        let priceStr = match[1];
        // Normaliser le format
        priceStr = priceStr.replace(/\s/g, '');
        
        // Déterminer le séparateur décimal
        const lastComma = priceStr.lastIndexOf(',');
        const lastDot = priceStr.lastIndexOf('.');
        
        if (lastComma > lastDot) {
          // Format français
          priceStr = priceStr.replace(/\./g, '').replace(',', '.');
        } else if (lastDot > lastComma) {
          // Format anglais
          priceStr = priceStr.replace(/,/g, '');
        }
        
        const price = parseFloat(priceStr);
        if (!isNaN(price) && price > 0) {
          return price;
        }
      }
    }
    
    return 0;
  }
  
  /**
   * Exécute l'extraction avec toutes les stratégies
   */
  function extractProductInfo() {
    const result = {
      name: null,
      price: null,
      currency: 'EUR',
      url: window.location.href,
      site: window.location.hostname.replace('www.', '')
    };
    
    // Essayer chaque stratégie
    for (const [strategyName, strategy] of Object.entries(extractionStrategies)) {
      try {
        const extracted = strategy();
        if (extracted) {
          // Compléter les infos manquantes
          if (!result.name && extracted.name) {
            result.name = extracted.name.trim();
          }
          if (result.price === null && extracted.price !== null) {
            result.price = typeof extracted.price === 'string' 
              ? extractPriceFromText(extracted.price)
              : extracted.price;
          }
          if (extracted.currency && extracted.currency !== 'EUR') {
            result.currency = extracted.currency;
          }
        }
        
        // Si on a tout, on arrête
        if (result.name && result.price !== null) {
          break;
        }
      } catch (e) {
        console.warn(`BenchmarkBox: Stratégie ${strategyName} échouée:`, e);
      }
    }
    
    // Nettoyage final du nom
    if (result.name) {
      result.name = result.name
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 200);
    }
    
    return result;
  }
  
  // Écouter les messages du popup/background
  const browserAPI = typeof browser !== 'undefined' ? browser : chrome;
  
  browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'extractProductInfo') {
      const info = extractProductInfo();
      sendResponse(info);
    }
    return true;
  });
  
  // Exposer pour tests
  if (typeof window !== 'undefined') {
    window.__benchmarkBoxExtract = extractProductInfo;
  }
})();
