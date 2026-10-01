import base from '../../playwright.config.js';
export default { ...base, testDir: '..', projects: ['chromium', 'firefox', 'webkit'].map(name => ({ name, use: { browserName: name } })) };
