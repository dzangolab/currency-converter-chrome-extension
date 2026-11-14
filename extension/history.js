// Conversion history: the last N successful conversions, newest first,
// stored under chrome.storage.local's "conversionHistory" key. N is the
// Settings page's "historySize" (part of extensionSettings), shared by
// options.js (to validate what's typed) and popup.js (to trim and render).
//
// Like providers.js, this attaches what it defines onto globalThis rather
// than using module.exports: a no-op in the browser, where classic <script>
// tags already share one global scope, but load-bearing under Jest/Node.

const DEFAULT_HISTORY_SIZE = 10;
const MAX_HISTORY_SIZE = 100;
const MIN_HISTORY_SIZE = 1;

const MONTH_ABBREVIATIONS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

// Any stored or typed value -> an integer within [MIN, MAX]; anything that
// isn't a number at all (missing setting, empty field) -> the default.
function normalizeHistorySize(value) {
  const size = Number.parseInt(value, 10);
  if (Number.isNaN(size)) return DEFAULT_HISTORY_SIZE;
  return Math.min(MAX_HISTORY_SIZE, Math.max(MIN_HISTORY_SIZE, size));
}

function formatHistoryAmount(amount) {
  return amount.toLocaleString('en-US', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  });
}

// "YYYY-MM-DD" -> "dd MMM yyyy", e.g. "2024-03-05" -> "05 Mar 2024".
// Built by hand rather than via toLocaleString(), whose day/month/year order
// and separators vary by locale and can't produce this exact pattern.
function formatHistoryDate(dateStr) {
  const date = Temporal.PlainDate.from(dateStr);
  const day = String(date.day).padStart(2, '0');
  return `${day} ${MONTH_ABBREVIATIONS[date.month - 1]} ${date.year}`;
}

// One history table row's cells, in column order. From and To each take two
// cells (currency, amount) so the currency can be left-aligned and the
// amount right-aligned, e.g.
// ["USD", "1,000.00", "0.921234", "EUR", "921.23", "05 Mar 2024"].
function formatHistoryCells(entry) {
  return [
    entry.sourceCurrency,
    formatHistoryAmount(entry.sourceAmount),
    entry.rate.toFixed(6),
    entry.targetCurrency,
    formatHistoryAmount(entry.sourceAmount * entry.rate),
    formatHistoryDate(entry.date)
  ];
}

function isSameConversion(a, b) {
  return a.apiProvider === b.apiProvider
    && a.date === b.date
    && a.sourceAmount === b.sourceAmount
    && a.sourceCurrency === b.sourceCurrency
    && a.targetCurrency === b.targetCurrency;
}

// Returns a new history with `entry` first, trimmed to `size`. Re-running
// the conversion that's already on top (e.g. clicking Convert twice) doesn't
// add a duplicate row.
function addToHistory(history, entry, size) {
  const previous = Array.isArray(history) ? history : [];
  const rest = previous.length && isSameConversion(previous[0], entry) ? previous.slice(1) : previous;
  return [entry, ...rest].slice(0, normalizeHistorySize(size));
}

Object.assign(globalThis, {
  DEFAULT_HISTORY_SIZE,
  MAX_HISTORY_SIZE,
  MIN_HISTORY_SIZE,
  addToHistory,
  formatHistoryCells,
  formatHistoryDate,
  normalizeHistorySize
});
