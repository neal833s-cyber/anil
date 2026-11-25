const apiBase = '/api';

function toggleDarkMode() {
  document.documentElement.classList.toggle('dark-mode');
  const isDark = document.documentElement.classList.contains('dark-mode');
  localStorage.setItem('darkMode', isDark ? 'on' : 'off');
}

function restoreDarkMode() {
  const saved = localStorage.getItem('darkMode');
  if (saved === 'on') {
    document.documentElement.classList.add('dark-mode');
  }
}

function updateBadge(selector, count) {
  const el = document.querySelector(selector);
  if (!el) return;
  el.textContent = count;
}

async function addToCart(productId, quantity = 1) {
  try {
    const response = await fetch(`${apiBase}/add_to_cart`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: productId, quantity }),
    });
    const result = await response.json();
    if (result.success) {
      updateBadge('#cart-count', result.count);
      alert('Product added to cart.');
    } else {
      alert(result.message || 'Unable to add to cart.');
    }
  } catch (error) {
    alert('Unable to connect to the server.');
  }
}

async function addToWishlist(productId) {
  try {
    const response = await fetch(`${apiBase}/add_to_wishlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: productId }),
    });
    const result = await response.json();
    if (result.success) {
      updateBadge('#wishlist-count', result.count);
      alert('Added to wishlist.');
    } else {
      alert(result.message || 'Unable to add to wishlist.');
    }
  } catch (error) {
    alert('Unable to connect to the server.');
  }
}

function initSearchForm() {
  const form = document.querySelector('.search-card form');
  if (!form) return;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const query = document.querySelector('input[name="q"]').value.trim();
    if (query) {
      window.location.href = `/products?q=${encodeURIComponent(query)}`;
    }
  });
}

function initContactForm() {
  const form = document.querySelector('#contact-form');
  if (!form) return;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    alert('Thank you! Your message has been sent. We will contact you soon.');
    form.reset();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  restoreDarkMode();
  initSearchForm();
  initContactForm();
});
