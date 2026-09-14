/**
 * Currency Conversion Tests
 * Exercises the real fetchHistoricalRate(), displayResult() and
 * performConversion() from popup.js against the live DOM fixture
 * (see jest.setup.js).
 */

// providers.js populates the global PROVIDERS lookup that popup.js's
// fetchHistoricalRate()/switchProvider() depend on; it isn't destructured
// here since it exposes globals, not module.exports.
require('../extension/providers.js');

const {
  initializeDOMElements,
  performConversion,
  fetchHistoricalRate,
  displayResult
} = require('../extension/popup.js');

beforeEach(() => {
  initializeDOMElements();
});

describe('fetchHistoricalRate()', () => {
  it('should fetch the exchange rate from the API with the correct URL', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ base: 'USD', date: '2024-01-15', rates: { EUR: 0.92 } })
    });

    const result = await fetchHistoricalRate('USD', 'EUR', '2024-01-15');

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.frankfurter.app/2024-01-15?from=USD&to=EUR'
    );
    expect(result).toEqual({ rate: 0.92, date: '2024-01-15', from: 'USD', to: 'EUR' });
  });

  it('should reject with a friendly message on a 404 (no data for that date)', async () => {
    global.fetch.mockResolvedValueOnce({ ok: false, status: 404 });

    await expect(fetchHistoricalRate('USD', 'EUR', '2025-01-15')).rejects.toThrow(
      'No data available for this date. Please try a different date.'
    );
  });

  it('should reject with a friendly message on a 400 (invalid currency/date)', async () => {
    global.fetch.mockResolvedValueOnce({ ok: false, status: 400 });

    await expect(fetchHistoricalRate('INVALID', 'EUR', '2024-01-15')).rejects.toThrow(
      'Invalid currency code or date format.'
    );
  });

  it('should reject with a generic message on other HTTP errors', async () => {
    global.fetch.mockResolvedValueOnce({ ok: false, status: 500 });

    await expect(fetchHistoricalRate('USD', 'EUR', '2024-01-15')).rejects.toThrow(
      'API error: Unable to fetch exchange rates'
    );
  });

  it('should reject when the target currency is missing from the response rates', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ base: 'USD', date: '2024-01-15', rates: {} })
    });

    await expect(fetchHistoricalRate('USD', 'EUR', '2024-01-15')).rejects.toThrow(
      'Exchange rate not found for this currency pair on this date'
    );
  });
});

describe('fetchHistoricalRate() with the fawazahmed0 provider', () => {
  beforeEach(() => {
    document.getElementById('apiProvider').value = 'fawazahmed0';
  });

  it('requests the lowercase path-only URL and reads the rate out of the whole basket', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ date: '2024-06-01', usd: { eur: 0.91, aed: 3.67 } })
    });

    const result = await fetchHistoricalRate('USD', 'EUR', '2024-06-01');

    expect(global.fetch).toHaveBeenCalledWith(
      'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@2024-06-01/v1/currencies/usd.json'
    );
    expect(result).toEqual({ rate: 0.91, date: '2024-06-01', from: 'USD', to: 'EUR' });
  });

  it('falls back to the Cloudflare Pages mirror when the primary CDN request fails', async () => {
    global.fetch.mockResolvedValueOnce({ ok: false, status: 404 });
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ date: '2024-06-01', usd: { eur: 0.91 } })
    });

    const result = await fetchHistoricalRate('USD', 'EUR', '2024-06-01');

    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@2024-06-01/v1/currencies/usd.json'
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      'https://2024-06-01.currency-api.pages.dev/v1/currencies/usd.json'
    );
    expect(result.rate).toBe(0.91);
  });

  it('reports the 2024-03-02 floor when a date before it 404s on both URLs', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 404 });

    await expect(fetchHistoricalRate('USD', 'EUR', '1999-01-01')).rejects.toThrow('2024-03-02');
  });
});

describe('displayResult()', () => {
  it('should render the converted amount and the rate line', () => {
    displayResult(
      { rate: 0.92, date: '2024-01-15', from: 'USD', to: 'EUR' },
      100,
      'USD',
      'EUR',
      '2024-01-15'
    );

    expect(document.getElementById('resultAmount').textContent).toBe('92.00 EUR');
    expect(document.getElementById('resultRate').textContent).toBe(
      '1 USD = 0.920000 EUR on Monday, January 15, 2024'
    );
    expect(document.getElementById('result').classList.contains('hidden')).toBe(false);
  });

  it('should format large amounts with a thousands separator', () => {
    displayResult({ rate: 1.2 }, 50000, 'USD', 'CAD', '2024-01-01');

    expect(document.getElementById('resultAmount').textContent).toBe('60,000.00 CAD');
  });

  it('should round small decimal amounts to two places', () => {
    displayResult({ rate: 149.5 }, 0.67, 'USD', 'JPY', '2024-01-01');

    expect(document.getElementById('resultAmount').textContent).toBe('100.17 JPY');
  });
});

describe('performConversion() — validation and orchestration', () => {
  const setForm = ({ amount = '100', from = 'USD', to = 'EUR', date = '2024-01-15' } = {}) => {
    document.getElementById('sourceAmount').value = amount;
    document.getElementById('sourceCurrency').value = from;
    document.getElementById('targetCurrency').value = to;
    document.getElementById('conversionDate').value = date;
  };

  it('shows an error when a currency is not selected', async () => {
    setForm({ from: '' });

    await performConversion();

    expect(document.getElementById('error').textContent).toBe('Please select both currencies');
    expect(document.getElementById('error').classList.contains('hidden')).toBe(false);
  });

  it('shows an error when source and target currencies are identical', async () => {
    setForm({ from: 'USD', to: 'USD' });

    await performConversion();

    expect(document.getElementById('error').textContent).toBe(
      'Please select two different currencies'
    );
    expect(document.getElementById('error').classList.contains('hidden')).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('shows an error for a zero or negative amount', async () => {
    setForm({ amount: '0' });

    await performConversion();

    expect(document.getElementById('error').textContent).toBe('Please enter a valid amount');
  });

  it('shows an error when the date is missing', async () => {
    setForm({ date: '' });

    await performConversion();

    expect(document.getElementById('error').textContent).toBe('Please select a date');
  });

  it('fetches the rate and displays the result for valid input', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ base: 'USD', date: '2024-01-15', rates: { EUR: 0.92 } })
    });
    setForm();

    await performConversion();

    expect(document.getElementById('resultAmount').textContent).toBe('92.00 EUR');
    expect(document.getElementById('result').classList.contains('hidden')).toBe(false);
    expect(document.getElementById('loading').classList.contains('hidden')).toBe(true);
  });

  it('surfaces API errors as a user-facing message and keeps the result hidden', async () => {
    global.fetch.mockResolvedValueOnce({ ok: false, status: 404 });
    setForm();

    await performConversion();

    expect(document.getElementById('error').textContent).toBe(
      'No data available for this date. Please try a different date.'
    );
    expect(document.getElementById('result').classList.contains('hidden')).toBe(true);
  });
});

describe('Conversion math', () => {
  it('multiplies the source amount by the fetched rate', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ base: 'USD', date: '2024-01-01', rates: { JPY: 149.5 } })
    });

    const result = await fetchHistoricalRate('USD', 'JPY', '2024-01-01');

    expect(1 * result.rate).toBe(149.5);
  });

  it('handles very small rates without losing precision', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ base: 'USD', date: '2024-01-01', rates: { XYZ: 0.00001 } })
    });

    const result = await fetchHistoricalRate('USD', 'XYZ', '2024-01-01');

    expect(1000 * result.rate).toBeCloseTo(0.01);
  });
});
