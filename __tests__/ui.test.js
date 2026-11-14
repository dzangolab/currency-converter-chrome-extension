/**
 * UI Interaction Tests
 * Dispatches real DOM events against the listeners wired up by the real
 * setupEventListeners() in popup.js (see jest.setup.js for the DOM fixture).
 *
 * Fake timers are used throughout because several listeners here schedule a
 * debounced (500ms) conversion or a 2s "Copied!" revert; without fake
 * timers those would be real pending setTimeouts left dangling past the end
 * of each test.
 */

// providers.js populates the global PROVIDERS lookup that popup.js's
// fetchHistoricalRate()/switchProvider() depend on; it isn't destructured
// here since it exposes globals, not module.exports.
require('../extension/providers.js');
require('../extension/history.js');

const {
  initializeDOMElements,
  setupEventListeners,
  switchProvider,
  performConversion,
  showError
} = require('../extension/popup.js');

beforeEach(() => {
  initializeDOMElements();
  setupEventListeners();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe('Swap Button', () => {
  it('swaps the source and target currencies and persists the change', async () => {
    document.getElementById('sourceCurrency').value = 'USD';
    document.getElementById('targetCurrency').value = 'EUR';
    document.getElementById('sourceAmount').value = '100';
    document.getElementById('conversionDate').value = '2024-01-15';

    document.getElementById('swapBtn').dispatchEvent(new Event('click', { bubbles: true }));

    expect(document.getElementById('sourceCurrency').value).toBe('EUR');
    expect(document.getElementById('targetCurrency').value).toBe('USD');
    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({
        converterData: expect.objectContaining({ sourceCurrency: 'EUR', targetCurrency: 'USD' })
      }),
      expect.any(Function)
    );

    await flushMicrotasks();
  });

  it('swaps even when one side has no currency selected, without triggering a conversion', () => {
    document.getElementById('sourceCurrency').value = 'USD';
    document.getElementById('targetCurrency').value = '';

    document.getElementById('swapBtn').dispatchEvent(new Event('click', { bubbles: true }));

    expect(document.getElementById('sourceCurrency').value).toBe('');
    expect(document.getElementById('targetCurrency').value).toBe('USD');
    // form is now invalid (empty source currency), so no fetch should fire
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('Provider Switching', () => {
  it('rebuilds the currency options for the newly selected provider', () => {
    switchProvider('fawazahmed0');

    const sourceOptions = Array.from(document.getElementById('sourceCurrency').options).map(
      (o) => o.value
    );
    expect(sourceOptions).toContain('AED');
    expect(sourceOptions).toHaveLength(PROVIDERS.fawazahmed0.currencies.length + 1);
  });

  it('keeps the current selection when the new provider still supports it', () => {
    document.getElementById('sourceCurrency').value = 'USD';
    document.getElementById('targetCurrency').value = 'EUR';

    switchProvider('fawazahmed0');

    expect(document.getElementById('sourceCurrency').value).toBe('USD');
    expect(document.getElementById('targetCurrency').value).toBe('EUR');
  });

  it('falls back to USD/EUR when the current selection does not exist under the new provider', () => {
    switchProvider('fawazahmed0');
    document.getElementById('sourceCurrency').value = 'AED';

    switchProvider('frankfurter');

    // AED isn't one of Frankfurter's 30 currencies
    expect(document.getElementById('sourceCurrency').value).toBe('USD');
  });

  it('saves the provider choice and reconverts when changed via the real select', async () => {
    document.getElementById('sourceAmount').value = '100';
    document.getElementById('sourceCurrency').value = 'USD';
    document.getElementById('targetCurrency').value = 'EUR';
    document.getElementById('conversionDate').value = '2024-06-01';

    document.getElementById('apiProvider').value = 'fawazahmed0';
    document.getElementById('apiProvider').dispatchEvent(new Event('change', { bubbles: true }));

    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({
        converterData: expect.objectContaining({ apiProvider: 'fawazahmed0' })
      }),
      expect.any(Function)
    );

    await flushMicrotasks();
  });

  it("sets the date input's min for the newly selected provider", () => {
    switchProvider('fawazahmed0');
    expect(document.getElementById('conversionDate').min).toBe('2024-03-02');

    switchProvider('frankfurter');
    expect(document.getElementById('conversionDate').min).toBe('1999-01-01');
  });

  it('clamps an already-selected date that predates the new (more restrictive) provider', () => {
    document.getElementById('conversionDate').value = '1999-06-15';

    switchProvider('fawazahmed0');

    expect(document.getElementById('conversionDate').value).toBe('2024-03-02');
    expect(document.getElementById('error').textContent).toContain('2024-03-02');
    expect(document.getElementById('error').classList.contains('hidden')).toBe(false);
  });
});

describe('Form Submission', () => {
  it('is valid when all fields are filled in correctly', () => {
    document.getElementById('sourceAmount').value = '100';
    document.getElementById('sourceCurrency').value = 'USD';
    document.getElementById('targetCurrency').value = 'EUR';
    document.getElementById('conversionDate').value = '2024-01-15';

    expect(document.getElementById('converterForm').checkValidity()).toBe(true);
  });

  it('is invalid when the amount is empty (required)', () => {
    document.getElementById('sourceAmount').value = '';
    expect(document.getElementById('sourceAmount').validity.valid).toBe(false);
  });

  it('is invalid when no currency is selected (required)', () => {
    document.getElementById('sourceCurrency').value = '';
    expect(document.getElementById('sourceCurrency').validity.valid).toBe(false);
  });

  it('prevents the default submit and runs a conversion', async () => {
    document.getElementById('sourceAmount').value = '100';
    document.getElementById('sourceCurrency').value = 'USD';
    document.getElementById('targetCurrency').value = 'EUR';
    document.getElementById('conversionDate').value = '2024-01-15';
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ base: 'USD', date: '2024-01-15', rates: { EUR: 0.92 } })
    });

    const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
    document.getElementById('converterForm').dispatchEvent(submitEvent);

    expect(submitEvent.defaultPrevented).toBe(true);

    await flushMicrotasks();
    expect(document.getElementById('resultAmount').textContent).toBe('92.00 EUR');
  });
});

describe('Copy Button', () => {
  it('copies the result amount to the clipboard', async () => {
    document.getElementById('resultAmount').textContent = '92.00 EUR';
    Object.assign(navigator, { clipboard: { writeText: jest.fn(() => Promise.resolve()) } });

    document.getElementById('copyBtn').dispatchEvent(new Event('click', { bubbles: true }));
    await flushMicrotasks();

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('92.00 EUR');
  });

  it('shows "Copied!" then reverts the label after 2 seconds', async () => {
    const copyBtn = document.getElementById('copyBtn');
    document.getElementById('resultAmount').textContent = '92.00 EUR';
    Object.assign(navigator, { clipboard: { writeText: jest.fn(() => Promise.resolve()) } });

    copyBtn.dispatchEvent(new Event('click', { bubbles: true }));
    await flushMicrotasks();
    expect(copyBtn.textContent).toBe('Copied!');

    jest.advanceTimersByTime(2000);
    expect(copyBtn.textContent).toBe('Copy Result');
  });

  it('shows an error message if the clipboard write fails', async () => {
    Object.assign(navigator, {
      clipboard: { writeText: jest.fn(() => Promise.reject(new Error('Clipboard denied'))) }
    });

    document.getElementById('copyBtn').dispatchEvent(new Event('click', { bubbles: true }));
    await flushMicrotasks();

    expect(document.getElementById('error').textContent).toBe('Failed to copy to clipboard');
    expect(document.getElementById('error').classList.contains('hidden')).toBe(false);
  });
});

describe('Date Validation', () => {
  it('rejects and resets a future date, showing an error', () => {
    const conversionDate = document.getElementById('conversionDate');
    conversionDate.value = Temporal.Now.plainDateISO().add({ days: 1 }).toString();

    conversionDate.dispatchEvent(new Event('change', { bubbles: true }));

    expect(conversionDate.value).toBe(Temporal.Now.plainDateISO().toString());
    expect(document.getElementById('error').textContent).toBe(
      'Please select a date in the past or today'
    );
    expect(document.getElementById('error').classList.contains('hidden')).toBe(false);
  });

  it("accepts today's date without an error", () => {
    document.getElementById('conversionDate').value = Temporal.Now.plainDateISO().toString();

    document.getElementById('conversionDate').dispatchEvent(new Event('change', { bubbles: true }));

    expect(document.getElementById('error').classList.contains('hidden')).toBe(true);
  });

  it('accepts a past date without an error', () => {
    document.getElementById('conversionDate').value = '2020-01-01';

    document.getElementById('conversionDate').dispatchEvent(new Event('change', { bubbles: true }));

    expect(document.getElementById('error').classList.contains('hidden')).toBe(true);
  });

  it("rejects and clamps a date earlier than the current provider's minDate", () => {
    switchProvider('fawazahmed0');
    const conversionDate = document.getElementById('conversionDate');

    conversionDate.value = '2020-01-01';
    conversionDate.dispatchEvent(new Event('change', { bubbles: true }));

    expect(conversionDate.value).toBe('2024-03-02');
    expect(document.getElementById('error').textContent).toContain('2024-03-02');
    expect(document.getElementById('error').classList.contains('hidden')).toBe(false);
  });

  it("accepts a date on the current provider's minDate exactly", () => {
    switchProvider('fawazahmed0');
    const conversionDate = document.getElementById('conversionDate');

    conversionDate.value = '2024-03-02';
    conversionDate.dispatchEvent(new Event('change', { bubbles: true }));

    expect(conversionDate.value).toBe('2024-03-02');
    expect(document.getElementById('error').classList.contains('hidden')).toBe(true);
  });
});

describe('Error Display', () => {
  it('shows an error message via showError()', () => {
    showError('Invalid currency');

    expect(document.getElementById('error').textContent).toBe('Invalid currency');
    expect(document.getElementById('error').classList.contains('hidden')).toBe(false);
  });

  it('can be hidden again by re-applying the hidden class', () => {
    showError('Some error');
    document.getElementById('error').classList.add('hidden');

    expect(document.getElementById('error').classList.contains('hidden')).toBe(true);
  });
});

describe('Settings Button', () => {
  it('opens the extension options page when clicked', () => {
    document.getElementById('settingsBtn').dispatchEvent(new Event('click', { bubbles: true }));

    expect(chrome.runtime.openOptionsPage).toHaveBeenCalled();
  });
});

describe('Reset Button', () => {
  it('reverts to the hardcoded fallback when no Settings have been saved', async () => {
    chrome.storage.local.get.mockImplementation((keys, callback) => callback({}));

    document.getElementById('sourceAmount').value = '999';
    document.getElementById('sourceCurrency').value = 'GBP';
    document.getElementById('targetCurrency').value = 'JPY';
    document.getElementById('conversionDate').value = '2020-01-01';
    document.getElementById('apiProvider').value = 'fawazahmed0';

    document.getElementById('resetBtn').dispatchEvent(new Event('click', { bubbles: true }));
    await flushMicrotasks();

    expect(document.getElementById('apiProvider').value).toBe('frankfurter');
    expect(document.getElementById('sourceCurrency').value).toBe('USD');
    expect(document.getElementById('targetCurrency').value).toBe('EUR');
    expect(document.getElementById('sourceAmount').value).toBe('1');
    expect(document.getElementById('conversionDate').value).toBe(todayLocalDateString());
  });

  it('reverts to the Settings-configured defaults when they exist', async () => {
    chrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({
        extensionSettings: { apiProvider: 'fawazahmed0', sourceCurrency: 'AED', targetCurrency: 'JPY' }
      });
    });

    document.getElementById('sourceCurrency').value = 'GBP';
    document.getElementById('targetCurrency').value = 'USD';

    document.getElementById('resetBtn').dispatchEvent(new Event('click', { bubbles: true }));
    await flushMicrotasks();

    expect(document.getElementById('apiProvider').value).toBe('fawazahmed0');
    expect(document.getElementById('sourceCurrency').value).toBe('AED');
    expect(document.getElementById('targetCurrency').value).toBe('JPY');
  });

  it('erases the last-used session so it does not immediately come back on next open', async () => {
    document.getElementById('resetBtn').dispatchEvent(new Event('click', { bubbles: true }));
    await flushMicrotasks();

    expect(chrome.storage.local.remove).toHaveBeenCalledWith('converterData', expect.any(Function));
  });

  it('clears a prior error and replaces a prior result with a fresh conversion of the reset values', async () => {
    document.getElementById('result').classList.remove('hidden');
    document.getElementById('resultAmount').textContent = 'stale 12,345.00 XYZ';
    document.getElementById('error').classList.remove('hidden');
    document.getElementById('error').textContent = 'some stale error';

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ base: 'USD', date: todayLocalDateString(), rates: { EUR: 0.9 } })
    });

    document.getElementById('resetBtn').dispatchEvent(new Event('click', { bubbles: true }));
    await flushMicrotasks();

    // The error is cleared, and the result now reflects the fresh
    // conversion against the reset (USD -> EUR) values, not the old
    // provider/currencies' stale content or visibility.
    expect(document.getElementById('error').classList.contains('hidden')).toBe(true);
    expect(document.getElementById('result').classList.contains('hidden')).toBe(false);
    expect(document.getElementById('resultAmount').textContent).toBe('0.90 EUR');
  });
});

describe('Loading State', () => {
  it('shows the loading indicator while converting and hides it when done', async () => {
    document.getElementById('sourceAmount').value = '100';
    document.getElementById('sourceCurrency').value = 'USD';
    document.getElementById('targetCurrency').value = 'EUR';
    document.getElementById('conversionDate').value = '2024-01-15';

    const conversionPromise = performConversion();
    expect(document.getElementById('loading').classList.contains('hidden')).toBe(false);

    await conversionPromise;

    expect(document.getElementById('loading').classList.contains('hidden')).toBe(true);
  });
});
