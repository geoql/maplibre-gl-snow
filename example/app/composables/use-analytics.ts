import type {
  GtagHandle,
  OpenPanelHandle,
  PlausibleHandle,
} from '~/types/analytics';
import { createAnalytics } from '~/utils/analytics';

export function useAnalytics() {
  const nuxtApp = useNuxtApp();
  return createAnalytics({
    ga: nuxtApp.$ga as GtagHandle | undefined,
    plausible: nuxtApp.$plausible as PlausibleHandle | undefined,
    openpanel: nuxtApp.$openpanel as OpenPanelHandle | undefined,
  });
}
