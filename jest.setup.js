// AsyncStorage has no native module under Jest; use the mock the package ships.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Reanimated 4 / worklets 0.7 (SDK 55 bump) initializes its native module eagerly at require
// time, throwing "Native part of Worklets doesn't seem to be initialized" under Jest, which has
// no native module to find. The package ships its own Jest mock for exactly this; substituting the
// whole module means the real (throwing) constructor is never reached.
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
