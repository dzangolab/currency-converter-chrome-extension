# Quick Start - Running Tests

## 1. Install Dependencies

```bash
cd currency_converter
npm install
```

## 2. Run Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (re-runs when you edit files)
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

## What Gets Tested

### 📊 Data Persistence (storage.test.js)
- ✅ Saving form data to Chrome storage
- ✅ Loading saved data when popup opens
- ✅ Auto-save on input changes
- ✅ Error handling for storage failures
- **9 tests**

### 💱 Currency Conversion (conversion.test.js)
- ✅ Fetching historical exchange rates from API
- ✅ Displaying conversion results correctly
- ✅ Formatting large numbers with commas
- ✅ Handling API errors (404, 400, network)
- ✅ Form validation before conversion
- ✅ Conversion math accuracy
- **17 tests**

### 🖱️ User Interface (ui.test.js)
- ✅ Swap button functionality
- ✅ Form submission validation
- ✅ Copy result to clipboard
- ✅ Date validation (past/future dates)
- ✅ Error message display
- ✅ Loading indicator state
- ✅ Clipboard error handling
- **23 tests**

## Test Results Example

```
PASS  __tests__/storage.test.js
PASS  __tests__/conversion.test.js
PASS  __tests__/ui.test.js

Test Suites: 3 passed, 3 total
Tests:       49 passed, 49 total
Snapshots:   0 total
Time:        2.543 s
```

## Run Specific Tests

```bash
# Test only data persistence
npm test -- storage.test.js

# Test only conversion
npm test -- conversion.test.js

# Test only UI
npm test -- ui.test.js

# Test by name pattern
npm test -- --testNamePattern="swap"
```

## Coverage Report

```bash
npm run test:coverage
```

Shows:
- Lines covered: XX%
- Branches covered: XX%
- Functions covered: XX%
- Statements covered: XX%

## For Developers

See `TESTING.md` for:
- Detailed test documentation
- Test examples and patterns
- How to write new tests
- Mocking strategies
- CI/CD integration

## Key Test Scenarios

### 1. Data Persistence
```javascript
// User enters: 100 USD → EUR on 2024-01-15
// Close popup
// Reopen popup
// ✅ All data is restored
```

### 2. Conversion
```javascript
// API returns: 1 USD = 0.92 EUR
// User enters: 100 USD
// ✅ Shows: 92.00 EUR
```

### 3. Swap
```javascript
// USD ↔ EUR
// Click swap button
// ✅ Now shows: EUR ↔ USD
```

### 4. Validation
```javascript
// User enters: -50 USD
// ✅ Error: "Please enter a valid amount"
// 
// User selects: tomorrow's date
// ✅ Error: "Please select a date in the past or today"
```

## Troubleshooting

### Tests won't run
```bash
npm install
npm test -- --clearCache
```

### Module not found
```bash
npm install jest jest-environment-jsdom
```

### Tests are slow
- Check for missing mocks
- Look for unnecessary async/await
- Verify jest.setup.js is loading

## Next Steps

1. ✅ Run tests: `npm test`
2. ✅ Check coverage: `npm run test:coverage`
3. ✅ Read TESTING.md for details
4. ✅ Add new tests for new features

---

**Total Tests: 49**
**Test Files: 3**
**Coverage Target: >80%**
