// Mock for Expo SDK 55 WinterCG runtime — prevents "import outside scope" Jest error
// The actual runtime installs globals lazily; in Jest we just provide a no-op
module.exports = {};
