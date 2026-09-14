/**
 * Settings (options.html) tests.
 * Exercises the real applySettings()/saveSettings()/loadSettings() and the
 * real 'change' listeners from options.js against the live DOM fixture (see
 * jest.setup.js's renderOptionsFixture).
 */

require('../extension/providers.js');

const {
  initializeOptionsElements,
  setupOptionsEventListeners,
  applySettings,
  saveSettings,
  loadSettings
} = require('../extension/options.js');

beforeEach(() => {
  renderOptionsFixture();
  initializeOptionsElements();
});

describe('loadSettings() / applySettings()', () => {
  it('defaults to frankfurter/USD/EUR when nothing has been saved yet', () => {
    chrome.storage.local.get.mockImplementation((keys, callback) => callback({}));

    loadSettings();

    expect(document.getElementById('apiProvider').value).toBe('frankfurter');
    expect(document.getElementById('sourceCurrency').value).toBe('USD');
    expect(document.getElementById('targetCurrency').value).toBe('EUR');
  });

  it('restores previously saved settings, rebuilding currency options for the saved provider', () => {
    // AED only exists under fawazahmed0's list — proves applySettings()
    // populates that provider's currencies before applying the saved codes.
    chrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({
        extensionSettings: {
          apiProvider: 'fawazahmed0',
          sourceCurrency: 'AED',
          targetCurrency: 'JPY'
        }
      });
    });

    loadSettings();

    expect(document.getElementById('apiProvider').value).toBe('fawazahmed0');
    expect(document.getElementById('sourceCurrency').value).toBe('AED');
    expect(document.getElementById('targetCurrency').value).toBe('JPY');
  });

  it('falls back to the default provider for an unrecognized saved provider id', () => {
    applySettings({ apiProvider: 'not-a-real-provider', sourceCurrency: 'USD', targetCurrency: 'EUR' });

    expect(document.getElementById('apiProvider').value).toBe(DEFAULT_PROVIDER_ID);
  });

  it('falls back to USD/EUR when saved currencies are missing', () => {
    applySettings({ apiProvider: 'frankfurter' });

    expect(document.getElementById('sourceCurrency').value).toBe('USD');
    expect(document.getElementById('targetCurrency').value).toBe('EUR');
  });

  it('logs an error and skips applying settings when chrome.runtime.lastError is set', () => {
    chrome.runtime.lastError = new Error('Storage access denied');
    chrome.storage.local.get.mockImplementation((keys, callback) => callback({}));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    loadSettings();

    expect(consoleSpy).toHaveBeenCalledWith('Settings load error:', chrome.runtime.lastError);
    consoleSpy.mockRestore();
  });
});

describe('saveSettings()', () => {
  it('saves the current provider and currency selections under extensionSettings', () => {
    document.getElementById('apiProvider').value = 'fawazahmed0';
    document.getElementById('sourceCurrency').value = 'GBP';
    document.getElementById('targetCurrency').value = 'JPY';

    saveSettings();

    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      {
        extensionSettings: {
          apiProvider: 'fawazahmed0',
          sourceCurrency: 'GBP',
          targetCurrency: 'JPY'
        }
      },
      expect.any(Function)
    );
  });

  it('shows and then hides a "Saved" confirmation', () => {
    jest.useFakeTimers();
    const savedMessage = document.getElementById('savedMessage');

    saveSettings();

    expect(savedMessage.classList.contains('hidden')).toBe(false);
    jest.advanceTimersByTime(1500);
    expect(savedMessage.classList.contains('hidden')).toBe(true);

    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('logs an error when chrome.storage.local.set reports a lastError', () => {
    chrome.runtime.lastError = new Error('Storage quota exceeded');
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    saveSettings();

    expect(consoleSpy).toHaveBeenCalledWith('Settings save error:', chrome.runtime.lastError);
    consoleSpy.mockRestore();
  });

  it("erases the popup's last-used session (converterData) so the new settings actually take effect", () => {
    saveSettings();

    expect(chrome.storage.local.remove).toHaveBeenCalledWith('converterData', expect.any(Function));
  });

  it('logs an error (but still attempted the erase) when chrome.storage.local.remove reports a lastError', () => {
    chrome.storage.local.remove.mockImplementationOnce((keys, callback) => {
      chrome.runtime.lastError = new Error('Storage access denied');
      callback();
    });
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    saveSettings();

    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to clear the previous session:',
      chrome.runtime.lastError
    );
    consoleSpy.mockRestore();
  });
});

describe('Real event wiring', () => {
  beforeEach(() => {
    setupOptionsEventListeners();
  });

  it('saves when a currency select changes', () => {
    document.getElementById('sourceCurrency').value = 'GBP';
    document.getElementById('sourceCurrency').dispatchEvent(new Event('change', { bubbles: true }));

    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({
        extensionSettings: expect.objectContaining({ sourceCurrency: 'GBP' })
      }),
      expect.any(Function)
    );
  });

  it('rebuilds currency options and saves when the provider changes', () => {
    document.getElementById('sourceCurrency').value = 'USD';
    document.getElementById('targetCurrency').value = 'EUR';

    document.getElementById('apiProvider').value = 'fawazahmed0';
    document.getElementById('apiProvider').dispatchEvent(new Event('change', { bubbles: true }));

    const sourceOptions = Array.from(document.getElementById('sourceCurrency').options).map(
      (o) => o.value
    );
    expect(sourceOptions).toContain('AED');
    // USD/EUR both exist under fawazahmed0 too, so the prior selection carries over
    expect(document.getElementById('sourceCurrency').value).toBe('USD');
    expect(document.getElementById('targetCurrency').value).toBe('EUR');

    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({
        extensionSettings: expect.objectContaining({ apiProvider: 'fawazahmed0' })
      }),
      expect.any(Function)
    );
  });
});
