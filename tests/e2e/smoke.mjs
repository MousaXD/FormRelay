import http from 'node:http';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Builder, Browser, By, Key, until } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';
import firefox from 'selenium-webdriver/firefox.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sourceFirefoxBuild = path.join(repoRoot, '.output/firefox-mv3');
const sourceChromiumBuild = path.join(repoRoot, '.output/chrome-mv3');
const fixturePath = path.join(repoRoot, 'tests/e2e/fixtures/basic-form.html');
const harnessDir = path.join(repoRoot, 'tests/e2e/harness');
const ADDON_ID = 'mousashriteh0@gmail.com';

async function prepareBuild(sourceDir, targetDir, browser) {
  await cp(sourceDir, targetDir, { recursive: true });
  const target = path.join(targetDir, 'e2e');
  await mkdir(target, { recursive: true });
  await cp(path.join(harnessDir, 'harness.html'), path.join(target, 'harness.html'));
  await cp(path.join(harnessDir, 'harness.js'), path.join(target, 'harness.js'));

  if (browser === 'chromium') {
    const manifestPath = path.join(targetDir, 'manifest.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    manifest.commands = {
      _execute_action: { suggested_key: { default: 'Ctrl+Shift+Y' } },
    };
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  }
}

async function fixtureServer() {
  const html = await readFile(fixturePath);
  const server = http.createServer((request, response) => {
    if (request.url === '/basic-form.html') {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      response.end(html);
      return;
    }
    response.writeHead(404);
    response.end('not found');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Could not start fixture server.');
  return {
    url: `http://127.0.0.1:${address.port}/basic-form.html`,
    close: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

async function runHarness(driver, harnessUrl, targetUrl) {
  await driver.switchTo().newWindow('tab');
  await driver.get(`${harnessUrl}?target=${encodeURIComponent(targetUrl)}`);
  await driver.wait(until.elementLocated(By.css('body[data-done="true"]')), 15000);
  const raw = await driver.findElement(By.id('result')).getText();
  const result = JSON.parse(raw);
  if (!result.ok) throw new Error(`Extension harness failed: ${result.error ?? raw}`);
  if (result.submitCount !== 0) throw new Error('Extension smoke test observed a form submission.');
  return result;
}

async function assertPopupShell(driver, popupUrl) {
  await driver.switchTo().newWindow('tab');
  await driver.get(popupUrl);
  const heading = await driver.wait(until.elementLocated(By.css('h1')), 10000);
  if ((await heading.getText()) !== 'FormRelay') throw new Error('Popup shell did not load.');
}

async function firefoxSmoke(targetUrl, firefoxBuild) {
  // Current geckodriver requires its own explicit system-access opt-in before
  // Marionette may enter Firefox's privileged browser context. This is confined
  // to the E2E process and does not change FormRelay's extension permissions.
  const options = new firefox.Options().addArguments('-headless');
  const service = new firefox.ServiceBuilder().addArguments('--allow-system-access');
  const driver = await new Builder()
    .forBrowser(Browser.FIREFOX)
    .setFirefoxOptions(options)
    .setFirefoxService(service)
    .build();

  try {
    await driver.installAddon(firefoxBuild, true);
    await driver.get(targetUrl);

    await driver.setContext(firefox.Context.CHROME);
    const urls = await driver.executeScript(`
      const policy = WebExtensionPolicy.getByID(arguments[0]);
      if (!policy) throw new Error('FormRelay WebExtensionPolicy was not found.');
      const win = Services.wm.getMostRecentWindow('navigator:browser');
      policy.extension.tabManager.addActiveTabPermission(win.gBrowser.selectedTab);
      return {
        harness: policy.getURL('e2e/harness.html'),
        popup: policy.getURL('popup.html'),
      };
    `, ADDON_ID);
    await driver.setContext(firefox.Context.CONTENT);

    const result = await runHarness(driver, urls.harness, targetUrl);
    await assertPopupShell(driver, urls.popup);
    return result;
  } finally {
    await driver.quit();
  }
}

async function findChromiumExtensionId(driver) {
  await driver.get('chrome://extensions/');
  return driver.wait(async () => {
    const id = await driver.executeScript(`
      const manager = document.querySelector('extensions-manager');
      const list = manager?.shadowRoot?.querySelector('extensions-item-list');
      const items = list?.shadowRoot?.querySelectorAll('extensions-item') ?? [];
      for (const item of items) {
        const name = item.shadowRoot?.querySelector('#name')?.textContent?.trim();
        if (name === 'FormRelay') return item.getAttribute('id') || item.id || null;
      }
      return null;
    `);
    return id || false;
  }, 10000);
}

async function chromiumSmoke(targetUrl, chromiumBuild) {
  const options = new chrome.Options().addArguments(
    '--headless=new',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    `--load-extension=${chromiumBuild}`,
  );
  const driver = await new Builder()
    .forBrowser(Browser.CHROME)
    .setChromeOptions(options)
    .build();

  try {
    const extensionId = await findChromiumExtensionId(driver);
    await driver.get(targetUrl);

    await driver.actions()
      .keyDown(Key.CONTROL)
      .keyDown(Key.SHIFT)
      .sendKeys('y')
      .keyUp(Key.SHIFT)
      .keyUp(Key.CONTROL)
      .perform();
    await driver.sleep(500);

    const base = `chrome-extension://${extensionId}`;
    const result = await runHarness(driver, `${base}/e2e/harness.html`, targetUrl);
    await assertPopupShell(driver, `${base}/popup.html`);
    return result;
  } finally {
    await driver.quit();
  }
}

async function main() {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'formrelay-e2e-'));
  const firefoxBuild = path.join(tempRoot, 'firefox');
  const chromiumBuild = path.join(tempRoot, 'chromium');
  const server = await fixtureServer();

  try {
    await prepareBuild(sourceFirefoxBuild, firefoxBuild, 'firefox');
    await prepareBuild(sourceChromiumBuild, chromiumBuild, 'chromium');
    const firefoxResult = await firefoxSmoke(server.url, firefoxBuild);
    console.log('Firefox extension smoke:', firefoxResult);
    const chromiumResult = await chromiumSmoke(server.url, chromiumBuild);
    console.log('Chromium extension smoke:', chromiumResult);
  } finally {
    await server.close();
    await rm(tempRoot, { recursive: true, force: true });
  }
}

await main();
