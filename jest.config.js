module.exports = {
  testEnvironment: 'jsdom',
  collectCoverageFrom: [
    'extension/history.js',
    'extension/options.js',
    'extension/popup.js',
    'extension/providers.js',
    '!node_modules/**'
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testMatch: ['**/__tests__/**/*.test.js'],
};
