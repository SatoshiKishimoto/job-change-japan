// リッチメニュー画像を作る: NODE_PATH=$(npm root -g) node line/make_richmenu.js
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 2500, height: 1686 } });
  await p.goto('file://' + path.join(__dirname, 'richmenu.html'));
  await p.waitForTimeout(300);
  await p.screenshot({ path: path.join(__dirname, 'richmenu.png') });
  await b.close();
})();
