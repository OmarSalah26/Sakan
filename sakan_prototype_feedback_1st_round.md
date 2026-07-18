# Sakan Prototype — Testing Notes & Feedback

## 1. Room Configuration / Preset System

**Issue:** When adding a listing, if a user has multiple rooms with the same configuration, the current flow forces them to create a separate preset for each one. This also caused a bug: identical rooms with identical prices were showing up as duplicate entries on the same card instead of being grouped.

**Solution:** Add a count field so the user can specify how many rooms share a given configuration, instead of repeating presets.

**Edge case to preserve:** If the user has multiple rooms with the same configuration but wants to price them differently, they should still be able to add a separate preset for that room. After the fix, identical config + identical price should never appear as duplicate listings on the card; only price variations should create separate entries.

**Config naming fix:** Replace the "triple+ / مشتركة" configuration with a proper **quadruple** config option.

---

## 2. Lister Dashboard / Listing Management

- **Missing controls:** No way to deactivate a listing when it's fully booked/empty, or to reactivate a previous ad. Both need to be added.
- **"اتمام التعاقد" icon:** Currently, clicking this reminds the lister to request ratings from contracted students. Remove the icon entirely; instead, surface this reminder as a passive note/notification in the dashboard view rather than an actionable button.

---

## 3. Ad Details Page

- **Owner vs. broker:** The listing card doesn't indicate whether the lister is the property owner or a broker. Needs to be shown.
- **Commission pricing:** When a unit has multiple room configurations with different commission prices, the details page (and card) currently show only a single commission figure. Fix: display the commission price directly next to each bed price, per configuration.
- **Unit description bug:** Description entered during listing creation isn't displaying on the details page.
- **Map link:** Currently a plain link; should be an embedded map instead.
- **Commission "paid once" note:** Currently emphasized on the details page — wrong location. Move this note into the student guide instead.

---

## 4. Ad Card Display

- Show a breakdown of room types on the card: number of single/double/triple/quadruple rooms, plus **total bed count** (not just currently available/vacant beds).
- Use bed icons to represent room configs — e.g., a double room shown as two bed icons side by side rather than one bed icon with a "2" next to it.

---

## 5. New Fields in "Add Listing" Flow

- **Insurance price (التأمين):** Add a field in the room configuration step, since insurance price can vary bed-to-bed (though it's usually equal to the bed price).
- **Services-inclusive checkbox:** Add a checkbox indicating whether the listed price includes utilities/services (شامل الخدمات زي الكهرباء والمياه).

---

## 6. Filters

Add the following filters for students:
- Commission price limit
- Services inclusive (شامل الخدمات)
- Insurance / no insurance (بتأمين أو بدون)

---

## 7. Sharing

Add a "share link" option on the ad details page that generates a message containing the key unit info (price, config, location, etc.) in a single shareable text.

---

## 8. Student Guide (New Section)

Add a first-time renter guidance section covering:

1. **Expected expenses** — rent, insurance, and broker commission, explained clearly.
2. **Services-inclusive vs. not** — clarify that some units bundle electricity/water/etc. into the price and some don't; always confirm with the owner before signing.
3. **Being a good tenant** — practical etiquette: maintaining appliances, respecting quiet hours, keeping shared spaces clean, avoiding damage to the unit.
4. **Commission benchmarks:**
   - Fair/standard: half a month's rent, paid once
   - High (uncommon): a full month's rent
   - Excessive/bad practice — flag and report: two months' rent or more
   - Note: Sakan requires brokers to declare a commission ceiling upfront; any broker asking above the listed cap should be reported for a ban.
5. **Terms of Service awareness** — point students to read the ToS to understand their rights.
6. **Golden rules before paying a deposit or signing:**
   - Never transfer money or pay a cash deposit before an in-person viewing and meeting with the owner/broker.
   - Verify the unit matches the photos/description exactly (AC, fridge, water filter, working washer, etc.).
   - Read the ToS and use the ratings system / other students' complaints to avoid bad experiences.

*(Full Arabic draft copy for this section already exists and can be dropped in directly — see original notes.)*
