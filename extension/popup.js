// The <input type="date"> value is a plain "YYYY-MM-DD" string with no
// timezone info — exactly what Temporal.PlainDate models (a calendar date,
// no time-of-day, no timezone), which is why all date handling here uses it
// instead of Date. Date's UTC-vs-local ambiguity (new Date(dateStr) parses
// as UTC midnight; a locally-computed "today" doesn't; mixing the two used
// to shift the boundary by the viewer's UTC offset — today reading as
// tomorrow, or a reset date reading as yesterday, for anyone east of UTC)
// simply doesn't exist for PlainDate: there's no time-of-day or timezone
// component for a UTC/local mismatch to hide in.

// Wait for DOM to be ready
let form, apiProviderSelect, sourceAmountInput, sourceCurrencySelect, targetCurrencySelect, conversionDateInput;
let resultDiv, resultAmountDiv, resultRateDiv, errorDiv, loadingDiv, copyBtn, swapBtn, settingsBtn, resetBtn;

function initializeDOMElements() {
  form = document.getElementById('converterForm');
  apiProviderSelect = document.getElementById('apiProvider');
  sourceAmountInput = document.getElementById('sourceAmount');
  sourceCurrencySelect = document.getElementById('sourceCurrency');
  targetCurrencySelect = document.getElementById('targetCurrency');
  conversionDateInput = document.getElementById('conversionDate');
  resultDiv = document.getElementById('result');
  resultAmountDiv = document.getElementById('resultAmount');
  resultRateDiv = document.getElementById('resultRate');
  errorDiv = document.getElementById('error');
  loadingDiv = document.getElementById('loading');
  copyBtn = document.getElementById('copyBtn');
  swapBtn = document.getElementById('swapBtn');
  settingsBtn = document.getElementById('settingsBtn');
  resetBtn = document.getElementById('resetBtn');

  if (!form || !sourceAmountInput || !sourceCurrencySelect) {
    console.error('DOM elements not found, retrying...');
    setTimeout(initializeDOMElements, 100);
    return false;
  }
  return true;
}

// Setup event listeners
function setupEventListeners() {
  if (!form) return;
  
  // Form submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await performConversion();
  });

  // Open the extension's Settings page (defaults for provider + currencies)
  settingsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // Revert the form to the Settings-configured defaults
  resetBtn.addEventListener('click', () => {
    resetToDefaults();
  });

  // Switch API provider: its currency list may not overlap 1:1 with the
  // previous provider's, so the selects have to be rebuilt, not just left
  // pointed at options that may no longer exist.
  apiProviderSelect.addEventListener('change', () => {
    switchProvider(apiProviderSelect.value);
    saveFormData();
    if (form.checkValidity()) {
      performConversion();
    }
  });

  // Swap currencies when button is clicked
  swapBtn.addEventListener('click', () => {
    const temp = sourceCurrencySelect.value;
    sourceCurrencySelect.value = targetCurrencySelect.value;
    targetCurrencySelect.value = temp;
    
    // Save and trigger conversion if form is valid
    saveFormData();
    if (form.checkValidity()) {
      performConversion();
    }
  });

  // Real-time conversion on input changes (debounced)
  let conversionTimeout;
  const debouncedConversion = () => {
    clearTimeout(conversionTimeout);
    conversionTimeout = setTimeout(() => {
      if (form.checkValidity()) {
        performConversion();
      }
    }, 500);
  };

  sourceAmountInput.addEventListener('change', debouncedConversion);
  sourceCurrencySelect.addEventListener('change', debouncedConversion);
  targetCurrencySelect.addEventListener('change', debouncedConversion);
  conversionDateInput.addEventListener('change', debouncedConversion);

  // Validate date is within [provider's minDate, today]
  conversionDateInput.addEventListener('change', enforceDateConstraints);

  // Save data on every input change
  sourceAmountInput.addEventListener('input', saveFormData);
  sourceCurrencySelect.addEventListener('change', saveFormData);
  targetCurrencySelect.addEventListener('change', saveFormData);
  conversionDateInput.addEventListener('change', saveFormData);

  // Copy result to clipboard
  copyBtn.addEventListener('click', () => {
    const resultText = resultAmountDiv.textContent;
    navigator.clipboard.writeText(resultText).then(() => {
      const originalText = copyBtn.textContent;
      copyBtn.textContent = 'Copied!';
      setTimeout(() => {
        copyBtn.textContent = originalText;
      }, 2000);
    }).catch(() => {
      showError('Failed to copy to clipboard');
    });
  });
}

// Rebuild the currency <select>s for a newly-chosen provider, carrying
// forward the previous selections where the new provider still supports
// them (most codes overlap) and falling back to USD/EUR where it doesn't.
function switchProvider(providerId) {
  // Set explicitly rather than assumed already-current: when this runs from
  // the provider <select>'s own 'change' listener the browser has already
  // updated .value to match providerId, but enforceDateConstraints() below
  // reads apiProviderSelect.value directly, so any other caller (tests,
  // future code) needs this to actually be in sync with the argument.
  apiProviderSelect.value = providerId;

  switchProviderCurrencies(providerId, sourceCurrencySelect, targetCurrencySelect);

  applyProviderDateRange(providerId);
  enforceDateConstraints();
}

// Applies the Settings-page configured provider/currencies (falling back to
// USD/EUR/frankfurter for anything unset or unrecognized) — the shared core
// of both loadFormData()'s extensionSettings seeding and the Reset button.
// Deliberately doesn't touch amount/date: loadFormData() leaves those to a
// last-used session if one exists, while resetToDefaults() below sets them
// separately as part of a full reset.
function applyConfiguredDefaults(settings) {
  const providerId = PROVIDERS[settings.apiProvider] ? settings.apiProvider : DEFAULT_PROVIDER_ID;

  apiProviderSelect.value = providerId;
  populateCurrencyOptions(providerId);
  applyProviderDateRange(providerId);

  sourceCurrencySelect.value = settings.sourceCurrency || '';
  if (!sourceCurrencySelect.value) {
    sourceCurrencySelect.value = 'USD';
  }

  targetCurrencySelect.value = settings.targetCurrency || '';
  if (!targetCurrencySelect.value) {
    targetCurrencySelect.value = 'EUR';
  }
}

// Reset button: reverts the whole form to the Settings-configured defaults
// (or the hardcoded fallback if Settings were never saved). Settings aren't
// cached anywhere in popup.js — they're only ever applied once, at boot — so
// this re-fetches them fresh in case they changed since this popup opened.
// Also erases the last-used session, the same way options.js's
// saveSettings() does: otherwise the very next popup open would just
// restore exactly what Reset was just used to clear.
function resetToDefaults() {
  chrome.storage.local.get(['extensionSettings'], (result) => {
    if (chrome.runtime.lastError) {
      console.error('Settings load error:', chrome.runtime.lastError);
      return;
    }

    applyConfiguredDefaults(result.extensionSettings || {});

    sourceAmountInput.value = '1';
    conversionDateInput.value = todayLocalDateString();
    applyMaxDateToday();

    resultDiv.classList.add('hidden');
    errorDiv.classList.add('hidden');

    chrome.storage.local.remove('converterData', () => {
      if (chrome.runtime.lastError) {
        console.error('Failed to clear the previous session:', chrome.runtime.lastError);
        return;
      }
      if (form.checkValidity()) {
        performConversion();
      }
    });
  });
}

// Keeps the date input within [current provider's minDate, today]. The
// input's `min` attribute (set by applyProviderDateRange) already stops the
// native picker from offering an out-of-range date, but doesn't retroactively
// fix a value that was valid a moment ago and no longer is — e.g. a date
// already selected under fawazahmed0 becomes fine when switching to
// Frankfurter's wider range, but a date valid under Frankfurter can predate
// fawazahmed0's 2024-03-02 floor, and a typed value can bypass the picker
// entirely. Called on every date change and after every provider switch.
function enforceDateConstraints() {
  if (!conversionDateInput.value) return;

  const provider = PROVIDERS[apiProviderSelect.value] || PROVIDERS[DEFAULT_PROVIDER_ID];
  const selectedDate = Temporal.PlainDate.from(conversionDateInput.value);
  const today = Temporal.Now.plainDateISO();

  if (Temporal.PlainDate.compare(selectedDate, today) > 0) {
    errorDiv.textContent = 'Please select a date in the past or today';
    errorDiv.classList.remove('hidden');
    conversionDateInput.value = today.toString();
    return;
  }

  const minDate = Temporal.PlainDate.from(provider.minDate);
  if (Temporal.PlainDate.compare(selectedDate, minDate) < 0) {
    errorDiv.textContent = `This provider only has data from ${provider.minDate} onward. Date adjusted.`;
    errorDiv.classList.remove('hidden');
    conversionDateInput.value = provider.minDate;
    return;
  }

  errorDiv.classList.add('hidden');
}

// Main conversion function
async function performConversion() {
  // Reset UI
  resultDiv.classList.add('hidden');
  errorDiv.classList.add('hidden');
  loadingDiv.classList.remove('hidden');

  try {
    const sourceAmount = parseFloat(sourceAmountInput.value);
    const sourceCurrency = sourceCurrencySelect.value;
    const targetCurrency = targetCurrencySelect.value;
    const conversionDate = conversionDateInput.value;

    // Validate inputs
    if (!sourceCurrency || !targetCurrency) {
      throw new Error('Please select both currencies');
    }

    if (sourceCurrency === targetCurrency) {
      throw new Error('Please select two different currencies');
    }

    if (isNaN(sourceAmount) || sourceAmount <= 0) {
      throw new Error('Please enter a valid amount');
    }

    if (!conversionDate) {
      throw new Error('Please select a date');
    }

    // Make API request
    const response = await fetchHistoricalRate(sourceCurrency, targetCurrency, conversionDate);

    displayResult(response, sourceAmount, sourceCurrency, targetCurrency, conversionDate);

  } catch (error) {
    showError(error.message);
  } finally {
    loadingDiv.classList.add('hidden');
  }
}

// Fetch a historical exchange rate through whichever provider is currently
// selected. Each provider (see providers.js) owns its own URL format,
// response shape, and error messages — this function just drives that
// interface and, where a provider defines one, falls back to a mirror URL
// if the primary request fails.
async function fetchHistoricalRate(fromCurrency, toCurrency, date) {
  const provider = PROVIDERS[apiProviderSelect.value] || PROVIDERS[DEFAULT_PROVIDER_ID];

  let response;
  try {
    response = await fetch(provider.buildUrl(fromCurrency, toCurrency, date));
  } catch (networkError) {
    response = null;
  }

  if ((!response || !response.ok) && provider.buildFallbackUrl) {
    try {
      response = await fetch(provider.buildFallbackUrl(fromCurrency, toCurrency, date));
    } catch (networkError) {
      response = null;
    }
  }

  if (!response || !response.ok) {
    throw new Error(provider.describeHttpError(response ? response.status : null));
  }

  const data = await response.json();
  const rate = provider.parseRate(data, fromCurrency, toCurrency);

  return {
    rate,
    date: data.date || date,
    from: fromCurrency,
    to: toCurrency
  };
}

// Display conversion result
function displayResult(apiResponse, sourceAmount, sourceCurrency, targetCurrency, dateStr) {
  const convertedAmount = sourceAmount * apiResponse.rate;

  // Format the result amount
  const formattedResult = convertedAmount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  resultAmountDiv.textContent = `${formattedResult} ${targetCurrency}`;

  // Format the rate information
  const formattedDate = Temporal.PlainDate.from(dateStr).toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const rateStr = `1 ${sourceCurrency} = ${apiResponse.rate.toFixed(6)} ${targetCurrency} on ${formattedDate}`;
  resultRateDiv.textContent = rateStr;

  resultDiv.classList.remove('hidden');
}

// Show error message
function showError(message) {
  errorDiv.textContent = message;
  errorDiv.classList.remove('hidden');
}

// Save form data to chrome storage
function saveFormData() {
  if (!sourceAmountInput || !sourceCurrencySelect) return;
  
  const data = {
    apiProvider: apiProviderSelect.value,
    sourceAmount: sourceAmountInput.value,
    sourceCurrency: sourceCurrencySelect.value,
    targetCurrency: targetCurrencySelect.value,
    conversionDate: conversionDateInput.value
  };
  
  // Use chrome.storage.local to save
  chrome.storage.local.set({ converterData: data }, () => {
    if (chrome.runtime.lastError) {
      console.error('Storage error:', chrome.runtime.lastError);
    }
  });
}

// Load and restore form data from chrome storage
function loadFormData() {
  if (!sourceAmountInput || !sourceCurrencySelect) {
    console.log('DOM not ready yet, retrying load...');
    setTimeout(loadFormData, 100);
    return;
  }

  chrome.storage.local.get(['converterData', 'extensionSettings'], (result) => {
    if (chrome.runtime.lastError) {
      console.error('Storage load error:', chrome.runtime.lastError);
      return;
    }

    // Configured defaults (from the Settings/options page) replace
    // providers.js's hardcoded USD/EUR/frankfurter boot values — but only
    // as a *seed*. If a last-used session exists below, it still wins,
    // exactly like before Settings existed: "defaults" apply on a fresh
    // install or after a Reset, "remember what I actually did" applies
    // from then on.
    if (result.extensionSettings) {
      applyConfiguredDefaults(result.extensionSettings);
    }

    if (result.converterData) {
      const data = result.converterData;
      console.log('Restoring saved data:', data);

      // Provider must be restored — and its currency options rebuilt —
      // before the saved currency codes are applied below, or those codes
      // may not exist yet as <option>s under whatever provider is currently
      // populated and silently fail to take.
      if (data.apiProvider && PROVIDERS[data.apiProvider]) {
        apiProviderSelect.value = data.apiProvider;
        populateCurrencyOptions(data.apiProvider);
        applyProviderDateRange(data.apiProvider);
      }

      if (data.sourceAmount) sourceAmountInput.value = data.sourceAmount;
      if (data.sourceCurrency) sourceCurrencySelect.value = data.sourceCurrency;
      if (data.targetCurrency) targetCurrencySelect.value = data.targetCurrency;
      if (data.conversionDate) conversionDateInput.value = data.conversionDate;

      // Defensive: re-validate the restored date against the restored
      // provider's range, in case the two were saved by an older version of
      // this extension (e.g. before apiProvider existed) or are otherwise
      // out of sync.
      enforceDateConstraints();
    } else {
      console.log('No saved data found');
    }
  });
}

// Initialize when everything is ready
document.addEventListener('DOMContentLoaded', () => {
  if (initializeDOMElements()) {
    setupEventListeners();
    loadFormData();
  }
});

// Expose internals to the Jest test suite (CommonJS only — `module` doesn't
// exist when this file is loaded as a browser <script>, so this is a no-op
// in the actual extension).
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initializeDOMElements,
    setupEventListeners,
    switchProvider,
    applyConfiguredDefaults,
    resetToDefaults,
    enforceDateConstraints,
    performConversion,
    fetchHistoricalRate,
    displayResult,
    showError,
    saveFormData,
    loadFormData
  };
}
