# IFTV frontend API docs

Last update: 2026-10-10

Ye folder frontend teams ke liye hai. Har team ka **ek doc** hai, aur har doc mein feature-wise sections hain. Har API ke saath ye sab likha hai:

- method aur URL
- auth (token chahiye ya nahi)
- request body (saare fields, rules, enums)
- success response (asli JSON)
- saare errors aur edge cases
- UI mein kaise lagana hai

| Doc | Kis team ke liye | Features |
| --- | --- | --- |
| [web-api.md](web-api.md) | Website (React / Next.js) | OTP login, Support (Contact Us + Tickets), Gallery, Subscription + Razorpay, Movies lock |
| [app-api.md](app-api.md) | Android / iOS app | OTP login, Support (Tickets), Gallery, Subscription + Razorpay (Android), Movies lock |
| [admin-panel-api.md](admin-panel-api.md) | Admin panel | Admin/staff login, Support inbox, Gallery management, Subscriptions, Payments, Movies free / paid |

## Kaunsa API kis doc mein hai

| Feature | API | Web | App | Admin |
| --- | --- | :---: | :---: | :---: |
| Auth | `POST /auth/loginOrSignin-with-mobile` (mobile OTP bhejo) | ✅ | ✅ | |
| Auth | `PUT /auth/verify-otp-mobile` (mobile OTP verify) | ✅ | ✅ | |
| Auth | `POST /auth/loginOrSignin-with-email` (email OTP bhejo) | ✅ | ✅ | |
| Auth | `PUT /auth/verify-otp-email` (email OTP verify) | ✅ | ✅ | |
| Auth | `POST /auth/login` (admin/staff password login) | | | ✅ |
| Support | `POST /supports/contact-us` (bina login) | ✅ | | |
| Support | `POST /supports/create` | ✅ | ✅ | |
| Support | `GET /supports/my` | ✅ | ✅ | |
| Support | `GET /supports/get/:id` | ✅ | ✅ | |
| Support | `POST /supports/reply/:id` | ✅ | ✅ | |
| Support | `PUT /supports/close/:id` | ✅ | ✅ | |
| Support | `GET /supports/admin/getAll` | | | ✅ |
| Support | `GET /supports/admin/stats` | | | ✅ |
| Support | `GET /supports/admin/get/:id` | | | ✅ |
| Support | `POST /supports/admin/reply/:id` | | | ✅ |
| Support | `PUT /supports/admin/update/:id` | | | ✅ |
| Support | `DELETE /supports/admin/delete/:id` | | | ✅ |
| Gallery | `GET /gallery/getAll` (bina login) | ✅ | ✅ | |
| Gallery | `GET /gallery/get/:id` (bina login) | ✅ | ✅ | |
| Gallery | `POST /gallery/admin/video/upload-url` | | | ✅ |
| Gallery | `GET /gallery/admin/video/:uid/status` | | | ✅ |
| Gallery | `POST /gallery/admin/create` | | | ✅ |
| Gallery | `POST /gallery/admin/bulk-create` | | | ✅ |
| Gallery | `GET /gallery/admin/getAll` | | | ✅ |
| Gallery | `GET /gallery/admin/get/:id` | | | ✅ |
| Gallery | `PUT /gallery/admin/update/:id` | | | ✅ |
| Gallery | `PUT /gallery/admin/reorder` | | | ✅ |
| Gallery | `DELETE /gallery/admin/delete/:id` | | | ✅ |
| Subscription | `GET /subscriptions/plans` (bina login) | ✅ | ✅ | |
| Subscription | `GET /subscriptions/plans/:id` (bina login) | ✅ | ✅ | |
| Subscription | `GET /subscriptions/my` | ✅ | ✅ | |
| Subscription | `GET /subscriptions/my/history` | ✅ | ✅ | |
| Subscription | `POST /subscriptions/add` (admin token) | | | ✅ |
| Subscription | `GET /subscriptions/get-all` | | | ✅ |
| Subscription | `GET /subscriptions/get/:id` | | | ✅ |
| Subscription | `PUT /subscriptions/update/:id` | | | ✅ |
| Subscription | `DELETE /subscriptions/delete/:id` (admin token) | | | ✅ |
| Subscription | `GET /subscriptions/admin/settings` | | | ✅ |
| Subscription | `PUT /subscriptions/admin/settings` | | | ✅ |
| Subscription | `GET /subscriptions/admin/users` | | | ✅ |
| Subscription | `GET /subscriptions/admin/users/:userId` | | | ✅ |
| Subscription | `POST /subscriptions/admin/grant` | | | ✅ |
| Subscription | `PUT /subscriptions/admin/cancel/:id` | | | ✅ |
| Payment | `GET /payments/quote` | ✅ | ✅ | |
| Payment | `POST /payments/create-order` (iOS se nahi) | ✅ | ✅ | |
| Payment | `POST /payments/verify` | ✅ | ✅ | |
| Payment | `POST /payments/failed` | ✅ | ✅ | |
| Payment | `GET /payments/my` | ✅ | ✅ | |
| Payment | `GET /payments/my/:id` | ✅ | ✅ | |
| Payment | `GET /payments/admin/getAll` | | | ✅ |
| Payment | `GET /payments/admin/get/:id` | | | ✅ |
| Payment | `POST /payments/admin/sync/:id` | | | ✅ |
| Payment | `GET /payments/admin/stats` | | | ✅ |
| Movies | `GET /movies/getAll`, `GET /movies/:id/get` (optional token, lock fields) | ✅ | ✅ | ✅ |
| Movies | `POST /movies/add`, `PUT /movies/update/:id` (`accessType`, `allowedPlans`) | | | ✅ |

**Abhi in docs mein nahi hai:** Register, password login (user ke liye), Users profile, Categories, SubCategories, Banners, aur Movies ke baaki APIs (sirf free / paid lock wala hissa docs mein hai). Razorpay webhook (`POST /payments/webhook`) sirf server-to-server hai, Postman mein hai. Inki details Postman collection mein hain. Jaise-jaise ye final hote jaayenge, inke sections bhi yahan add honge.

## Saath mein Postman

Har API Postman collection `server/postman/IFTV.postman_collection.json` mein bhi hai, saved example responses ke saath. Collection import karke `baseUrl` variable set kar lo, phir requests seedhe chala sakte ho.

## Update ka rule

Jab bhi koi naya API bane ya kisi API mein change ho:

1. Jis team ko wo API use karni hai, uske doc mein us feature ke section mein update karo. Feature naya ho to naya section banao.
2. Upar wali "Kaunsa API kis doc mein hai" table update karo.
3. Doc ke top par "Last update" ki date badlo, aur neeche **Changelog** mein ek line likho.

## Changelog

- **2026-10-10:** Pehla version. Isme OTP login (mobile + email), Support (Contact Us, tickets, admin inbox) aur Gallery (public + admin) hain.
- **2026-10-10:** Subscription + Razorpay payments (web, app, admin) aur Movies free / paid lock add kiye.
