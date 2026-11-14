/**
 * Conversion history tests.
 * Covers history.js's pure helpers directly, then popup.js's real
 * recordConversion()/renderHistory()/loadFormData() against the popup
 * fixture (see jest.setup.js's renderPopupFixture).
 */

require('../extension/providers.js');
require('../extension/history.js');

const {
  initializeDOMElements,
  loadFormData,
  performConversion,
  recordConversion,
  renderHistory
} = require('../extension/popup.js');

const entry = (overrides = {}) => ({
  apiProvider: 'frankfurter',
  date: '2024-03-05',
  rate: 0.921234,
  sourceAmount: 1000,
  sourceCurrency: 'USD',
  targetCurrency: 'EUR',
  ...overrides
});

const rows = () => Array.from(document.querySelectorAll('#historyList li')).map((li) => li.textContent);

describe('normalizeHistorySize()', () => {
  it('defaults to 10 for a missing or non-numeric value', () => {
    expect(normalizeHistorySize(undefined)).toBe(10);
    expect(normalizeHistorySize('')).toBe(10);
    expect(normalizeHistorySize('abc')).toBe(10);
  });

  it('clamps to 1–100 and drops decimals', () => {
    expect(normalizeHistorySize(0)).toBe(1);
    expect(normalizeHistorySize(-5)).toBe(1);
    expect(normalizeHistorySize(500)).toBe(100);
    expect(normalizeHistorySize('25')).toBe(25);
    expect(normalizeHistorySize(12.7)).toBe(12);
  });
});

describe('formatHistoryEntry()', () => {
  it('formats a row as "XXX x,xxx.00 @ <rate> = XXX x,xxx.00 dd/MMM/yyyy"', () => {
    expect(formatHistoryEntry(entry())).toBe('USD 1,000.00 @ 0.921234 = EUR 921.23 05/Mar/2024');
  });

  it('pads the day and uses English month abbreviations', () => {
    expect(formatHistoryDate('2023-12-01')).toBe('01/Dec/2023');
    expect(formatHistoryDate('2024-01-31')).toBe('31/Jan/2024');
  });
});

describe('addToHistory()', () => {
  it('puts the newest entry first and trims to the given size', () => {
    let history = [];
    for (let amount = 1; amount <= 4; amount++) {
      history = addToHistory(history, entry({ sourceAmount: amount }), 3);
    }

    expect(history.map((e) => e.sourceAmount)).toEqual([4, 3, 2]);
  });

  it("doesn't add a duplicate when the same conversion is repeated", () => {
    const history = addToHistory([entry()], entry(), 10);

    expect(history).toHaveLength(1);
  });

  it('still records a repeat of an older, non-top entry', () => {
    const history = addToHistory([entry({ sourceAmount: 5 }), entry()], entry(), 10);

    expect(history.map((e) => e.sourceAmount)).toEqual([1000, 5, 1000]);
  });

  it('treats a missing stored history as empty', () => {
    expect(addToHistory(undefined, entry(), 10)).toEqual([entry()]);
  });
});

describe('popup history pane', () => {
  beforeEach(() => {
    initializeDOMElements();
  });

  it('stays hidden while there is no history', () => {
    renderHistory([], 10);

    expect(document.getElementById('history').classList.contains('hidden')).toBe(true);
    expect(rows()).toEqual([]);
  });

  it('shows one row per entry, newest first, trimmed to the configured size', () => {
    renderHistory([entry({ sourceAmount: 3 }), entry({ sourceAmount: 2 }), entry({ sourceAmount: 1 })], 2);

    expect(document.getElementById('history').classList.contains('hidden')).toBe(false);
    expect(rows()).toEqual([
      'USD 3.00 @ 0.921234 = EUR 2.76 05/Mar/2024',
      'USD 2.00 @ 0.921234 = EUR 1.84 05/Mar/2024'
    ]);
  });

  it('renders stored text as text, not markup', () => {
    renderHistory([entry({ sourceCurrency: '<img src=x>' })], 10);

    expect(document.querySelector('#historyList img')).toBeNull();
  });

  it('renders the stored history on popup boot', () => {
    chrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({ conversionHistory: [entry()], extensionSettings: { historySize: 5 } });
    });

    loadFormData();

    expect(rows()).toEqual(['USD 1,000.00 @ 0.921234 = EUR 921.23 05/Mar/2024']);
  });

  it('records a successful conversion, trimmed to the configured history size', () => {
    const stored = [entry({ sourceAmount: 2 }), entry({ sourceAmount: 1 })];
    chrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({ conversionHistory: stored, extensionSettings: { historySize: 2 } });
    });

    recordConversion(entry({ sourceAmount: 3 }));

    const saved = chrome.storage.local.set.mock.calls.at(-1)[0].conversionHistory;
    expect(saved.map((e) => e.sourceAmount)).toEqual([3, 2]);
    expect(rows()).toHaveLength(2);
  });

  it('adds a row after performConversion() succeeds', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ date: '2024-01-01', rates: { EUR: 0.5 } })
    });
    document.getElementById('sourceAmount').value = '10';
    document.getElementById('sourceCurrency').value = 'USD';
    document.getElementById('targetCurrency').value = 'EUR';
    document.getElementById('conversionDate').value = '2024-01-01';

    await performConversion();

    expect(rows()).toEqual(['USD 10.00 @ 0.500000 = EUR 5.00 01/Jan/2024']);
  });

  it("doesn't record a failed conversion", async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 404 });
    document.getElementById('sourceCurrency').value = 'USD';
    document.getElementById('targetCurrency').value = 'EUR';

    await performConversion();

    expect(chrome.storage.local.set).not.toHaveBeenCalledWith(
      expect.objectContaining({ conversionHistory: expect.anything() }),
      expect.any(Function)
    );
  });

  it('logs and skips the save when reading history fails', () => {
    chrome.runtime.lastError = new Error('Storage access denied');
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    recordConversion(entry());

    expect(consoleSpy).toHaveBeenCalledWith('History load error:', chrome.runtime.lastError);
    expect(chrome.storage.local.set).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
