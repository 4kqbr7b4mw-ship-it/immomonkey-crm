/**
 * Immomonkey Lead Form Widget
 * Einbettungscode für Webseiten
 * 
 * Verwendung:
 * <div id="immomonkey-form"></div>
 * <script src="https://ihre-domain.de/widget.js" data-api="https://ihre-api.de"></script>
 */

(function() {
  'use strict';

  const API_URL = document.currentScript?.getAttribute('data-api') || '';
  const CONTAINER_ID = 'immomonkey-form';

  const styles = `
    .immomonkey-widget {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      max-width: 500px;
      margin: 0 auto;
      padding: 20px;
    }
    .immomonkey-widget * {
      box-sizing: border-box;
    }
    .immomonkey-header {
      text-align: center;
      margin-bottom: 24px;
    }
    .immomonkey-logo {
      width: 80px;
      height: 80px;
      margin: 0 auto 16px;
      border-radius: 50%;
      object-fit: contain;
    }
    .immomonkey-title {
      font-size: 24px;
      font-weight: 700;
      color: #1a472a;
      margin: 0 0 8px;
    }
    .immomonkey-subtitle {
      font-size: 14px;
      color: #666;
      margin: 0;
    }
    .immomonkey-form-group {
      margin-bottom: 16px;
    }
    .immomonkey-label {
      display: block;
      font-size: 14px;
      font-weight: 500;
      color: #333;
      margin-bottom: 6px;
    }
    .immomonkey-label .required {
      color: #e74c3c;
    }
    .immomonkey-input {
      width: 100%;
      padding: 14px 16px;
      font-size: 16px;
      border: 2px solid #d4e8dc;
      border-radius: 12px;
      background: #f5faf7;
      transition: all 0.2s ease;
    }
    .immomonkey-input:focus {
      outline: none;
      border-color: #1a472a;
      background: #fff;
    }
    .immomonkey-input::placeholder {
      color: #999;
    }
    .immomonkey-checkbox-group {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      margin: 20px 0;
    }
    .immomonkey-checkbox {
      width: 20px;
      height: 20px;
      margin-top: 2px;
      accent-color: #1a472a;
      cursor: pointer;
    }
    .immomonkey-checkbox-label {
      font-size: 13px;
      color: #555;
      line-height: 1.5;
    }
    .immomonkey-checkbox-label a {
      color: #1a472a;
      text-decoration: underline;
    }
    .immomonkey-submit {
      width: 100%;
      padding: 16px 24px;
      font-size: 16px;
      font-weight: 600;
      color: #fff;
      background: linear-gradient(135deg, #1a472a 0%, #2d5a3d 100%);
      border: none;
      border-radius: 50px;
      cursor: pointer;
      transition: all 0.2s ease;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .immomonkey-submit:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(26, 71, 42, 0.35);
    }
    .immomonkey-submit:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }
    .immomonkey-footer {
      text-align: center;
      margin-top: 16px;
      font-size: 12px;
      color: #888;
    }
    .immomonkey-success {
      text-align: center;
      padding: 40px 20px;
    }
    .immomonkey-success-icon {
      width: 80px;
      height: 80px;
      margin: 0 auto 24px;
      background: linear-gradient(135deg, #1a472a 0%, #2d5a3d 100%);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 40px;
    }
    .immomonkey-success h3 {
      font-size: 24px;
      color: #1a472a;
      margin: 0 0 12px;
    }
    .immomonkey-success p {
      font-size: 16px;
      color: #666;
      margin: 0;
    }
    .immomonkey-error {
      background: #fee;
      color: #c33;
      padding: 12px 16px;
      border-radius: 8px;
      margin-bottom: 16px;
      font-size: 14px;
    }
  `;

  function injectStyles() {
    if (document.getElementById('immomonkey-styles')) return;
    const styleEl = document.createElement('style');
    styleEl.id = 'immomonkey-styles';
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);
  }

  function createForm(container) {
    const logoUrl = API_URL ? `${API_URL}/logo.png` : '/logo.png';
    const formHTML = `
      <div class="immomonkey-widget">
        <div class="immomonkey-header">
          <img src="${logoUrl}" alt="Immomonkey" class="immomonkey-logo" onerror="this.style.display='none'">
          <h2 class="immomonkey-title">Immomonkey</h2>
          <p class="immomonkey-subtitle">Kostenlose Ersteinschätzung Ihrer Immobilie</p>
        </div>
        <form id="immomonkey-lead-form">
          <div class="immomonkey-form-group">
            <label class="immomonkey-label">
              Dein Name <span class="required">*</span>
            </label>
            <input type="text" name="name" class="immomonkey-input" placeholder="Max Mustermann" required>
          </div>
          <div class="immomonkey-form-group">
            <label class="immomonkey-label">
              Deine E-Mail-Adresse <span class="required">*</span>
            </label>
            <input type="email" name="email" class="immomonkey-input" placeholder="max@beispiel.de" required>
          </div>
          <div class="immomonkey-form-group">
            <label class="immomonkey-label">
              Telefon <span class="required">*</span>
            </label>
            <input type="tel" name="phone" class="immomonkey-input" placeholder="+49 123 456789" required>
          </div>
          <div class="immomonkey-form-group">
            <label class="immomonkey-label">
              Ort der Immobilie <span class="required">*</span>
            </label>
            <input type="text" name="location" class="immomonkey-input" placeholder="12345 Berlin" required>
          </div>
          <div class="immomonkey-form-group">
            <label class="immomonkey-label">
              Objektart
            </label>
            <select name="object_type" class="immomonkey-input" style="cursor: pointer;">
              <option value="">Bitte wählen...</option>
              <option value="Haus">Haus</option>
              <option value="Wohnung">Wohnung</option>
              <option value="Grundstück">Grundstück</option>
              <option value="Gewerbe">Gewerbe</option>
              <option value="Sonstiges">Sonstiges</option>
            </select>
          </div>
          <div class="immomonkey-checkbox-group">
            <input type="checkbox" id="immomonkey-dsgvo" name="dsgvo" class="immomonkey-checkbox" required>
            <label for="immomonkey-dsgvo" class="immomonkey-checkbox-label">
              Ich habe die <a href="/datenschutz" target="_blank">Datenschutzerklärung</a> gelesen und akzeptiere sie. <span class="required">*</span>
            </label>
          </div>
          <button type="submit" class="immomonkey-submit">
            Ersteinschätzung sichern
          </button>
          <p class="immomonkey-footer">
            unverbindlich · unabhängig · ohne Verkaufsabsicht
          </p>
        </form>
      </div>
    `;
    container.innerHTML = formHTML;

    const form = container.querySelector('#immomonkey-lead-form');
    form.addEventListener('submit', handleSubmit);
  }

  function showSuccess(container) {
    container.innerHTML = `
      <div class="immomonkey-widget">
        <div class="immomonkey-success">
          <div class="immomonkey-success-icon">✓</div>
          <h3>Vielen Dank!</h3>
          <p>Wir haben Ihre Anfrage erhalten und senden Ihnen in Kürze eine E-Mail mit weiteren Informationen.</p>
        </div>
      </div>
    `;
  }

  function showError(container, message) {
    const existingError = container.querySelector('.immomonkey-error');
    if (existingError) existingError.remove();

    const errorEl = document.createElement('div');
    errorEl.className = 'immomonkey-error';
    errorEl.textContent = message;

    const form = container.querySelector('form');
    form.insertBefore(errorEl, form.firstChild);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const submitBtn = form.querySelector('.immomonkey-submit');
    const container = form.closest('.immomonkey-widget').parentElement;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Wird gesendet...';

    const formData = new FormData(form);
    const data = {
      name: formData.get('name'),
      email: formData.get('email'),
      phone: formData.get('phone'),
      location: formData.get('location'),
      object_type: formData.get('object_type'),
      source: 'website_widget'
    };

    try {
      const response = await fetch(`${API_URL}/api/leads/public`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (response.ok) {
        showSuccess(container.parentElement);
      } else {
        const error = await response.json();
        showError(container, error.message || 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Ersteinschätzung sichern';
      }
    } catch (err) {
      showError(container, 'Verbindungsfehler. Bitte überprüfen Sie Ihre Internetverbindung.');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Ersteinschätzung sichern';
    }
  }

  function init() {
    injectStyles();
    const container = document.getElementById(CONTAINER_ID);
    if (container) {
      createForm(container);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
