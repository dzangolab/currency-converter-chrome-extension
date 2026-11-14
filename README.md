# Historical Currency Converter Extension

A Chrome/Chromium extension for converting currencies at historical exchange rates from any date in the past.

## Features

✨ **Key Capabilities:**
- Choose from two exchange-rate providers, each with its own currency list and historical range
- Convert between 30 currencies (Frankfurter.app / ECB) or 160+ currencies (fawazahmed0/currency-api)
- Access historical exchange rates back to 1999 (Frankfurter) or 2024-03-02 (fawazahmed0)
- Configurable default provider and currencies via a Settings page
- Real-time conversion as you type
- Simple, clean interface
- Copy results to clipboard
- No API key required for either provider

## Installation

### From the Chrome Web Store

1. Open the extension's page on the Chrome Web Store
2. Click **Add to Chrome**, then **Add extension** to confirm
3. Pin it from the puzzle-piece (Extensions) menu so its icon stays in the toolbar

The same listing works in any Chromium-based browser that accepts Chrome Web Store extensions (Brave, Edge, Opera, Vivaldi). Firefox and Safari aren't supported.

Once installed, click the toolbar icon to open the converter, pick a provider, currencies, amount and date, and the result appears right away.

### From source (for development)

1. Clone this repository
2. Open `chrome://extensions/` (or `brave://extensions/`, `edge://extensions/`)
3. Turn on **Developer mode** (top right)
4. Click **Load unpacked** and select the **`extension/`** folder, not the repo root
5. After editing a file, click the reload icon on the extension's card and reopen the popup

Only `extension/` is shipped. Everything else in the repo (`__tests__/`, `node_modules/`, `package.json`, …) is test tooling. Chrome refuses to load any folder that contains a file or directory whose name starts with `_`, so pointing it at the repo root fails with "Failed to load extension". To run the tests, see [Development](#development).

## How to Use

### Basic Workflow

1. **Choose a Provider**: Pick Frankfurter.app or fawazahmed0/currency-api — this determines both the currency list below and how far back you can pick a date
2. **Enter Amount**: Type the amount you want to convert (default: 1)
3. **Select Source Currency**: Choose the currency you're converting from
4. **Select Target Currency**: Choose the currency you're converting to
5. **Select Date**: Pick a date within the chosen provider's supported range
6. **View Result**: The converted amount appears instantly
7. **Copy Result**: Click the "Copy Result" button to copy to clipboard

Switching providers rebuilds both currency dropdowns for the new provider's currency list. If your currently-selected currency isn't available under the new provider (e.g. AED isn't on Frankfurter's list), that field resets to USD/EUR.

### Settings

Click the ⚙ icon in the popup (or right-click the extension icon → Options, or "Extension options" from `chrome://extensions/`) to open the Settings page and configure your default provider and default "from"/"to" currencies.

These are the defaults shown when there's nothing else to go on. Once you convert something, the popup remembers that specific provider/currencies/amount/date and restores it on every subsequent open, taking priority over these Settings. **Changing any Settings field clears that remembered session** — so a change here always takes visible effect the next time you open the popup, rather than being silently overridden by whatever you converted last.

### Reset

Click the ↺ icon in the popup (next to ⚙ Settings) to immediately revert the form to your configured Settings — provider, "from"/"to" currencies, amount back to 1, date back to today — without leaving the popup. This also clears the remembered session the same way changing a Settings field does, and re-runs the conversion against the reset values so you see a live result right away, not a blank form.

### Real-Time Conversion

The extension automatically converts as you:
- Change the amount
- Switch currencies
- Select a different date

Simply wait a moment for the API to respond and the result updates automatically.

### Date Selection

- **Supported Range**: depends on the selected provider — see below. Picking a date outside a provider's range returns "No data available for this date," which is about the date/provider combination, not the currency pair.
- **Weekend/Holiday Handling**: both APIs return the most recent available rate
- **Future Dates**: blocked client-side to prevent errors
- **Format**: YYYY-MM-DD (selected via date picker)

## Supported Currencies & Providers

### Frankfurter.app
Sources rates from the European Central Bank's reference rates, which only cover these 30 currencies — historical data back to **January 1, 1999**:

AUD, BRL, CAD, CHF, CNY, CZK, DKK, EUR, GBP, HKD, HUF, IDR, ILS, INR, ISK, JPY, KRW, MXN, MYR, NOK, NZD, PHP, PLN, RON, SEK, SGD, THB, TRY, USD, ZAR

### fawazahmed0/currency-api
A community-maintained, CDN-hosted API covering 160+ currencies (curated here to exclude its long tail of crypto tokens) — but its daily-snapshot history only goes back to **2024-03-02**, not 1999. It has no query-param endpoint: a request returns the entire rate basket for one base currency, and this extension picks the target rate back out of that response. If the primary CDN (`cdn.jsdelivr.net`) fails, the extension automatically retries against its documented Cloudflare Pages mirror.

See `extension/providers.js` for both full lists with display names. Any code outside a provider's list isn't available through that provider and won't convert, regardless of date — and the extension blocks selecting the same currency for both sides regardless of provider.

## API Reference

### Frankfurter.app
**Endpoint**: `https://api.frankfurter.app/{date}?from={source}&to={target}`

**Response Example**:
```json
{
  "base": "USD",
  "date": "2020-01-15",
  "rates": {
    "EUR": 0.92
  }
}
```

### fawazahmed0/currency-api
**Endpoint**: `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@{date}/v1/currencies/{source-lowercase}.json` (fallback: `https://{date}.currency-api.pages.dev/v1/currencies/{source-lowercase}.json`)

**Response Example** (note: the *entire* rate basket for the base currency, not just the requested target):
```json
{
  "date": "2024-06-03",
  "usd": {
    "eur": 0.9223,
    "aed": 3.6725,
    "...": "..."
  }
}
```

**Limitations (both)**:
- Free, no authentication required
- Most recent rates typically available from the previous business day
- Rate limits: generous for casual use (fawazahmed0 explicitly advertises none)

## Troubleshooting

### "No data available for this date"
- The requested currency pair may not have historical data for that specific date
- Try a different date (usually weekends/holidays have no data)
- Try a different currency pair

### "Invalid currency code"
- Ensure both currencies are selected from the dropdown
- Check that currency codes are valid ISO 4217 codes

### Extension won't load
- Verify all required files are present in the folder you selected:
  - manifest.json
  - popup.html
  - popup.js
  - providers.js
  - options.html
  - options.js
  - options.css
  - styles.css
- Make sure you selected the `extension/` subfolder, not the repo root (see Installation above)
- Check browser console for error messages (F12 → Console tab)
- Ensure you're using Chrome, Edge, Brave, or another Chromium-based browser

### Results seem incorrect
- Verify the date is correct (historical rates change)
- Check that you selected the right currencies
- Confirm the amount is entered correctly
- The two providers source data independently and can differ slightly from each other and from other sources

## Development

### File Structure
```
currency_converter/
├── extension/          # <- Load THIS folder as the unpacked extension
│   ├── manifest.json   # Extension configuration (Manifest V3)
│   ├── popup.html      # User interface
│   ├── popup.js        # Conversion logic; provider-agnostic
│   ├── providers.js    # Provider definitions: currency lists, URL/response handling
│   ├── options.html    # Settings page UI
│   ├── options.js      # Settings page logic (saves/loads extensionSettings)
│   ├── options.css     # Settings page layout override (full-tab, not popup-width)
│   ├── styles.css      # Shared styling (popup + settings)
│   └── vendor/
│       └── temporal-polyfill.js   # @js-temporal/polyfill, vendored (see Key Technologies)
├── __tests__/          # Jest test suite (not part of the extension)
├── package.json        # Test tooling, plus the one vendored runtime dependency
└── README.md           # This file
```

### Permissions Used
- `activeTab`: To detect when user opens the popup
- `host_permissions`: To fetch data from `https://api.frankfurter.app/*`, `https://cdn.jsdelivr.net/*`, and `https://*.currency-api.pages.dev/*` (fawazahmed0's Cloudflare Pages fallback)
- `options_page`: Registers `options.html` as the extension's Settings page (opens from `chrome://extensions/`, the right-click context menu, or the ⚙ button in the popup)

### Key Technologies
- **Manifest V3**: Latest Chrome extension standard
- **Vanilla JavaScript**: No frameworks
- **[Temporal](https://tc39.es/proposal-temporal/)**: all date handling (`Temporal.PlainDate`, `Temporal.Now.plainDateISO()`) instead of `Date` — sidesteps `Date`'s UTC-vs-local timezone ambiguity entirely for calendar-only values like a `YYYY-MM-DD` date input. Not yet native in Chrome, so `extension/vendor/temporal-polyfill.js` (from `@js-temporal/polyfill`) is loaded on the popup; drop it once Chrome ships `Temporal` natively.
- **Fetch API**: For HTTP requests to either provider
- **CSS Grid/Flexbox**: For responsive layout

### Commit Conventions & Git Hooks

Commits must follow [Conventional Commits](https://www.conventionalcommits.org/) (`type: subject`, e.g. `fix: correct date range validation`, `feat: add reset button`) — enforced by [commitlint](https://commitlint.js.org/) (`commitlint.config.js`) via a [husky](https://typicode.github.io/husky/) `commit-msg` hook. A `pre-commit` hook also runs [sort-package-json](https://github.com/keithamus/sort-package-json) (re-staging `package.json` if it changed) and the full test suite — a commit is rejected if either hook fails. Hooks install automatically via `npm install`'s `prepare` script; check a message without committing with `echo "your message" | npx commitlint`.

### Adding a New Provider

Add an entry to the `PROVIDERS` object in `extension/providers.js` with: `id`, `label`, `currencies` (array of `{code, name}` — verify each code actually exists in that API's own currency-list response first), `buildUrl(from, to, date)`, `parseRate(data, from, to)`, `describeHttpError(status)`, and optionally `buildFallbackUrl(from, to, date)`. Then add its host(s) to `host_permissions` in `manifest.json` — a popup page's `fetch()` calls are blocked for hosts not declared there, even when the target sends permissive CORS headers.

### Modifying the Extension

To customize the extension:

1. **Change default provider/currencies without rebuilding**: use the Settings page (see above) — no code change needed.

2. **Change the hardcoded fallback defaults** (used before Settings has ever been saved — in `providers.js`'s `DOMContentLoaded` handler):
   ```javascript
   sourceCurrencySelect.value = 'EUR';  // Change from 'USD'
   targetCurrencySelect.value = 'GBP';  // Change from 'EUR'
   ```

3. **Change styling** (in `styles.css` for the popup+settings shared look, `options.css` for settings-page-only layout):
   - Modify color scheme, fonts, or layout
   - Update gradient colors in `linear-gradient()`

4. **Add new features** (in `popup.js`):
   - Cache historical rates for offline use
   - Add currency conversion history
   - Export results as CSV

## Privacy & Data

- **API calls only**: The only data sent anywhere is the currency pair and date of each conversion, to your selected provider (Frankfurter.app or fawazahmed0/currency-api's CDN)
- **Local storage only**: Your last conversion (provider, currencies, amount, date) and your Settings-page defaults are saved on your device via `chrome.storage.local`, never synced or sent anywhere. The last conversion is kept only so the popup can restore it, not as a history, and is erased when you click ↺ Reset or change a Setting
- **No authentication**: Neither provider needs an account or API key, so no credentials are stored
- **No tracking**: No analytics, telemetry or third-party scripts

## Performance

- **Fast**: Most conversions complete in < 500ms
- **One vendored dependency**: a [Temporal](https://tc39.es/proposal-temporal/) polyfill (`extension/vendor/temporal-polyfill.js`, ~240KB unminified) is loaded on the popup for date handling, until Chrome ships `Temporal` natively — everything else is dependency-free
- **Caching**: Consider implementing browser cache headers for repeat queries
- **Rate limiting**: both providers allow generous free usage; fawazahmed0 explicitly advertises none

## Limitations

- Historical range depends on the provider: Frankfurter goes back to 1999; fawazahmed0 only back to 2024-03-02
- Currency list depends on the provider: 30 (Frankfurter) vs. 160+ (fawazahmed0, crypto excluded)
- Weekend/holiday rates may use previous business day's data
- Requires internet connection (API-dependent)

## License & Attribution

- **Extension**: [MIT License](LICENSE)
- **Data Sources**: [Frankfurter.app](https://www.frankfurter.app/) (ECB reference rates, free to use) and [fawazahmed0/currency-api](https://github.com/fawazahmed0/exchange-api) (community-maintained, free to use)

## Future Enhancements

Possible additions to the extension:

- [ ] Offline mode with cached historical rates
- [ ] Conversion history with timestamps
- [ ] Batch conversion (convert multiple currencies at once)
- [ ] Chart showing historical conversion rates over time
- [ ] Support for cryptocurrency conversion
- [ ] Reverse conversion (convert to and from)
- [ ] Custom conversion fee/margin calculator
- [ ] Dark mode toggle

## Support & Issues

For issues with the extension:

1. Check the troubleshooting section above
2. Verify all files are present and valid
3. Check browser console (F12) for error messages
4. Test with a different currency pair and date
5. Ensure you have internet connection

For issues with a specific provider's API:
- Frankfurter.app: https://www.frankfurter.app/
- fawazahmed0/currency-api: https://github.com/fawazahmed0/exchange-api
- Either API may have occasional downtime; try switching providers if one seems to be down

## Changelog

### Version 1.0.0 (Initial Release)
- ✨ Full historical currency conversion
- 📅 Date picker with validation
- 🌍 150+ supported currencies
- 📋 Copy to clipboard functionality
- ⚡ Real-time conversion as you type
- 🎨 Clean, modern UI with gradient design
- ✅ No API key required

---

**Made with ❤️ for currency traders, travelers, and finance enthusiasts**

Last Updated: 2026-09-12
