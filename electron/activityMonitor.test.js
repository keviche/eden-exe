import { describe, it, expect } from 'vitest';
import rules from './activityRules.cjs';

describe('Deterministic desktop activity classification', () => {
  it('recognizes productive and leisure desktop applications', () => {
    expect(rules.classifyWindow({ appName: 'Visual Studio Code' }).category).toBe('productivity');
    expect(rules.classifyWindow({ appName: 'Steam' }).category).toBe('leisure');
  });
  it('recognizes browser sites with hostname boundaries', () => {
    expect(rules.classifyWindow({ appName: 'Microsoft Edge', url: 'https://github.com/org/repo' }).category).toBe('productivity');
    expect(rules.classifyWindow({ appName: 'Microsoft Edge', url: 'https://fakegithub.com/' }).category).toBe('leisure');
  });
});
