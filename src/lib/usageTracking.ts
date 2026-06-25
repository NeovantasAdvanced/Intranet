export type UsageEventKind = 'pageview' | 'section' | 'link';

export type UsageEventPayload = {
  kind: UsageEventKind;
  label: string;
  section?: string;
  href?: string;
  route?: string;
  page?: string;
  timestamp?: string;
  userDetails?: string;
  userEmail?: string;
};

let trackingUserDetails = '';

export function setUsageTrackingPrincipal(principal: { userDetails?: string } | null) {
  trackingUserDetails = principal?.userDetails?.trim() ?? '';
}

function buildRequestBody(payload: UsageEventPayload) {
  const userDetails = (payload.userDetails ?? trackingUserDetails) || undefined;
  const userEmail = (payload.userEmail ?? trackingUserDetails) || undefined;

  return JSON.stringify({
    ...payload,
    userDetails,
    userEmail,
    timestamp: payload.timestamp ?? new Date().toISOString(),
  });
}

export function trackUsageEvent(payload: UsageEventPayload) {
  if (typeof window === 'undefined') {
    return;
  }

  if (import.meta.env.DEV) {
    return;
  }

  const body = buildRequestBody(payload);
  const url = '/api/usage/track';

  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' });
      if (navigator.sendBeacon(url, blob)) {
        return;
      }
    }
  } catch {
    // Fallback below.
  }

  void fetch(url, {
    method: 'POST',
    cache: 'no-store',
    keepalive: true,
    headers: {
      'content-type': 'application/json',
    },
    body,
  }).catch(() => {
    // Tracking must never break the UI.
  });
}
