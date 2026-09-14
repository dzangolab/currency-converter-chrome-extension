// Settings saved here (chrome.storage.local, key "extensionSettings") seed
// the popup's provider/currency defaults — see popup.js's loadFormData().
// Once the popup has been used, its own remembered last-used session
// (converterData) would otherwise take priority over these forever, which
// would make changing a setting here look like it did nothing. So every
// settings save also erases converterData: the next popup open then has
// nothing to restore and falls back to exactly what was just configured.

let apiProviderSelect, sourceCurrencySelect, targetCurrencySelect, savedMessage;

function initializeOptionsElements() {
  apiProviderSelect = document.getElementById('apiProvider');
  sourceCurrencySelect = document.getElementById('sourceCurrency');
  targetCurrencySelect = document.getElementById('targetCurrency');
  savedMessage = document.getElementById('savedMessage');
}

function applySettings(settings) {
  const providerId = PROVIDERS[settings.apiProvider] ? settings.apiProvider : DEFAULT_PROVIDER_ID;
  apiProviderSelect.value = providerId;
  populateCurrencyOptions(providerId);

  sourceCurrencySelect.value = settings.sourceCurrency || '';
  if (!sourceCurrencySelect.value) {
    sourceCurrencySelect.value = 'USD';
  }

  targetCurrencySelect.value = settings.targetCurrency || '';
  if (!targetCurrencySelect.value) {
    targetCurrencySelect.value = 'EUR';
  }
}

function saveSettings() {
  const settings = {
    apiProvider: apiProviderSelect.value,
    sourceCurrency: sourceCurrencySelect.value,
    targetCurrency: targetCurrencySelect.value
  };

  chrome.storage.local.set({ extensionSettings: settings }, () => {
    if (chrome.runtime.lastError) {
      console.error('Settings save error:', chrome.runtime.lastError);
      return;
    }

    // Erase the popup's last-used session so these settings actually take
    // effect next time it opens, instead of being immediately overridden by
    // whatever was previously remembered.
    chrome.storage.local.remove('converterData', () => {
      if (chrome.runtime.lastError) {
        console.error('Failed to clear the previous session:', chrome.runtime.lastError);
        return;
      }
      if (savedMessage) {
        savedMessage.classList.remove('hidden');
        setTimeout(() => savedMessage.classList.add('hidden'), 1500);
      }
    });
  });
}

function loadSettings() {
  chrome.storage.local.get(['extensionSettings'], (result) => {
    if (chrome.runtime.lastError) {
      console.error('Settings load error:', chrome.runtime.lastError);
      return;
    }
    applySettings(result.extensionSettings || {});
  });
}

function setupOptionsEventListeners() {
  // Same currency-list-doesn't-1:1-overlap concern as popup.js's provider
  // switch — reuse the exact same reconciliation logic from providers.js.
  apiProviderSelect.addEventListener('change', () => {
    switchProviderCurrencies(apiProviderSelect.value, sourceCurrencySelect, targetCurrencySelect);
    saveSettings();
  });

  sourceCurrencySelect.addEventListener('change', saveSettings);
  targetCurrencySelect.addEventListener('change', saveSettings);
}

document.addEventListener('DOMContentLoaded', () => {
  initializeOptionsElements();
  setupOptionsEventListeners();
  loadSettings();
});

// Expose internals to the Jest test suite (CommonJS only — `module` doesn't
// exist when this file is loaded as a browser <script>, so this is a no-op
// in the actual extension).
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initializeOptionsElements,
    setupOptionsEventListeners,
    applySettings,
    saveSettings,
    loadSettings
  };
}
