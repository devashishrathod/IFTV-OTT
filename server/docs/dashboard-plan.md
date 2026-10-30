# Admin Dashboard: plan

Last update: 2026-10-30 · Status: **code poora hai (branch `support-system`, uncommitted). 166/166 end-to-end tests pass hue. Postman mein Dashboard folder aur `docs/frontend/admin-panel-api.md` mein section 8 add ho gaya.** Code mein kya bana aur plan se kya alag hai, wo neeche *Implementation status* mein hai.

Admin panel ke home page ke liye **ek hi API**, jo ek call mein poora dashboard deti hai: KPI cards (pichhle period se comparison ke saath), charts ka data, analysis circles (pie / donut) ka data, har section ke totals aur recent lists. Date range aur baaki filters query mein jaate hain.

Abhi tak koi dashboard API nahi bani hai. Sirf do chhoti stats APIs pehle se hain:
- `GET /payments/admin/stats`
- `GET /supports/admin/stats`

Ye dono **waise hi rahengi**, unhe koi change nahi milega. Dashboard ka code alag service mein hoga. Wahi models aur wahi rules use honge, jaise "active subscriber" ka matlab: `status` active / scheduled ho aur `startDate <= abhi < endDate`.

## API

```
GET /dashboard/admin
Authorization: Bearer {{adminToken}}      ← sirf admin (staff / user ko 403)
```

### Filters (query params, sab optional)

| Param | Values | Default | Kya karta hai |
| --- | --- | --- | --- |
| `range` | `today`, `yesterday`, `last_7_days`, `last_30_days`, `last_90_days`, `this_month`, `last_month`, `this_year`, `all_time`, `custom` | `last_30_days` | Date range ka preset. Saari dates IST (Asia/Kolkata) mein |
| `fromDate` | `YYYY-MM-DD` | — | `range=custom` ke saath. Agar `fromDate` / `toDate` bheje aur `range` nahi bheja to `custom` maana jayega |
| `toDate` | `YYYY-MM-DD` | aaj | Ye pura din shaamil hota hai (23:59:59 IST tak). `fromDate` se pehle nahi ho sakta |
| `groupBy` | `day`, `week`, `month` | auto | Chart ka bucket. Auto rule: 31 din tak `day`, 180 din tak `week`, usse zyada `month`. `day` max 366 buckets tak chalega, usse bade range par 422 |
| `platform` | `web`, `android`, `ios` | sab | Payments, subscriptions aur tickets par lagta hai. Users par nahi lagta, kyunki User model mein platform field nahi hai |
| `planId` | plan ka ObjectId | sab | Payments aur subscriptions par lagta hai |
| `categoryId` | category ka ObjectId | sab | Content section ke movies par lagta hai |
| `compare` | `true` / `false` | `true` | KPI cards mein pichhle barabar period se comparison. `all_time` mein comparison nahi hota (`null`) |
| `recentLimit` | 1–20 | 10 | Har recent list mein kitne items aayenge |

**Rule:** "flow" wala data (signups, payments, naye subscriptions, naye tickets) **date range** ke hisaab se badlega. "Abhi ki state" wala data (active subscribers, content count, open tickets, expiring soon) hamesha **aaj ka snapshot** hoga. Har field ke saath neeche likha hai ki wo kis type ka hai.

Filters kahan lagte hain:

| Section | Date range | `platform` | `planId` | `categoryId` |
| --- | --- | --- | --- | --- |
| Users | ✅ (signups) | ❌ | ❌ | ❌ |
| Payments / revenue | ✅ (`paidAt` / `createdAt`) | ✅ | ✅ | ❌ |
| Subscriptions | ✅ (naye periods ka `createdAt`) + snapshot | ✅ | ✅ | ❌ |
| Support | ✅ (`createdAt`) + snapshot | ✅ | ❌ | ❌ |
| Content | ❌ (snapshot) | ❌ | ❌ | ✅ (movies) |
| Recent lists | ❌ (hamesha latest) | ✅ jahan field ho | ✅ jahan field ho | ✅ (movies) |

Users ke numbers sirf `role: user` (customers) ke hain, `isDeleted: false`. Admin / staff inme nahi gine jaate.

### Response (`data`)

```jsonc
{
  "filters": {
    "range": "last_30_days", "fromDate": "2026-10-01", "toDate": "2026-10-30",
    "groupBy": "day", "platform": null, "planId": null, "categoryId": null,
    "compare": true, "previousFromDate": "2026-09-01", "previousToDate": "2026-09-30",
    "timezone": "Asia/Kolkata", "currency": "INR", "amountUnit": "paise"
  },

  // 1. KPI cards. Har card: { value, previous, changePercent }
  //    changePercent = ((value - previous) / previous) * 100, 1 decimal tak.
  //    previous 0 ho to null. compare=false ya all_time mein previous / changePercent null
  "overview": {
    "newUsers":         { "value": 120, "previous": 90, "changePercent": 33.3 },  // range
    "revenue":          { "value": 4599900, "previous": 3200000, "changePercent": 43.7 }, // range, paise
    "paidPayments":     { ... },   // range
    "newSubscriptions": { ... },   // range
    "newTickets":       { ... },   // range
    "totalUsers": 5400,            // snapshot
    "activeSubscribers": 830,      // snapshot (unique users)
    "openTickets": 14,             // snapshot (open + in_progress)
    "totalMovies": 210             // snapshot (not deleted)
  },

  // 2. Charts (line / bar / area). Har bucket mein zero bhi bhara hoga, koi gap nahi
  "charts": {
    "groupBy": "day",
    "points": [
      {
        "date": "2026-10-01",     // bucket ka start (IST). week = Monday, month = 1 tareekh
        "label": "1 Oct",
        "signups": 4,
        "revenue": 149900,         // paise
        "paidPayments": 3,
        "failedPayments": 1,
        "newSubscriptions": 3,
        "expiredSubscriptions": 1,
        "tickets": 2,
        "resolvedTickets": 1
      }
    ]
  },

  // 3. Analysis circles (pie / donut). Har circle: { total, items: [{ key, label, count, percent }] }
  //    Revenue wale circles mein har item mein "amount" (paise) bhi, aur percent amount par hota hai.
  //    Har enum ki saari values aati hain, zero ke saath (fixed colours ke liye)
  "circles": {
    "usersByLoginType":           { ... },  // range (signups): email / mobile / google / password / other
    "usersByStatus":              { ... },  // range: active / inactive
    "usersByVerification":        { ... },  // range: both / email_only / mobile_only / none
    "paymentsByStatus":           { ... },  // range: created / paid / failed / expired
    "paymentsByPurpose":          { ... },  // range, paid: new / renewal / upgrade
    "paymentsByMethod":           { ... },  // range, paid: upi / card / netbanking / wallet / ... (Razorpay ka method)
    "revenueByPlatform":          { ... },  // range, paid: web / android / ios
    "revenueByPlan":              { ... },  // range, paid: plan wise (key = planId)
    "activeSubscribersByPlan":    { ... },  // snapshot
    "activeSubscribersByPlatform":{ ... },  // snapshot
    "subscriptionsBySource":      { ... },  // range: purchase / renewal / upgrade / admin_grant
    "ticketsByStatus":            { ... },  // range: open / in_progress / resolved / closed
    "ticketsByCategory":          { ... },  // range: payment / subscription / playback / account / content_request / feedback / other
    "ticketsByPriority":          { ... },  // range: low / medium / high
    "ticketsBySource":            { ... },  // range: ticket / contact_us
    "ticketsByPlatform":          { ... },  // range: web / android / ios
    "moviesByAccessType":         { ... },  // snapshot: free / paid
    "moviesByCategory":           { ... },  // snapshot, category wise
    "moviesByLanguage":           { ... },  // snapshot, top 10 + "other"
    "galleryByMediaType":         { ... }   // snapshot: image / gif / video
  },

  // 4. Section totals (cards / tables ke liye)
  "users": {
    "total": 5400, "active": 5300, "inactive": 100,            // snapshot
    "emailVerified": 4100, "mobileVerified": 3900,              // snapshot
    "signUpCompleted": 5000, "onlineNow": 37,                   // snapshot
    "newInRange": 120, "subscribed": 830, "neverSubscribed": 4200  // range / snapshot
  },
  "subscriptions": {
    "activeSubscribers": 830,       // snapshot
    "scheduled": 25,                // snapshot (aage shuru hone wale)
    "expiringIn7Days": 40,          // snapshot
    "expiredInRange": 60,           // range
    "cancelledInRange": 3,          // range
    "adminGrantsInRange": 5,        // range
    "upgradeAllowed": false         // abhi ki setting
  },
  "revenue": {
    "today": { "amount": 0, "count": 0 },
    "thisMonth": { ... },
    "range": { ... },
    "allTime": { ... },
    "averageOrderValue": 149900,    // range, paise
    "successRatePercent": 82.5,     // range: paid / (paid + failed + expired)
    "creditAppliedInRange": 0       // upgrade credit, paise
  },
  "content": {
    "movies": { "total": 210, "active": 200, "inactive": 10, "free": 150, "paid": 60, "withoutVideo": 4 },
    "categories": { "total": 12, "active": 11 },
    "subCategories": { "total": 30, "active": 28 },
    "banners": { "total": 8, "active": 5 },
    "gallery": { "total": 90, "active": 85, "image": 60, "gif": 10, "video": 20 },
    "plans": { "total": 4, "active": 3 }
  },
  "support": {
    "totalInRange": 45,             // range
    "open": 10, "inProgress": 4,    // snapshot
    "unassignedOpen": 6,            // snapshot
    "highPriorityOpen": 2,          // snapshot
    "avgResolutionHours": 18.4      // range: resolvedAt - createdAt ka average, resolved na ho to null
  },

  // 5. Recent lists (hamesha latest, date range nahi lagta). Har list recentLimit tak
  "recent": {
    "users": [ { "_id", "name", "email", "mobile", "image", "loginType", "isActive", "createdAt" } ],
    "payments": [ { "_id", "receipt", "user": { "_id", "name", "email" }, "plan": { "name", "type" }, "amount", "purpose", "method", "platform", "paidAt" } ],   // sirf paid
    "failedPayments": [ ... same shape, "failureReason", "createdAt" ],
    "subscriptions": [ { "_id", "user": {...}, "plan": {...}, "status", "source", "startDate", "endDate", "platform", "createdAt" } ],
    "expiringSoon": [ ... same shape + "daysLeft" ],  // agle 7 din mein khatam hone wale, sabse pehle khatam hone wala upar
    "tickets": [ { "_id", "ticketId", "subject", "category", "status", "priority", "source", "name", "email", "platform", "createdAt" } ],
    "movies": [ { "_id", "title", "image", "accessType", "category": { "_id", "name" }, "isActive", "createdAt" } ]
  }
}
```

### Errors

| Status | Kab |
| --- | --- |
| 401 | Token nahi bheja |
| 403 | Token galat hai, ya role admin nahi hai (staff / user) |
| 422 | Galat `range` / `groupBy` / `platform`, invalid `planId` / `categoryId`, `toDate` `fromDate` se pehle, `range=custom` bina `fromDate` ke, `recentLimit` 1–20 ke bahar, `groupBy=day` ke saath 366 se zyada din |

Data na ho to bhi **200** aayega, zero aur khali arrays ke saath (dashboard kabhi 404 nahi dega).

## Performance

- Saari queries `Promise.all` mein ek saath chalengi. Har model par `$facet` lagega taaki ek collection par ek hi aggregate chale.
- Buckets `$dateTrunc` (timezone `Asia/Kolkata`, week Monday se) se banenge. Khali buckets JS mein zero se bhare jayenge.
- Existing indexes kaafi hain: Payment `{status, paidAt}` / `{status, createdAt}`, UserSubscription `{status, endDate}` / `{status, startDate}`, SupportTicket `{status, source, createdAt}`. Koi naya index nahi lagega.
- Password, otp, fcmToken, Razorpay signature kabhi response mein nahi jayenge.

## Files

| File | Kya |
| --- | --- |
| `routes/dashboard.js` (naya) | `GET /admin` with `isAdmin` → mount `/dashboard` |
| `controllers/dashboard/index.js` (naya) | validate → service → `sendSuccess(200, "Dashboard fetched successfully")` |
| `services/dashboard/index.js` (naya) | sab sections jodta hai |
| `services/dashboard/dateRange.js` (naya) | presets, IST boundaries, previous period, auto `groupBy`, buckets |
| `services/dashboard/users.js`, `payments.js`, `subscriptions.js`, `support.js`, `content.js`, `recent.js` (naye) | har section ka aggregate |
| `validator/dashboard.js` (naya) | Joi query validation |
| `constants.js` | `DASHBOARD_RANGES`, `DASHBOARD_GROUP_BY`, `DASHBOARD_LIMITS` add honge (sirf add, baaki kuch nahi badlega) |
| `postman/IFTV.postman_collection.json` | naya **Dashboard** folder: default, har range, custom, filters ke saath, aur 401 / 403 / 422 examples |
| `docs/frontend/admin-panel-api.md` + `README.md` | Dashboard section (Hinglish), mapping table aur changelog |

Kya **nahi** badlega: existing payment / ticket stats APIs, koi model, koi existing route.

## Testing

Pehle features jaisa e2e test scratchpad mein hoga (repo mein nahi). Throwaway DB `iftv_e2e_dashboard` mein seed data dala jayega aur har number check hoga: ranges, IST boundaries, buckets ka zero fill, filters, comparison, roles (admin 200 / staff 403 / user 403 / bina token 401) aur 422 cases. Test ke end mein DB drop ho jayega.

## Decisions (user ne 2026-10-30 ko approve kiye)

1. Access **sirf admin** ko hai. Staff ko 403 milega.
2. Ek hi API hai, sections alag nahi.
3. Recent lists mein 10 items aate hain (`recentLimit` 1–20 se badal sakte hain).
4. Platform breakdown add hua: payments, subscriptions aur tickets mein.
5. Charts aur analysis circles add hue, saath mein date range aur baaki filters.
6. Default range `last_30_days` hai.
7. Users ke circles date range ke signups par chalte hain.
8. Amounts paise mein hain.

## Implementation status (2026-10-30)

Files:

| File | Kya karta hai |
| --- | --- |
| `routes/dashboard.js` | Route, `isAdmin` ke saath |
| `controllers/dashboard/index.js` | Controller |
| `validator/dashboard.js` | Query validation |
| `services/dashboard/index.js` | Sab sections jodta hai, `filters` aur `charts` banata hai |
| `services/dashboard/dateRange.js` | IST presets, pichhla period, buckets, `$dateTrunc` key |
| `services/dashboard/helpers.js` | `toCircle`, `toKpi` |
| `services/dashboard/users.js`, `payments.js`, `subscriptions.js`, `support.js`, `content.js`, `recent.js` | Har section ka data |
| `constants.js` | `DASHBOARD_RANGES`, `DASHBOARD_GROUP_BY`, `DASHBOARD_LIMITS` |

Plan se ye cheezein alag ya zyada bani hain:
- `filters` mein `days` aur `recentLimit` bhi aate hain.
- `subscriptions` section mein `newInRange` bhi aata hai.
- Jin circles ke data mein amount hota hai (payment method, platform, plan), unke har item mein `amount` (paise) bhi aata hai. `percent` sirf `revenueByPlatform` aur `revenueByPlan` mein amount par hai, baaki circles mein count par.
- `resolvedTickets` aur `avgResolutionHours` mein **close** hue tickets bhi gine jaate hain, jo bina resolve ke close kiye gaye. Time `resolvedAt` se liya jata hai, wo na ho to `closedAt` se. Reopen hone par ye dono fields hat jaate hain.
- Do items ka count barabar ho to circle ka order fix rehta hai: pehle bada amount, phir key.
- `week` / `month` mein pehla bucket range se pehle shuru ho sakta hai (jaise Monday). Data sirf range ke andar ka gina jata hai.
- `all_time` sabse purane user, payment, subscription ya ticket se shuru hota hai. Koi record na ho to sirf aaj ka din aata hai.
- Mongo `$dateTrunc` use hua hai. Iske liye MongoDB 5.0+ chahiye. Atlas par 8.0 chal raha hai.

Testing: `iftv_e2e_dashboard` DB par 166 checks chale, aur DB end mein drop ho gaya. Inme ye sab cover hua:
- auth: 401, staff / user ko 403
- har preset range ki IST dates
- pichhle period ka comparison
- buckets ka zero fill aur Monday wale week
- auto `groupBy`
- har section ke numbers aur saare 20 circles
- recent lists (password / signature nahi aate)
- platform / plan / category filters
- 16 tarah ke 422
- khali DB par 200 aur zeros
