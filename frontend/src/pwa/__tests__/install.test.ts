import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isIosSafari,
  isStandalone,
  rememberInstallDismissed,
  wasInstallDismissed,
} from '../install';

function setUserAgent(ua: string, maxTouchPoints = 0) {
  // jsdom doesn't define maxTouchPoints, so spyOn can't find it — define both
  // as configurable so each test can redefine them.
  Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true });
  Object.defineProperty(navigator, 'maxTouchPoints', {
    value: maxTouchPoints,
    configurable: true,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('install dismissal persistence', () => {
  it('is not dismissed by default', () => {
    expect(wasInstallDismissed()).toBe(false);
  });

  it('remembers a dismissal across reads', () => {
    rememberInstallDismissed();
    expect(wasInstallDismissed()).toBe(true);
  });
});

describe('isStandalone', () => {
  beforeEach(() => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false } as MediaQueryList);
  });

  it('is false in a normal browser tab', () => {
    expect(isStandalone()).toBe(false);
  });

  it('is true when launched in standalone display mode', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList);
    expect(isStandalone()).toBe(true);
  });

  it('is true for the legacy iOS navigator.standalone flag', () => {
    (navigator as Navigator & { standalone?: boolean }).standalone = true;
    expect(isStandalone()).toBe(true);
    delete (navigator as Navigator & { standalone?: boolean }).standalone;
  });
});

describe('isIosSafari', () => {
  it('is true on an iPhone running Safari', () => {
    setUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    );
    expect(isIosSafari()).toBe(true);
  });

  it('is true on a touch iPadOS device reporting a desktop Mac UA', () => {
    setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
      5,
    );
    expect(isIosSafari()).toBe(true);
  });

  it('is false for Chrome on iOS (CriOS), which cannot install', () => {
    setUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0 Mobile/15E148 Safari/604.1',
    );
    expect(isIosSafari()).toBe(false);
  });

  it('is false on desktop Chrome', () => {
    setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
    );
    expect(isIosSafari()).toBe(false);
  });
});
