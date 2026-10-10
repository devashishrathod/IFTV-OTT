# IFTV App (Android / iOS): API doc

Last update: 2026-10-10 · Index: [README.md](README.md)

Ye doc mobile app team ke liye hai. Isme 3 features hain:

1. [Auth: OTP login](#1-auth-otp-login) (mobile OTP main hai, email OTP optional)
2. [Support: Tickets](#2-support-tickets) (login ke baad). App mein Contact Us **nahi** hai, wo sirf website par hai.
3. [Gallery](#3-gallery) (bina login)

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

---

## Changelog

- **2026-10-10:** Pehla version. Isme OTP login (mobile + email), Support tickets aur Gallery hain.
