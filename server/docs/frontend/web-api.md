# IFTV Website: API doc

Last update: 2026-10-10 · Index: [README.md](README.md)

Ye doc website team ke liye hai. Isme 3 features hain:

1. [Auth: OTP login](#1-auth-otp-login) (mobile OTP aur email OTP)
2. [Support](#2-support): Contact Us (bina login) aur Tickets (login ke baad)
3. [Gallery](#3-gallery) (bina login)

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

## Changelog

- **2026-10-10:** Pehla version. Isme OTP login (mobile + email), Support (Contact Us + tickets) aur Gallery hain.
