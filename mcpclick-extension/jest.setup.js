require('fake-indexeddb/auto');

// Polyfill for structuredClone, which is used by fake-indexeddb but not in jsdom
if (typeof global.structuredClone === 'undefined') {
  global.structuredClone = (val) => JSON.parse(JSON.stringify(val));
}

// Mock the chrome API
global.chrome = {
  storage: {
    sync: {
      get: jest.fn((keys, callback) => {
        // Handle both promise and callback styles
        if (callback) {
          callback(keys);
          return;
        }
        return Promise.resolve(keys);
      }),
      set: jest.fn((items, callback) => {
        if (callback) {
          callback();
        }
        return Promise.resolve();
      }),
    },
  },
  runtime: {
    onMessage: {
      addListener: jest.fn(),
    },
    sendMessage: jest.fn(),
  },
};
