import assert from 'node:assert/strict';

// Isolated failure cases use the actual UI and synthetic records, never the user's browser profile.
export async function checkPublicationDraftFailures(browser, origin, entry) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const shareUrl = `${origin}/#/entries/${encodeURIComponent(entry.id)}?share=1`;
  async function open() {
    await page.goto(shareUrl);
    await page.reload();
    await page.locator('.review-share-dialog[open]').waitFor();
    await page.getByLabel('公众号稿', { exact: true }).check();
    await page.getByLabel('推文标题', { exact: true }).waitFor();
  }
  try {
    await page.goto(origin);
    await page.evaluate(item => {
      localStorage.clear();
      localStorage.setItem('music-feelings-mobile-entries', JSON.stringify([item]));
    }, entry);
    await open();
    await page.getByText('推文草稿已保存在本机。', { exact: false }).waitFor();
    const key = await page.evaluate(() => Object.keys(localStorage).find(item => item.startsWith('codex.publication.draft.v1:')));
    assert.ok(key, 'actual composer creates a source-specific draft');
    await page.getByRole('button', { name: '关闭分享预览', exact: true }).click();
    await page.evaluate(key => localStorage.setItem(key, '{corrupt'), key);
    await open();
    await page.getByText('本机推文草稿读取或校验失败，旧副本已保留。当前稿件仍可复制、导出。', { exact: true }).waitFor();
    await page.getByLabel('推文标题', { exact: true }).fill('损坏副本仍应保留');
    await page.waitForTimeout(600);
    assert.equal(await page.evaluate(key => localStorage.getItem(key), key), '{corrupt', 'corrupt draft is not overwritten by autosave');
    page.once('dialog', dialog => dialog.dismiss());
    await page.getByRole('button', { name: '关闭分享预览', exact: true }).click();
    assert.equal(await page.locator('.review-share-dialog[open]').count(), 1, 'declining leave preserves the active editor');
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: '从原文重新生成', exact: true }).click();
    await page.getByText('推文草稿已保存在本机。', { exact: false }).waitFor();
    const regenerated = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
    assert.equal(regenerated.draft.title, entry.title, 'explicit regeneration replaces only the damaged publication draft');

    await page.evaluate(() => {
      window.__codexPublicationSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function(key, value) {
        if (key.startsWith('codex.publication.draft.v1:')) throw new DOMException('simulated quota', 'QuotaExceededError');
        return window.__codexPublicationSetItem.call(this, key, value);
      };
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async value => { window.__codexFailureCopy = value; } } });
    });
    await page.getByLabel('推文标题', { exact: true }).fill('配额不足时的当前输入');
    await page.getByText('推文草稿未能自动保存，当前输入仍保留。请先复制或导出稿件。', { exact: true }).waitFor();
    assert.equal(await page.getByLabel('推文标题', { exact: true }).inputValue(), '配额不足时的当前输入');
    page.once('dialog', dialog => dialog.dismiss());
    await page.getByRole('button', { name: '关闭分享预览', exact: true }).click();
    assert.equal(await page.locator('.review-share-dialog[open]').count(), 1, 'failed-save leave cancellation keeps input');
    await page.getByRole('button', { name: '复制标题', exact: true }).click();
    await page.getByText('已复制标题，请填入公众号标题栏。', { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => window.__codexFailureCopy), '配额不足时的当前输入', 'failed autosave still allows copying the current draft');
    await page.evaluate(() => { Storage.prototype.setItem = window.__codexPublicationSetItem; });
    await page.getByRole('button', { name: '关闭分享预览', exact: true }).click();
    const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)).draft.title, key);
    assert.equal(saved, '配额不足时的当前输入', 'restored storage capability saves the current draft on close');
    assert.equal(await page.evaluate(() => localStorage.getItem('music-feelings-mobile-entries')), JSON.stringify([entry]), 'failure recovery preserves original records');
    assert.deepEqual(errors, []);
    return ['corrupt draft preserved until explicit reset', 'quota failure retains input, guards leaving, permits copy, and recovers saving'];
  } finally {
    await page.evaluate(() => { if (window.__codexPublicationSetItem) Storage.prototype.setItem = window.__codexPublicationSetItem; }).catch(() => {});
    await context.close();
  }
}
