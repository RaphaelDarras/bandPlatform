module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|react-native-mmkv|react-native-reanimated))'
  ],
  setupFilesAfterEnv: ['./jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // Prevent Expo SDK 55 WinterCG runtime from triggering Jest scope errors
    'expo/src/winter/runtime\\.native': '<rootDir>/src/__mocks__/expo-winter-runtime.js',
    'expo/src/winter/runtime$': '<rootDir>/src/__mocks__/expo-winter-runtime.js',
    'expo/src/winter$': '<rootDir>/src/__mocks__/expo-winter-runtime.js',
    'expo/src/winter/installGlobal': '<rootDir>/src/__mocks__/expo-winter-runtime.js',
  }
};
