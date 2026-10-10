# Subscription + Razorpay payments: plan

Last update: 2026-10-10 · Status: **LOCKED (2026-10-10). Code poora hai (branch `support-system`, uncommitted). 149/149 end-to-end tests pass (alag test DB + nakli Razorpay). Postman aur frontend docs update ho gaye. Asli Razorpay keys aur webhook abhi set karne hain.** Kya bana aur plan se kya alag hai, wo section 13 *Implementation status* mein hai.

User web aur Android app se plan kharidega (Razorpay se). Web, Android aur iOS teeno par use apna current plan, transactions, subscription history aur upgrade option dikhega. Admin panel mein plans, upgrade setting, users ke subscriptions, payments aur revenue dikhenge. Admin har movie ko free / paid kar sakega aur bata sakega ki paid movie kin plans mein milegi.

---

## 1. Abhi kya hai (audit)

### Model: `models/Subscription.js` (ye *plan* hai, user ka subscription nahi)

`name`, `description`, `price` (rupees), `type` (weekly / monthly / quarterly / half_yearly / yearly), `durationInDays` (type se server set karta hai), `benefits[]`, `limitations[]`, `isActive`, `isDeleted`.

### Abhi sirf 4 APIs hain (`routes/subscriptions.js`)

| # | Method | Route | Kiske liye | Auth | Problem |
| --- | --- | --- | --- | --- | --- |
| 1 | POST | `/subscriptions/add` | Admin | **Koi nahi** (`isAdmin` comment out) | Koi bhi plan bana sakta hai (S6). Raw `req.body` save hota hai (P5) |
| 2 | GET | `/subscriptions/get/:id` | Sab | Nahi | Inactive plan bhi de deta hai. Galat id par 500 (P2) |
| 3 | GET | `/subscriptions/get-all` | Sab | Nahi | Inactive plans bhi aate hain (jab tak `isActive=true` na bhejo). Anjaan query key filter ban jaati hai (P1). Khali list par 404 |
| 4 | DELETE | `/subscriptions/delete/:id` | Admin | **Koi nahi** | Koi bhi plan delete kar sakta hai (S6) |

### Kya missing hai

- **Plan update ki API hi nahi hai.** Price, benefits ya active/inactive badal nahi sakte.
- **User side kuch nahi:** plan kharidna, payment, "mera plan", history, transactions, upgrade. User ko plan assign karne ka koi model hi nahi hai.
- Public aur admin APIs alag nahi hain. Web/app ke liye "sirf active plans, sahi order mein" wali API nahi hai.
- Razorpay: `configs/razorpay.js` file hai, par `razorpay` npm package install nahi hai, kahin use nahi hota, aur `.env` mein `RAZORPAY_KEY_ID` / `RAZORPAY_SECRET` khali hain.
- Content gating nahi hai: `Movie` mein free/paid ka koi field nahi, aur `/movies/:id/get` sabko video URL de deta hai.
- Subscriptions abhi `docs/frontend/*` mein nahi hain (sirf Postman mein).

**Natija:** customer / web / app ke liye abhi sirf 2 read APIs (get-all, get) hain, wo bhi bina active filter ke. Payment wala poora system naya banana hai.

---

## 2. Payment ka tareeka: Prepaid (Razorpay Orders API)

- User har baar khud pay karega. Plan khatam → dobara kharido (ya pehle se renew karo).
- Auto-renew (Razorpay Subscriptions / UPI Autopay) **baad mein**. Model aisa banega ki wo bina kuch tode jud sake (`Payment.provider`, `UserSubscription.autoRenew` fields ready rahenge).

### Kahan se kharid sakte hain

| Platform | Plans / my plan / history / transactions | Kharidna (Razorpay checkout) |
| --- | --- | --- |
| Web | Haan | Haan (`checkout.js`) |
| Android app | Haan | Haan (Razorpay Android SDK) |
| iOS app | Haan | **Nahi.** "Web par jaakar kharido" wala message |

- iOS app ke andar digital subscription bechne ke liye Apple **In-App Purchase** zaroori hai, Razorpay lagaya to review reject ka risk hai. Server bhi `platform: ios` par `create-order` ko 403 dega.
- Google Play par bhi Play Billing rule hai. India mein "user choice billing" se alternative allowed hai, par Play Console mein enrol karna pad sakta hai. **Android launch se pehle check karna.**

---

## 3. Flow

```
Web / Android                     Backend                                  Razorpay
─────────────                     ───────                                  ────────
1. Plans dekho  ── GET /subscriptions/plans ──▶ active plans
2. Price dekho ─── GET /payments/quote?planId ─▶ new / renewal / upgrade, credit, payable
3. Buy  ─────────── POST /payments/create-order ─▶ amount server nikalta hai ──▶ orders.create
                                                   Payment(status=created) save
                    ◀── orderId, amount, keyId, prefill ──
4. Razorpay Checkout khulta hai (web: checkout.js, Android SDK) ─────────────▶ user pay karta hai
5. Success ─────── POST /payments/verify ─────────▶ signature check (HMAC)
                    {order_id, payment_id, signature}  Razorpay se payment fetch (amount + status)
                                                   activate()  ──▶ Payment=paid, UserSubscription ban gaya
                    ◀── naya subscription ──
6. (backup) ──────────────────────────────────────── POST /payments/webhook ◀── payment.captured /
                                                   signature check → wahi activate()     order.paid /
                                                   (step 5 ho chuka to kuch nahi)        payment.failed
```

**Webhook kyun zaroori hai:** payment ho gaya par app band ho gayi / net chala gaya, to step 5 kabhi nahi aayega. Webhook se subscription phir bhi chalu ho jayega. Isliye `activate()` **idempotent** hoga: verify aur webhook dono aayein to bhi subscription ek hi baar banega.

### Robustness ke rules

1. **Amount kabhi client se nahi aayega.** Client sirf `planId` bhejta hai. Price, credit, payable sab server nikalta hai.
2. **Signature check:** verify mein `HMAC_SHA256(order_id + "|" + payment_id, RAZORPAY_SECRET)`, webhook mein raw body par `RAZORPAY_WEBHOOK_SECRET`. Timing-safe compare.
3. **Double check:** signature ke baad Razorpay se payment fetch karke dekhenge ki `status = captured` (authorized ho to capture karenge) aur `amount` hamare order se match karta hai.
4. **Idempotency:** `Payment.razorpayOrderId` unique. `created → paid` ek atomic `findOneAndUpdate` se hoga (jo jeeta wahi subscription banayega). `UserSubscription.paymentId` par bhi unique index. MongoDB Atlas hai, to ye dono steps ek **transaction** mein honge.
5. **Webhook events log:** `RazorpayEvent` collection mein event id unique. Same event dobara aaye to skip.
6. **Order expiry:** `created` payment 30 min baad `expired` maana jayega. Ek user ka ek time par ek hi open order (naya order maange to purana expire).
7. **Quote order par save hota hai:** purpose, price, credit aur payable order banate waqt fix ho jaate hain. Beech mein admin setting / price badle ya plan inactive kare, to bhi paid order usi quote par chalega.
8. **Price snapshot:** kharidte waqt plan ka naam, price, duration, benefits `UserSubscription` mein copy honge. Baad mein admin price badle to purani history nahi badlegi.
9. **Access cron par depend nahi karega:** access hamesha `startDate ≤ now < endDate` se check hoga. Cron sirf status saaf karta hai aur reminder bhejta hai.
10. **Webhook ke liye raw body:** `index.js` mein `express.json({ verify: (req, res, buf) => { req.rawBody = buf } })`. Baaki routes par koi asar nahi.
11. **Reconcile:** admin "sync" se atka hua payment Razorpay se dobara check kar sakega.

---

## 4. Plan kharidne ke rules (buy / renew / upgrade)

| User ki halat | Kaunsa plan | Upgrade setting | Kya hoga | Kitna pay |
| --- | --- | --- | --- | --- |
| Koi active plan nahi | Koi bhi | — | **New**: abhi se shuru | Poora price |
| Active plan hai | **Same plan** | ON / OFF dono | **Renew**: current khatam hote hi shuru (`scheduled`) | Poora price |
| Active plan hai | **Mehenga plan** | **ON** | **Upgrade**: abhi se shuru, purana `upgraded` | Naya price − credit |
| Active plan hai | Mehenga plan | **OFF** | Nahi milega. 409: "Upgrade abhi available nahi, current plan khatam hone ke baad lo" | — |
| Active plan hai | Sasta ya same price ka dusra plan | ON / OFF dono | Nahi milega. 409: "Current plan khatam hone ke baad lo" | — |
| Pehle se ek renew `scheduled` hai | Same plan dobara renew | — | Nahi milega. 409: max 1 scheduled plan | — |

"Mehenga" ka matlab: naye plan ka abhi ka price > current plan ka snapshot price.

### Upgrade setting (admin)

- `SubscriptionSetting.allowUpgrade` (on / off), admin panel se. **Default: OFF.**
- ON ho to user **kabhi bhi** upgrade kar sakta hai, plan ka pehla din ho ya aakhri. Current plan kitne din chala, isse farak nahi padta.
- OFF ho to `/subscriptions/my` mein `upgradeEnabled: false` aur `upgradeOptions: []` jayega, taaki web/app upgrade button na dikhaye. Quote aur create-order bhi 409 denge.

### Upgrade ka hisaab

- **Credit** = current plan ka snapshot price × (bacha hua time / kul time). Paise mein round down.
- Admin ka diya hua free plan (`admin_grant`) ho to credit **0**.
- **Payable** = naya price − credit, kam se kam ₹1 (Razorpay ka minimum).
- Naya plan abhi se apni **poori duration** chalega.
- Agar pehle se same plan ka `scheduled` renew pada hai, to wo naye plan ke khatam hone ke baad shift ho jayega (paisa diya hua hai, isliye cancel nahi hoga).

Example: Monthly ₹199, 30 mein se 10 din bache → credit ₹66.33. Yearly ₹1499 par upgrade → pay ₹1432.67. Yearly aaj se 365 din.

---

## 5. Content gating: movie free / paid

### Movie mein 2 naye fields

| Field | Type | Default | Note |
| --- | --- | --- | --- |
| `accessType` | `free` / `paid` | `free` | Purani aur nayi sab movies free rahengi. Admin jise chahe paid karega |
| `allowedPlans` | [ref Subscription] | `[]` | Sirf paid movie ke liye. Admin tick karega ki movie kin plans mein milegi |

Purani movies ka koi migration nahi. Field na ho to movie `free` maani jayegi.

### Kaun dekh sakta hai

| Movie | `accessType` | `allowedPlans` | Kaun dekh sakta hai |
| --- | --- | --- | --- |
| A | free | — | Sab, bina login bhi |
| B | paid | `[]` (kuch tick nahi) | Koi bhi active plan wala |
| C | paid | `[Yearly]` | Sirf Yearly plan wala |
| D | paid | `[Monthly, Yearly]` | Monthly ya Yearly wala |

- Admin aur staff ke liye har movie unlocked.
- Plan baad mein delete / inactive ho jaye, to jinke paas wo plan abhi active hai wo movie dekhte rahenge. Naye users ko wo plan "available in" list mein nahi dikhega.

### Locked movie ka response (get aur getAll dono mein)

Movie APIs par **optional auth** lagega: token ho to user pehchana jayega, na ho to bhi API chalegi.

```json
{
  "_id": "…",
  "title": "Movie C",
  "image": "…",
  "accessType": "paid",
  "isLocked": true,
  "lockReason": "plan_not_included",
  "availableInPlans": [{ "_id": "…", "name": "Yearly", "type": "yearly", "price": 1499 }],
  "video": null
}
```

- `lockReason`: `login_required` (token nahi) / `subscription_required` (koi active plan nahi) / `plan_not_included` (plan hai par is movie mein nahi).
- Locked movie mein `video` (aur HLS URL) **nahi** jayega. Unlocked mein `isLocked: false` aur video normal.
- `availableInPlans` se app/web "Ye plan lo" button dikha sakte hain. Sirf active plans aayenge.

### Admin panel

- Movie create / update mein `accessType` aur `allowedPlans` bhej sakenge. `allowedPlans` ke ids check honge (plan maujood aur deleted nahi).
- `free` movie mein `allowedPlans` khali kar diya jayega.
- Admin movie list mein `accessType` filter.

> **Note:** asli protection ke liye Cloudflare Stream signed URLs (`requireSignedURLs`) chahiye, warna URL leak hone par koi bhi dekh lega. Ye baad mein (section 11).

---

## 6. Data models

### 6.1 `Subscription` (plan): existing, kuch fields add

| Field | Type | Note |
| --- | --- | --- |
| *(existing)* | | name, description, price, type, durationInDays, benefits, limitations, isActive, isDeleted |
| `currency` | String, default `INR` | |
| `sortOrder` | Number, default 0 | Web/app mein plans kis order mein dikhen |
| `isPopular` | Boolean, default false | "Most popular" tag |
| `razorpayPlanId` | String | Sirf future auto-renew ke liye, abhi khali |

- Price **GST ke saath (inclusive)** hai. Admin jo price daalega, user wahi pay karega.
- Price **0 wala plan** kharida nahi ja sakega (Razorpay ₹0 order nahi banata). Free plan dena ho to admin grant se.

### 6.2 `UserSubscription` (naya): user ka ek subscription period

| Field | Type | Note |
| --- | --- | --- |
| `userId` | ref User, required | |
| `planId` | ref Subscription, required | Movie access isi se check hoga |
| `plan` | Object | Snapshot: `name`, `type`, `price`, `durationInDays`, `benefits` |
| `status` | `active` / `scheduled` / `expired` / `upgraded` / `cancelled` | `refunded` baad mein (section 11) |
| `source` | `purchase` / `renewal` / `upgrade` / `admin_grant` | |
| `startDate`, `endDate` | Date | |
| `paymentId` | ref Payment, unique (sparse) | Admin grant mein khali |
| `amountPaid` | Number (paise) | |
| `creditApplied` | Number (paise) | Upgrade mein purane plan ka credit |
| `previousSubscriptionId` | ref UserSubscription | Upgrade / renew chain |
| `autoRenew` | Boolean, default false | Future |
| `cancelledAt`, `cancelReason`, `cancelledBy` | | Admin cancel |
| `grantedBy`, `note` | | Admin grant |
| `platform` | `web` / `android` / `ios` | |

Index: `{ userId: 1, status: 1, endDate: -1 }`, `{ status: 1, endDate: 1 }` (cron ke liye).

### 6.3 `Payment` (naya): har transaction

| Field | Type | Note |
| --- | --- | --- |
| `userId`, `planId` | ref | |
| `userSubscriptionId` | ref | Paid hone ke baad |
| `purpose` | `new` / `renewal` / `upgrade` | |
| `provider` | `razorpay` | Future mein `apple` / `google` |
| `amount` | Number (paise) | Jo user ne diya |
| `planPrice`, `creditApplied` | Number (paise) | Breakdown (quote) |
| `currency` | `INR` | |
| `status` | `created` / `paid` / `failed` / `expired` | `refunded` / `partially_refunded` baad mein |
| `receipt` | String, unique | `IFTV-20261010-XXXX`, user ko dikhega |
| `razorpayOrderId` | String, unique | |
| `razorpayPaymentId` | String, unique (sparse) | |
| `razorpaySignature` | String | |
| `method` | String | upi / card / netbanking / wallet (Razorpay se) |
| `failureReason` | String | |
| `paidAt`, `expiresAt` | Date | |
| `platform` | web / android | |

Index: `{ userId: 1, createdAt: -1 }`, `{ status: 1, createdAt: -1 }`.

### 6.4 `RazorpayEvent` (naya, chhota): webhook log

`eventId` (unique), `event` (jaise `payment.captured`), `payload`, `processedAt`, `error`. Duplicate webhook rokne aur debug ke liye.

### 6.5 `SubscriptionSetting` (naya, ek hi document)

| Field | Type | Note |
| --- | --- | --- |
| `allowUpgrade` | Boolean, default false | Upgrade on / off |
| `updatedBy` | ref User | Kis admin ne badla |

Pehli baar read par default document apne aap ban jayega. Baad mein yahin aur settings aa sakti hain.

### 6.6 `Movie`: `accessType`, `allowedPlans` (section 5)

### 6.7 `User`: koi change nahi

Active plan `UserSubscription` se nikalega (helper `getActiveSubscription(userId)`). User par copy nahi rakhenge, taaki data do jagah out of sync na ho.

---

## 7. APIs

Web aur app **same APIs** use karenge. Fark sirf checkout SDK ka hai aur `platform` field ka.

### 7.1 Public (bina login)

| Method | Route | Kaam |
| --- | --- | --- |
| GET | `/subscriptions/plans` | Sirf active plans, `sortOrder` se. Khali ho to `[]` (404 nahi) |
| GET | `/subscriptions/plans/:id` | Ek active plan |
| POST | `/payments/webhook` | Sirf Razorpay ke liye (signature check) |

### 7.2 Logged-in user (web + app)

| Method | Route | Kaam |
| --- | --- | --- |
| GET | `/subscriptions/my` | `isSubscribed`, current plan (naam, start, end, days left), scheduled plan, `canRenew`, `upgradeEnabled`, `upgradeOptions` (har plan ka credit aur payable) |
| GET | `/subscriptions/my/history` | Saare subscription periods, paginated |
| GET | `/payments/quote?planId=` | Kharidne se pehle: purpose (new/renewal/upgrade), price, credit, payable, start/end date. Allowed nahi to 409 + reason |
| POST | `/payments/create-order` | `{ planId, platform }` → Razorpay order + checkout options. `ios` par 403 |
| POST | `/payments/verify` | `{ razorpay_order_id, razorpay_payment_id, razorpay_signature }` → subscription chalu |
| POST | `/payments/failed` | User ne checkout band kiya / fail hua, reason save |
| GET | `/payments/my` | Mere transactions, paginated, `status` filter |
| GET | `/payments/my/:id` | Ek transaction ki receipt detail |

### 7.3 Admin panel (GET: admin + staff, baaki sab: sirf admin)

Plans:

| Method | Route | Kaam |
| --- | --- | --- |
| POST | `/subscriptions/add` | Existing. `isAdmin` lagega, Joi `value` save hoga, naye fields |
| GET | `/subscriptions/get-all` | Existing. Admin ke liye (inactive bhi). Auth lagega |
| GET | `/subscriptions/get/:id` | Existing. `validateObjectId` |
| PUT | `/subscriptions/update/:id` | **Naya.** Naam, price, benefits, sortOrder, isPopular, isActive. Price badalne se purane users par asar nahi |
| DELETE | `/subscriptions/delete/:id` | Existing. `isAdmin`. Jinke paas ye plan active hai unka chalta rahega |

User subscriptions aur setting:

| Method | Route | Kaam |
| --- | --- | --- |
| GET | `/subscriptions/admin/users` | Saare user subscriptions. Filter: status, planId, userId, source, date, search (naam/email/mobile) |
| GET | `/subscriptions/admin/users/:userId` | Ek user ki poori history + current plan |
| POST | `/subscriptions/admin/grant` | Free plan dena (`userId`, `planId`, `days`?, `note`) |
| PUT | `/subscriptions/admin/cancel/:id` | Access band karna, reason ke saath (refund nahi) |
| GET | `/subscriptions/admin/settings` | Upgrade setting dekhna |
| PUT | `/subscriptions/admin/settings` | `{ allowUpgrade: true/false }` |

Payments:

| Method | Route | Kaam |
| --- | --- | --- |
| GET | `/payments/admin/getAll` | Saare transactions. Filter: status, purpose, planId, userId, method, date |
| GET | `/payments/admin/get/:id` | Ek transaction + Razorpay details |
| POST | `/payments/admin/sync/:id` | Atka hua payment Razorpay se dobara check |
| GET | `/payments/admin/stats` | Revenue (aaj / mahina / range), active subscribers, plan-wise count, failed payments |

### 7.4 Movies (existing APIs mein badlav, nayi API nahi)

| Route | Badlav |
| --- | --- |
| `POST /movies/add`, `PUT /movies/update/:id` | `accessType`, `allowedPlans` accept |
| `GET /movies/getAll`, `GET /movies/:id/get` | Optional auth, `isLocked`, `lockReason`, `availableInPlans`. Locked mein video nahi. `accessType` filter |

### Ginti

| | APIs |
| --- | --- |
| Public | 2 |
| Webhook | 1 |
| User (web + app) | 8 |
| Admin: plan update | 1 |
| Admin: user subscriptions | 4 |
| Admin: settings | 2 |
| Admin: payments | 4 |
| **Kul nayi** | **22** |
| Purani subscription APIs jo theek hongi | 4 |
| Purani movie APIs jinme gating aayegi | 4 |

---

## 8. Background job (din mein ek baar)

`node-cron` (naya package) se:

- `active` jinka `endDate` nikal gaya → `expired`
- `scheduled` jinka `startDate` aa gaya → `active`
- `created` payments jo 30 min se purane → `expired`
- Expiry se 3 din aur 1 din pehle reminder email (sirf jinka email hai; nodemailer pehle se hai)

Access is job par depend nahi karta (rule 9), to job miss ho jaye to bhi kisi ko galat access nahi milega.

Payment success par bhi email jayega (email ho to).

---

## 9. Files jo banenge / badlenge

| File | Kya |
| --- | --- |
| `package.json` | `razorpay`, `node-cron` add |
| `.env` | `RAZORPAY_KEY_ID`, `RAZORPAY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` (user bharega) |
| `configs/razorpay.js` | Existing, use hoga |
| `index.js` | `express.json` mein `rawBody` capture, cron start |
| `constants.js` | `USER_SUBSCRIPTION_STATUSES`, `SUBSCRIPTION_SOURCES`, `PAYMENT_STATUSES`, `PAYMENT_PURPOSES`, `MOVIE_ACCESS_TYPES`, `LOCK_REASONS`, `PAYMENT_LIMITS` (order expiry, min amount) |
| `models/Subscription.js` | Naye fields |
| `models/UserSubscription.js`, `models/Payment.js`, `models/RazorpayEvent.js`, `models/SubscriptionSetting.js` | Naye |
| `models/Movie.js` | `accessType`, `allowedPlans` |
| `middlewares/optionalAuth.js` | Naya: token ho to user set kare, na ho to bhi aage jaane de |
| `routes/subscriptions.js` | Naye routes + auth chalu |
| `routes/payments.js` | Naya |
| `routes/movies.js`, `controllers/movies/*`, `services/movies/*`, `validator/movies.js` | Gating |
| `controllers/subscriptions/*`, `controllers/payments/*` | |
| `services/subscriptions/*`, `services/payments/*` | `quote`, `createOrder`, `verify`, `activate` (transaction), `webhook`, `sync`, `stats`, `access` (movie check) |
| `validator/subscriptions.js`, `validator/payments.js` | Joi |
| `jobs/subscriptionJobs.js` | Cron |
| `helpers/nodeMailer/*` | Payment success + expiry reminder mail |
| `postman/IFTV.postman_collection.json` | Subscriptions update + naya Payments folder + movies gating |
| `docs/frontend/{admin-panel,web,app}-api.md` | Naye sections (Hinglish) |
| `docs/known-issues-plan.md` | S6, P1–P5 (subscriptions) fixed mark |

### Implementation ka order

1. Constants, models, plan APIs theek (auth, update, public plans)
2. Payments core: quote, create-order, verify, `activate()` transaction
3. Webhook + RazorpayEvent
4. User APIs: my, history, transactions
5. Admin APIs: users, grant, cancel, settings, payments, sync, stats
6. Movie gating
7. Cron + emails
8. E2E tests, Postman, frontend docs

---

## 10. Testing

- Razorpay **test mode** keys se.
- E2E script: new / renew / upgrade (ON aur OFF), sasta plan 409, double scheduled 409, credit ka hisaab, ₹1 minimum, iOS 403, create-order, verify (test signature khud HMAC se bana kar), duplicate verify, duplicate webhook, galat signature, amount mismatch, expired order, admin grant (credit 0), admin cancel, cron transitions, movie gating ke saare cases (free, paid + khali list, paid + plan list, bina login, admin).
- Asli checkout ek baar web par test card / UPI test se.

---

## 11. Baad mein (abhi is kaam mein nahi)

| Kaam | Note |
| --- | --- |
| **Refund** | Admin refund API (full / partial), `refund.processed` webhook, `refunded` status. Model mein jagah rakhenge, API baad mein |
| **PDF invoice** | GST breakdown (base + 18%) ke saath download |
| **Device / screen limit** | Plan mein `maxScreens`, user ke active devices/sessions track karna, limit par naya device block |
| Auto-renew | Razorpay Subscriptions / UPI Autopay |
| iOS purchase | Apple In-App Purchase |
| Signed video URLs | Cloudflare Stream `requireSignedURLs`, taaki paid video ka URL leak na ho |
| Google Play billing | Android launch se pehle check |

---

## 12. Decisions (sab confirm, 2026-10-10)

| # | Sawaal | Faisla |
| --- | --- | --- |
| D1 | Prepaid ya auto-renew? | Prepaid. Auto-renew baad mein |
| D2 | Kahan se kharid sakte hain? | Web + Android par Razorpay. iOS app mein sirf status/history, kharidna web par |
| D3 | Upgrade | Admin setting `allowUpgrade` (default OFF). ON ho to user kabhi bhi sirf mehenge plan par upgrade kar sakta hai, abhi se, credit ke saath |
| D3a | Setting OFF ho to | Sirf same plan ka renew (current ke baad). Dusra plan current khatam hone ke baad |
| D4 | Content gating | Isi kaam mein |
| D4a | Movie kaise lock ho | Movie mein `accessType` (default free, purani movies jaisi hain waisi) + `allowedPlans` (admin tick karega; khali = koi bhi active plan) |
| D5 | GST | Price mein shamil |
| D6 | Refund | Baad mein |
| D7 | PDF invoice | Baad mein |
| D8 | Device / screen limit | Chahiye, par baad mein |
| D9 | Razorpay keys + webhook secret | User `.env` mein daalega |

---

## 13. Implementation status (2026-10-10)

### Bana

- **Models:** `UserSubscription`, `Payment`, `RazorpayEvent`, `SubscriptionSetting`, `planSnapshot` (shared). `Subscription` mein `currency`, `sortOrder`, `isPopular`, `razorpayPlanId`. `Movie` mein `accessType`, `allowedPlans`.
- **APIs:** section 7 ki saari 22 nayi APIs + 4 purani subscription APIs theek + 4 movie APIs mein gating.
- **Core logic:** `services/subscriptions/periods.js` (access dates se, status sync, rechain), `quote.js` (new / renewal / upgrade + credit), `movieAccess.js`; `services/payments/activatePayment.js` (Mongo transaction, idempotent), `checkout.js`, `webhook.js`, `adminPayments.js`.
- **Jobs:** `jobs/subscriptionJobs.js` (`node-cron`), `index.js` se start. `DISABLE_CRON=true` se band.
- **Mails:** payment success, expiry reminder (3 din aur 1 din pehle, sirf jinka email hai, renew kar chuke users ko nahi).
- **Packages:** `razorpay@^2.9.8`, `node-cron@^4.6.0`.
- Postman: Subscriptions folder 4 sub-folders mein, naya Payments folder, Movies mein gating. Frontend docs: web (section 4–5), app (4–5), admin (4–6), README.
- `docs/known-issues-plan.md`: S6 (subscriptions hissa), B2 / B3 / B5 (subscriptions), P1–P5 ✅.

### Plan se kya alag hai

| Plan | Code | Kyun |
| --- | --- | --- |
| `get-all` / `get/:id` par auth lagega | Ye dono **bina token** hi chalte hain (pehle jaise). Sirf add / update / delete par `isAdmin` | Web / app abhi in APIs se plans dikha rahe ho sakte hain. Inhe band karte to purani screens toot jaatin. Public screens ke liye nayi `/subscriptions/plans` hai |
| Cron din mein ek baar | Status sync **har 15 minute**, reminders roz 10:00 IST | Unpaid order 30 min mein expire hona chahiye. Sync sasta hai |
| — | ₹0 plan `availableInPlans` mein nahi aata, aur `/payments/quote` 422 deta hai | ₹0 plan kharida nahi ja sakta, sirf grant |
| — | `get-all` khali hone par 404 pehle jaisa; nayi lists (`plans`, `my/history`, `payments/my`, admin lists) `200 []` | Purana behaviour na badle. `utils/pagination.js` mein `allowEmpty` option joda |
| — | Upgrade order pay hone tak purana plan khatam ho chuka ho (late payment), to naya plan purane ke baad queue hota hai | Paisa liya hai, to plan kabhi kho na jaye |
| — | Webhook events: `payment.authorized`, `payment.captured`, `order.paid`, `payment.failed`. Baaki log hokar ignore | Refund events baad mein |

### Purane behaviour mein jaan-boojh kar badlav

1. `POST /subscriptions/add`, `PUT /subscriptions/update/:id`, `DELETE /subscriptions/delete/:id` par **admin token zaroori** (pehle open the). Admin panel ko token bhejna hoga.
2. Subscriptions get / delete par galat id → 422 (pehle 500). `get-all` mein anjaan query key ab ignore (pehle 404).
3. Movies `getAll` / `get` ke har item mein `accessType`, `allowedPlans`, `isLocked`, `lockReason`, `availableInPlans` aate hain. Sab purani movies free hain, isliye abhi kisi ka video band nahi hua. Admin koi movie paid kare tab admin panel ko bhi movie APIs par token bhejna hoga.

### Test

`scratchpad/subs-e2e/run.js` (repo mein nahi): server ko alag database `iftv_e2e_subscriptions` par chalaya (asli data touch nahi hua, end mein ye DB drop), Razorpay ka nakli client aur nakli mailer. **149/149 pass:** plans CRUD + auth, public plans, settings, quote ke saare cases, create-order (iOS 403), verify (galat signature, fail, amount mismatch, dobara verify, kisi aur ka order), renewal queue, upgrade OFF / ON, credit hisaab, ₹1 minimum, admin grant (credit 0), failed → baad mein paid, webhook (signature, duplicate event, unknown order, failed), verify + webhook + verify ek saath (sirf 1 subscription bana), admin lists / search / detail / grant / cancel (queue aage khiski), payments list / detail / sync / stats, movie gating (guest, galat token, bina plan, monthly, yearly, staff, admin, filters, update), jobs (expire, scheduled → active, stale order, reminders ek hi baar), aur gallery / supports / categories ab bhi chal rahe hain. Bina Razorpay keys ke: server start hota hai, payment APIs `503` dete hain.

### Live karne se pehle (user ko karna hai)

1. `.env` mein `RAZORPAY_KEY_ID`, `RAZORPAY_SECRET` (test mode pehle), aur naya `RAZORPAY_WEBHOOK_SECRET`.
2. Razorpay Dashboard → Settings → Webhooks: URL `https://<server>/iftv-ott/payments/webhook`, wahi secret, events `payment.authorized`, `payment.captured`, `order.paid`, `payment.failed`.
3. Razorpay Dashboard → Payment capture: **automatic** (server authorized payment ko khud bhi capture karta hai, par auto behtar hai).
4. Admin panel: plan add / update / delete aur movie lists par admin token bhejna.
5. Ek baar web par asli test checkout (test card / UPI) se poora flow chalana.
6. Android launch se pehle Google Play billing rule check karna. iOS app mein checkout aur website link nahi.
