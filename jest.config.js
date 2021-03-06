module.exports = {
  collectCoverage: true,
  verbose: true,
  collectCoverageFrom: [
    "packages/**/*.{js,jsx}",
    "!**/node_modules/**",
    "!**/bundle.js",
    "!**/cheerio-bundle.js",
    "!**/dist/**",
  ],
  moduleNameMapper: {
    "(@useparcel/.*)": "$1/index.js",
  },
  transformIgnorePatterns: [
    "node_modules/(?!@useparcel/.*).*",
    "\\.pnp\\.[^\\/]+$",
  ],
};
