import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import {
  hashPin,
  setupPinLocally,
  verifyPinOffline,
  getCachedToken,
} from '@/features/auth/pinAuth';

// expo-secure-store is mocked globally in jest.setup.js
// expo-crypto needs to be mocked here
jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA256' },
  digestStringAsync: jest.fn(),
}));

const mockDigest = Crypto.digestStringAsync as jest.Mock;
const mockGetItem = SecureStore.getItemAsync as jest.Mock;
const mockSetItem = SecureStore.setItemAsync as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  // Default: hashPin returns deterministic hex string
  mockDigest.mockResolvedValue('abc123hash');
  mockGetItem.mockResolvedValue(null);
  mockSetItem.mockResolvedValue(undefined);
});

describe('hashPin', () => {
  it('returns SHA-256 hex string for a PIN', async () => {
    mockDigest.mockResolvedValue('a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3');
    const result = await hashPin('1234');
    expect(result).toBe('a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3');
    expect(mockDigest).toHaveBeenCalledWith('SHA256', '1234');
  });

  it('is deterministic — same PIN gives same hash', async () => {
    mockDigest.mockResolvedValue('fixed-hash');
    const hash1 = await hashPin('5678');
    const hash2 = await hashPin('5678');
    expect(hash1).toBe(hash2);
    expect(hash1).toBe('fixed-hash');
  });
});

describe('setupPinLocally', () => {
  it('stores hash under pin_hash key in SecureStore', async () => {
    mockDigest.mockResolvedValue('myhash');
    await setupPinLocally('1234', 'my.jwt.token');
    expect(mockSetItem).toHaveBeenCalledWith('pin_hash', 'myhash');
  });

  it('stores JWT under auth_token key in SecureStore', async () => {
    await setupPinLocally('1234', 'my.jwt.token');
    expect(mockSetItem).toHaveBeenCalledWith('auth_token', 'my.jwt.token');
  });
});

describe('verifyPinOffline', () => {
  it('returns true when stored hash matches input PIN hash', async () => {
    mockDigest.mockResolvedValue('correct-hash');
    mockGetItem.mockImplementation((key: string) => {
      if (key === 'pin_hash') return Promise.resolve('correct-hash');
      return Promise.resolve(null);
    });
    const result = await verifyPinOffline('1234');
    expect(result).toBe(true);
  });

  it('returns false when stored hash does not match input PIN hash', async () => {
    mockDigest.mockResolvedValue('wrong-hash');
    mockGetItem.mockImplementation((key: string) => {
      if (key === 'pin_hash') return Promise.resolve('correct-hash');
      return Promise.resolve(null);
    });
    const result = await verifyPinOffline('9999');
    expect(result).toBe(false);
  });

  it('returns false when no stored hash exists (fresh install)', async () => {
    mockGetItem.mockResolvedValue(null);
    const result = await verifyPinOffline('1234');
    expect(result).toBe(false);
  });
});

describe('getCachedToken', () => {
  it('returns stored JWT when available', async () => {
    mockGetItem.mockImplementation((key: string) => {
      if (key === 'auth_token') return Promise.resolve('stored.jwt.token');
      return Promise.resolve(null);
    });
    const token = await getCachedToken();
    expect(token).toBe('stored.jwt.token');
  });

  it('returns null when no token stored', async () => {
    mockGetItem.mockResolvedValue(null);
    const token = await getCachedToken();
    expect(token).toBeNull();
  });
});
