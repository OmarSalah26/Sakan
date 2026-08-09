 Round 3: Sakan — Implementation Plan

All decisions locked in with the user. Building group-by-group with user review after each group.

---

## Status Overview

| Group | Status |
|---|---|
| **Group 1: Account & Governorate Foundation** | **Completed & Verified** |
| **Group 2: Map Picker & Location Logic** | Pending User Approval of G1 |
| **Group 3: Listing Flow Fields** | Pending |
| **Group 4: Ad Details Page Additions** | Pending |
| **Group 5: Filters UI** | Pending |
| **Group 6: Role-Based Visibility** | Pending |
| **Group 7: Content & Copy** | Pending |

---

## Group 1: Account & Governorate Foundation (COMPLETED)

- **Per-ad edit token system**: Admin clicks a button on any listing in the dashboard → unique token is generated, `full_edit_available` flips to `true` for that listing only. Token is embedded in an outreach link. Auto-copies message to clipboard and opens WhatsApp Direct with prefilled text ready for sending.
- **Advertiser edit UI**: New edit form for all advertisers. Reuses the create form, pre-filled with existing listing data. Normal ads → always full edit access. Scraped/bulk ads → full edit only while `full_edit_available` is `true`, otherwise only `available_beds` and `description` are editable.
- **Dynamic live-check at listing creation**: At the point the advertiser selects a governorate for a specific ad (not upfront on a separate gate screen), the system checks that governorate's live status. If live → proceed. If not live → show the waitlist/coming-soon flow for that ad's governorate.
- **Dedicated Admin Subtab**: Added "إعلانات الإدارة والإستيراد" tab in Admin Panel to manage scraped/bulk/admin ads.

---

## Group 2: Map Picker & Location Logic (NEXT)

- **GPS "My Location" button**: Add a button in `MapPickerModal` calling `navigator.geolocation.getCurrentPosition()` to center the map on user's current GPS location.
- **Instructional text cleanup**: Remove pin emoji from map tooltip/header for clean typography.
- **`location_precise` flag**: When user confirms location via map picker, set `location_precise = true`. If skipped, stays `false`.
- **Conditional map display**: Detail page only renders embedded Google Maps iframe if `location_precise === true`.

---

## Group 3: Listing Flow Fields

- **Cover photo selector**: Clicking "Set as Cover" reorders the `photo_urls` array so the chosen photo is at index `[0]`. First photo gets a "غلاف" badge.
- **Negotiable commission range (additive)**: Add `commission_type` ("fixed" / "range"), `commission_min`, `commission_max` per room config. Existing `commission` field left untouched for backward compatibility.
- **"Select all" basic amenities**: Master checkbox toggling all basic indoor amenities at once.
- **Services clarification note**: Banner stating gas/water/electricity are standard, internet is excluded unless stated.
- **AC checkbox**: Per room config toggle (`has_ac: true/false`), displayed on room cards.

---

## Group 4: Ad Details Page Additions

- **Student guide inline section**: Collapsible `<details>` section at bottom of listing detail page (`نصائح سكن للطلاب`) for students/guests. (User provides short copy).
- **"Not vacant" report button**: Student click button `هل تواصلت مع المعلن والسكن لم يعد شاغراً؟` sending soft report `POST /listings/{id}/report-not-vacant`. Increments admin counter; no auto-deactivation.

---

## Group 5: Filters UI

- **Compact sidebar layout**: Group price & beds in horizontal rows, pills for room types, collapsible section for advanced filters.
- **Governorate dropdown with live status**: Live governorates at top with `✓`, non-live below divider grayed out with `(قريباً)`.

---

## Group 6: Role-Based Visibility

- **Hide student guide tab**: Only show "دليل الطالب" nav button if `!user` or `user.account_type === 'student'`. Hidden from brokers, owners, admins.

---

## Group 7: Content & Copy

- **WhatsApp note**: Small muted text above WhatsApp CTA button: `يرجى إبقاء رسالة سكن الآلية للإيضاح للمعلن أي سكن تقصد.`
- **About page shell**: Update layout shell (User provides Arabic copy).
- **Mobile app coming soon**: Banner at bottom of About page.
