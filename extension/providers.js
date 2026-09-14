// Each provider owns everything specific to its own API: which currencies
// it actually has data for, how to build a request URL, how to pull a rate
// back out of its response shape, and how to describe an HTTP failure.
// popup.js only ever calls through this interface — it never assumes a
// particular URL or JSON shape, since the two providers' APIs don't agree
// on either (Frankfurter takes from+to as query params and replies with
// {rates: {TO: rate}}; fawazahmed0 takes only "from" in the path, replies
// with the ENTIRE basket of rates for that base, and uses lowercase codes).
const PROVIDERS = {
  frankfurter: {
    id: 'frankfurter',
    label: 'Frankfurter.app (ECB rates, 1999–present)',
    minDate: '1999-01-01',

    // Frankfurter sources ECB reference rates, which only cover these 30
    // currencies — this is the full list https://api.frankfurter.app/currencies
    // returns, not a subset. Anything outside it always 404s regardless of
    // date, so don't add a code here without confirming it's actually in
    // that endpoint's response first.
    currencies: [
      { code: 'AUD', name: 'Australian Dollar' },
      { code: 'BRL', name: 'Brazilian Real' },
      { code: 'CAD', name: 'Canadian Dollar' },
      { code: 'CHF', name: 'Swiss Franc' },
      { code: 'CNY', name: 'Chinese Renminbi Yuan' },
      { code: 'CZK', name: 'Czech Koruna' },
      { code: 'DKK', name: 'Danish Krone' },
      { code: 'EUR', name: 'Euro' },
      { code: 'GBP', name: 'British Pound' },
      { code: 'HKD', name: 'Hong Kong Dollar' },
      { code: 'HUF', name: 'Hungarian Forint' },
      { code: 'IDR', name: 'Indonesian Rupiah' },
      { code: 'ILS', name: 'Israeli New Shekel' },
      { code: 'INR', name: 'Indian Rupee' },
      { code: 'ISK', name: 'Icelandic Króna' },
      { code: 'JPY', name: 'Japanese Yen' },
      { code: 'KRW', name: 'South Korean Won' },
      { code: 'MXN', name: 'Mexican Peso' },
      { code: 'MYR', name: 'Malaysian Ringgit' },
      { code: 'NOK', name: 'Norwegian Krone' },
      { code: 'NZD', name: 'New Zealand Dollar' },
      { code: 'PHP', name: 'Philippine Peso' },
      { code: 'PLN', name: 'Polish Złoty' },
      { code: 'RON', name: 'Romanian Leu' },
      { code: 'SEK', name: 'Swedish Krona' },
      { code: 'SGD', name: 'Singapore Dollar' },
      { code: 'THB', name: 'Thai Baht' },
      { code: 'TRY', name: 'Turkish Lira' },
      { code: 'USD', name: 'United States Dollar' },
      { code: 'ZAR', name: 'South African Rand' }
    ],

    buildUrl(from, to, date) {
      return `https://api.frankfurter.app/${date}?from=${from}&to=${to}`;
    },

    parseRate(data, from, to) {
      const rate = data.rates && data.rates[to];
      if (typeof rate !== 'number') {
        throw new Error('Exchange rate not found for this currency pair on this date');
      }
      return rate;
    },

    describeHttpError(status) {
      if (status === 404) return 'No data available for this date. Please try a different date.';
      if (status === 400) return 'Invalid currency code or date format.';
      return 'API error: Unable to fetch exchange rates';
    }
  },

  fawazahmed0: {
    id: 'fawazahmed0',
    label: 'fawazahmed0/currency-api (160+ currencies, since 2024-03-02)',
    minDate: '2024-03-02',

    // fawazahmed0/currency-api publishes a daily snapshot of ~200
    // currencies (plus a long tail of crypto tokens we deliberately
    // exclude here to keep this a *currency* picker). This is the ISO
    // 4217-style subset that overlaps with our original curated list —
    // every code here has been verified present in that API's own
    // https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies.json.
    // IMPORTANT: unlike Frankfurter, this provider's per-date snapshots
    // only exist back to 2024-03-02 — it does NOT cover "since 1999"
    // despite the app's general historical-data pitch.
    currencies: [
      { code: 'AED', name: 'United Arab Emirates Dirham' },
      { code: 'AFN', name: 'Afghan Afghani' },
      { code: 'ALL', name: 'Albanian Lek' },
      { code: 'AMD', name: 'Armenian Dram' },
      { code: 'ANG', name: 'Netherlands Antillean Guilder' },
      { code: 'AOA', name: 'Angolan Kwanza' },
      { code: 'ARS', name: 'Argentine Peso' },
      { code: 'AUD', name: 'Australian Dollar' },
      { code: 'AWG', name: 'Aruban Florin' },
      { code: 'AZN', name: 'Azerbaijani Manat' },
      { code: 'BAM', name: 'Bosnia-Herzegovina Convertible Mark' },
      { code: 'BBD', name: 'Barbadian Dollar' },
      { code: 'BDT', name: 'Bangladeshi Taka' },
      { code: 'BGN', name: 'Bulgarian Lev' },
      { code: 'BHD', name: 'Bahraini Dinar' },
      { code: 'BIF', name: 'Burundian Franc' },
      { code: 'BMD', name: 'Bermudian Dollar' },
      { code: 'BND', name: 'Brunei Dollar' },
      { code: 'BOB', name: 'Bolivian Boliviano' },
      { code: 'BRL', name: 'Brazilian Real' },
      { code: 'BSD', name: 'Bahamian Dollar' },
      { code: 'BTC', name: 'Bitcoin' },
      { code: 'BTN', name: 'Bhutanese Ngultrum' },
      { code: 'BWP', name: 'Botswana Pula' },
      { code: 'BYN', name: 'Belarusian Ruble' },
      { code: 'BZD', name: 'Belize Dollar' },
      { code: 'CAD', name: 'Canadian Dollar' },
      { code: 'CDF', name: 'Congolese Franc' },
      { code: 'CHF', name: 'Swiss Franc' },
      { code: 'CLP', name: 'Chilean Peso' },
      { code: 'CNH', name: 'Chinese Yuan (Offshore)' },
      { code: 'CNY', name: 'Chinese Yuan' },
      { code: 'COP', name: 'Colombian Peso' },
      { code: 'CRC', name: 'Costa Rican Colón' },
      { code: 'CUC', name: 'Cuban Convertible Peso' },
      { code: 'CUP', name: 'Cuban Peso' },
      { code: 'CVE', name: 'Cape Verdean Escudo' },
      { code: 'CZK', name: 'Czech Koruna' },
      { code: 'DJF', name: 'Djiboutian Franc' },
      { code: 'DKK', name: 'Danish Krone' },
      { code: 'DOP', name: 'Dominican Peso' },
      { code: 'DZD', name: 'Algerian Dinar' },
      { code: 'EGP', name: 'Egyptian Pound' },
      { code: 'ERN', name: 'Eritrean Nakfa' },
      { code: 'ETB', name: 'Ethiopian Birr' },
      { code: 'EUR', name: 'Euro' },
      { code: 'FJD', name: 'Fijian Dollar' },
      { code: 'FKP', name: 'Falkland Islands Pound' },
      { code: 'GBP', name: 'British Pound' },
      { code: 'GEL', name: 'Georgian Lari' },
      { code: 'GHS', name: 'Ghanaian Cedi' },
      { code: 'GIP', name: 'Gibraltar Pound' },
      { code: 'GMD', name: 'Gambian Dalasi' },
      { code: 'GNF', name: 'Guinean Franc' },
      { code: 'GTQ', name: 'Guatemalan Quetzal' },
      { code: 'GYD', name: 'Guyanese Dollar' },
      { code: 'HKD', name: 'Hong Kong Dollar' },
      { code: 'HNL', name: 'Honduran Lempira' },
      { code: 'HRK', name: 'Croatian Kuna' },
      { code: 'HTG', name: 'Haitian Gourde' },
      { code: 'HUF', name: 'Hungarian Forint' },
      { code: 'IDR', name: 'Indonesian Rupiah' },
      { code: 'ILS', name: 'Israeli Shekel' },
      { code: 'INR', name: 'Indian Rupee' },
      { code: 'IQD', name: 'Iraqi Dinar' },
      { code: 'IRR', name: 'Iranian Rial' },
      { code: 'ISK', name: 'Icelandic Króna' },
      { code: 'JMD', name: 'Jamaican Dollar' },
      { code: 'JOD', name: 'Jordanian Dinar' },
      { code: 'JPY', name: 'Japanese Yen' },
      { code: 'KES', name: 'Kenyan Shilling' },
      { code: 'KGS', name: 'Kyrgyzstani Som' },
      { code: 'KHR', name: 'Cambodian Riel' },
      { code: 'KMF', name: 'Comorian Franc' },
      { code: 'KPW', name: 'North Korean Won' },
      { code: 'KRW', name: 'South Korean Won' },
      { code: 'KWD', name: 'Kuwaiti Dinar' },
      { code: 'KYD', name: 'Cayman Islands Dollar' },
      { code: 'KZT', name: 'Kazakhstani Tenge' },
      { code: 'LAK', name: 'Laotian Kip' },
      { code: 'LBP', name: 'Lebanese Pound' },
      { code: 'LKR', name: 'Sri Lankan Rupee' },
      { code: 'LRD', name: 'Liberian Dollar' },
      { code: 'LSL', name: 'Lesotho Loti' },
      { code: 'LYD', name: 'Libyan Dinar' },
      { code: 'MAD', name: 'Moroccan Dirham' },
      { code: 'MDL', name: 'Moldovan Leu' },
      { code: 'MGA', name: 'Malagasy Ariary' },
      { code: 'MKD', name: 'Macedonian Denar' },
      { code: 'MMK', name: 'Myanmar Kyat' },
      { code: 'MNT', name: 'Mongolian Tugrik' },
      { code: 'MOP', name: 'Macanese Pataca' },
      { code: 'MRU', name: 'Mauritanian Ouguiya' },
      { code: 'MUR', name: 'Mauritian Rupee' },
      { code: 'MVR', name: 'Maldivian Rufiyaa' },
      { code: 'MWK', name: 'Malawian Kwacha' },
      { code: 'MXN', name: 'Mexican Peso' },
      { code: 'MYR', name: 'Malaysian Ringgit' },
      { code: 'MZN', name: 'Mozambican Metical' },
      { code: 'NAD', name: 'Namibian Dollar' },
      { code: 'NGN', name: 'Nigerian Naira' },
      { code: 'NIO', name: 'Nicaraguan Córdoba' },
      { code: 'NOK', name: 'Norwegian Krone' },
      { code: 'NPR', name: 'Nepalese Rupee' },
      { code: 'NZD', name: 'New Zealand Dollar' },
      { code: 'OMR', name: 'Omani Rial' },
      { code: 'PAB', name: 'Panamanian Balboa' },
      { code: 'PEN', name: 'Peruvian Nuevo Sol' },
      { code: 'PGK', name: 'Papua New Guinean Kina' },
      { code: 'PHP', name: 'Philippine Peso' },
      { code: 'PKR', name: 'Pakistani Rupee' },
      { code: 'PLN', name: 'Polish Zloty' },
      { code: 'PYG', name: 'Paraguayan Guaraní' },
      { code: 'QAR', name: 'Qatari Rial' },
      { code: 'RON', name: 'Romanian Leu' },
      { code: 'RSD', name: 'Serbian Dinar' },
      { code: 'RUB', name: 'Russian Ruble' },
      { code: 'RWF', name: 'Rwandan Franc' },
      { code: 'SAR', name: 'Saudi Arabian Riyal' },
      { code: 'SBD', name: 'Solomon Islands Dollar' },
      { code: 'SCR', name: 'Seychellois Rupee' },
      { code: 'SDG', name: 'Sudanese Pound' },
      { code: 'SEK', name: 'Swedish Krona' },
      { code: 'SGD', name: 'Singapore Dollar' },
      { code: 'SHP', name: 'Saint Helena Pound' },
      { code: 'SLL', name: 'Sierra Leonean Leone' },
      { code: 'SOS', name: 'Somali Shilling' },
      { code: 'SRD', name: 'Surinamese Dollar' },
      { code: 'SSP', name: 'South Sudanese Pound' },
      { code: 'STN', name: 'São Tomé and Príncipe Dobra' },
      { code: 'SYP', name: 'Syrian Pound' },
      { code: 'SZL', name: 'Swazi Lilangeni' },
      { code: 'THB', name: 'Thai Baht' },
      { code: 'TJS', name: 'Tajikistani Somoni' },
      { code: 'TMT', name: 'Turkmenistani Manat' },
      { code: 'TND', name: 'Tunisian Dinar' },
      { code: 'TOP', name: 'Tongan Paʻanga' },
      { code: 'TRY', name: 'Turkish Lira' },
      { code: 'TTD', name: 'Trinidad and Tobago Dollar' },
      { code: 'TWD', name: 'New Taiwan Dollar' },
      { code: 'TZS', name: 'Tanzanian Shilling' },
      { code: 'UAH', name: 'Ukrainian Hryvnia' },
      { code: 'UGX', name: 'Ugandan Shilling' },
      { code: 'USD', name: 'United States Dollar' },
      { code: 'UYU', name: 'Uruguayan Peso' },
      { code: 'UZS', name: 'Uzbekistani Som' },
      { code: 'VES', name: 'Venezuelan Bolívar' },
      { code: 'VND', name: 'Vietnamese Dong' },
      { code: 'VUV', name: 'Vanuatu Vatu' },
      { code: 'WST', name: 'Samoan Tala' },
      { code: 'XAF', name: 'Central African CFA Franc' },
      { code: 'XAG', name: 'Silver Ounce' },
      { code: 'XAU', name: 'Gold Ounce' },
      { code: 'XCD', name: 'East Caribbean Dollar' },
      { code: 'XOF', name: 'West African CFA Franc' },
      { code: 'XPF', name: 'CFP Franc' },
      { code: 'YER', name: 'Yemeni Rial' },
      { code: 'ZAR', name: 'South African Rand' },
      { code: 'ZMW', name: 'Zambian Kwacha' },
      { code: 'ZWL', name: 'Zimbabwean Dollar' }
    ],

    // Unlike Frankfurter, this API takes only a base currency in the path
    // and replies with that currency's ENTIRE rate basket — there's no way
    // to ask for a single target pair. `to` is unused here but kept in the
    // signature so both providers share one call shape.
    buildUrl(from, to, date) {
      return `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${date}/v1/currencies/${from.toLowerCase()}.json`;
    },

    // The jsdelivr CDN mirror occasionally lags or blips; the project's own
    // README calls out this Cloudflare Pages URL as the documented fallback.
    buildFallbackUrl(from, to, date) {
      return `https://${date}.currency-api.pages.dev/v1/currencies/${from.toLowerCase()}.json`;
    },

    parseRate(data, from, to) {
      const basket = data[from.toLowerCase()];
      const rate = basket && basket[to.toLowerCase()];
      if (typeof rate !== 'number') {
        throw new Error('Exchange rate not found for this currency pair on this date');
      }
      return rate;
    },

    describeHttpError() {
      return 'No data available for this date. Please try a different date (this provider only has data from 2024-03-02 onward).';
    }
  }
};

const DEFAULT_PROVIDER_ID = 'frankfurter';

// Rebuilds both currency <select>s for the given provider. Called once at
// boot (for the default provider) and again any time the user switches
// providers or a saved provider choice is restored from storage — the two
// providers' currency lists only partly overlap, so this can't just run
// once at DOMContentLoaded like it used to when there was a single list.
function populateCurrencyOptions(providerId) {
  const provider = PROVIDERS[providerId] || PROVIDERS[DEFAULT_PROVIDER_ID];
  const options =
    '<option value="">Select currency</option>' +
    provider.currencies
      .map((curr) => `<option value="${curr.code}">${curr.code} - ${curr.name}</option>`)
      .join('');

  document.getElementById('sourceCurrency').innerHTML = options;
  document.getElementById('targetCurrency').innerHTML = options;
}

function populateProviderSelect() {
  const select = document.getElementById('apiProvider');
  select.innerHTML = Object.values(PROVIDERS)
    .map((provider) => `<option value="${provider.id}">${provider.label}</option>`)
    .join('');
  select.value = DEFAULT_PROVIDER_ID;
}

// Shared by popup.js's switchProvider() and options.js's provider-change
// handler: repopulate the currency <select>s for a newly-chosen provider,
// carrying forward the previous selections where the new provider still
// supports them (most codes overlap) and falling back to USD/EUR where it
// doesn't. Takes explicit element references rather than assuming fixed
// global bindings, since popup.js and options.js each manage their own.
function switchProviderCurrencies(providerId, sourceCurrencySelect, targetCurrencySelect) {
  const previousSource = sourceCurrencySelect.value;
  const previousTarget = targetCurrencySelect.value;

  populateCurrencyOptions(providerId);

  sourceCurrencySelect.value = previousSource;
  if (!sourceCurrencySelect.value) {
    sourceCurrencySelect.value = 'USD';
  }

  targetCurrencySelect.value = previousTarget;
  if (!targetCurrencySelect.value) {
    targetCurrencySelect.value = 'EUR';
  }
}

// Local calendar day as "YYYY-MM-DD" — toISOString() would render UTC and
// can read as yesterday/tomorrow depending on the viewer's timezone offset.
function todayLocalDateString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// Sets the date <input>'s `min` so the native date picker itself refuses to
// offer a date earlier than the given provider's earliest supported one —
// this is the primary defense; popup.js's enforceDateConstraints() is the
// secondary one, for a value set some other way (typed, restored from
// storage, or already selected before a provider switch tightens the floor).
// No-ops if there's no #conversionDate on the page (e.g. options.html, which
// has no date field at all) rather than throwing.
function applyProviderDateRange(providerId) {
  const dateInput = document.getElementById('conversionDate');
  if (!dateInput) return;
  const provider = PROVIDERS[providerId] || PROVIDERS[DEFAULT_PROVIDER_ID];
  dateInput.min = provider.minDate;
}

// Same idea as applyProviderDateRange, but for the *upper* bound: today, the
// same ceiling regardless of provider. Also primary defense only — a value
// already in the future when the popup opens (there shouldn't be one, since
// this always runs at boot) is still caught by enforceDateConstraints(). Also
// a no-op without a #conversionDate on the page.
function applyMaxDateToday() {
  const dateInput = document.getElementById('conversionDate');
  if (!dateInput) return;
  dateInput.max = todayLocalDateString();
}

document.addEventListener('DOMContentLoaded', function () {
  populateProviderSelect();
  populateCurrencyOptions(DEFAULT_PROVIDER_ID);
  applyProviderDateRange(DEFAULT_PROVIDER_ID);
  applyMaxDateToday();

  const sourceCurrencySelect = document.getElementById('sourceCurrency');
  const targetCurrencySelect = document.getElementById('targetCurrency');
  const conversionDateInput = document.getElementById('conversionDate');

  // Set default values
  sourceCurrencySelect.value = 'USD';
  targetCurrencySelect.value = 'EUR';
  // options.html has no date field — this handler is shared by both pages.
  if (conversionDateInput) {
    conversionDateInput.value = todayLocalDateString();
  }
});

// popup.js is a separate <script> (and, under Jest, a separate CommonJS
// module) that needs this data and these two render functions. Classic
// <script> tags share one global lexical scope in a real browser, but
// Node's module wrapper means a plain top-level `const`/`function` here
// would NOT be visible to a separately `require`'d popup.js — so these are
// attached to `globalThis` explicitly, which resolves to `window` in the
// browser (a no-op there, already implicitly reachable) and to Node's
// `global` under Jest (where it's load-bearing).
globalThis.PROVIDERS = PROVIDERS;
globalThis.DEFAULT_PROVIDER_ID = DEFAULT_PROVIDER_ID;
globalThis.populateCurrencyOptions = populateCurrencyOptions;
globalThis.populateProviderSelect = populateProviderSelect;
globalThis.switchProviderCurrencies = switchProviderCurrencies;
globalThis.applyProviderDateRange = applyProviderDateRange;
globalThis.applyMaxDateToday = applyMaxDateToday;
globalThis.todayLocalDateString = todayLocalDateString;
