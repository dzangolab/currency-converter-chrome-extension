// Node has no native Temporal yet, and the browser extension itself loads
// the same polyfill as a vendored classic <script> (extension/vendor/
// temporal-polyfill.js) rather than through npm — so it's loaded here
// separately, before anything under test can call a Temporal-dependent
// function. (@js-temporal/polyfill was picked over the newer, lighter
// temporal-polyfill package specifically because it ships a real CJS build
// — temporal-polyfill is ESM-only, and Jest's module system rejects a
// dynamic import() of an ESM package without --experimental-vm-modules,
// which isn't worth forcing on this project just for one dependency.)
if (typeof globalThis.Temporal === 'undefined') {
  globalThis.Temporal = require('@js-temporal/polyfill').Temporal;
}

// Mock Chrome storage API
global.chrome = {
  storage: {
    local: {
      set: jest.fn((data, callback) => {
        if (callback) callback();
      }),
      get: jest.fn((keys, callback) => {
        if (callback) callback({});
      }),
      remove: jest.fn((keys, callback) => {
        if (callback) callback();
      })
    }
  },
  runtime: {
    lastError: null,
    openOptionsPage: jest.fn()
  }
};

// Mock fetch API
global.fetch = jest.fn();

// popup.js fires off some real (non-mocked) async work as a side effect of
// normal user interactions (e.g. clicking swap triggers a live conversion
// call). Awaiting this a few times drains that leftover promise chain
// before the next test's DOM/mocks are reset, so it can't resolve mid-way
// through a later test and mutate its state.
global.flushMicrotasks = async () => {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
  }
};

const CURRENCY_OPTIONS = ['USD', 'EUR', 'GBP', 'JPY', 'CAD']
  .map((code) => `<option value="${code}">${code}</option>`)
  .join('');

// The popup.html body, reproduced as a fixture. Exposed as a function (not
// just called from the beforeEach below) so tests that need to simulate a
// popup being closed and reopened — a fresh, blank DOM — can re-render it
// mid-test without duplicating this markup out of sync with popup.html.
global.renderPopupFixture = () => {
  document.body.innerHTML = `
    <div class="container">
      <button type="button" id="resetBtn">↺</button>
      <button type="button" id="settingsBtn">⚙</button>
      <form id="converterForm">
        <select id="apiProvider" required>
          <option value="frankfurter" selected>Frankfurter.app (ECB rates, 1999–present)</option>
          <option value="fawazahmed0">fawazahmed0/currency-api (160+ currencies, since 2024-03-02)</option>
        </select>
        <input type="number" id="sourceAmount" value="1" step="0.01" min="0" required />
        <select id="sourceCurrency" required>
          <option value="">Select currency</option>
          ${CURRENCY_OPTIONS}
        </select>
        <button type="button" id="swapBtn" class="btn-swap">⇅</button>
        <select id="targetCurrency" required>
          <option value="">Select currency</option>
          ${CURRENCY_OPTIONS}
        </select>
        <input type="date" id="conversionDate" value="2024-01-01" required />
        <button type="submit" class="btn-convert">Convert</button>
      </form>
      <div id="result" class="result hidden">
        <div id="resultAmount"></div>
        <div id="resultRate"></div>
        <button id="copyBtn" class="btn-copy">Copy Result</button>
      </div>
      <div id="error" class="error hidden"></div>
      <div id="loading" class="loading hidden">Converting...</div>
      <div id="history" class="history hidden">
        <ol id="historyList"></ol>
      </div>
    </div>
  `;
};

// The options.html body, reproduced as a fixture, for the same reason as
// renderPopupFixture above.
global.renderOptionsFixture = () => {
  document.body.innerHTML = `
    <div class="container">
      <select id="apiProvider" required>
        <option value="frankfurter" selected>Frankfurter.app (ECB rates, 1999–present)</option>
        <option value="fawazahmed0">fawazahmed0/currency-api (160+ currencies, since 2024-03-02)</option>
      </select>
      <select id="sourceCurrency" required>
        <option value="">Select currency</option>
        ${CURRENCY_OPTIONS}
      </select>
      <select id="targetCurrency" required>
        <option value="">Select currency</option>
        ${CURRENCY_OPTIONS}
      </select>
      <input type="number" id="historySize" min="1" max="100" step="1" value="10" required />
      <div id="savedMessage" class="saved-message hidden">✓ Saved</div>
    </div>
  `;
};

// Setup DOM elements before each test
beforeEach(() => {
  global.renderPopupFixture();

  // Reset all mocks and give fetch/storage safe, deterministic defaults so
  // any incidental call (e.g. performConversion firing after a swap/submit,
  // or resetToDefaults() reading settings) resolves cleanly instead of
  // throwing into an unhandled rejection or leaking a mockImplementation a
  // previous test set into one that never overrides it. jest.clearAllMocks()
  // alone only resets call history, not implementations set via
  // .mockImplementation() — mockReset() clears both.
  jest.clearAllMocks();
  chrome.runtime.lastError = null;

  global.fetch.mockReset();
  global.fetch.mockResolvedValue({
    ok: true,
    json: async () => ({ base: 'USD', date: '2024-01-01', rates: { EUR: 1 } })
  });

  chrome.storage.local.set.mockReset();
  chrome.storage.local.set.mockImplementation((data, callback) => {
    if (callback) callback();
  });
  chrome.storage.local.get.mockReset();
  chrome.storage.local.get.mockImplementation((keys, callback) => callback({}));
  chrome.storage.local.remove.mockReset();
  chrome.storage.local.remove.mockImplementation((keys, callback) => {
    if (callback) callback();
  });
});

afterEach(async () => {
  await global.flushMicrotasks();
});
