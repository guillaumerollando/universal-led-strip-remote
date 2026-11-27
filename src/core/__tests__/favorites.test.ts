import { describe, expect, it, vi } from 'vitest';

vi.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem: vi.fn(), setItem: vi.fn() } }));
vi.mock('react', () => ({ useEffect: vi.fn(), useSyncExternalStore: vi.fn() }));

const { favoritesFirst } = await import('../../services/favorites');

describe('favoris', () => {
  it('les favoris passent devant, le reste garde son ordre', () => {
    const items = ['cosy', 'cinema', 'party', 'love'];
    expect(favoritesFirst(items, (x) => `scene:${x}`, ['scene:love', 'scene:cinema'])).toEqual(['cinema', 'love', 'cosy', 'party']);
    expect(favoritesFirst(items, (x) => `scene:${x}`, [])).toEqual(items);
  });
});
