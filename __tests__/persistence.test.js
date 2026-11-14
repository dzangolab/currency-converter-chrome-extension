/**
 * End-to-end persistence test.
 *
 * The other suites (storage.test.js, conversion.test.js, ui.test.js) all
 * call initializeDOMElements() / setupEventListeners() / loadFormData()
 * directly. That's fine for unit-testing those functions, but it means none
 * of them ever exercise the actual entry point the real extension uses:
 *
 *   document.addEventListener('DOMContentLoaded', () => {
 *     if (initializeDOMElements()) { setupEventListeners(); loadFormData(); }
 *   });
 *
 * A bug living only in that bootstrap wiring — wrong script/listener order,
 * the retry path never re-running setup after a delayed DOM, etc. — would
 * pass every other test and still break the real popup. This file requires
 * providers.js and popup.js exactly once (so their DOMContentLoaded
 * listeners register in the same order popup.html's <script> tags do,
 * exactly like the real extension) and drives everything by dispatching a
 * real 'DOMContentLoaded' event, never by calling their internals directly.
 */

require('../extension/providers.js');
require('../extension/history.js');
require('../extension/popup.js');

function bootPopup() {
  document.dispatchEvent(new Event('DOMContentLoaded'));
}

describe('Popup close/reopen persistence (via the real bootstrap)', () => {
  it('has no saved data on a first-ever open, and shows the default provider and currencies', () => {
    bootPopup();

    expect(document.getElementById('sourceCurrency').value).toBe('USD');
    expect(document.getElementById('targetCurrency').value).toBe('EUR');
  });

  it('constrains the date input to [provider minDate, today] on boot', () => {
    bootPopup();

    const conversionDate = document.getElementById('conversionDate');
    expect(conversionDate.min).toBe(PROVIDERS.frankfurter.minDate);
    expect(conversionDate.max).toBe(todayLocalDateString());
  });

  it('saves form edits to chrome.storage.local through the real event wiring', () => {
    bootPopup();

    document.getElementById('sourceAmount').value = '250';
    document.getElementById('sourceAmount').dispatchEvent(new Event('input', { bubbles: true }));

    document.getElementById('sourceCurrency').value = 'GBP';
    document.getElementById('sourceCurrency').dispatchEvent(new Event('change', { bubbles: true }));

    document.getElementById('targetCurrency').value = 'JPY';
    document.getElementById('targetCurrency').dispatchEvent(new Event('change', { bubbles: true }));

    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({
        converterData: expect.objectContaining({
          sourceAmount: '250',
          sourceCurrency: 'GBP',
          targetCurrency: 'JPY'
        })
      }),
      expect.any(Function)
    );
  });

  it('restores previously saved data when the popup is closed and reopened', () => {
    // --- Session 1: user opens the popup and fills in the form ---
    bootPopup();

    document.getElementById('sourceAmount').value = '250';
    document.getElementById('sourceAmount').dispatchEvent(new Event('input', { bubbles: true }));

    document.getElementById('sourceCurrency').value = 'GBP';
    document.getElementById('sourceCurrency').dispatchEvent(new Event('change', { bubbles: true }));

    document.getElementById('targetCurrency').value = 'JPY';
    document.getElementById('targetCurrency').dispatchEvent(new Event('change', { bubbles: true }));

    document.getElementById('conversionDate').value = '2020-05-15';
    document.getElementById('conversionDate').dispatchEvent(new Event('change', { bubbles: true }));

    const savedData = chrome.storage.local.set.mock.calls.at(-1)[0].converterData;
    expect(savedData).toEqual({
      apiProvider: 'frankfurter',
      sourceAmount: '250',
      sourceCurrency: 'GBP',
      targetCurrency: 'JPY',
      conversionDate: '2020-05-15'
    });

    // --- Popup closes: real Chrome destroys the popup's JS realm and DOM
    // entirely. Simulate that here with a blank DOM and chrome.storage.local
    // now returning what session 1 actually wrote (storage is the one thing
    // that *does* survive — it's backed by the browser, not the popup page). ---
    global.renderPopupFixture();
    chrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({ converterData: savedData });
    });

    // --- Session 2: user reopens the popup ---
    bootPopup();

    expect(document.getElementById('sourceAmount').value).toBe('250');
    expect(document.getElementById('sourceCurrency').value).toBe('GBP');
    expect(document.getElementById('targetCurrency').value).toBe('JPY');
    expect(document.getElementById('conversionDate').value).toBe('2020-05-15');
  });
});
