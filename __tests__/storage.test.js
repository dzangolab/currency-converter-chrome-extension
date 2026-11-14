/**
 * Data Persistence Tests
 * Exercises the real saveFormData() / loadFormData() / setupEventListeners()
 * from popup.js against the live DOM fixture (see jest.setup.js).
 */

// providers.js populates the global PROVIDERS lookup that popup.js's
// fetchHistoricalRate()/switchProvider() depend on; it isn't destructured
// here since it exposes globals, not module.exports.
require('../extension/providers.js');
require('../extension/history.js');

const {
  initializeDOMElements,
  setupEventListeners,
  saveFormData,
  loadFormData
} = require('../extension/popup.js');

beforeEach(() => {
  initializeDOMElements();
});

describe('saveFormData()', () => {
  it('should save all form data to chrome.storage.local', () => {
    document.getElementById('sourceAmount').value = '100';
    document.getElementById('sourceCurrency').value = 'USD';
    document.getElementById('targetCurrency').value = 'EUR';
    document.getElementById('conversionDate').value = '2024-01-15';

    saveFormData();

    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      {
        converterData: {
          apiProvider: 'frankfurter',
          sourceAmount: '100',
          sourceCurrency: 'USD',
          targetCurrency: 'EUR',
          conversionDate: '2024-01-15'
        }
      },
      expect.any(Function)
    );
  });

  it('should save an empty amount if not set', () => {
    document.getElementById('sourceAmount').value = '';

    saveFormData();

    expect(chrome.storage.local.set).toHaveBeenCalled();
    const callArgs = chrome.storage.local.set.mock.calls[0][0];
    expect(callArgs.converterData.sourceAmount).toBe('');
  });

  it('should log an error when chrome.storage.local.set reports a lastError', () => {
    chrome.runtime.lastError = new Error('Storage quota exceeded');
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    saveFormData();

    expect(consoleSpy).toHaveBeenCalledWith('Storage error:', chrome.runtime.lastError);

    consoleSpy.mockRestore();
  });
});

describe('loadFormData()', () => {
  it('seeds provider and currencies from extensionSettings when there is no last-used session', () => {
    // AED only exists under fawazahmed0's list, proving the configured
    // provider is applied (and its currencies repopulated) before the
    // configured currency codes are set — same ordering concern as
    // restoring a last-used converterData session.
    chrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({
        extensionSettings: { apiProvider: 'fawazahmed0', sourceCurrency: 'AED', targetCurrency: 'JPY' }
      });
    });

    loadFormData();

    expect(document.getElementById('apiProvider').value).toBe('fawazahmed0');
    expect(document.getElementById('sourceCurrency').value).toBe('AED');
    expect(document.getElementById('targetCurrency').value).toBe('JPY');
  });

  it('prefers the last-used session (converterData) over configured defaults when both exist', () => {
    chrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({
        extensionSettings: { apiProvider: 'fawazahmed0', sourceCurrency: 'AED', targetCurrency: 'JPY' },
        converterData: {
          apiProvider: 'frankfurter',
          sourceCurrency: 'GBP',
          targetCurrency: 'USD',
          sourceAmount: '5',
          conversionDate: '2024-01-01'
        }
      });
    });

    loadFormData();

    expect(document.getElementById('apiProvider').value).toBe('frankfurter');
    expect(document.getElementById('sourceCurrency').value).toBe('GBP');
    expect(document.getElementById('targetCurrency').value).toBe('USD');
  });

  it('should restore all saved form data', () => {
    chrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({
        converterData: {
          sourceAmount: '50',
          sourceCurrency: 'GBP',
          targetCurrency: 'JPY',
          conversionDate: '2023-12-25'
        }
      });
    });

    loadFormData();

    expect(document.getElementById('sourceAmount').value).toBe('50');
    expect(document.getElementById('sourceCurrency').value).toBe('GBP');
    expect(document.getElementById('targetCurrency').value).toBe('JPY');
    expect(document.getElementById('conversionDate').value).toBe('2023-12-25');
  });

  it('restores the saved provider and rebuilds currency options before restoring the saved codes', () => {
    // AED only exists under fawazahmed0's currency list, not frankfurter's
    // (the default) — this only resolves correctly if the provider is
    // restored, and its currency options rebuilt, before sourceCurrency is
    // set. Restoring in the other order would silently fail to apply AED,
    // since it wouldn't exist yet as an <option> under frankfurter's list.
    chrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({
        converterData: {
          apiProvider: 'fawazahmed0',
          sourceAmount: '10',
          sourceCurrency: 'AED',
          targetCurrency: 'USD',
          conversionDate: '2024-06-01'
        }
      });
    });

    loadFormData();

    expect(document.getElementById('apiProvider').value).toBe('fawazahmed0');
    expect(document.getElementById('sourceCurrency').value).toBe('AED');
    expect(document.getElementById('targetCurrency').value).toBe('USD');
  });

  it('clamps a restored date that predates the restored provider’s minDate', () => {
    // Simulates data saved by an older version of the extension (or any
    // other way a provider/date pair could end up out of sync) — the date
    // was valid for frankfurter but not for fawazahmed0's 2024-03-02 floor.
    chrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({
        converterData: {
          apiProvider: 'fawazahmed0',
          sourceAmount: '10',
          sourceCurrency: 'USD',
          targetCurrency: 'EUR',
          conversionDate: '1999-06-15'
        }
      });
    });

    loadFormData();

    expect(document.getElementById('conversionDate').value).toBe('2024-03-02');
    expect(document.getElementById('error').textContent).toContain('2024-03-02');
  });

  it('should leave the form untouched when no saved data exists', () => {
    chrome.storage.local.get.mockImplementation((keys, callback) => callback({}));
    const original = document.getElementById('sourceAmount').value;

    loadFormData();

    expect(document.getElementById('sourceAmount').value).toBe(original);
  });

  it('should only restore the fields present in the saved data', () => {
    chrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({ converterData: { sourceAmount: '75', sourceCurrency: 'EUR' } });
    });
    const originalTarget = document.getElementById('targetCurrency').value;
    const originalDate = document.getElementById('conversionDate').value;

    loadFormData();

    expect(document.getElementById('sourceAmount').value).toBe('75');
    expect(document.getElementById('sourceCurrency').value).toBe('EUR');
    expect(document.getElementById('targetCurrency').value).toBe(originalTarget);
    expect(document.getElementById('conversionDate').value).toBe(originalDate);
  });

  it('should log an error and skip restoring when chrome.runtime.lastError is set', () => {
    chrome.runtime.lastError = new Error('Storage access denied');
    chrome.storage.local.get.mockImplementation((keys, callback) => callback({}));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    loadFormData();

    expect(consoleSpy).toHaveBeenCalledWith('Storage load error:', chrome.runtime.lastError);

    consoleSpy.mockRestore();
  });
});

describe('Auto-save on input changes', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    setupEventListeners();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('should save data when the amount input fires "input"', () => {
    const sourceAmount = document.getElementById('sourceAmount');
    sourceAmount.value = '200';
    sourceAmount.dispatchEvent(new Event('input', { bubbles: true }));

    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({
        converterData: expect.objectContaining({ sourceAmount: '200' })
      }),
      expect.any(Function)
    );
  });

  it('should save data when the source currency changes', () => {
    const sourceCurrency = document.getElementById('sourceCurrency');
    sourceCurrency.value = 'GBP';
    sourceCurrency.dispatchEvent(new Event('change', { bubbles: true }));

    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({
        converterData: expect.objectContaining({ sourceCurrency: 'GBP' })
      }),
      expect.any(Function)
    );
  });

  it('should save data when the date changes', () => {
    const conversionDate = document.getElementById('conversionDate');
    conversionDate.value = '2020-05-15';
    conversionDate.dispatchEvent(new Event('change', { bubbles: true }));

    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({
        converterData: expect.objectContaining({ conversionDate: '2020-05-15' })
      }),
      expect.any(Function)
    );
  });
});
