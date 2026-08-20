/**
 * Analytics Tracking Helper
 * - Google Analytics 4 (GA4): G-RY3FZRRMKR
 * - Meta Pixel (Facebook Pixel): 1078298471815986
 */

/**
 * Track an event in Meta Pixel (Facebook Pixel)
 */
export function trackMetaEvent(eventName, params = {}, isCustom = false) {
  try {
    if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
      if (isCustom) {
        window.fbq('trackCustom', eventName, params);
      } else {
        window.fbq('track', eventName, params);
      }
    }
  } catch (err) {
    console.debug(`[MetaPixel] event "${eventName}" failed:`, err);
  }
}

/**
 * Unified event tracker for GA4 and Meta Pixel
 */
export function trackEvent(eventName, params = {}) {
  // 1. Google Analytics 4
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
    console.debug(`[GA4] event "${eventName}" failed:`, err);
  }

  // 2. Meta Pixel (Facebook Pixel) Event Mapping
  try {
    switch (eventName) {
      case 'listing_view':
        trackMetaEvent('ViewContent', {
          content_ids: params.listing_id ? [String(params.listing_id)] : [],
          content_name: params.title || '',
          content_category: params.governorate || '',
          content_type: 'product'
        });
        break;

      case 'contact_click':
        trackMetaEvent('Contact', {
          content_ids: params.listing_id ? [String(params.listing_id)] : [],
          content_category: params.governorate || '',
          advertiser_type: params.advertiser_type || ''
        });
        break;

      case 'sign_in':
        trackMetaEvent('CompleteRegistration', {
          status: 'success',
          user_role: params.user_role || 'student'
        });
        break;

      case 'filter_apply':
        trackMetaEvent('Search', {
          search_string: params.filter_type || '',
          content_category: params.governorate || ''
        });
        break;

      case 'add_ad_start':
        trackMetaEvent('AddAdStart', {
          advertiser_type: params.advertiser_type || '',
          is_signed_in: Boolean(params.is_signed_in)
        }, true);
        break;

      case 'listing_publish':
        trackMetaEvent('ListingPublish', {
          advertiser_type: params.advertiser_type || '',
          governorate: params.governorate || '',
          pricing_mode: params.pricing_mode || 'room_based'
        }, true);
        break;

      default:
        break;
    }
  } catch (err) {
    console.debug(`[MetaPixel] mapping for "${eventName}" failed:`, err);
  }
}
