/**
 * BenchmarkBox - Utilities Module
 * Fonctions utilitaires
 */

/**
 * Extrait le nom de domaine d'une URL
 */
function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return 'unknown';
  }
}

/**
 * Formate un prix avec devise
 */
function formatPrice(price, currency = 'EUR') {
  const num = parseFloat(price);
  if (isNaN(num)) return '—';
  
  const symbols = {
    'EUR': '€',
    'USD': '$',
    'GBP': '£'
  };
  
  const symbol = symbols[currency] || currency;
  return `${num.toFixed(2).replace('.', ',')}${symbol}`;
}

/**
 * Formate une date relative
 */
function formatRelativeDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return 'Hier';
  if (diffDays < 7) return `Il y a ${diffDays} jours`;
  if (diffDays < 30) return `Il y a ${Math.floor(diffDays / 7)} sem.`;
  
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

/**
 * Formate une date complète
 */
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Génère le nom d'affichage d'un produit
 */
function generateProductDisplayName(product) {
  const price = formatPrice(product.price, product.currency);
  return `${product.name} - ${price} - ${product.site}`;
}

/**
 * Tronque un texte avec ellipsis
 */
function truncate(text, maxLength = 50) {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Échappe le HTML
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Debounce function
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Génère une couleur aléatoire (palette orange/rouge)
 */
function generateRandomColor() {
  const colors = [
    '#f97316', // orange-500
    '#ea580c', // orange-600
    '#dc2626', // red-600
    '#ef4444', // red-500
    '#f59e0b', // amber-500
    '#d97706', // amber-600
    '#fb923c', // orange-400
    '#f87171', // red-400
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

/**
 * Détermine si une couleur est claire ou foncée
 */
function isLightColor(hex) {
  const c = hex.substring(1);
  const rgb = parseInt(c, 16);
  const r = (rgb >> 16) & 0xff;
  const g = (rgb >> 8) & 0xff;
  const b = (rgb >> 0) & 0xff;
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luma > 128;
}

/**
 * Crée un élément HTML avec attributs
 */
function createElement(tag, attributes = {}, children = []) {
  const element = document.createElement(tag);
  
  for (const [key, value] of Object.entries(attributes)) {
    if (key === 'className') {
      element.className = value;
    } else if (key === 'dataset') {
      for (const [dataKey, dataValue] of Object.entries(value)) {
        element.dataset[dataKey] = dataValue;
      }
    } else if (key.startsWith('on')) {
      element.addEventListener(key.substring(2).toLowerCase(), value);
    } else {
      element.setAttribute(key, value);
    }
  }
  
  for (const child of children) {
    if (typeof child === 'string') {
      element.appendChild(document.createTextNode(child));
    } else if (child instanceof Node) {
      element.appendChild(child);
    }
  }
  
  return element;
}

/**
 * Affiche une notification toast
 */
function showToast(message, type = 'success', duration = 3000) {
  // Supprimer les toasts existants
  document.querySelectorAll('.bb-toast').forEach(t => t.remove());
  
  const toast = createElement('div', {
    className: `bb-toast bb-toast-${type}`
  }, [message]);
  
  document.body.appendChild(toast);
  
  // Animation d'entrée
  requestAnimationFrame(() => {
    toast.classList.add('bb-toast-show');
  });
  
  // Auto-dismiss
  setTimeout(() => {
    toast.classList.remove('bb-toast-show');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/**
 * Affiche une modal de confirmation
 */
function showConfirm(message, onConfirm, onCancel = null) {
  const overlay = createElement('div', { className: 'bb-modal-overlay' });
  
  const modal = createElement('div', { className: 'bb-modal' }, [
    createElement('div', { className: 'bb-modal-content' }, [
      createElement('p', {}, [message]),
      createElement('div', { className: 'bb-modal-actions' }, [
        createElement('button', {
          className: 'bb-btn bb-btn-secondary',
          onClick: () => {
            overlay.remove();
            if (onCancel) onCancel();
          }
        }, ['Annuler']),
        createElement('button', {
          className: 'bb-btn bb-btn-danger',
          onClick: () => {
            overlay.remove();
            onConfirm();
          }
        }, ['Confirmer'])
      ])
    ])
  ]);
  
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  
  // Fermer en cliquant sur l'overlay
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove();
      if (onCancel) onCancel();
    }
  });
}

/**
 * Parse un prix depuis une chaîne
 */
function parsePrice(priceString) {
  if (!priceString) return 0;
  
  // Nettoyer la chaîne
  let cleaned = priceString
    .replace(/[^\d,.\-]/g, '')  // Garder chiffres, virgule, point, tiret
    .replace(/\s/g, '');        // Supprimer espaces
  
  // Gérer le format français (1.234,56 ou 1234,56)
  if (cleaned.includes(',')) {
    // Si virgule est le dernier séparateur décimal
    const lastComma = cleaned.lastIndexOf(',');
    const lastDot = cleaned.lastIndexOf('.');
    
    if (lastComma > lastDot) {
      // Format français: virgule = décimal
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      // Format anglais: point = décimal
      cleaned = cleaned.replace(/,/g, '');
    }
  }
  
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.abs(num);
}

/**
 * Détecte la devise depuis une chaîne
 */
function detectCurrency(text) {
  if (!text) return 'EUR';
  
  if (text.includes('$') || text.toLowerCase().includes('usd')) return 'USD';
  if (text.includes('£') || text.toLowerCase().includes('gbp')) return 'GBP';
  return 'EUR';
}

/**
 * Calcule la date prévue selon le type
 */
function getPlannedDateFromType(type, customDate) {
  const now = new Date();
  
  switch (type) {
    case 'this_week': {
      const endOfWeek = new Date(now);
      endOfWeek.setDate(now.getDate() + (7 - now.getDay()));
      return endOfWeek.toISOString().split('T')[0];
    }
    case 'next_week': {
      const nextWeek = new Date(now);
      nextWeek.setDate(now.getDate() + 7 + (7 - now.getDay()));
      return nextWeek.toISOString().split('T')[0];
    }
    case 'this_month': {
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return endOfMonth.toISOString().split('T')[0];
    }
    case 'next_month': {
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0);
      return nextMonth.toISOString().split('T')[0];
    }
    case 'custom':
      return customDate || null;
    default:
      return null;
  }
}

/**
 * Formate l'affichage de la date prévue
 */
function formatPlannedDate(dateType, date) {
  switch (dateType) {
    case 'this_week':
      return 'Cette semaine';
    case 'next_week':
      return 'Semaine prochaine';
    case 'this_month':
      return 'Ce mois-ci';
    case 'next_month':
      return 'Mois prochain';
    case 'custom':
      if (date) {
        return formatDate(new Date(date));
      }
      return 'Date non définie';
    default:
      return 'Pas de date';
  }
}

/**
 * Calcule le pourcentage du budget utilisé
 */
function calculateBudgetPercentage(total, budget) {
  if (!budget || budget <= 0) return null;
  return Math.round((total / budget) * 100);
}

/**
 * Retourne le statut du budget
 */
function getBudgetStatus(percentage) {
  if (percentage === null) return 'none';
  if (percentage > 100) return 'exceeded';
  if (percentage >= 90) return 'warning';
  return 'ok';
}

/**
 * Vérifie si une date est passée
 */
function isDatePassed(dateString) {
  if (!dateString) return false;
  const date = new Date(dateString);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return date < now;
}

// Export
if (typeof window !== 'undefined') {
  window.Utils = {
    extractDomain,
    formatPrice,
    formatRelativeDate,
    formatDate,
    generateProductDisplayName,
    truncate,
    escapeHtml,
    debounce,
    generateRandomColor,
    isLightColor,
    createElement,
    showToast,
    showConfirm,
    parsePrice,
    detectCurrency,
    getPlannedDateFromType,
    formatPlannedDate,
    calculateBudgetPercentage,
    getBudgetStatus,
    isDatePassed
  };
  console.log('Utils: Module loaded and exported to window.Utils');
}
