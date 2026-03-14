// Mock expo-sqlite
jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(() =>
    Promise.resolve({
      execAsync: jest.fn(() => Promise.resolve()),
      runAsync: jest.fn(() => Promise.resolve({ lastInsertRowId: 1, changes: 1 })),
      getFirstAsync: jest.fn(() => Promise.resolve(null)),
      getAllAsync: jest.fn(() => Promise.resolve([])),
      withTransactionAsync: jest.fn((fn) => fn()),
    })
  ),
}));

// Mock expo-secure-store
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));

// Mock react-native-mmkv (v4.x uses createMMKV instead of new MMKV())
jest.mock('react-native-mmkv', () => {
  const store = {};
  const mmkvInstance = {
    getString: jest.fn((key) => store[key] ?? undefined),
    set: jest.fn((key, value) => { store[key] = value; }),
    remove: jest.fn((key) => { delete store[key]; }),
  };
  return {
    createMMKV: jest.fn(() => mmkvInstance),
  };
});

// Mock @react-native-community/netinfo
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(() =>
    Promise.resolve({ isConnected: true, isInternetReachable: true })
  ),
}));
