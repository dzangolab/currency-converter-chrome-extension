/**
 * Direct unit tests for providers.js — the URL formats and response shapes
 * here were hand-verified against the real Frankfurter and fawazahmed0
 * APIs (they disagree on almost everything: query params vs. path-only,
 * a single rate vs. a whole basket, uppercase vs. lowercase codes). These
 * tests pin those details down so a future edit can't silently drift from
 * what the real APIs actually expect/return.
 */

require('../extension/providers.js');

describe('PROVIDERS.frankfurter', () => {
  const provider = PROVIDERS.frankfurter;

  it('lists exactly the 30 currencies Frankfurter/ECB actually supports', () => {
    expect(provider.currencies).toHaveLength(30);
    const codes = provider.currencies.map((c) => c.code);
    expect(codes).toContain('USD');
    expect(codes).toContain('EUR');
    expect(codes).not.toContain('AED');
    expect(codes).not.toContain('NPR');
  });

  it('builds a query-param URL with uppercase codes', () => {
    expect(provider.buildUrl('USD', 'EUR', '2024-01-15')).toBe(
      'https://api.frankfurter.app/2024-01-15?from=USD&to=EUR'
    );
  });

  it('has no fallback URL (Frankfurter has no documented mirror)', () => {
    expect(provider.buildFallbackUrl).toBeUndefined();
  });

  it('parses the rate for the requested target out of data.rates', () => {
    const rate = provider.parseRate({ rates: { EUR: 0.92 } }, 'USD', 'EUR');
    expect(rate).toBe(0.92);
  });

  it('throws when the target currency is missing from data.rates', () => {
    expect(() => provider.parseRate({ rates: {} }, 'USD', 'EUR')).toThrow(
      'Exchange rate not found for this currency pair on this date'
    );
  });

  it('describes 404/400/other HTTP statuses distinctly', () => {
    expect(provider.describeHttpError(404)).toBe(
      'No data available for this date. Please try a different date.'
    );
    expect(provider.describeHttpError(400)).toBe('Invalid currency code or date format.');
    expect(provider.describeHttpError(500)).toBe('API error: Unable to fetch exchange rates');
  });
});

describe('PROVIDERS.fawazahmed0', () => {
  const provider = PROVIDERS.fawazahmed0;

  it('lists 160 currencies (all but CLF from the original curated list)', () => {
    expect(provider.currencies).toHaveLength(160);
    const codes = provider.currencies.map((c) => c.code);
    expect(codes).toContain('USD');
    expect(codes).toContain('AED');
    expect(codes).not.toContain('CLF');
  });

  it('builds a path-only URL with lowercase codes, ignoring "to"', () => {
    expect(provider.buildUrl('USD', 'EUR', '2024-06-01')).toBe(
      'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@2024-06-01/v1/currencies/usd.json'
    );
  });

  it('builds the documented Cloudflare Pages fallback URL', () => {
    expect(provider.buildFallbackUrl('USD', 'EUR', '2024-06-01')).toBe(
      'https://2024-06-01.currency-api.pages.dev/v1/currencies/usd.json'
    );
  });

  it('parses the rate out of the whole-basket response, case-insensitively', () => {
    const rate = provider.parseRate({ usd: { eur: 0.91 } }, 'USD', 'EUR');
    expect(rate).toBe(0.91);
  });

  it('throws when the target currency is missing from the basket', () => {
    expect(() => provider.parseRate({ usd: {} }, 'USD', 'EUR')).toThrow(
      'Exchange rate not found for this currency pair on this date'
    );
  });

  it('mentions the 2024-03-02 floor in its error message', () => {
    expect(provider.describeHttpError(404)).toContain('2024-03-02');
  });
});

describe('populateProviderSelect() / populateCurrencyOptions() / applyProviderDateRange()', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <select id="apiProvider"></select>
      <select id="sourceCurrency"></select>
      <select id="targetCurrency"></select>
      <input type="date" id="conversionDate" />
    `;
  });

  it('populates the provider select with both providers, defaulting to frankfurter', () => {
    populateProviderSelect();

    const select = document.getElementById('apiProvider');
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toEqual(['frankfurter', 'fawazahmed0']);
    expect(select.value).toBe(DEFAULT_PROVIDER_ID);
  });

  it('populates both currency selects with the given provider’s currency list', () => {
    populateCurrencyOptions('fawazahmed0');

    const sourceOptions = Array.from(document.getElementById('sourceCurrency').options).map(
      (o) => o.value
    );
    // +1 for the leading "Select currency" placeholder option
    expect(sourceOptions).toHaveLength(PROVIDERS.fawazahmed0.currencies.length + 1);
    expect(sourceOptions).toContain('AED');
    expect(document.getElementById('targetCurrency').innerHTML).toBe(
      document.getElementById('sourceCurrency').innerHTML
    );
  });

  it('falls back to the default provider for an unknown provider id', () => {
    populateCurrencyOptions('not-a-real-provider');

    const options = Array.from(document.getElementById('sourceCurrency').options).map(
      (o) => o.value
    );
    expect(options).toHaveLength(PROVIDERS[DEFAULT_PROVIDER_ID].currencies.length + 1);
  });

  it("sets the date input's min to each provider's earliest supported date", () => {
    applyProviderDateRange('frankfurter');
    expect(document.getElementById('conversionDate').min).toBe('1999-01-01');

    applyProviderDateRange('fawazahmed0');
    expect(document.getElementById('conversionDate').min).toBe('2024-03-02');
  });

  it('falls back to the default provider’s minDate for an unknown provider id', () => {
    applyProviderDateRange('not-a-real-provider');
    expect(document.getElementById('conversionDate').min).toBe(
      PROVIDERS[DEFAULT_PROVIDER_ID].minDate
    );
  });

  it("sets the date input's max to today's local date", () => {
    applyMaxDateToday();
    expect(document.getElementById('conversionDate').max).toBe(todayLocalDateString());
  });

  it('todayLocalDateString() formats as zero-padded YYYY-MM-DD', () => {
    expect(todayLocalDateString()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
