module.exports = {
  collectCoverage: true,
  verbose: true,
  collectCoverageFrom: [
    "packages/**/*.{js,jsx}",
    "!**/node_modules/**",
    "!**/bundle.js",
    "!**/cheerio-bundle.js",
  ],
  moduleNameMapper: {
    "(@useparcel/.*)": "$1/index.js",
  },
};
