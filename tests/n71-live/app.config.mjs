import base from '../../playwright.config.js';
export default {...base,testDir:'..',testMatch:'n71-*.e2e.mjs',use:{...base.use,serviceWorkers:'block'},webServer:undefined};
