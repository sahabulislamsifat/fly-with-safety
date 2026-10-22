async (page) => {
  await page.goto('http://127.0.0.1:3100/flights/results?from=DAC&to=CXB&depart=2027-06-20&tripType=oneWay');
  await page.getByRole('button', {name:'Book with Agent'}).first().waitFor();
  await page.setViewportSize({width:320,height:900});
  await page.getByLabel('Compare flight', {exact:true}).first().check();
  const panel = page.getByLabel('Flight comparison panel');
  const result = {width:320,scrollWidth:await page.evaluate(()=>document.documentElement.scrollWidth),timeLabels:await panel.innerText()};
  await page.screenshot({path:'output/playwright/flight-results-mobile.png',fullPage:true});
  await page.getByRole('button',{name:'Clear All',exact:true}).click();
  return result;
}
