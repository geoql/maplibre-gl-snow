import type {
  AnalyticsEvent,
  AnalyticsEventMap,
  AnalyticsHandles,
} from '../types/analytics';

/**
 * Fan one event out to every tracker that booted. A missing handle (SSR,
 * automation browser, blocked script, GA4 id not set) is skipped, never an
 * error.
 */
export function createAnalytics(handles: AnalyticsHandles) {
  function track<E extends AnalyticsEvent>(
    event: E,
    properties: AnalyticsEventMap[E],
  ) {
    const props: Record<string, unknown> = { ...properties };
    handles.ga?.gtag('event', event, props);
    handles.plausible?.plausible(event, { props });
    handles.openpanel?.track(event, props);
  }

  return { track };
}
