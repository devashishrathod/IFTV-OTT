# IFTV App (Android / iOS): API doc

Last update: 2026-10-10 · Index: [README.md](README.md)

Ye doc mobile app team ke liye hai. Isme 5 features hain:

1. [Auth: OTP login](#1-auth-otp-login) (mobile OTP main hai, email OTP optional)
2. [Support: Tickets](#2-support-tickets) (login ke baad). App mein Contact Us **nahi** hai, wo sirf website par hai.
3. [Gallery](#3-gallery) (bina login)
4. [Subscription + Payment (Razorpay)](#4-subscription--payment-razorpay): plans, plan kharidna (Android), my plan, history, transactions, upgrade. iOS mein sirf dekhna
5. [Movies: free / paid lock](#5-movies-free--paid-lock)

---

## 0. Shuru karne se pehle (sab APIs par lagta hai)

### Base URL

| Server | Base URL |
| --- | --- |
| Live (Render) | `https://iftv-ott.onrender.com/iftv-ott` |
| Local | `http://localhost:8500/iftv-ott` (emulator se `http://10.0.2.2:8500/iftv-ott`) |

Neeche har path base URL ke baad lagta hai.

### Response ka format

Success:

```json
{ "success": true, "message": "....", "data": { } }
```

Error:

```json
{ "success": false, "message": "User ko dikhane layak message", "error": {} }
```

Error par `message` ko snackbar ya toast mein dikhao.

### Token

- OTP verify ke response mein `data.token` milta hai. Ye JWT hai aur **7 din** chalta hai.
- Ise secure storage mein rakho (Android: EncryptedSharedPreferences / Keystore, iOS: Keychain).
- Har protected API par header bhejo: `Authorization: Bearer <token>`.
- `401 Your session has expired. Please log in again.` aaye to token delete karke login screen par bhejo. Ise ek jagah (interceptor) mein handle karo.

### Body kaise bhejna hai

- **JSON:** header `Content-Type: application/json`.
- **Multipart (files wale APIs):** `multipart/form-data` (Retrofit `@Multipart` / Dio `FormData` / Alamofire `upload(multipartFormData:)`). Boundary library khud lagati hai.
- File part ka **filename extension sahi hona chahiye** (`.jpg`, `.png`, `.webp`), kyunki server type extension se check karta hai. Camera se aayi `.heic` image ko pehle JPEG mein convert karo.

### Common errors

| Status | message | Kya karna hai |
| --- | --- | --- |
| 401 | `Access Denied! Missing authorization token` | Login screen |
| 401 | `Your session has expired. Please log in again.` | Logout, login screen |
| 403 | `Access Denied! Invalid authorization token format` / `Invalid or malformed token. Please log in again.` | Logout |
| 404 | `Access Denied! User not found` | Account delete ho gaya. Logout |
| 404 | `Invalid API` | Path ya method galat |
| 413 | `File too large. ...` | File bahut badi |
| 422 | validation messages | Kai errors ek hi message mein `, ` se jude aate hain |
| 500 | koi bhi | "Kuch galat ho gaya, dobara try karo" |

### Khali list = 404

List APIs (`/supports/my`, `/gallery/getAll`) par record na ho to **404** `No any ... found` aata hai. Isko error mat dikhao, **empty state** dikhao. Aakhri page ke aage bhi yahi aata hai.

**Exception:** subscription aur payment ki nayi list APIs (`/subscriptions/plans`, `/subscriptions/my/history`, `/payments/my`) khali hone par **200** ke saath khali list (`[]`) deti hain, 404 nahi.

### Dates

Saari dates UTC ISO format mein aati hain (`2026-10-10T13:00:44.566Z`). Device ke local time mein dikhao.

---

## 1. Auth: OTP login

App mein login aur sign-up ek hi flow hai. User pehle se na ho to server naya account bana deta hai (`isFirst: true`).

```
[Mobile number] ──▶ 1.1 Send OTP ──▶ [OTP screen + timer] ──▶ 1.2 Verify ──▶ token save ──▶ Home / Onboarding
                         ▲                    │
                         └──── Resend ────────┘   (1.1 dobara, naya sessionId save karo)
```

> ⚠️ `role` hamesha `"user"` bhejo, ya mat bhejo (default `user`). App se `admin` ya `staff` kabhi mat bhejo.

### 1.1 Mobile OTP bhejo

`POST /auth/loginOrSignin-with-mobile` · Auth: nahi · Body: JSON

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| mobile | number | haan | 10 digit, bina `+91` ke, jaise `9876543210` |
| role | string | nahi | `"user"` |
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
    "isFirst": true
  }
}
```

- `data.otpData.Details` hi **sessionId** hai. Ise verify ke liye save karo.
- OTP **10 minute** valid hai. Resend par naya `sessionId` aata hai aur purana band ho jaata hai.
- `isFirst: true` matlab naya user hai. Verify ke baad onboarding dikhao.

**Errors:**

| Status | message | UI |
| --- | --- | --- |
| 422 | `Mobile number is required` | |
| 400 | `Could not send OTP to this mobile number` | "Is number par OTP nahi bhej paaye" |
| 502 | `OTP service is unavailable. Please try again.` | "Thodi der baad try karo" |
| 500 | `User validation failed: ...` | Number mein digits ke alawa kuch tha. Bhejne se pehle validate karo |

> Har call par paid SMS jaata hai. Resend button par **30 second ka timer** lagao.
>
> SMS auto-read (Android SMS Retriever / iOS `oneTimeCode`) laga sakte ho. OTP 6 digit ka hota hai.

### 1.2 Mobile OTP verify

`PUT /auth/verify-otp-mobile` · Auth: nahi · Body: JSON · Method **PUT** hai

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| sessionId | string | haan | 1.1 ka latest `data.otpData.Details` |
| otp | string | haan | 6 digit, jaise `"123456"` |
| mobile | number | haan | wahi number |
| role | string | nahi | `"user"` |
| loginType | string | nahi | `"mobile"` |
| currentScreen | string | nahi | jaise `"HOME_SCREEN"` |
| fcmToken | string | nahi | **bhejo**, push notifications ke liye (Firebase token) |

**Request:**

```json
{
  "sessionId": "7c0f6a2e-3b1d-4e5f-9a8b-1c2d3e4f5a6b",
  "otp": "123456",
  "mobile": 9876543210,
  "role": "user",
  "currentScreen": "HOME_SCREEN",
  "fcmToken": "fcm-device-token"
}
```

**Success 200:**

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
      "fcmToken": "fcm-device-token",
      "isDeleted": false,
      "createdAt": "2026-10-10T08:00:00.000Z",
      "updatedAt": "2026-10-10T08:05:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...."
  }
}
```

`isSignUpCompleted` aur `isOnBoardingCompleted` se decide karo ki user ko onboarding dikhana hai ya seedha Home.

**Errors:**

| Status | message | Kab | UI |
| --- | --- | --- | --- |
| 422 | `Please fill all required fields` | sessionId, otp ya mobile missing | |
| 404 | `User not found with this mobile number` | is number par OTP bheja hi nahi gaya | mobile screen par wapas bhejo |
| 404 | `OTP not found` | OTP use ho chuka hai | "Naya OTP mangao" |
| 403 | `Invalid OTP` | code galat hai, ya `sessionId` purana / kisi aur number ka hai | "OTP galat hai" |
| 410 | `OTP expired` | 10 minute nikal gaye | "OTP expire ho gaya, Resend karo" |
| 502 | `OTP service is unavailable. Please try again.` | | "Thodi der baad try karo" |

Ek OTP sirf ek baar chalta hai.

### 1.3 Email OTP bhejo (optional)

`POST /auth/loginOrSignin-with-email` · Auth: nahi · Body: JSON

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| email | string | haan | valid email (app par validate karo, server format check nahi karta) |
| role | string | nahi | `"user"` |
| loginType | string | nahi | `"email"` |

**Request:**

```json
{ "email": "john@example.com", "role": "user" }
```

**Success 200:**

```json
{
  "success": true,
  "message": "OTP has been sent to your Email. Please check your inbox.",
  "data": { "isFirst": false }
}
```

OTP **5 minute** valid hai. Response mein OTP nahi aata, wo email par jaata hai.

**Errors:** 422 `Email is required`

### 1.4 Email OTP verify (optional)

`PUT /auth/verify-otp-email` · Auth: nahi · Body: JSON · Method **PUT** hai

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| email | string | haan | |
| otp | **string** | haan | `"483920"`. **Number bhejoge to hamesha `Invalid OTP` aayega**, isliye string hi bhejo |
| role | string | nahi | `"user"` |
| loginType | string | nahi | `"email"` |
| currentScreen | string | nahi | |
| fcmToken | string | nahi | bhejo |

**Request:**

```json
{ "email": "john@example.com", "otp": "483920", "role": "user", "fcmToken": "fcm-device-token" }
```

**Success 200:** 1.2 jaisa `{ user, token }`, bas `isEmailVerified: true` hota hai.

**Errors (isi order mein check hote hain):**

| Status | message |
| --- | --- |
| 404 | `User not found with this email` |
| 404 | `OTP not found` |
| 410 | `OTP expired` |
| 403 | `Invalid OTP` |

---

## 2. Support: Tickets

Logged-in user "Help & Support" screen se ticket banata hai aur support team se thread mein baat karta hai. Har reply user ko email par bhi jaata hai.

**Enums:**

| Enum | Values (UI label suggestion) |
| --- | --- |
| category | `payment` (Payment), `subscription` (Subscription), `playback` (Video / Playback), `account` (Account), `content_request` (Content request), `feedback` (Feedback), `other` (Other) |
| status | `open` (Open), `in_progress` (In progress), `resolved` (Resolved), `closed` (Closed) |
| priority | `low`, `medium`, `high` (admin set karta hai, dikhana optional hai) |
| platform | app se `android` ya `ios` (device ke hisaab se) |

- `ticketId` (jaise `SUP-261010-4821`) user ko dikhane ke liye hai. API calls mein hamesha `_id` lagta hai.
- Status flow:

```
open ──(support reply)──▶ in_progress ──▶ resolved ──▶ closed
  ▲                                         │
  └──── user ne resolved ticket par reply kiya

closed ticket par reply nahi hota. Naya issue ho to naya ticket banao.
```

### 2.1 Ticket banao

`POST /supports/create` · Auth: `Bearer <token>` · Body: **multipart/form-data**

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| category | text | haan | category enum |
| subject | text | haan | 3–150 |
| message | text | haan | 10–2000 |
| platform | text | haan | `android` / `ios` |
| appVersion | text | nahi | max 30, jaise `1.4.2`. **Zaroor bhejo**, debugging mein madad karta hai |
| attachments | file | nahi | 0–3 screenshots, **jpg / jpeg / png / webp**, har ek **≤ 5 MB**. Same part name `attachments` repeat karo |

**Limit:** ek user ke max **5 tickets** aise ho sakte hain jo `closed` nahi hain.

**Request (multipart parts):**

```
category    = playback
subject     = Video keeps buffering
message     = Movie stops every 10 seconds on wifi.
platform    = android
appVersion  = 1.4.2
attachments = (file) screenshot1.jpg
attachments = (file) screenshot2.png
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
    "platform": "android",
    "appVersion": "1.4.2",
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
| 422 | `Platform is required` / `Platform must be one of [web, android, ios]` |
| 422 | `Category must be one of [...]` / `Subject has minimum 3 characters` / `Message has minimum 10 characters` |
| 422 | `Maximum 3 attachments are allowed` |
| 422 | `Invalid attachment <name>. Allowed: .jpg, .jpeg, .png, .webp` |
| 422 | `Attachment <name> is larger than 5 MB` (bade screenshot ko compress karke bhejo) |
| 429 | `You already have 5 open tickets. Please close one or wait for them to be resolved.` |

### 2.2 Mere tickets

`GET /supports/my` · Auth: `Bearer <token>`

| Query | Required | Rules |
| --- | --- | --- |
| page | nahi | default 1 |
| limit | nahi | 1–100, default 10 |
| status | nahi | `open` / `in_progress` / `resolved` / `closed` (tabs ke liye) |

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
        "platform": "android",
        "status": "open",
        "createdAt": "2026-10-10T13:00:44.566Z",
        "updatedAt": "2026-10-10T13:00:44.566Z",
        "replyCount": 0
      }
    ]
  }
}
```

- Newest first aate hain. List mein replies nahi hote, sirf `replyCount` hota hai (aur reply ho chuka ho to `lastReplyAt`).
- **404** `No any supportticket found` aaye to empty state dikhao: "Abhi koi ticket nahi" + "Naya ticket" button.
- **422** `Status must be one of [open, in_progress, resolved, closed]`.

### 2.3 Ticket detail + thread

`GET /supports/get/:id` · Auth: `Bearer <token>`

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
    "platform": "android",
    "appVersion": "1.4.2",
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

**Chat screen kaise banana hai:**

- Pehla bubble user ka original `message` + `attachments` hai, phir `replies` purane se naye ke order mein.
- `senderRole = user` wale bubbles right side mein, aur `admin` / `staff` wale left side mein "IFTV Support" naam se.
- Image preview ke liye URL ke end ka `/public` hata kar `/thumbnail` lagao. Tap karne par `/public` (full size) kholo.
- `status = closed` ho to input box hata do aur "Ye ticket band hai" dikhao. `resolved` ho to "Problem solve hui? Ticket band karo" button (2.5) dikhao.

**Errors:** 404 `Ticket not found` (kisi aur ka ticket bhi) · 422 `Invalid Ticket Id`

### 2.4 Reply bhejo

`POST /supports/reply/:id` · Auth: `Bearer <token>` · Body: **multipart/form-data**

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| message | text | haan | 1–2000 |
| attachments | file | nahi | 0–3 images, jpg / jpeg / png / webp, har ek ≤ 5 MB |

**Success 200:** poora updated ticket aata hai (2.3 jaisa), naya reply end mein hota hai. `resolved` ticket par reply kiya ho to `status` wapas `open` ho jaata hai.

**Errors:**

| Status | message |
| --- | --- |
| 400 | `This ticket is closed. Please create a new ticket.` |
| 404 | `Ticket not found` |
| 422 | `Message is required` / `Message is not allowed to be empty` / attachment errors |

### 2.5 Ticket band karo

`PUT /supports/close/:id` · Auth: `Bearer <token>` · Body: nahi

**Success 200:** poora ticket aata hai, `"status": "closed"` aur `closedAt` ke saath.

**Errors:** 400 `Ticket is already closed` · 404 `Ticket not found`

---

## 3. Gallery

Gallery **bina login** dikhti hai. Admin images, GIFs aur videos daalta hai. Sirf active items aate hain, admin ke set kiye order mein, isliye app ko sort nahi karna.

| Enum | Values |
| --- | --- |
| mediaType | `image`, `gif`, `video` |

### Item ke fields

| Field | Type | Use |
| --- | --- | --- |
| _id | string | |
| title, description | string | khali ho to `""`. Khali ho to caption mat dikhao |
| mediaType | enum | `image` / `gif` / `video` |
| media | string | image / gif: full size URL (max 1920x1080). video: Stream watch URL (web ke liye, app mein use nahi karna) |
| hlsUrl | string \| null | **video: app mein yahi chalao** (`.m3u8`) |
| poster | string \| null | video ka poster (admin ka uploaded, ya Cloudflare ka auto thumbnail) |
| thumbnailUrl | string | grid ke liye chhota image, har type ke liye hamesha milta hai |
| durationInSeconds | number \| null | sirf video. `null` ho to badge mat dikhao |
| tags | string[] | filter chips |
| order | number | |
| createdAt | date | |

### 3.1 Gallery list

`GET /gallery/getAll` · Auth: nahi

| Query | Required | Rules |
| --- | --- | --- |
| page | nahi | default 1 |
| limit | nahi | default 20, **max 50** |
| mediaType | nahi | `image` / `gif` / `video` |
| tag | nahi | ek tag |
| search | nahi | title / description |

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
| 404 | `No any galleryitem found` | Empty state. Aakhri page ke aage bhi yahi aata hai, isliye `page < totalPages` ho tabhi agla page mangao |
| 422 | `Limit must be less than or equal to 50` | |
| 422 | `Media Type must be one of [image, gif, video]` | |

### 3.2 Ek item

`GET /gallery/get/:id` · Auth: nahi

Push notification ya deep link se seedha item kholne ke liye. Response mein ek item aata hai (fields upar wale).

**Errors:** 404 `Gallery item not found` (item delete ya hide ho gaya; "Ye item ab available nahi hai" dikhao) · 422 `Invalid Gallery item Id`

### 3.3 App mein kaise dikhana hai

**Grid:** `thumbnailUrl` se image load karo (Glide / Coil / Kingfisher / `Image.network`). Video par play icon aur `durationInSeconds` ka badge (jaise `1:34`) dikhao, GIF par "GIF" badge.

**Item kholne par:**

| mediaType | Kaise chalana hai |
| --- | --- |
| image | `media` full screen, pinch-zoom ke saath |
| gif | `media` ko animated image ki tarah load karo. Android: Glide `asGif()` / Coil `GifDecoder`. iOS: SDWebImage / Kingfisher. Flutter: `Image.network` GIF khud chalata hai |
| video | `hlsUrl` ko native player mein chalao. Android: ExoPlayer / Media3 (`HlsMediaSource`). iOS: `AVPlayer(url:)`. Flutter: `video_player` / `better_player`. Load hone tak `poster` dikhao |

> Admin ne video abhi abhi upload kiya ho to Cloudflare kuch minute tak use process karta hai. Us dauraan player error de sakta hai. "Video abhi process ho raha hai, thodi der baad try karo" dikhao.

## 4. Subscription + Payment (Razorpay)

User **Android app** aur website par plan kharid sakta hai (Razorpay Checkout se). **iOS app mein kharidna nahi hai** (neeche dekho). Plan **prepaid** hai: auto-renew abhi nahi hai, plan khatam hone par user khud renew karta hai.

### Paise ka rule (zaroor padho)

| Kahan | Unit | Example |
| --- | --- | --- |
| Plan ka `price` (`/subscriptions/plans`, `plan.price`) | **rupees** (GST shamil) | `199` = ₹199 |
| Payment ke saare amounts: `amount`, `planPrice`, `creditApplied`, `payable`, `amountPaid` | **paise** | `19900` = ₹199 |

Dikhate waqt paise ko `/ 100` karo: `₹${(payable / 100).toFixed(2)}`.

### Plan kharidne ke rules

Server khud decide karta hai, app ko sirf `planId` bhejna hai:

| User ke paas | Kaunsa plan chuna | Kya hoga |
| --- | --- | --- |
| Koi active plan nahi | koi bhi | **new**: aaj se shuru, poora price |
| Active plan hai | **wahi plan** | **renewal**: current plan khatam hote hi shuru, poora price. Ek time par sirf 1 renewal queue ho sakta hai |
| Active plan hai | **mehenga plan**, aur admin ne upgrade ON kiya hai | **upgrade**: aaj se shuru. Purane plan ke bache din ka paisa credit, user sirf farak deta hai (kam se kam ₹1) |
| Active plan hai | mehenga plan, upgrade OFF | 409, "current plan khatam hone ke baad lo" |
| Active plan hai | sasta / same price ka dusra plan | 409, "current plan khatam hone ke baad lo" |

### iOS app: sirf dekhna, kharidna nahi

Apple ke rule ke hisaab se iOS app ke andar subscription bechne ke liye Apple In-App Purchase chahiye, isliye iOS app mein **Razorpay checkout mat kholo**:

- Plans, My plan, History, Transactions aur movie lock: sab dikhao (same APIs).
- "Buy" / "Renew" / "Upgrade" button iOS par **mat dikhao**, aur website par kharidne ka **link ya button bhi mat do** (Apple bahar payment ki taraf bhejne wale link par bhi reject kar sakta hai). Plan na ho to bas plan ka status / locked state dikhao. Exact wording launch se pehle Apple guidelines se check kar lena.
- Server bhi `platform: "ios"` par `POST /payments/create-order` ko **403** deta hai: `Plans can't be bought in the iOS app. Please buy your plan on the IFTV-OTT website.`
- Website se kharida plan login karte hi iOS app mein `/subscriptions/my` mein dikh jayega.

### Poora flow (Android)

```
1. GET  /subscriptions/plans            → plan cards dikhao
2. GET  /payments/quote?planId=...      → "Aapko ₹X dene honge" (optional par recommended)
3. POST /payments/create-order          → data.checkout milta hai
4. Razorpay Android SDK checkout kholo  → user pay karta hai
5a. success handler → POST /payments/verify  → plan active, success screen
5b. modal band / fail → POST /payments/failed
6. GET  /subscriptions/my               → "My plan" screen refresh
```

Payment ho gaya par app band / crash ho gaya to bhi chinta nahi: server ka webhook plan chalu kar deta hai. User agli baar aaye to `/subscriptions/my` mein plan dikhega.

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
| platform | string | haan | Android se `android`. (`ios` bhejoge to 403) |

**Request:**

```json
{ "planId": "6aca5a8eba00278d098a2337", "platform": "android" }
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
      "platform": "android"
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

**Checkout kholna (Razorpay Android SDK `com.razorpay:checkout`):**

```kotlin
class PlanActivity : AppCompatActivity(), PaymentResultWithDataListener {

    private var orderId: String? = null

    fun buy(planId: String) = lifecycleScope.launch {
        val res = api.createOrder(CreateOrderBody(planId = planId, platform = "android"))
        val c = res.data.checkout
        orderId = c.order_id
        Checkout.preload(applicationContext)
        val checkout = Checkout().apply { setKeyID(c.key) }
        val options = JSONObject().apply {
            put("order_id", c.order_id)
            put("amount", c.amount)          // paise, server ka diya hua
            put("currency", c.currency)
            put("name", c.name)
            put("description", c.description)
            put("prefill", JSONObject().apply {
                put("name", c.prefill.name); put("email", c.prefill.email); put("contact", c.prefill.contact)
            })
            put("notes", JSONObject().apply { put("receipt", c.notes.receipt) })
        }
        checkout.open(this@PlanActivity, options)
    }

    override fun onPaymentSuccess(razorpayPaymentId: String?, data: PaymentData?) {
        lifecycleScope.launch {
            api.verifyPayment(VerifyBody(
                razorpay_order_id = data!!.orderId,
                razorpay_payment_id = data.paymentId,
                razorpay_signature = data.signature,
            ))   // → success screen
        }
    }

    override fun onPaymentError(code: Int, response: String?, data: PaymentData?) {
        lifecycleScope.launch {
            api.paymentFailed(FailedBody(razorpay_order_id = orderId!!, reason = response))
        }
    }
}
```

Flutter: `razorpay_flutter` package (`EVENT_PAYMENT_SUCCESS` → verify, `EVENT_PAYMENT_ERROR` → failed). React Native: `react-native-razorpay` (`RazorpayCheckout.open(options).then(verify).catch(failed)`).

> `amount` khud mat badlo. Server ka diya `checkout` waisa hi Razorpay ko do.

**Errors:**

| Status | message | UI |
| --- | --- | --- |
| 409 / 404 / 422 | Quote wale errors | message dikhao |
| 422 | `Platform is required` | |
| 403 | `Plans can't be bought in the iOS app. Please buy your plan on the IFTV-OTT website.` | iOS se order mat banao |
| 502 | `Could not start the payment. Please try again.` | dobara try button |
| 503 | `Payments are not available right now. Please try again later.` | payment abhi band hai |

Naya order banane par user ka purana unpaid order apne aap `expired` ho jaata hai. Har "Buy" click par naya order banao.

### 4.6 Payment verify

`POST /payments/verify` · Auth: haan · Body JSON

`onPaymentSuccess` ke `PaymentData` se ye 3 values bhejo (`orderId`, `paymentId`, `signature`):

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
| `login_required` | "Login karke dekho" → login screen |
| `subscription_required` | "Plan lo" → plans screen (iOS: sirf "Premium" lock dikhao, kharidne ka button nahi) |
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

Poster par paid movie ke liye 🔒 / "Premium" badge dikhao (`accessType === "paid"`), aur `isLocked` ho to play ki jagah upar wala CTA.

`GET /movies/getAll?accessType=free` ya `?accessType=paid` se filter bhi kar sakte ho (galat value par `422 Access Type must be one of [free, paid]`).

---

## Changelog

- **2026-10-10:** Pehla version. Isme OTP login (mobile + email), Support tickets aur Gallery hain.
- **2026-10-10:** Subscription + Razorpay payment (section 4; Android par kharidna, iOS par sirf dekhna) aur Movies free / paid lock (section 5) add kiye.
