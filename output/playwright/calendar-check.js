async (page) => {
  const checks = [];
  const check = (name, passed, detail) => { checks.push({ name, passed, detail }); };
  await page.goto('http://127.0.0.1:3100/flights');
  await page.getByRole('button', { name: /sign in/i }).first().waitFor();
  await page.locator('main').ariaSnapshot();
  for (const width of [320, 375, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const name of ['DEPARTURE', 'RETURN']) {
      const input = page.getByRole('textbox', { name, exact: true });
      await input.click();
      check(`${width} ${name} pointer opens`, await input.evaluate(el => el.matches(':open')));
      await page.keyboard.press('Escape');
      await input.focus();
      await page.keyboard.press('Enter');
      check(`${width} ${name} keyboard opens`, await input.evaluate(el => el.matches(':open')));
      const before = await input.inputValue();
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('Enter');
      check(`${width} ${name} calendar selection updates`, (await input.inputValue()) !== before);
      await page.keyboard.press('Escape');
    }
    check(`${width} page fits`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  }
  const departure = page.getByRole('textbox', { name: 'DEPARTURE', exact: true });
  const ret = page.getByRole('textbox', { name: 'RETURN', exact: true });
  await departure.fill('2027-06-20');
  check('return adjusts after departure', await ret.inputValue() === '2027-06-20');
  await ret.fill('2027-06-19');
  check('earlier return invalid', await ret.evaluate(el => el.validity.rangeUnderflow));
  await page.getByRole('button', { name: 'One Way', exact: true }).click();
  check('one-way removes return input', await ret.count() === 0);
  await departure.fill('2027-07-01');
  await page.getByRole('button', { name: 'Round Trip', exact: true }).click();
  check('round-trip restores valid return', await ret.inputValue() === '2027-07-01');
  await departure.fill('2000-01-01');
  check('past departure invalid', await departure.evaluate(el => el.validity.rangeUnderflow));
  await departure.fill('');
  check('empty departure invalid', await departure.evaluate(el => el.validity.valueMissing));
  await departure.fill('2027-07-01');
  await page.getByRole('button', { name: 'Multi City', exact: true }).click();
  await page.locator('main').ariaSnapshot();
  const first = page.getByLabel('Flight 1 departure date');
  await first.click();
  check('multi-city calendar opens', await first.evaluate(el => el.matches(':open')));
  await page.keyboard.press('Escape');
  await first.fill('2027-08-01');
  check('multi-city rejects out-of-order next leg', await page.getByLabel('Flight 2 departure date').evaluate(el => el.validity.rangeUnderflow));
  await page.getByRole('tab', { name: 'Hotel', exact: true }).click();
  await page.locator('main').ariaSnapshot();
  const cin = page.getByLabel('Check-in', { exact: true });
  const cout = page.getByLabel('Check-out', { exact: true });
  await cin.fill('2027-06-20');
  check('hotel checkout advances', await cout.inputValue() === '2027-06-21');
  await cout.fill('2027-06-20');
  check('same-day checkout invalid', await cout.evaluate(el => el.validity.rangeUnderflow));
  for (const input of [cin, cout]) {
    await input.click();
    check('hotel calendar opens', await input.evaluate(el => el.matches(':open')));
    await page.keyboard.press('Escape');
  }
  return { checks, passed: checks.filter(c => c.passed).length, failed: checks.filter(c => !c.passed) };
}
