module.exports = {
  testEnvironment: 'jsdom',
  collectCoverageFrom: [
    'extension/popup.js',
    'extension/providers.js',
    'extension/options.js',
    '!node_modules/**'
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testMatch: ['**/__tests__/**/*.test.js'],
};
