module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  clearMocks: true,
  restoreMocks: true,
  setupFiles: ['<rootDir>/tests/setupEnv.js'],
  verbose: true,
};
