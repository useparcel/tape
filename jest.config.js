module.exports = {
  testMatch: ["**/test/**/*.[jt]s?(x)"],
  collectCoverage: true,
  verbose: true,
  collectCoverageFrom: [
    "packages/**/*.{js,jsx}",
    "!**/node_modules/**",
    "!**/bundle.js",
  ],
};
