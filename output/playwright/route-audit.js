async (page) => {
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url());
    const response = await route.fetch({ url: `http://127.0.0.1:5100${url.pathname}${url.search}` });
    await route.fulfill({ response });
  });
  const results = [];
  for (const path of ['/', '/flights', '/hotels', '/packages', '/visa-info', '/contact', '/privacy', '/terms', '/register', '/verify-email', '/forgot-password', '/reset-password', '/account', '/admin', '/track-booking', '/bookings/lookup', '/flights/results?from=DAC&to=CXB&depart=2027-06-20&tripType=oneWay', '/hotels/results?destination=Bangkok&checkIn=2027-06-20&checkOut=2027-06-23']) {
    const errors = [];
    const onError = error => errors.push(error.message);
    const onConsole = message => { if (message.type() === 'error' && /hydrat|server rendered/i.test(message.text())) errors.push(message.text()); };
    page.on('pageerror', onError);
    page.on('console', onConsole);
    await page.setViewportSize({ width: 1440, height: 900 });
    const response = await page.goto(`http://127.0.0.1:3100${path}`);
    await page.getByRole('button', { name: /sign in/i }).first().waitFor();
    if (path.includes('/flights/results')) await page.getByRole('button', { name: 'Book with Agent' }).first().waitFor();
    if (path.includes('/hotels/results')) await page.getByText('DEMO MODE', { exact: true }).waitFor();
    await page.locator('main').first().ariaSnapshot();
    const widths = [];
    for (const width of [320, 375, 430, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      widths.push(await page.evaluate(() => ({width: innerWidth, scrollWidth: document.documentElement.scrollWidth})));
    }
    results.push({ path, status: response.status(), headings: await page.locator('main h1').allTextContents(), widths, errors });
    page.off('pageerror', onError);
    page.off('console', onConsole);
  }
  return results;
}

