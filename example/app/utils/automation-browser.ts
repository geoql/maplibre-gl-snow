/**
 * Automation browsers (Playwright, headless checkers) get no analytics: bot
 * traffic pollutes the dataset. Real users are unaffected.
 */
export function isAutomationBrowser(): boolean {
  if (!import.meta.client) return false;
  return navigator.webdriver === true;
}
