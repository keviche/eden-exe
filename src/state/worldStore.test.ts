// Test file: src/state/worldStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useWorldStore } from './worldStore';

describe('World Store Activity Integration', () => {
  beforeEach(() => {
    // Reset world state before each test
    useWorldStore.getState().resetWorld();
  });

  it('updates the activity category correctly when switched', () => {
    const store = useWorldStore.getState();
    
    // Switch to leisure
    store.setActivityCategory('leisure');
    expect(useWorldStore.getState().world.activity.category).toBe('leisure');

    // Switch to productivity
    store.setActivityCategory('productivity');
    expect(useWorldStore.getState().world.activity.category).toBe('productivity');
  });

  it('forces category to idle when systemIdle is set to true', () => {
    const store = useWorldStore.getState();
    
    store.setActivityCategory('productivity');
    expect(useWorldStore.getState().world.activity.category).toBe('productivity');

    // Trigger system idle
    store.setSystemIdle(true);
    expect(useWorldStore.getState().world.activity.category).toBe('idle');

    // Remove system idle; should restore previous category
    store.setSystemIdle(false);
    expect(useWorldStore.getState().world.activity.category).toBe('productivity');
  });
});