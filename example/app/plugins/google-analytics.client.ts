import type { GtagHandle } from '~/types/analytics';
import { isAutomationBrowser } from '~/utils/automation-browser';

// GA4 is optional: the measurement ID is empty until one is issued for this
// host, and the plugin then loads nothing.
export default defineNuxtPlugin(() => {
  const gtagId = useRuntimeConfig().public.gtagId;
  if (!gtagId || isAutomationBrowser()) return;

  const { proxy } = useScriptGoogleAnalytics({ id: gtagId });

  const ga: GtagHandle = {
    gtag: (...args: unknown[]) => {
      (proxy.gtag as (...a: unknown[]) => void)(...args);
    },
  };

  return { provide: { ga } };
});
