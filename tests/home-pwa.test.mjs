import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';

// Setup mock browser globals before imports
let matchMediaStandalone = false;
global.window = {
  matchMedia: (query) => ({
    matches: query.includes('display-mode: standalone') ? matchMediaStandalone : false,
  }),
  localStorage: {
    _store: {},
    getItem(k) { return this._store[k] ?? null; },
    setItem(k, v) { this._store[k] = String(v); },
    removeItem(k) { delete this._store[k]; },
    clear() { this._store = {}; },
  },
};
global.localStorage = global.window.localStorage;
let navStandalone = false;
try {
  Object.defineProperty(globalThis, 'navigator', {
    value: { get standalone() { return navStandalone; } },
    writable: true,
    configurable: true,
  });
} catch {
  // ignore
}
global.document = {
  documentElement: { setAttribute: () => {}, removeAttribute: () => {} },
  querySelector: () => null,
  referrer: '',
};

import * as store from '../src/store.js';
import * as db from '../src/lib/db.js';
import homeView, {
  isStandaloneMode,
  isHomeInstallPromptDismissed,
  dismissHomeInstallPrompt,
  resetHomeInstallPrompt,
} from '../src/views/home.js';

test('isStandaloneMode detection logic', () => {
  matchMediaStandalone = false;
  navStandalone = false;
  global.document.referrer = '';
  assert.equal(isStandaloneMode(), false, 'Should be false in standard browser mode');

  matchMediaStandalone = true;
  assert.equal(isStandaloneMode(), true, 'Should be true when matchMedia reports standalone');

  matchMediaStandalone = false;
  navStandalone = true;
  assert.equal(isStandaloneMode(), true, 'Should be true when navigator.standalone is true (iOS)');

  navStandalone = false;
  global.document.referrer = 'android-app://com.example.rakeez';
  assert.equal(isStandaloneMode(), true, 'Should be true when document.referrer is android-app');

  global.document.referrer = '';
  assert.equal(isStandaloneMode(), false);
});

test('Home PWA install prompt dismissal and 14-day suppression rule', () => {
  global.window.localStorage.clear();
  resetHomeInstallPrompt();

  assert.equal(isHomeInstallPromptDismissed(), false, 'Prompt should not be dismissed initially');

  dismissHomeInstallPrompt();
  assert.equal(isHomeInstallPromptDismissed(), true, 'Prompt should be dismissed immediately after action');

  // Test 14-day suppression: Within 13 days, remains dismissed
  const thirteenDaysAgo = Date.now() - (13 * 24 * 60 * 60 * 1000);
  global.window.localStorage.setItem('rakeezx_home_pwa_dismissed_at', String(thirteenDaysAgo));
  assert.equal(isHomeInstallPromptDismissed(), true, 'Prompt should remain suppressed within 14-day window');

  // After 15 days, suppression expires and prompt reappears
  const fifteenDaysAgo = Date.now() - (15 * 24 * 60 * 60 * 1000);
  global.window.localStorage.setItem('rakeezx_home_pwa_dismissed_at', String(fifteenDaysAgo));
  // clear in-memory session flag by calling reset then re-setting storage
  resetHomeInstallPrompt();
  global.window.localStorage.setItem('rakeezx_home_pwa_dismissed_at', String(fifteenDaysAgo));
  assert.equal(isHomeInstallPromptDismissed(), false, 'Prompt should reappear after 14-day suppression expires');

  // Reset clears suppression completely
  resetHomeInstallPrompt();
  assert.equal(isHomeInstallPromptDismissed(), false);
});

test('Home view render: shows prompt when not installed and not dismissed', async () => {
  await store.init();
  matchMediaStandalone = false;
  navStandalone = false;
  global.document.referrer = '';
  global.window.localStorage.clear();
  resetHomeInstallPrompt();
  global.window.deferredInstallPrompt = null;

  const template = homeView.render();
  const htmlStr = template.value;

  assert.ok(htmlStr.includes('id="home-pwa-prompt"'), 'Home prompt should be rendered when not installed');
  assert.ok(htmlStr.includes('id="home-pwa-install-btn"'), 'Install/guide button should be rendered');
  assert.ok(htmlStr.includes('id="home-pwa-dismiss-btn"'), 'Dismiss button should be rendered');
  assert.ok(htmlStr.includes('إرشادات التثبيت'), 'Should show "إرشادات التثبيت" when deferredInstallPrompt is absent');
  assert.ok(htmlStr.includes('تطبيق رَكيز X على جهازك'), 'Should show brief title');
});

test('Home view render: shows direct install button when deferredInstallPrompt exists', async () => {
  matchMediaStandalone = false;
  navStandalone = false;
  global.document.referrer = '';
  resetHomeInstallPrompt();
  global.window.deferredInstallPrompt = { prompt: () => {}, userChoice: Promise.resolve({ outcome: 'accepted' }) };

  const template = homeView.render();
  const htmlStr = template.value;

  assert.ok(htmlStr.includes('id="home-pwa-prompt"'));
  assert.ok(htmlStr.includes('تثبيت التطبيق'), 'Should show "تثبيت التطبيق" when deferred prompt is ready');

  global.window.deferredInstallPrompt = null;
});

test('Home view render: hides prompt when app is already installed', async () => {
  matchMediaStandalone = true;
  resetHomeInstallPrompt();

  const template = homeView.render();
  const htmlStr = template.value;

  assert.ok(!htmlStr.includes('id="home-pwa-prompt"'), 'Home prompt must NOT be rendered when app is installed');
  matchMediaStandalone = false;
});

test('Home view render: hides prompt when dismissed', async () => {
  matchMediaStandalone = false;
  dismissHomeInstallPrompt();

  const template = homeView.render();
  const htmlStr = template.value;

  assert.ok(!htmlStr.includes('id="home-pwa-prompt"'), 'Home prompt must NOT be rendered when dismissed');
  resetHomeInstallPrompt();

  store.closeChannel();
  await db.closeDB();
});
