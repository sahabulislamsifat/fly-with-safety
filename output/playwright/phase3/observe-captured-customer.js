async page => {
  const s = page.__phase3;
  await page.getByRole('button', { name: 'Refresh payment status', exact: true }).click();
  await page.getByText('12000.00 BDT · VERIFIED', { exact: true }).waitFor();
  return { role: s.role, actualVerifiedUi: true, capturedPayNowFormVisible: await page.getByRole('button', { name: 'Pay now / resume sandbox checkout', exact: true }).isVisible(), provider: 'MOCK_ONLY' };
}
