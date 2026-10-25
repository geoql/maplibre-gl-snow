import { describe, expect, it, vi } from 'vite-plus/test';
import { createAnalytics } from '../app/utils/analytics';

describe('createAnalytics', () => {
  it('fans one event out to every tracker that booted', () => {
    const gtag = vi.fn();
    const plausible = vi.fn();
    const track = vi.fn();
    const analytics = createAnalytics({
      ga: { gtag },
      plausible: { plausible },
      openpanel: { track },
    });

    analytics.track('demo_interaction', { control: 'density', value: 0.7 });

    const props = { control: 'density', value: 0.7 };
    expect(gtag).toHaveBeenCalledWith('event', 'demo_interaction', props);
    expect(plausible).toHaveBeenCalledWith('demo_interaction', { props });
    expect(track).toHaveBeenCalledWith('demo_interaction', props);
  });

  it('skips trackers that did not boot (GA4 unset, automation browser)', () => {
    const track = vi.fn();
    const analytics = createAnalytics({ openpanel: { track } });

    expect(() =>
      analytics.track('install_copy', { command: 'pnpm add x' }),
    ).not.toThrow();
    expect(track).toHaveBeenCalledOnce();
  });
});
