/**
 * Google Analytics 4 (GA4) Event Tracking Helper
 * Measurement ID: G-RY3FZRRMKR
 */

export function trackEvent(eventName, params = {}) {
  try {
    if (typeof window !== 'undefined') {
      if (typeof window.gtag === 'function') {
        window.gtag('event', eventName, params);
      } else if (window.dataLayer && Array.isArray(window.dataLayer)) {
        window.dataLayer.push({
          event: eventName,
          ...params
        });
      }
    }
  } catch (err) {
    // Non-blocking error handling for analytics
    console.debug(`[Analytics] event "${eventName}" failed:`, err);
  }
}
