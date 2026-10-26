import {test,expect} from '@playwright/test';
// Synthetic, fresh browser context with no school login. No submission or save.
async function openPicker(page) {
  await page.goto('/#/classes');
  await page.waitForFunction(()=>window.store?.state?.ready === true);
  await page.getByRole('button',{name:/إضافة فصل|إنشاء أول فصل/,exact:true}).first().click();
  const dialog=page.getByRole('dialog');
  await expect(dialog.locator('[name="grade"]')).toBeVisible();
  return dialog;
}
test('grade-four official names + legacy builtin identity + manual input',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const dialog=await openPicker(page);
  await dialog.locator('[name="grade"]').selectOption('4');
  await dialog.locator('[data-subject-trigger]').click();
  await expect(dialog.getByText('مواد هذا الصف — الإصدار السادس')).toBeVisible();
  const search=dialog.getByRole('combobox',{name:'ابحث عن مادة'});
  await search.fill('لغتي');
  await expect(dialog.locator('[data-subject-token]')).toHaveCount(1);
  await dialog.getByRole('option',{name:'اللغة العربية'}).click();
  await expect(dialog.locator('[data-subject-selected]')).toHaveText('اللغة العربية');
  await expect(dialog.locator('[name="subjectToken"]')).toHaveValue('builtin:arabic');
  await dialog.locator('[data-subject-trigger]').click();
  await dialog.locator('[data-subject-custom]').click();
  await expect(dialog.getByRole('textbox',{name:'اسم المادة المخصصة'})).toBeVisible();
  await expect(dialog.locator('[name="subjectToken"]')).toHaveValue('custom');
  expect(errors).toEqual([]);
});
test('Tajweed appears in Tahfiz grade five and not in general grade five',async({page})=>{
 const dialog=await openPicker(page);
 await dialog.locator('[name="grade"]').selectOption('5');
 await dialog.locator('[data-subject-trigger]').click();
 await dialog.getByRole('combobox',{name:'ابحث عن مادة'}).fill('التجويد');
 await expect(dialog.getByRole('option',{name:'التجويد'})).toHaveCount(0);
 await dialog.locator('[data-v6-program]').selectOption('tahfiz');
 await expect(dialog.getByRole('option',{name:'التجويد'})).toBeVisible();
});
test('Chinese only for specific middle-school programme',async({page})=>{
 const dialog=await openPicker(page);
 await dialog.locator('[name="grade"]').selectOption('9');
 await dialog.locator('[data-v6-program]').selectOption('chinese_pilot');
 await dialog.locator('[data-subject-trigger]').click();
 await dialog.getByRole('combobox',{name:'ابحث عن مادة'}).fill('اللغة الصينية');
 await dialog.getByRole('option',{name:'اللغة الصينية'}).click();
 await expect(dialog.locator('[name="subjectToken"]')).toHaveValue('custom');
 await expect(dialog.locator('[name="customSubjectName"]')).toHaveValue('اللغة الصينية');
 await expect(dialog.locator('[data-subject-selected]')).toHaveText('اللغة الصينية');
});
test('grade twelve requires track and filters cyber-security correctly',async({page})=>{
 const dialog=await openPicker(page);
 await dialog.locator('[name="grade"]').selectOption('12');
 await expect(dialog.locator('[data-v6-track-field]')).toBeVisible();
 await expect(dialog.locator('[data-v6-track]')).toHaveValue('');
 await dialog.locator('[data-subject-trigger]').click();
 await expect(dialog.getByText('مواد هذا الصف — الإصدار السادس')).toHaveCount(0);
 await dialog.locator('[data-v6-track]').selectOption('computer_engineering');
 await dialog.getByRole('combobox',{name:'ابحث عن مادة'}).fill('الأمن السيبراني');
 await expect(dialog.getByRole('option',{name:'الأمن السيبراني'})).toBeVisible();
 await dialog.locator('[data-v6-track]').selectOption('general');
 await expect(dialog.getByRole('option',{name:'الأمن السيبراني'})).toHaveCount(0);
});
test('selecting grade re-filters list without retaining stale material selection',async({page})=>{
 const dialog=await openPicker(page);
 await dialog.locator('[name="grade"]').selectOption('4');
 await dialog.locator('[data-subject-trigger]').click();
 await dialog.getByRole('option',{name:'المهارات الرقمية'}).click();
 expect(['builtin:digital-skills','subject:sub:digital-skills']).toContain(await dialog.locator('[name="subjectToken"]').inputValue());
 await dialog.locator('[name="grade"]').selectOption('1');
 await expect(dialog.locator('[name="subjectToken"]')).toHaveValue('');
 await expect(dialog.locator('[data-subject-selected]')).toHaveText('اختر المادة');
});
