// Test file: electron/activityMonitor.test.js
const { describe, it, expect, vi, beforeEach } = require('vitest');

// Mock electron's powerMonitor
vi.mock('electron', () => ({
  powerMonitor: {
    getSystemIdleTime: vi.fn(() => 0), // 0 seconds idle = active
  },
}));

describe('Activity Monitor Classifier Logic', () => {
  it('correctly classifies productivity applications and windows', () => {
    // If you export classifyActivity from activityMonitor.cjs:
    // const { classifyActivity } = require('./activityMonitor.cjs');
    
    // Example test assertions for keywords:
    const productivityExamples = [
      { app: 'Visual Studio Code', title: 'index.tsx - Eden' },
      { app: 'Terminal', title: 'npm run dev' },
      { app: 'Figma', title: 'World Design UI' }
    ];

    productivityExamples.forEach(({ app, title }) => {
      // Assuming you test your classifier function directly:
      // expect(classifyActivity(app, title)).toBe('productivity');
    });
  });

  it('correctly classifies leisure applications and websites', () => {
    const leisureExamples = [
      { app: 'Steam', title: 'Counter-Strike 2' },
      { app: 'Google Chrome', title: 'YouTube - LoFi Beats' },
      { app: 'Discord', title: 'Chatting' }
    ];

    leisureExamples.forEach(({ app, title }) => {
      // expect(classifyActivity(app, title)).toBe('leisure');
    });
  });
});