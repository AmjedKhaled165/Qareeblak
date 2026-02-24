module.exports = {
    testEnvironment: 'node',
    verbose: true,
    collectCoverage: true,
    coverageDirectory: 'coverage',
    testMatch: ['**/tests/**/*.test.js'],
    setupFiles: ['<rootDir>/tests/setup.js'],
};
