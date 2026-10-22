async (page) => {
  await page.goto('http://127.0.0.1:3100/flights/results?from=DAC&to=CXB&depart=2027-06-20&tripType=oneWay');
  await page.getByRole('button', { name: 'Book with Agent' }).first().waitFor();
  await page.setViewportSize({ width: 320, height: 900 });
  return page.evaluate(() => [...document.querySelectorAll('main *')].filter(el => el.getBoundingClientRect().right > innerWidth).map(el => ({ tag: el.tagName, class: el.className, text: el.textContent.slice(0, 90), right: el.getBoundingClientRect().right })).slice(0, 35));
}
