# Testing Guide - Historical Currency Converter

This document explains how to run tests for the currency converter extension.

## Setup

### 1. Install Dependencies

```bash
npm install
```

This installs Jest and other testing dependencies.

### 2. Run Tests

```bash
# Run all tests once
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

## Test Structure

The test suite is organized into 3 main test files:

### 1. **storage.test.js** - Data Persistence Tests
Tests for saving and loading user input data using Chrome's storage API.

**Coverage:**
- ✅ `saveFormData()` - Saves form inputs to storage
- ✅ `loadFormData()` - Restores saved data from storage
- ✅ Auto-save on input changes
- ✅ Error handling for storage failures
- ✅ Partial data restoration
- ✅ Storage quota errors

**Test Count:** 9 tests

**Example Test:**
```javascript
it('should save all form data to chrome.storage.local', () => {
  // Sets form inputs and calls saveFormData()
  // Verifies data is stored with correct structure
});
```

### 2. **conversion.test.js** - Conversion Functionality Tests
Tests for API integration, exchange rate calculations, and result display.

**Coverage:**
- ✅ `fetchHistoricalRate()` - Fetches rates from Frankfurter API
- ✅ `displayResult()` - Formats and displays conversion results
- ✅ API error handling (404, 400, network errors)
- ✅ Form validation
- ✅ Conversion calculation accuracy
- ✅ Number formatting (thousands separator, decimals)
- ✅ Edge cases (zero amounts, negative amounts)

**Test Count:** 17 tests

**Example Test:**
```javascript
it('should fetch exchange rate from API with correct URL', async () => {
  // Mocks fetch call
  // Verifies correct API endpoint is called
  // Checks returned rate is correct
});
```

### 3. **ui.test.js** - User Interface Tests
Tests for button interactions, form submission, and UI state management.

**Coverage:**
- ✅ Swap button functionality
- ✅ Form submission validation
- ✅ Copy to clipboard
- ✅ Date validation (past/future dates)
- ✅ Error message display
- ✅ Loading indicator state
- ✅ Clipboard error handling

**Test Count:** 23 tests

**Example Test:**
```javascript
it('should swap source and target currencies when clicked', () => {
  // Sets initial currencies
  // Calls swap function
  // Verifies values are swapped
});
```

## Running Specific Tests

```bash
# Run only storage tests
npm test -- storage.test.js

# Run only conversion tests
npm test -- conversion.test.js

# Run only UI tests
npm test -- ui.test.js

# Run tests matching a pattern
npm test -- --testNamePattern="swap"
```

## Test Coverage Report

Generate a coverage report:

```bash
npm run test:coverage
```

This creates a `coverage/` directory with detailed coverage stats showing:
- **Lines covered** - % of code lines executed
- **Branches covered** - % of conditional branches tested
- **Functions covered** - % of functions tested
- **Statements covered** - % of statements tested

## Mocking

### Chrome API
The tests mock Chrome's storage API:
```javascript
global.chrome = {
  storage: {
    local: {
      set: jest.fn(),
      get: jest.fn()
    }
  }
};
```

### Fetch API
The tests mock the fetch function to avoid real API calls:
```javascript
global.fetch = jest.fn();

// In test:
global.fetch.mockResolvedValueOnce({
  ok: true,
  json: async () => ({ rates: { EUR: 0.92 } })
});
```

### Clipboard API
The tests mock the Clipboard API for copy functionality:
```javascript
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn(() => Promise.resolve())
  }
});
```

## Test Examples

### Testing Data Persistence

```javascript
// Test saving form data
it('should save all form data to chrome.storage.local', () => {
  // 1. Set form values
  sourceAmount.value = '100';
  sourceCurrency.value = 'USD';
  
  // 2. Call save function
  saveFormData();
  
  // 3. Verify chrome.storage.local.set was called
  expect(chrome.storage.local.set).toHaveBeenCalledWith(
    {
      converterData: {
        sourceAmount: '100',
        sourceCurrency: 'USD',
        targetCurrency: targetCurrency.value,
        conversionDate: conversionDate.value
      }
    },
    expect.any(Function)
  );
});
```

### Testing API Calls

```javascript
// Test fetching exchange rate
it('should fetch exchange rate from API', async () => {
  // 1. Mock the API response
  global.fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      base: 'USD',
      date: '2024-01-15',
      rates: { EUR: 0.92 }
    })
  });
  
  // 2. Call fetch function
  const result = await fetchHistoricalRate('USD', 'EUR', '2024-01-15');
  
  // 3. Verify correct URL was called
  expect(global.fetch).toHaveBeenCalledWith(
    'https://api.frankfurter.app/2024-01-15?from=USD&to=EUR'
  );
  
  // 4. Verify result
  expect(result.rate).toBe(0.92);
});
```

### Testing UI Interactions

```javascript
// Test swap button
it('should swap currencies when clicked', () => {
  // 1. Set initial values
  sourceCurrency.value = 'USD';
  targetCurrency.value = 'EUR';
  
  // 2. Call swap function
  const temp = sourceCurrency.value;
  sourceCurrency.value = targetCurrency.value;
  targetCurrency.value = temp;
  
  // 3. Verify values are swapped
  expect(sourceCurrency.value).toBe('EUR');
  expect(targetCurrency.value).toBe('USD');
});
```

## Common Testing Patterns

### Async/Await Testing

```javascript
it('should work with async functions', async () => {
  const result = await asyncFunction();
  expect(result).toBe(expectedValue);
});
```

### Testing Errors

```javascript
it('should throw error for invalid input', () => {
  expect(() => {
    functionThatThrows();
  }).toThrow('Expected error message');
});
```

### Testing DOM Manipulation

```javascript
it('should update DOM element', () => {
  const element = document.getElementById('result');
  element.textContent = 'New text';
  expect(element.textContent).toBe('New text');
});
```

## Continuous Integration

To run tests in a CI/CD pipeline:

```bash
npm test -- --ci --coverage --watchAll=false
```

## Debugging Tests

### Run single test file
```bash
npm test -- storage.test.js
```

### Run single test
```bash
npm test -- --testNamePattern="exact test name"
```

### Show verbose output
```bash
npm test -- --verbose
```

### Keep running in watch mode
```bash
npm run test:watch
```

## Writing New Tests

When adding new features, follow this pattern:

```javascript
describe('Feature Name', () => {
  
  it('should do something when condition met', () => {
    // Arrange - set up test data
    const input = 'test data';
    
    // Act - perform the action
    const result = functionToTest(input);
    
    // Assert - verify the result
    expect(result).toBe('expected output');
  });
});
```

## Test Results Interpretation

### Passing Tests
✅ All assertions passed, feature works correctly

### Failing Tests
❌ One or more assertions failed, needs investigation

### Skipped Tests
⊘ Test marked with `it.skip()`, not currently running

### Pending Tests
⊘ Test with `it.todo()`, not yet implemented

## Performance

Tests should complete in under 5 seconds. If tests are slow:

1. Check for unnecessary async/await
2. Verify mocks are working properly
3. Look for missing `jest.useFakeTimers()`
4. Optimize heavy DOM operations

## Troubleshooting

### "Cannot find module" errors
```bash
npm install
```

### Tests not running
```bash
# Clear Jest cache
npm test -- --clearCache
```

### Mock not working
```javascript
// Make sure to clear mocks between tests
jest.clearAllMocks();
```

## Coverage Goals

Aim for:
- **Lines:** >80%
- **Branches:** >75%
- **Functions:** >80%
- **Statements:** >80%

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Jest Testing Library](https://testing-library.com/docs/dom-testing-library/intro/)
- [Chrome Extensions Testing](https://developer.chrome.com/docs/extensions/mv3/)

---

**Last Updated:** September 14, 2026
