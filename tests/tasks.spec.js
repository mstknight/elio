import { test, expect } from '@playwright/test';

async function add(page, title) {
  await page.locator('#task-input').fill(title);
  await page.getByRole('button', { name: '添加任务', exact: true }).click();
}

test('create, complete, filter, persist and delete', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await add(page, '  第一项  ');
  await add(page, '第二项');
  await page.locator('.task-item').last().getByRole('checkbox').check();
  await page.getByRole('button', { name: '已完成', exact: true }).click();
  await expect(page.locator('.task-title')).toHaveText('第一项');
  await page.reload();
  await expect(page.locator('.task-item')).toHaveCount(2);
  await expect(page.locator('#task-stats')).toHaveText('1 项待完成');
  await page.locator('.delete-button').first().click();
  await page.reload();
  await expect(page.locator('.task-item')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('edit saves, cancels, preserves blank title and deletes with one click', async ({ page }) => {
  await page.goto('/');
  await add(page, '原文');
  await page.locator('.task-title').dblclick();
  await page.locator('.task-edit-input').fill('新标题');
  await page.locator('.task-edit-input').press('Enter');
  await expect(page.locator('.task-title')).toHaveText('新标题');
  await page.locator('.task-title').dblclick();
  await page.locator('.task-edit-input').fill('取消');
  await page.locator('.task-edit-input').press('Escape');
  await expect(page.locator('.task-title')).toHaveText('新标题');
  await page.locator('.task-title').dblclick();
  await page.locator('.task-edit-input').fill('   ');
  await page.locator('.task-edit-input').press('Enter');
  await expect(page.locator('.task-title')).toHaveText('新标题');
  await page.locator('.task-title').dblclick();
  await page.locator('.task-edit-input').fill('失焦修改');
  await page.locator('.delete-button').click();
  await expect(page.locator('.task-item')).toHaveCount(0);
});

test('invalid stored records do not crash valid tasks', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('elio.tasks', JSON.stringify([
    null, {}, { id: 'ok', title: '保留', completed: false },
    { id: 'ok', title: '重复标识', completed: false },
    { id: 'bad', title: 123, completed: 'false' },
  ])));
  await page.goto('/');
  await expect(page.locator('.task-title')).toHaveText('保留');
});

test('storage failure is visible while tasks remain usable', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => { throw new DOMException('full', 'QuotaExceededError'); };
  });
  await page.goto('/');
  await add(page, '临时任务');
  await expect(page.locator('.task-title')).toHaveText('临时任务');
  await expect(page.locator('#storage-status')).toBeVisible();
});

test('long title stays inside mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/');
  await add(page, 'a'.repeat(100));
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test('keyboard editing respects IME and blur preserves checkbox click', async ({ page }) => {
  await page.goto('/');
  await add(page, '输入法');
  await page.locator('.task-title').focus();
  await page.keyboard.press('Enter');
  await page.locator('.task-edit-input').fill('中文输入');
  await page.locator('.task-edit-input').dispatchEvent('keydown', { key: 'Enter', isComposing: true });
  await expect(page.locator('.task-edit-input')).toBeVisible();
  await page.locator('.task-item input[type=checkbox]').click();
  await expect(page.locator('.task-title')).toHaveText('中文输入');
  await expect(page.locator('.task-item input[type=checkbox]')).toBeChecked();
  await page.reload();
  await expect(page.locator('.task-title')).toHaveText('中文输入');
});

test('invalid JSON and unavailable storage do not block new tasks', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => '{broken';
  });
  await page.goto('/');
  await expect(page.locator('#storage-status')).toBeVisible();
  await add(page, '仍可操作');
  await expect(page.locator('.task-title')).toHaveText('仍可操作');
});

test('storage read denied, UUID fallback, literal HTML and blank input', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new DOMException('denied', 'SecurityError'); };
    Object.defineProperty(crypto, 'randomUUID', { value: undefined });
  });
  await page.goto('/');
  await expect(page.locator('#storage-status')).toBeVisible();
  await add(page, '   ');
  await expect(page.locator('.task-item')).toHaveCount(0);
  await add(page, '<img src=x onerror=alert(1)>');
  await add(page, '另一个任务');
  await expect(page.locator('.task-item img')).toHaveCount(0);
  const tasks = await page.evaluate(() => JSON.parse(window.localStorage['elio.tasks']));
  expect(new Set(tasks.map(task => task.id)).size).toBe(2);
  await page.getByRole('button', { name: '已完成', exact: true }).click();
  await expect(page.locator('#empty-state')).toHaveText('还没有已完成任务。');
});
