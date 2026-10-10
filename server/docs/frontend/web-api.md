# IFTV Website: API doc

Last update: 2026-10-10 · Index: [README.md](README.md)

Ye doc website team ke liye hai. Isme 5 features hain:

1. [Auth: OTP login](#1-auth-otp-login) (mobile OTP aur email OTP)
2. [Support](#2-support): Contact Us (bina login) aur Tickets (login ke baad)
3. [Gallery](#3-gallery) (bina login)
4. [Subscription + Payment (Razorpay)](#4-subscription--payment-razorpay): plans, plan kharidna, my plan, history, transactions, upgrade
5. [Movies: free / paid lock](#5-movies-free--paid-lock)

---

## 0. Shuru karne se pehle (sab APIs par lagta hai)

### Base URL

| Server | Base URL |
| --- | --- |
| Live (Render) | `https://iftv-ott.onrender.com/iftv-ott` |
| Local | `http://localhost:8500/iftv-ott` |

Neeche har path base URL ke baad lagta hai. Jaise `GET /gallery/getAll` ka matlab hai `GET https://iftv-ott.onrender.com/iftv-ott/gallery/getAll`.

### Response ka format

Har response isi shape mein aata hai.

Success:

```json
{ "success": true, "message": "....", "data": { } }
```

Error:

```json
{ "success": false, "message": "User ko dikhane layak message", "error": {} }
```

UI mein error dikhana ho to `message` hi dikhao.

### Token (login wale APIs)

- Login (OTP verify) ke response mein `data.token` milta hai. Ye JWT hai aur **7 din** chalta hai.
- Ise localStorage ya cookie mein save karo. Har protected API mein header bhejo: `Authorization: Bearer <token>`.
- `401 Your session has expired. Please log in again.` aaye to token hata do aur login page par bhejo.

### Body kaise bhejna hai

- **JSON:** header `Content-Type: application/json`.
- **form-data (files wale APIs):** `FormData` use karo, aur `Content-Type` **khud set mat karo**. Browser boundary ke saath khud set karta hai.
- `x-www-form-urlencoded` server parse nahi karta, isliye use mat karo.

### Common errors

| Status | message | Kab aata hai / kya karna hai |
| --- | --- | --- |
| 401 | `Access Denied! Missing authorization token` | Token nahi bheja. Login page par bhejo |
| 401 | `Your session has expired. Please log in again.` | Token expire ho gaya. Logout karke login page par bhejo |
| 403 | `Access Denied! Invalid authorization token format` / `Invalid or malformed token. Please log in again.` | Token kharab hai. Logout karo |
| 404 | `Access Denied! User not found` | User delete ho chuka hai. Logout karo |
| 404 | `Invalid API` | Path ya method galat hai |
| 413 | `File too large. Max 2048 MB allowed; ...` | File bahut badi hai |
| 422 | validation messages | Kai errors ho to `, ` se jude hue ek hi message mein aate hain |
| 500 | koi bhi | Server error. "Kuch galat ho gaya, dobara try karo" dikhao |

### Khali list = 404

List wale APIs (`/supports/my`, `/gallery/getAll`) par koi record na ho to **404** aata hai, message `No any ... found` ke saath. Ise error mat dikhao, **empty state** ("Abhi kuch nahi hai") dikhao.

**Exception:** subscription aur payment ki nayi list APIs (`/subscriptions/plans`, `/subscriptions/my/history`, `/payments/my`) khali hone par **200** ke saath khali list (`[]`) deti hain, 404 nahi.

### Dates

Saari dates ISO format mein UTC mein aati hain, jaise `2026-10-10T13:00:44.566Z`. Dikhate waqt local time mein convert karo.

---

## 1. Auth: OTP login

Website par user do tarah se login/sign-up kar sakta hai: **mobile OTP** ya **email OTP**. Login aur sign-up ek hi flow hai. User pehle se na ho to server khud naya account bana deta hai, aur response mein `isFirst: true` aata hai.

```
[Mobile / email daalo] ──▶ Send OTP API ──▶ [OTP screen] ──▶ Verify OTP API ──▶ token save ──▶ Home
                                 ▲                 │
                                 └── Resend OTP ───┘   (wahi Send OTP API dobara)
```

> ⚠️ `role` field hamesha `"user"` bhejo, ya bhejo hi mat (default `user` hai). Website se `admin` ya `staff` kabhi mat bhejo.

### 1.1 Mobile OTP bhejo

`POST /auth/loginOrSignin-with-mobile` · Auth: nahi · Body: JSON

Server user ke mobile par SMS se OTP bhejta hai (2factor). Response mein `data.otpData.Details` aata hai, ye **sessionId** hai. Ise save karo, verify mein lagega.

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| mobile | number | haan | 10 digit, jaise `9876543210`, bina `+91` ke |
| role | string | nahi | hamesha `"user"` |
| loginType | string | nahi | `"mobile"` (default) |

**Request:**

```json
{ "mobile": 9876543210, "role": "user", "loginType": "mobile" }
```

**Success 200:**

```json
{
  "success": true,
  "message": "OTP has been sent to your Mobile. Please check your inbox.",
  "data": {
    "otpData": { "Status": "Success", "Details": "7c0f6a2e-3b1d-4e5f-9a8b-1c2d3e4f5a6b" },
    "isFirst": false
  }
}
```

- `isFirst: true` ka matlab naya user bana hai. OTP verify ke baad profile/onboarding screen dikha sakte ho.
- OTP **10 minute** valid hai. Resend karne par naya OTP aur naya `sessionId` aata hai, aur purana session kaam karna band kar deta hai. Isliye resend ke baad naya `sessionId` save karo.

**Errors:**

| Status | message | UI |
| --- | --- | --- |
| 422 | `Mobile number is required` | Mobile field par error |
| 400 | `Could not send OTP to this mobile number` | "Is number par OTP nahi bhej paaye, number check karo" |
| 502 | `OTP service is unavailable. Please try again.` | "Thodi der baad try karo" |
| 500 | `User validation failed: ...` | Mobile mein digits ke alawa kuch bheja gaya. Bhejne se pehle validate karo |

> Har call par ek paid SMS jaata hai. Resend button par **30 second ka timer** lagao, aur double click se bachao.

### 1.2 Mobile OTP verify

`PUT /auth/verify-otp-mobile` · Auth: nahi · Body: JSON · Method **PUT** hai

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| sessionId | string | haan | Send OTP ke response ka `data.otpData.Details` (latest wala) |
| otp | string | haan | SMS wala 6 digit code, jaise `"123456"` |
| mobile | number | haan | wahi number jis par OTP bheja tha |
| role | string | nahi | `"user"` |
| loginType | string | nahi | `"mobile"` |
| currentScreen | string | nahi | jaise `"HOME_SCREEN"` (server uppercase kar deta hai) |
| fcmToken | string | nahi | web push token, agar use karte ho |

**Request:**

```json
{
  "sessionId": "7c0f6a2e-3b1d-4e5f-9a8b-1c2d3e4f5a6b",
  "otp": "123456",
  "mobile": 9876543210,
  "role": "user",
  "currentScreen": "HOME_SCREEN"
}
```

**Success 200:** `data.token` save karo, aur `data.user` profile ke liye use karo.

```json
{
  "success": true,
  "message": "OTP Verification successful",
  "data": {
    "user": {
      "_id": "6705e0b1a1b2c3d4e5f60701",
      "name": "john doe",
      "role": "user",
      "loginType": "mobile",
      "mobile": 9876543210,
      "currentScreen": "HOME_SCREEN",
      "isEmailVerified": false,
      "isMobileVerified": true,
      "isSignUpCompleted": false,
      "isOnBoardingCompleted": false,
      "isLoggedIn": true,
      "isOnline": true,
      "isActive": true,
      "isDeleted": false,
      "createdAt": "2026-10-10T08:00:00.000Z",
      "updatedAt": "2026-10-10T08:05:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...."
  }
}
```

**Errors:**

| Status | message | Kab | UI |
| --- | --- | --- | --- |
| 422 | `Please fill all required fields` | sessionId, otp ya mobile missing | |
| 404 | `User not found with this mobile number` | Is number par OTP bheja hi nahi gaya | Mobile screen par wapas bhejo |
| 404 | `OTP not found` | OTP pehle hi use ho chuka hai, ya bheja hi nahi gaya | "Naya OTP mangao" |
| 403 | `Invalid OTP` | Code galat hai, ya `sessionId` purana / kisi aur number ka hai | "OTP galat hai" |
| 410 | `OTP expired` | 10 minute nikal gaye | "OTP expire ho gaya, Resend karo" |
| 502 | `OTP service is unavailable. Please try again.` | SMS service down hai | "Thodi der baad try karo" |

Ek OTP sirf **ek baar** chalta hai. Success ke baad dobara verify karoge to `404 OTP not found` aayega.

### 1.3 Email OTP bhejo

`POST /auth/loginOrSignin-with-email` · Auth: nahi · Body: JSON

Server email par 6 digit OTP bhejta hai. OTP response mein **nahi** aata.

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| email | string | haan | valid email (server format check nahi karta, isliye frontend par validate karo) |
| role | string | nahi | `"user"` |
| loginType | string | nahi | `"email"` (default) |

**Request:**

```json
{ "email": "john@example.com", "role": "user", "loginType": "email" }
```

**Success 200:**

```json
{
  "success": true,
  "message": "OTP has been sent to your Email. Please check your inbox.",
  "data": { "isFirst": true }
}
```

- OTP **5 minute** valid hai. Resend karne par naya OTP aata hai aur purana band ho jaata hai.

**Errors:**

| Status | message |
| --- | --- |
| 422 | `Email is required` |

### 1.4 Email OTP verify

`PUT /auth/verify-otp-email` · Auth: nahi · Body: JSON · Method **PUT** hai

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| email | string | haan | wahi email |
| otp | **string** | haan | 6 digit **string** mein, jaise `"483920"`. Number bhejoge (`483920`) to hamesha `Invalid OTP` aayega |
| role | string | nahi | `"user"` |
| loginType | string | nahi | `"email"` |
| currentScreen | string | nahi | jaise `"HOME_SCREEN"` |
| fcmToken | string | nahi | |

**Request:**

```json
{ "email": "john@example.com", "otp": "483920", "role": "user", "currentScreen": "HOME_SCREEN" }
```

**Success 200:** mobile verify jaisa hi `{ user, token }` aata hai, bas `isEmailVerified: true` hota hai aur `loginType: "email"`.

**Errors (isi order mein check hote hain):**

| Status | message | UI |
| --- | --- | --- |
| 404 | `User not found with this email` | Email screen par wapas bhejo |
| 404 | `OTP not found` | "Naya OTP mangao" |
| 410 | `OTP expired` | "OTP expire ho gaya, Resend karo" |
| 403 | `Invalid OTP` | "OTP galat hai" |

---

## 2. Support

Website par support ke do raaste hain:

| | Contact Us | Ticket |
| --- | --- | --- |
| Login | Nahi chahiye | Chahiye |
| Kahan | Footer / Contact page | "Help & Support" (My account) |
| Jawab kaise milta hai | Sirf email par | Website ke thread mein aur email par |
| Attachments | Nahi | 0–3 images |

**Enums** (UI label tum apne hisaab se rakh sakte ho):

| Enum | Values |
| --- | --- |
| category | `payment` (Payment), `subscription` (Subscription), `playback` (Video / Playback), `account` (Account), `content_request` (Content request), `feedback` (Feedback), `other` (Other) |
| status | `open` (Open), `in_progress` (In progress), `resolved` (Resolved), `closed` (Closed) |
| priority | `low`, `medium`, `high` (sirf admin set karta hai, user ko dikhana optional hai) |
| platform | `web`, `android`, `ios`. Website se hamesha `web` bhejo |

**Ticket number:** `ticketId` jaise `SUP-261010-4821` user ko dikhane ke liye hai. URLs mein hamesha Mongo `_id` lagta hai, ticket number nahi.

**Status ka safar:**

```
open ──(support ne reply kiya)──▶ in_progress ──▶ resolved ──▶ closed
  ▲                                                │
  └────────── user ne resolved ticket par reply kiya

closed ticket par koi reply nahi ho sakta. Naya issue ho to naya ticket banana hoga.
```

### 2.1 Contact Us (bina login)

`POST /supports/contact-us` · Auth: nahi · Body: JSON

Visitor ko confirmation email jaata hai aur support team ko alert. Admin ka jawab visitor ko **sirf email** par milta hai.

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| name | string | haan | 2–80 characters |
| email | string | haan | valid email, max 120 |
| mobile | string | nahi | jaise `"+919876543210"` ya `"9876543210"` |
| category | enum | haan | upar wali category list |
| subject | string | haan | 3–150 |
| message | string | haan | 10–2000 |
| website | string | nahi | **honeypot** (bots pakadne ke liye), neeche dekho |

**Honeypot:** form mein ek hidden input `website` rakho jo CSS se chhupa ho (`display:none`). Asli user ise kabhi nahi bharega, isliye hamesha `""` bhejo. Ye bhara hua aaya to server 201 deta hai, lekin kuch save nahi karta.

**Limit:** ek email se **24 ghante mein max 3** messages.

**Request:**

```json
{
  "name": "Guest Person",
  "email": "guest@example.com",
  "mobile": "+919876543210",
  "category": "feedback",
  "subject": "Love the app",
  "message": "Hello team, great work on the new release!",
  "website": ""
}
```

**Success 201:**

```json
{
  "success": true,
  "message": "Your message has been sent successfully",
  "data": { "ticketId": "SUP-261010-5426", "status": "open", "createdAt": "2026-10-10T13:00:36.596Z" }
}
```

Success par dikhao: "Aapka message mil gaya. Reference: SUP-261010-5426. Hum email par jawab denge."

**Errors:**

| Status | message |
| --- | --- |
| 422 | `Name is required` / `Name has minimum 2 characters` |
| 422 | `Email must be a valid email` |
| 422 | `Mobile is not a valid mobile number` |
| 422 | `Category must be one of [payment, subscription, playback, account, content_request, feedback, other]` |
| 422 | `Subject has minimum 3 characters` / `Subject cannot exceed 150 characters` |
| 422 | `Message has minimum 10 characters` / `Message cannot exceed 2000 characters` |
| 429 | `Too many requests from this email. Please try again after 24 hours.` |

Kai fields galat hon to saare messages `, ` se jud kar ek hi `message` mein aate hain.

### 2.2 Ticket banao (login)

`POST /supports/create` · Auth: `Bearer <token>` · Body: **form-data**

Naam, email aur mobile account se apne aap le liye jaate hain. User ko confirmation email jaata hai.

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| category | enum (text) | haan | category list |
| subject | text | haan | 3–150 |
| message | text | haan | 10–2000 |
| platform | text | haan | website se `web` |
| appVersion | text | nahi | max 30 (web build version, chaho to) |
| attachments | file | nahi | 0–3 images, **jpg / jpeg / png / webp**, har ek **≤ 5 MB**. Same key `attachments` 3 baar tak append karo |

**Limit:** ek user ke max **5 tickets** aise ho sakte hain jo `closed` nahi hain.

**Request (JS):**

```js
const fd = new FormData();
fd.append("category", "playback");
fd.append("subject", "Video keeps buffering");
fd.append("message", "Movie stops every 10 seconds on wifi.");
fd.append("platform", "web");
files.forEach((f) => fd.append("attachments", f)); // max 3

await fetch(`${BASE}/supports/create`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}` }, // Content-Type mat lagao
  body: fd,
});
```

**Success 201:**

```json
{
  "success": true,
  "message": "Ticket created successfully",
  "data": {
    "_id": "6aca36fcadf89e0beee090c6",
    "ticketId": "SUP-261010-5015",
    "source": "ticket",
    "user": "6aca36ee6f68761936f63087",
    "name": "Test User",
    "email": "test-user@example.com",
    "category": "playback",
    "subject": "Video keeps buffering",
    "message": "Movie stops every 10 seconds on wifi.",
    "attachments": [
      "https://imagedelivery.net/<account-hash>/<image-id>/public",
      "https://imagedelivery.net/<account-hash>/<image-id>/public"
    ],
    "platform": "web",
    "status": "open",
    "priority": "medium",
    "replies": [],
    "createdAt": "2026-10-10T13:00:44.566Z",
    "updatedAt": "2026-10-10T13:00:44.566Z"
  }
}
```

**Errors:**

| Status | message |
| --- | --- |
| 422 | `Platform is required` / `Category must be one of [...]` / `Subject has minimum 3 characters` / `Message has minimum 10 characters` |
| 422 | `Maximum 3 attachments are allowed` |
| 422 | `Invalid attachment notes.txt. Allowed: .jpg, .jpeg, .png, .webp` |
| 422 | `Attachment big.png is larger than 5 MB` |
| 429 | `You already have 5 open tickets. Please close one or wait for them to be resolved.` |
| 401 / 403 | token wale errors (section 0) |

> Tip: file type aur size frontend par hi check kar lo (`accept="image/jpeg,image/png,image/webp"`), taaki user ko jaldi pata chale.

### 2.3 Mere tickets (list)

`GET /supports/my` · Auth: `Bearer <token>`

| Query | Required | Rules |
| --- | --- | --- |
| page | nahi | ≥ 1, default 1 |
| limit | nahi | 1–100, default 10 |
| status | nahi | `open` / `in_progress` / `resolved` / `closed` (tabs ke liye) |

Tickets newest first aate hain. List mein replies nahi aate, sirf `replyCount` aata hai. Thread dekhne ke liye ticket open karo (2.4).

**Success 200:**

```json
{
  "success": true,
  "message": "Tickets fetched successfully",
  "data": {
    "total": 1,
    "totalPages": 1,
    "page": 1,
    "limit": 10,
    "data": [
      {
        "_id": "6aca36fcadf89e0beee090c6",
        "ticketId": "SUP-261010-5015",
        "category": "playback",
        "subject": "Video keeps buffering",
        "attachments": ["https://imagedelivery.net/<account-hash>/<image-id>/public"],
        "platform": "web",
        "status": "open",
        "createdAt": "2026-10-10T13:00:44.566Z",
        "updatedAt": "2026-10-10T13:00:44.566Z",
        "replyCount": 0
      }
    ]
  }
}
```

`lastReplyAt` tab aata hai jab koi reply ho chuka ho.

**Errors:**

| Status | message | UI |
| --- | --- | --- |
| 404 | `No any supportticket found` | Empty state: "Abhi koi ticket nahi hai" + "Naya ticket" button |
| 422 | `Status must be one of [open, in_progress, resolved, closed]` | |

### 2.4 Ticket detail + thread

`GET /supports/get/:id` · Auth: `Bearer <token>` · `:id` = ticket ka `_id`

**Success 200:**

```json
{
  "success": true,
  "message": "Ticket fetched successfully",
  "data": {
    "_id": "6aca36fcadf89e0beee090c6",
    "ticketId": "SUP-261010-5015",
    "source": "ticket",
    "user": "6aca36ee6f68761936f63087",
    "name": "Test User",
    "email": "test-user@example.com",
    "category": "playback",
    "subject": "Video keeps buffering",
    "message": "Movie stops every 10 seconds on wifi.",
    "attachments": ["https://imagedelivery.net/<account-hash>/<image-id>/public"],
    "platform": "web",
    "status": "in_progress",
    "priority": "high",
    "replies": [
      {
        "_id": "6aca3703adf89e0beee090df",
        "sender": "6aca36ee6f68761936f63089",
        "senderRole": "admin",
        "message": "Please clear the app cache and try again.",
        "attachments": ["https://imagedelivery.net/<account-hash>/<image-id>/public"],
        "createdAt": "2026-10-10T13:00:51.878Z"
      }
    ],
    "createdAt": "2026-10-10T13:00:44.566Z",
    "updatedAt": "2026-10-10T13:00:54.070Z",
    "lastReplyAt": "2026-10-10T13:00:51.877Z"
  }
}
```

**Thread kaise dikhana hai:**

- Sabse upar user ka original `message` aur `attachments`, phir `replies` purane se naye ke order mein.
- `senderRole`: `user` wale reply right side mein (user ke apne), aur `admin` / `staff` wale left side mein "IFTV Support" naam se.
- Attachment URL `.../public` hai. Chhota preview chahiye to end ka `/public` hata kar `/thumbnail` lagao (400px).
- `status` ke hisaab se reply box: `closed` ho to reply box chhupa do aur "Ye ticket band hai" dikhao.

**Errors:**

| Status | message |
| --- | --- |
| 404 | `Ticket not found` (kisi aur ka ticket bhi 404 deta hai) |
| 422 | `Invalid Ticket Id` |

### 2.5 Ticket par reply

`POST /supports/reply/:id` · Auth: `Bearer <token>` · Body: **form-data**

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| message | text | haan | 1–2000 |
| attachments | file | nahi | 0–3 images, jpg / jpeg / png / webp, har ek ≤ 5 MB |

- `resolved` ticket par reply karne se ticket wapas `open` ho jaata hai.
- `closed` ticket par reply nahi ho sakta.

**Success 200:** poora updated ticket aata hai (2.4 jaisa), jisme naya reply `replies` ke end mein hota hai. Isi se thread refresh kar do.

**Errors:**

| Status | message |
| --- | --- |
| 400 | `This ticket is closed. Please create a new ticket.` |
| 404 | `Ticket not found` |
| 422 | `Message is required` / `Message is not allowed to be empty` / attachment errors (2.2 jaise) |

### 2.6 Ticket band karo

`PUT /supports/close/:id` · Auth: `Bearer <token>` · Body: nahi

User khud ticket band kar sakta hai, jaise "Mera issue solve ho gaya" button se. Band karne ke baad reply nahi ho sakta.

**Success 200:** poora ticket aata hai, jisme `"status": "closed"` aur `closedAt` set hote hain.

**Errors:**

| Status | message |
| --- | --- |
| 400 | `Ticket is already closed` |
| 404 | `Ticket not found` |

---

## 3. Gallery

Gallery section **bina login** dikhta hai. Admin panel se images, GIFs aur videos aate hain. Sirf active items aate hain, aur admin ke set kiye order mein.

| Enum | Values |
| --- | --- |
| mediaType | `image`, `gif`, `video` |

### Item ke fields

| Field | Type | Kya hai / kaise use karna hai |
| --- | --- | --- |
| _id | string | item id |
| title, description | string | set na ho to `""` aata hai. Khali ho to caption mat dikhao |
| mediaType | enum | `image` / `gif` / `video` |
| media | string | image / gif: full size URL (max 1920x1080). video: Cloudflare Stream **watch** URL |
| hlsUrl | string \| null | sirf video: HLS stream (`.m3u8`) |
| poster | string \| null | sirf video: poster image. Admin ne upload na kiya ho to Cloudflare ka auto thumbnail aata hai |
| thumbnailUrl | string | **grid ke liye chhota image** (har type ke liye hamesha milta hai) |
| durationInSeconds | number \| null | sirf video. Kabhi kabhi `null` ho sakta hai, tab duration badge mat dikhao |
| tags | string[] | lowercase. Filter chips ke liye |
| order | number | server isi se sort karke bhejta hai, tumhe sort nahi karna |
| createdAt | date | |

### 3.1 Gallery list

`GET /gallery/getAll` · Auth: nahi

| Query | Required | Rules |
| --- | --- | --- |
| page | nahi | default 1 |
| limit | nahi | default 20, **max 50** |
| mediaType | nahi | `image` / `gif` / `video` (tabs: All / Photos / Videos) |
| tag | nahi | ek tag, jaise `bts` |
| search | nahi | title aur description mein dhundhta hai |

**Request:** `GET /gallery/getAll?page=1&limit=20`

**Success 200:**

```json
{
  "success": true,
  "message": "Gallery fetched successfully",
  "data": {
    "total": 7,
    "totalPages": 1,
    "page": 1,
    "limit": 20,
    "data": [
      {
        "_id": "6aca4285acab35ec9bd561e8",
        "title": "Behind the scenes (full)",
        "description": "",
        "mediaType": "video",
        "media": "https://customer-<code>.cloudflarestream.com/<uid>/watch",
        "hlsUrl": "https://customer-<code>.cloudflarestream.com/<uid>/manifest/video.m3u8",
        "poster": "https://customer-<code>.cloudflarestream.com/<uid>/thumbnails/thumbnail.jpg",
        "thumbnailUrl": "https://customer-<code>.cloudflarestream.com/<uid>/thumbnails/thumbnail.jpg",
        "durationInSeconds": 94,
        "tags": ["bts"],
        "order": 0,
        "createdAt": "2026-10-10T13:49:57.535Z"
      },
      {
        "_id": "6aca4284acab35ec9bd561e1",
        "title": "Dance loop",
        "description": "",
        "mediaType": "gif",
        "media": "https://imagedelivery.net/<account-hash>/<image-id>/public",
        "hlsUrl": null,
        "poster": null,
        "thumbnailUrl": "https://imagedelivery.net/<account-hash>/<image-id>/thumbnail",
        "durationInSeconds": null,
        "tags": ["bts"],
        "order": 0,
        "createdAt": "2026-10-10T13:49:56.882Z"
      },
      {
        "_id": "6aca4283acab35ec9bd561de",
        "title": "Premiere night 2026",
        "description": "Red carpet at the IFTV premiere",
        "mediaType": "image",
        "media": "https://imagedelivery.net/<account-hash>/<image-id>/public",
        "hlsUrl": null,
        "poster": null,
        "thumbnailUrl": "https://imagedelivery.net/<account-hash>/<image-id>/thumbnail",
        "durationInSeconds": null,
        "tags": ["events", "red carpet"],
        "order": 1,
        "createdAt": "2026-10-10T13:49:55.893Z"
      }
    ]
  }
}
```

**Errors:**

| Status | message | UI |
| --- | --- | --- |
| 404 | `No any galleryitem found` | Empty state (gallery khali hai, ya filter / search se kuch nahi mila). Aakhri page ke baad bhi yahi aata hai |
| 422 | `Limit must be less than or equal to 50` | |
| 422 | `Media Type must be one of [image, gif, video]` | |

**Infinite scroll:** `page < totalPages` ho tabhi agla page mangao.

### 3.2 Ek item

`GET /gallery/get/:id` · Auth: nahi

Share link ya direct item page (`/gallery/<id>`) ke liye. Response mein ek item aata hai (fields upar wale).

**Errors:**

| Status | message | Kab |
| --- | --- | --- |
| 404 | `Gallery item not found` | Item delete ho gaya, ya admin ne hide kar diya |
| 422 | `Invalid Gallery item Id` | id format galat hai |

### 3.3 Website par kaise dikhana hai

**Grid:** har item ke liye `<img src={thumbnailUrl} loading="lazy">`. Video par play icon aur `durationInSeconds` ka badge (jaise `1:34`) dikhao, GIF par "GIF" badge.

**Item kholne par (lightbox / modal):**

| mediaType | Kya dikhana hai |
| --- | --- |
| image | `<img src={media}>` |
| gif | `<img src={media}>` (animation browser khud chalata hai) |
| video | Neeche ke do options mein se ek |

**Video ke options:**

1. **Cloudflare player (sabse aasaan):** `media` URL ka `/watch` hata kar `/iframe` lagao.

   ```html
   <iframe
     src="https://customer-<code>.cloudflarestream.com/<uid>/iframe?poster=<encodeURIComponent(poster)>"
     allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
     allowfullscreen
     style="border:none;width:100%;aspect-ratio:16/9">
   </iframe>
   ```

2. **Apna player:** `hlsUrl` ko [hls.js](https://github.com/video-dev/hls.js) ke saath `<video poster={poster}>` mein chalao. Safari HLS native chalata hai.

> Admin ne video abhi abhi upload kiya ho to Cloudflare use process kar raha hota hai, aur kuch minute tak player "processing" dikha sakta hai. Ye normal hai.

---

## 4. Subscription + Payment (Razorpay)

User website par plan kharidta hai (Razorpay Checkout se). Plan **prepaid** hai: auto-renew abhi nahi hai, plan khatam hone par user khud renew karta hai.

### Paise ka rule (zaroor padho)

| Kahan | Unit | Example |
| --- | --- | --- |
| Plan ka `price` (`/subscriptions/plans`, `plan.price`) | **rupees** (GST shamil) | `199` = ₹199 |
| Payment ke saare amounts: `amount`, `planPrice`, `creditApplied`, `payable`, `amountPaid` | **paise** | `19900` = ₹199 |

Dikhate waqt paise ko `/ 100` karo: `₹${(payable / 100).toFixed(2)}`.

### Plan kharidne ke rules

Server khud decide karta hai, website ko sirf `planId` bhejna hai:

| User ke paas | Kaunsa plan chuna | Kya hoga |
| --- | --- | --- |
| Koi active plan nahi | koi bhi | **new**: aaj se shuru, poora price |
| Active plan hai | **wahi plan** | **renewal**: current plan khatam hote hi shuru, poora price. Ek time par sirf 1 renewal queue ho sakta hai |
| Active plan hai | **mehenga plan**, aur admin ne upgrade ON kiya hai | **upgrade**: aaj se shuru. Purane plan ke bache din ka paisa credit, user sirf farak deta hai (kam se kam ₹1) |
| Active plan hai | mehenga plan, upgrade OFF | 409, "current plan khatam hone ke baad lo" |
| Active plan hai | sasta / same price ka dusra plan | 409, "current plan khatam hone ke baad lo" |

### Poora flow

```
1. GET  /subscriptions/plans            → plan cards dikhao
2. GET  /payments/quote?planId=...      → "Aapko ₹X dene honge" (optional par recommended)
3. POST /payments/create-order          → data.checkout milta hai
4. new Razorpay(checkout).open()        → user pay karta hai
5a. success handler → POST /payments/verify  → plan active, success screen
5b. modal band / fail → POST /payments/failed
6. GET  /subscriptions/my               → "My plan" screen refresh
```

Payment ho gaya par browser band ho gaya to bhi chinta nahi: server ka webhook plan chalu kar deta hai. User agli baar aaye to `/subscriptions/my` mein plan dikhega.

### Subscription period ke fields

`/subscriptions/my`, history aur verify mein ye object aata hai:

| Field | Type | Kya hai |
| --- | --- | --- |
| _id | string | period id |
| planId | string | |
| plan | object | kharidte waqt ka plan: `name`, `type`, `price` (rupees), `durationInDays`, `benefits`. Baad mein admin price badle to ye nahi badlega |
| status | enum | `active` (abhi chal raha), `scheduled` (renewal, baad mein shuru hoga), `expired`, `upgraded` (upgrade ki wajah se band), `cancelled` (admin ne band kiya) |
| source | enum | `purchase`, `renewal`, `upgrade`, `admin_grant` (admin ne free diya) |
| startDate, endDate | date | |
| daysLeft | number | sirf `active` mein |
| amountPaid, creditApplied | number | paise |
| paymentId | string | admin grant mein nahi hota |
| endedAt | date | upgrade / cancel se pehle band hua to |

### 4.1 Plans (bina login)

`GET /subscriptions/plans` · Auth: nahi

Sirf active plans, display order mein (`sortOrder`, phir price). Khali ho to `data: []`.

**Success 200:**

```json
{
  "success": true,
  "message": "Plans fetched",
  "data": [
    {
      "_id": "6aca5a8eba00278d098a233d",
      "name": "Yearly",
      "type": "yearly",
      "price": 1499,
      "currency": "INR",
      "durationInDays": 365,
      "benefits": ["HD", "Ad free"],
      "limitations": [],
      "sortOrder": 1,
      "isPopular": true
    },
    {
      "_id": "6aca5a8eba00278d098a2337",
      "name": "Monthly",
      "type": "monthly",
      "price": 199,
      "currency": "INR",
      "durationInDays": 30,
      "benefits": ["HD"],
      "limitations": [],
      "sortOrder": 2,
      "isPopular": false
    }
  ]
}
```

- `isPopular: true` par "Most popular" tag dikhao.
- `price` 0 wala plan (admin ka free plan) kharida nahi ja sakta. Uska "Buy" button mat dikhao.

`GET /subscriptions/plans/:id` · Auth: nahi. Ek plan. Inactive / deleted plan par `404 Plan not found`, galat id par `422 Invalid plan Id`.

### 4.2 My plan

`GET /subscriptions/my` · Auth: haan

**Success 200:**

```json
{
  "success": true,
  "message": "Subscription fetched",
  "data": {
    "isSubscribed": true,
    "current": {
      "_id": "6aca5aa1ba00278d098a2396",
      "planId": "6aca5a8eba00278d098a2337",
      "plan": { "name": "Monthly", "type": "monthly", "price": 199, "durationInDays": 30, "benefits": ["HD"] },
      "status": "active",
      "source": "purchase",
      "startDate": "2026-10-10T15:32:48.543Z",
      "endDate": "2026-11-09T15:32:48.543Z",
      "daysLeft": 30,
      "amountPaid": 19900,
      "creditApplied": 0,
      "paymentId": "6aca5a9eba00278d098a2388",
      "platform": "web",
      "createdAt": "2026-10-10T15:32:49.237Z"
    },
    "scheduled": [
      {
        "_id": "6aca5aabba00278d098a23c4",
        "planId": "6aca5a8eba00278d098a2337",
        "plan": { "name": "Monthly", "type": "monthly", "price": 199, "durationInDays": 30, "benefits": ["HD"] },
        "status": "scheduled",
        "source": "renewal",
        "startDate": "2026-11-09T15:32:48.543Z",
        "endDate": "2026-12-09T15:32:48.543Z",
        "amountPaid": 19900,
        "creditApplied": 0,
        "previousSubscriptionId": "6aca5aa1ba00278d098a2396"
      }
    ],
    "canRenew": false,
    "upgradeEnabled": true,
    "upgradeOptions": [
      {
        "plan": { "_id": "6aca5a8eba00278d098a233d", "name": "Yearly", "type": "yearly", "price": 1499, "currency": "INR", "durationInDays": 365, "benefits": [], "limitations": [], "sortOrder": 1, "isPopular": true },
        "planPrice": 149900,
        "creditApplied": 19899,
        "payable": 130001,
        "currency": "INR"
      }
    ]
  }
}
```

**Screen kaise banana hai:**

| Field | UI |
| --- | --- |
| `isSubscribed: false` | "Aapka koi plan nahi hai" + plans list |
| `current` | Plan naam, "Valid till {endDate}", "{daysLeft} din bache" |
| `scheduled[0]` | "Renewal: {startDate} se shuru hoga" |
| `canRenew: true` | **Renew** button (same plan, `planId = current.planId`) |
| `upgradeEnabled: false` | Upgrade section mat dikhao |
| `upgradeOptions` | Har option ka card: "{plan.name} par upgrade karo, sirf ₹{payable/100} do (₹{creditApplied/100} credit)" |

### 4.3 Subscription history

`GET /subscriptions/my/history?page=1&limit=10` · Auth: haan

Saare periods (kharide, renew, upgrade, admin ke diye, cancel), naye pehle. Response paginated (`total`, `totalPages`, `page`, `limit`, `data`). Khali ho to `data: []`. `status` ke hisaab se badge dikhao.

| Status | message |
| --- | --- |
| 422 | `Limit must be less than or equal to 100` |

### 4.4 Quote (kitna dena hoga)

`GET /payments/quote?planId=<planId>` · Auth: haan

Plan card par click hone par ya confirm screen par call karo. Kuch save nahi hota.

**Success 200 (upgrade):**

```json
{
  "success": true,
  "message": "Quote fetched",
  "data": {
    "purpose": "upgrade",
    "planId": "6aca5a8eba00278d098a233d",
    "plan": { "name": "Yearly", "type": "yearly", "price": 1499, "durationInDays": 365, "benefits": [] },
    "planPrice": 149900,
    "creditApplied": 13266,
    "payable": 136634,
    "currency": "INR",
    "startsAt": "2026-10-10T15:33:28.398Z",
    "endsAt": "2027-10-10T15:33:28.398Z",
    "currentSubscriptionId": "6aca5ac7ba00278d098a2436"
  }
}
```

| purpose | Confirm screen par kya likhna hai |
| --- | --- |
| `new` | "{plan.name}: ₹{payable/100}. Aaj se {endsAt} tak" |
| `renewal` | "Renew: ₹{payable/100}. {startsAt} se {endsAt} tak (current plan ke baad)" |
| `upgrade` | "Upgrade: ₹{planPrice/100} − ₹{creditApplied/100} credit = ₹{payable/100}. Aaj se shuru" |

**Errors:**

| Status | message | UI |
| --- | --- | --- |
| 409 | `Upgrade is not available right now. You can buy this plan after your current plan ends on 9 Nov 2026.` | message dikhao, buy button disable |
| 409 | `You can buy this plan after your current plan ends on 9 Nov 2026.` | sasta / dusra plan |
| 409 | `You have already renewed this plan. You can renew again after 9 Nov 2026.` | |
| 404 | `Plan not found or no longer available` | plan list refresh karo |
| 422 | `This plan can't be purchased` | ₹0 plan |
| 422 | `Plan Id is required` / `Invalid planId format` | |

### 4.5 Order banao + Razorpay Checkout kholo

`POST /payments/create-order` · Auth: haan · Body JSON

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| planId | string | haan | plan ka `_id` |
| platform | string | haan | website se hamesha `web` |

**Request:**

```json
{ "planId": "6aca5a8eba00278d098a2337", "platform": "web" }
```

**Success 201:**

```json
{
  "success": true,
  "message": "Order created",
  "data": {
    "payment": {
      "_id": "6aca5a9bba00278d098a2380",
      "purpose": "new",
      "amount": 19900,
      "planPrice": 19900,
      "creditApplied": 0,
      "currency": "INR",
      "status": "created",
      "receipt": "IFTV-261010-564775",
      "razorpayOrderId": "order_PxYz123AbC",
      "expiresAt": "2026-10-10T16:02:42.692Z",
      "platform": "web"
    },
    "quote": { "purpose": "new", "planPrice": 19900, "creditApplied": 0, "payable": 19900, "currency": "INR", "startsAt": "2026-10-10T15:32:42.692Z", "endsAt": "2026-11-09T15:32:42.692Z" },
    "checkout": {
      "key": "rzp_live_xxxxxxxx",
      "order_id": "order_PxYz123AbC",
      "amount": 19900,
      "currency": "INR",
      "name": "IFTV-OTT",
      "description": "Monthly (monthly)",
      "prefill": { "name": "Rahul Sharma", "email": "rahul@example.com", "contact": "9876503602" },
      "notes": { "receipt": "IFTV-261010-564775" }
    }
  }
}
```

**Checkout kholna (checkout.js):**

```html
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
```

```js
const { data } = await api.post("/payments/create-order", { planId, platform: "web" });

const rzp = new window.Razorpay({
  ...data.checkout,                 // key, order_id, amount, currency, name, description, prefill, notes
  theme: { color: "#E50914" },
  handler: async (resp) => {
    // resp = { razorpay_order_id, razorpay_payment_id, razorpay_signature }
    const result = await api.post("/payments/verify", resp);
    // result.data.subscription → success screen
  },
  modal: {
    ondismiss: () =>
      api.post("/payments/failed", { razorpay_order_id: data.checkout.order_id, reason: "User closed checkout" }),
  },
});
rzp.on("payment.failed", (e) =>
  api.post("/payments/failed", { razorpay_order_id: data.checkout.order_id, reason: e.error?.description })
);
rzp.open();
```

> `amount` khud mat badlo. Server ka diya `checkout` waisa hi Razorpay ko do.

**Errors:**

| Status | message | UI |
| --- | --- | --- |
| 409 / 404 / 422 | Quote wale errors | message dikhao |
| 422 | `Platform is required` | |
| 502 | `Could not start the payment. Please try again.` | dobara try button |
| 503 | `Payments are not available right now. Please try again later.` | payment abhi band hai |

Naya order banane par user ka purana unpaid order apne aap `expired` ho jaata hai. Har "Buy" click par naya order banao.

### 4.6 Payment verify

`POST /payments/verify` · Auth: haan · Body JSON

Razorpay `handler` jo 3 values deta hai, wahi bhejo:

```json
{
  "razorpay_order_id": "order_PxYz123AbC",
  "razorpay_payment_id": "pay_Qw12Er34Ty",
  "razorpay_signature": "9f2c...64 hex chars"
}
```

**Success 200:**

```json
{
  "success": true,
  "message": "Payment verified, plan activated",
  "data": {
    "alreadyProcessed": false,
    "payment": {
      "_id": "6aca5a9eba00278d098a2388",
      "status": "paid",
      "amount": 19900,
      "receipt": "IFTV-261010-464227",
      "method": "upi",
      "paidAt": "2026-10-10T15:32:48.543Z",
      "razorpayPaymentId": "pay_Qw12Er34Ty",
      "userSubscriptionId": "6aca5aa1ba00278d098a2396"
    },
    "subscription": {
      "_id": "6aca5aa1ba00278d098a2396",
      "plan": { "name": "Monthly", "type": "monthly", "price": 199, "durationInDays": 30, "benefits": ["HD"] },
      "status": "active",
      "source": "purchase",
      "startDate": "2026-10-10T15:32:48.543Z",
      "endDate": "2026-11-09T15:32:48.543Z",
      "daysLeft": 30
    }
  }
}
```

- Renewal mein `subscription.status` = `scheduled` aata hai ("{startDate} se shuru hoga").
- Dobara call karo to bhi same result (`alreadyProcessed: true`), double charge / double plan nahi hota.

**Errors:**

| Status | message | UI |
| --- | --- | --- |
| 400 | `Payment verification failed. If money was deducted, your plan will be activated automatically in a few minutes.` | yahi message dikhao, "My plan" par bhejo |
| 402 | `Payment is not complete yet. If money was deducted, ...` | same |
| 400 | `Payment amount does not match the order` | support se contact |
| 404 | `Payment not found` | |
| 409 | `This order is already paid` | `/subscriptions/my` refresh |

### 4.7 Payment fail / band

`POST /payments/failed` · Auth: haan · Body: `{ "razorpay_order_id": "order_...", "reason": "User closed checkout" }`

`reason` optional (max 500). Paid order par kuch nahi badalta. Response mein payment aata hai. Unknown order par `404 Payment not found`.

### 4.8 Transactions

`GET /payments/my?page=1&limit=10&status=paid` · Auth: haan

`status` optional: `created`, `paid`, `failed`, `expired`. Khali ho to `data: []`.

| Payment field | Kya dikhana hai |
| --- | --- |
| receipt | "Receipt no." |
| plan.name | plan |
| amount | ₹{amount/100} |
| status | `paid` ✅ / `failed` ❌ / `expired` ("adhoora") / `created` ("pending") |
| purpose | `new` / `renewal` / `upgrade` |
| creditApplied | upgrade mein "₹X credit laga" |
| method | upi / card / netbanking / wallet |
| failureReason | failed mein |
| paidAt / createdAt | date |

`GET /payments/my/:id` · Auth: haan. Ek payment (receipt page) + `subscription` (jo period kharida). Dusre user ka payment ho to `404 Payment not found`.

---

## 5. Movies: free / paid lock

Har movie ab `free` ya `paid` hoti hai. Purani saari movies free hain. Admin kisi movie ko paid kar sakta hai aur bata sakta hai ki wo kin plans mein milegi.

`GET /movies/getAll` aur `GET /movies/:id/get` mein **token optional** hai. Login user ho to `Authorization: Bearer <token>` **zaroor bhejo**, warna paid movies locked aayengi. Token galat / expire ho to bhi API chalti hai (guest ki tarah).

Har movie mein ye fields aate hain:

| Field | Type | Kya hai |
| --- | --- | --- |
| accessType | `free` / `paid` | |
| allowedPlans | string[] | paid movie kin plan ids mein hai (khali = har plan mein) |
| isLocked | boolean | `true` → play mat karo. Tab `video` = `null` |
| lockReason | string \| null | neeche table |
| availableInPlans | array | paid movie ke liye: kaun se plans ise unlock karte hain `[{ _id, name, type, price, durationInDays }]` |

| lockReason | UI |
| --- | --- |
| `null` | play button |
| `login_required` | "Login karke dekho" → login page |
| `subscription_required` | "Plan lo" → plans page |
| `plan_not_included` | "Ye movie {availableInPlans[].name} plan mein hai" → upgrade / us plan ka page |

**Locked movie (example):**

```json
{
  "_id": "6aca58db4d19773e91732a65",
  "title": "Paid yearly",
  "accessType": "paid",
  "allowedPlans": ["6aca5a8eba00278d098a233d"],
  "video": null,
  "isLocked": true,
  "lockReason": "plan_not_included",
  "availableInPlans": [
    { "_id": "6aca5a8eba00278d098a233d", "name": "Yearly", "type": "yearly", "price": 1499, "durationInDays": 365 }
  ]
}
```

Card par paid movie ke liye 🔒 / "Premium" badge dikhao (`accessType === "paid"`), aur `isLocked` ho to play ki jagah upar wala CTA.

`GET /movies/getAll?accessType=free` ya `?accessType=paid` se filter bhi kar sakte ho (galat value par `422 Access Type must be one of [free, paid]`).

---

## Changelog

- **2026-10-10:** Pehla version. Isme OTP login (mobile + email), Support (Contact Us + tickets) aur Gallery hain.
- **2026-10-10:** Subscription + Razorpay payment (section 4) aur Movies free / paid lock (section 5) add kiye.
