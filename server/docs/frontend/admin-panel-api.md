# IFTV Admin Panel: API doc

Last update: 2026-10-10 · Index: [README.md](README.md)

Ye doc admin panel team ke liye hai. Isme 3 features hain:

1. [Auth: admin / staff login](#1-auth-admin--staff-login)
2. [Support inbox](#2-support-inbox) (tickets + Contact Us messages)
3. [Gallery management](#3-gallery-management) (images, GIFs, videos)

---

## 0. Shuru karne se pehle (sab APIs par lagta hai)

### Base URL

| Server | Base URL |
| --- | --- |
| Live (Render) | `https://iftv-ott.onrender.com/iftv-ott` |
| Local | `http://localhost:8500/iftv-ott` |

Neeche har path base URL ke baad lagta hai.

### Response ka format

Success:

```json
{ "success": true, "message": "....", "data": { } }
```

Error:

```json
{ "success": false, "message": "Dikhane layak message", "error": {} }
```

Error aaye to `message` ko toast mein dikhao.

### Roles

| Role | Admin panel |
| --- | --- |
| `admin` | Support aur Gallery, sab kuch |
| `staff` | Abhi admin jaisa hi: Support aur Gallery sab kuch |
| `user` | Admin panel ke har API par **403** milta hai |

### Token

- Login (section 1) ke response mein `data.token` milta hai. Ye JWT hai aur **7 din** chalta hai.
- Har admin API par header bhejo: `Authorization: Bearer <token>`.
- `401` aaye to logout karke login page par bhejo. `403 Forbidden: You do not have permission to perform this action.` ka matlab hai ki account `user` role ka hai.

### Body kaise bhejna hai

- **JSON:** header `Content-Type: application/json`.
- **form-data (files):** `FormData` use karo aur `Content-Type` khud mat lagao.
- `x-www-form-urlencoded` server parse nahi karta.

### Common errors

| Status | message | Kya karna hai |
| --- | --- | --- |
| 401 | `Access Denied! Missing authorization token` | Login page |
| 401 | `Your session has expired. Please log in again.` | Logout, login page |
| 403 | `Access Denied! Invalid authorization token format` / `Invalid or malformed token. Please log in again.` | Logout |
| 403 | `Forbidden: You do not have permission to perform this action.` | Account admin/staff nahi hai |
| 404 | `Access Denied! User not found` | Account delete ho gaya. Logout |
| 404 | `Invalid API` | Path ya method galat |
| 413 | `File too large. Max 2048 MB allowed; use the direct video upload for bigger files.` | Bade video ke liye Direct upload (3.2) use karo |
| 422 | validation messages | Kai errors ek message mein `, ` se jude aate hain |
| 500 | koi bhi | Server error |

### Khali list = 404

List APIs par koi record na ho (ya filter se kuch match na ho) to **404** `No any ... found` aata hai. Isko error mat dikhao, table mein "No data" dikhao.

### Dates

Saari dates UTC ISO format mein aati hain. Panel mein local time (IST) mein dikhao. `fromDate` / `toDate` filters `YYYY-MM-DD` format mein bhejo.

---

## 1. Auth: admin / staff login

`POST /auth/login` · Auth: nahi · Body: JSON

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| type | string | haan | `"email"` |
| email | string | haan | admin/staff ka email |
| password | string | haan | |
| role | string | haan | `"admin"` ya `"staff"`. Account ke role se match hona chahiye |

Login form mein ek role dropdown rakho (Admin / Staff), ya pehle `admin` se try karo aur 404 aaye to `staff` se.

**Request:**

```json
{ "type": "email", "email": "admin@example.com", "password": "Admin@123", "role": "admin" }
```

**Success 200:**

```json
{
  "success": true,
  "message": "User loggedin successfully",
  "data": {
    "user": {
      "_id": "6705e0b1a1b2c3d4e5f60702",
      "name": "admin",
      "role": "admin",
      "email": "admin@example.com",
      "isActive": true,
      "createdAt": "2026-10-10T08:00:00.000Z",
      "updatedAt": "2026-10-10T08:00:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...."
  }
}
```

> `data.user` mein `password` (hash) bhi aata hai. Ye backend ka known issue hai aur fix hoga. Ise kahin store ya log **mat** karo.

**Errors:**

| Status | message | Kab |
| --- | --- | --- |
| 422 | `Eamil is required` | email missing (spelling API mein hi aisi hai) |
| 404 | `User not found with this email` | email galat hai, ya `role` account se match nahi karta |
| 403 | `Wrong password` | |
| 500 | `data and hash arguments required` | password khali bheja. Form par required validation lagao |

---

## 2. Support inbox

Ek hi inbox mein do tarah ki entries aati hain:

| source | Kahan se | Jawab user tak kaise pahunchta hai |
| --- | --- | --- |
| `ticket` | App / website, logged-in user | User ke ticket thread mein aur email par |
| `contact_us` | Website ka Contact Us form, bina login | **Sirf email** par (visitor ka koi account nahi hota) |

**Enums:**

| Enum | Values |
| --- | --- |
| source | `ticket`, `contact_us` |
| category | `payment`, `subscription`, `playback`, `account`, `content_request`, `feedback`, `other` |
| status | `open`, `in_progress`, `resolved`, `closed` |
| priority | `low`, `medium` (default), `high` |
| platform | `web`, `android`, `ios` |
| senderRole (replies) | `user`, `admin`, `staff` |

**Status ka safar:**

```
open ──(admin/staff reply)──▶ in_progress ──▶ resolved ──▶ closed
  ▲                                              │
  └──────── user ne resolved ticket par reply kiya
```

- `open` ticket par reply karte hi wo apne aap `in_progress` ho jaata hai.
- Status `resolved` set karne par user ko "resolved" email jaata hai, aur `resolvedAt` set hota hai.
- `closed` ticket par reply nahi hota. Pehle update API se status `open` / `in_progress` karo, phir reply karo.
- Admin koi bhi status kabhi bhi set kar sakta hai.

**ID:** `ticketId` (`SUP-261010-4821`) dikhane aur search ke liye hai. URL mein hamesha `_id` lagta hai.

### 2.1 Inbox list

`GET /supports/admin/getAll` · Auth: admin / staff

| Query | Rules |
| --- | --- |
| page | ≥ 1, default 1 |
| limit | 1–100, default 10 |
| source | `ticket` / `contact_us` |
| status | `open` / `in_progress` / `resolved` / `closed` |
| category | category enum |
| priority | `low` / `medium` / `high` |
| platform | `web` / `android` / `ios` |
| assignedTo | admin/staff user ka `_id` ("Mere tickets" filter ke liye apna `_id` bhejo) |
| search | ticket number, naam, email ya subject (case-insensitive) |
| fromDate / toDate | `YYYY-MM-DD` (createdAt par; toDate pura din include karta hai) |
| sortBy | `createdAt` (default) / `updatedAt` / `lastReplyAt` |
| sortOrder | `desc` (default) / `asc` |

**Success 200:**

```json
{
  "success": true,
  "message": "Tickets fetched successfully",
  "data": {
    "total": 4,
    "totalPages": 1,
    "page": 1,
    "limit": 10,
    "data": [
      {
        "_id": "6aca36fcadf89e0beee090c6",
        "ticketId": "SUP-261010-5015",
        "source": "ticket",
        "user": "6aca36ee6f68761936f63087",
        "name": "Test User",
        "email": "test-user@example.com",
        "category": "playback",
        "subject": "Video keeps buffering",
        "platform": "android",
        "status": "open",
        "priority": "medium",
        "createdAt": "2026-10-10T13:00:44.566Z",
        "updatedAt": "2026-10-10T13:00:44.566Z",
        "assignedTo": null,
        "replyCount": 0,
        "attachmentCount": 2
      },
      {
        "_id": "6aca36f6adf89e0beee090bd",
        "ticketId": "SUP-261010-4476",
        "source": "contact_us",
        "user": null,
        "name": "Guest Person",
        "email": "guest@example.com",
        "category": "feedback",
        "subject": "Love the app",
        "platform": "web",
        "status": "open",
        "priority": "medium",
        "createdAt": "2026-10-10T13:00:38.340Z",
        "updatedAt": "2026-10-10T13:00:38.340Z",
        "assignedTo": null,
        "replyCount": 0,
        "attachmentCount": 0
      }
    ]
  }
}
```

- `assignedTo` ki value `{ _id, name, email }` hoti hai, ya `null`.
- List mein message aur replies nahi aate. Detail ke liye 2.3 use karo.
- Table columns suggestion: Ticket # · Source badge · Name/Email · Category · Subject · Status · Priority · Assigned · Replies · Created.

**Errors:**

| Status | message |
| --- | --- |
| 404 | `No any supportticket found` (No data dikhao) |
| 422 | `Sort By must be one of [createdAt, updatedAt, lastReplyAt]` / `Status must be one of [...]` / `Invalid assignedTo format` / `Limit must be less than or equal to 100` |

### 2.2 Stats (dashboard cards / badge)

`GET /supports/admin/stats` · Auth: admin / staff

| Query | Rules |
| --- | --- |
| fromDate / toDate | optional, `YYYY-MM-DD` |

**Success 200** (har key hamesha aati hai, zero ho tab bhi):

```json
{
  "success": true,
  "message": "Ticket stats fetched successfully",
  "data": {
    "total": 9,
    "byStatus": { "open": 7, "in_progress": 0, "resolved": 1, "closed": 1 },
    "bySource": { "ticket": 6, "contact_us": 3 }
  }
}
```

Sidebar ke "Support" menu par `byStatus.open` ko badge ki tarah dikha sakte ho.

### 2.3 Ticket detail

`GET /supports/admin/get/:id` · Auth: admin / staff

**Success 200:**

```json
{
  "success": true,
  "message": "Ticket fetched successfully",
  "data": {
    "_id": "6aca36fcadf89e0beee090c6",
    "ticketId": "SUP-261010-5015",
    "source": "ticket",
    "user": { "_id": "6aca36ee6f68761936f63087", "name": "Test User", "email": "test-user@example.com", "mobile": 9876543210, "image": "https://..." },
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
    "assignedTo": { "_id": "6aca36ee6f68761936f6308a", "name": "Test Staff", "role": "staff", "email": "test-staff@example.com" },
    "adminNote": "Checked logs, CDN issue in Mumbai region.",
    "isDeleted": false,
    "replies": [
      {
        "_id": "6aca3703adf89e0beee090df",
        "sender": { "_id": "6aca36ee6f68761936f63089", "name": "Test Admin", "role": "admin" },
        "senderRole": "admin",
        "message": "Please clear the app cache and try again.",
        "attachments": [],
        "createdAt": "2026-10-10T13:00:51.878Z"
      }
    ],
    "createdAt": "2026-10-10T13:00:44.566Z",
    "updatedAt": "2026-10-10T13:00:54.070Z",
    "lastReplyAt": "2026-10-10T13:00:51.877Z"
  }
}
```

- `user` populated aata hai (`name, email, mobile, image`, jo account mein ho). Contact Us mein `user: null` hota hai, tab naam aur email ticket ke `name` / `email` se dikhao.
- Contact Us mein `mobile` ticket par hi hota hai (agar visitor ne diya ho).
- `adminNote` andar ka note hai jo user ko **kabhi nahi** dikhta.
- Contact Us messages mein HTML tags ho sakte hain (jaise `<script>`). Inhe **text ki tarah** render karo, HTML ki tarah nahi.
- `resolvedAt` / `closedAt` tab aate hain jab status set ho.

**Errors:** 404 `Ticket not found` (delete hua ticket bhi) · 422 `Invalid Ticket Id`

### 2.4 Reply karo

`POST /supports/admin/reply/:id` · Auth: admin / staff · Body: **form-data**

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| message | text | haan | 1–2000 |
| status | text | nahi | status enum. Na bhejo to `open` ticket `in_progress` ho jaata hai. "Reply & Resolve" button ke liye `resolved` bhejo |
| attachments | file | nahi | 0–3 images, jpg / jpeg / png / webp, har ek ≤ 5 MB |

Reply user ko **email** par bhi jaata hai. Contact Us ke liye ye email hi ek-matra raasta hai.

**Success 200:** poora ticket aata hai (2.3 jaisa, populated), naya reply end mein hota hai.

**Errors:**

| Status | message |
| --- | --- |
| 400 | `This ticket is closed. Reopen it before replying.` |
| 404 | `Ticket not found` |
| 422 | `Message is required` / `Status must be one of [open, in_progress, resolved, closed]` / `Maximum 3 attachments are allowed` / `Invalid attachment <name>. Allowed: .jpg, .jpeg, .png, .webp` / `Attachment <name> is larger than 5 MB` |

### 2.5 Status / priority / assign / note badlo

`PUT /supports/admin/update/:id` · Auth: admin / staff · Body: JSON (kam se kam ek field)

| Field | Type | Rules |
| --- | --- | --- |
| status | enum | `resolved` → `resolvedAt` set hota hai aur user ko email jaata hai. `closed` → `closedAt` set hota hai. `open` / `in_progress` → ticket reopen hota hai |
| priority | enum | `low` / `medium` / `high` |
| assignedTo | string \| null | kisi **active admin ya staff** ka `_id`. `null` bhejne se unassign hota hai |
| adminNote | string | max 2000. `""` bhejne se note clear hota hai |

**Request:**

```json
{
  "status": "in_progress",
  "priority": "high",
  "assignedTo": "6aca36ee6f68761936f6308a",
  "adminNote": "Checked logs, CDN issue in Mumbai region."
}
```

**Success 200:** poora ticket aata hai (2.3 jaisa).

**Errors:**

| Status | message |
| --- | --- |
| 422 | `Nothing to update` (khali body) |
| 422 | `assignedTo must be an active admin or staff user` |
| 422 | `Invalid assignedTo format` / `Status must be one of [...]` / `Priority must be one of [low, medium, high]` |
| 404 | `Ticket not found` |

> **Abhi ki limit:** admin/staff users ki list ka API abhi nahi hai. "Assign to" dropdown ke liye abhi apna `_id` (login response `data.user._id`) use karo ("Assign to me"). List API baad mein aayega (backend plan: `server/docs/known-issues-plan.md` → F1).

### 2.6 Ticket delete

`DELETE /supports/admin/delete/:id` · Auth: admin / staff

Soft delete hota hai. Ticket inbox aur user ki list dono se hat jaata hai. Confirm dialog zaroor lagao.

**Success 200:**

```json
{ "success": true, "message": "Ticket deleted successfully", "data": {} }
```

**Errors:** 404 `Ticket not found` (pehle se delete) · 422 `Invalid Ticket Id`

---

## 3. Gallery management

Admin images, GIFs aur videos upload karta hai, aur ye app/website ki gallery mein **bina login** dikhte hain.

| Enum | Values |
| --- | --- |
| mediaType | `image`, `gif`, `video` (**server khud set karta hai**, kabhi bhejna nahi) |

**Media type kaise tay hota hai:** file ke extension se. `.gif` ho to `gif`, image extension ho to `image`, video extension ho to `video`.

| Type | Allowed files | Max size | Kahan store hota hai |
| --- | --- | --- | --- |
| image | jpg, jpeg, png, webp | 10 MB | Cloudflare Images |
| gif | gif | 10 MB (badi GIF ko mp4 bana kar video ki tarah upload karo) | Cloudflare Images |
| video | mp4, mov, mkv, webm, avi, m4v, mpeg, mpg, flv, wmv, 3gp | 2048 MB server se. Isse bada (ya ~200 MB se upar) → Direct upload (3.2) | Cloudflare Stream |
| poster (sirf video) | jpg, jpeg, png, webp (gif nahi) | 10 MB | Cloudflare Images |

**Safety:** kisi request mein koi upload fail ho jaaye to us request ki upload hui files apne aap delete ho jaati hain, aur kuch save nahi hota. Update mein purani file tabhi delete hoti hai jab nayi wali save ho jaaye.

### Item ke fields (admin response)

| Field | Type | Notes |
| --- | --- | --- |
| _id | string | |
| title, description | string | khali ho to `""` |
| mediaType | enum | `image` / `gif` / `video` |
| media | string | image / gif: `https://imagedelivery.net/.../public`. video: Stream watch URL (`.../<uid>/watch`, browser mein khulta hai) |
| hlsUrl | string \| null | sirf video |
| poster | string \| null | sirf video. Custom poster, ya Stream ka auto thumbnail |
| hasCustomPoster | boolean | video ka apna poster upload hua hai ya nahi ("Remove poster" button sirf `true` par dikhao) |
| thumbnailUrl | string | table/grid preview ke liye (400px) |
| durationInSeconds | number \| null | sirf video. Direct upload ke turant baad `null` ho sakta hai |
| tags | string[] | lowercase |
| order | number | chhota number pehle aata hai |
| isActive | boolean | `false` = users se chhupa hua |
| createdBy | string / object | create aur update ke response mein `_id` string aata hai. List aur get mein `{ _id, name, email, role }` aata hai |
| createdAt, updatedAt | date | |

Users ko item kis order mein dikhte hain: pehle `order` (chhota pehle), phir naya pehle.

### 3.1 Item banao (image / GIF / chhota video)

`POST /gallery/admin/create` · Auth: admin / staff · Body: **form-data**

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| media | file | `media` ya `videoUid` mein se ek | **ek** file (upar wali table) |
| videoUid | text | `media` ya `videoUid` mein se ek | 32 hex characters, Direct upload (3.2) se milta hai |
| poster | file | nahi | **sirf video ke saath**. Na do to Stream ka auto thumbnail use hota hai |
| title | text | nahi | max 150 |
| description | text | nahi | max 1000 |
| tags | text | nahi | max 10 tags, har tag max 30 characters. Teen format chalte hain: `tags=bts,events`, ya `tags[]` repeat karke, ya `tags=["bts","events"]`. Server lowercase aur duplicate-free kar deta hai |
| order | text (number) | nahi | 0–1000000, default 0 |
| isActive | text | nahi | `true` / `false`, default `true` |

**Request (JS):**

```js
const fd = new FormData();
fd.append("media", file);                 // image / gif / video
if (isVideo && posterFile) fd.append("poster", posterFile);
fd.append("title", "Premiere night");
fd.append("description", "Red carpet at the IFTV premiere");
fd.append("tags", "events,premiere");
fd.append("order", "1");
fd.append("isActive", "true");

await fetch(`${BASE}/gallery/admin/create`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}` },
  body: fd,
});
```

**Success 201 (image):**

```json
{
  "success": true,
  "message": "Gallery item created successfully",
  "data": {
    "_id": "6aca4283acab35ec9bd561de",
    "title": "Premiere night",
    "description": "Red carpet at the IFTV premiere",
    "mediaType": "image",
    "media": "https://imagedelivery.net/<account-hash>/<image-id>/public",
    "hlsUrl": null,
    "poster": null,
    "thumbnailUrl": "https://imagedelivery.net/<account-hash>/<image-id>/thumbnail",
    "durationInSeconds": null,
    "tags": ["events", "premiere"],
    "order": 1,
    "createdAt": "2026-10-10T13:49:55.893Z",
    "hasCustomPoster": false,
    "isActive": true,
    "createdBy": "6aca427b8f1f88f868cf6439",
    "updatedAt": "2026-10-10T13:49:55.893Z"
  }
}
```

**Success 201 (video file + poster):**

```json
{
  "success": true,
  "message": "Gallery item created successfully",
  "data": {
    "_id": "6aca4285acab35ec9bd561e4",
    "title": "Teaser",
    "description": "Official teaser",
    "mediaType": "video",
    "media": "https://customer-<code>.cloudflarestream.com/<uid>/watch",
    "hlsUrl": "https://customer-<code>.cloudflarestream.com/<uid>/manifest/video.m3u8",
    "poster": "https://imagedelivery.net/<account-hash>/<image-id>/public",
    "thumbnailUrl": "https://imagedelivery.net/<account-hash>/<image-id>/thumbnail",
    "durationInSeconds": 94,
    "tags": ["trailer"],
    "order": 0,
    "createdAt": "2026-10-10T13:49:57.165Z",
    "hasCustomPoster": true,
    "isActive": true,
    "createdBy": "6aca427b8f1f88f868cf6439",
    "updatedAt": "2026-10-10T13:49:57.165Z"
  }
}
```

GIF ke liye bhi response image jaisa hi aata hai, bas `"mediaType": "gif"` hota hai.

**Errors:**

| Status | message |
| --- | --- |
| 422 | `media file or videoUid is required` |
| 422 | `Send either a media file or videoUid, not both` |
| 422 | `Poster is allowed only for videos` |
| 422 | `Only one media file is allowed` / `Only one poster file is allowed` |
| 422 | `Invalid media file notes.txt. Allowed: .jpg, .jpeg, .png, .webp, .gif, .mp4, .mov, ...` |
| 422 | `GIF huge.gif is larger than 10 MB. Upload it as a video (mp4) instead` |
| 422 | `Image photo.png is larger than 10 MB` |
| 422 | `Invalid poster file. Allowed: .jpg, .jpeg, .png, .webp` / `Poster must be 10 MB or smaller` |
| 422 | `Title cannot exceed 150 characters` / `Description cannot exceed 1000 characters` / `Order cannot be negative` / `Maximum 10 tags are allowed` / `Tag cannot exceed 30 characters` |
| 413 | `File too large. ...` (2048 MB se badi file, Direct upload use karo) |
| 401 / 403 | token / role errors |
| 500 | Cloudflare upload fail ho gaya (kuch save nahi hua). Dobara try karo |

> **UI tip:** file select hote hi type pehchaan lo. Video ho to poster picker dikhao, image/GIF ho to poster picker chhupa do. Size aur type pehle hi check kar lo.

### 3.2 Bada video: Direct upload (GB size)

Bada video **seedha browser se Cloudflare** par jaata hai, hamare server se hokar nahi. Isse upload fast hota hai aur network tootne par resume bhi ho jaata hai. Ye movies wala hi flow hai.

```
Step 1  POST /gallery/admin/video/upload-url  ──▶ { uid, uploadURL }
Step 2  Browser ──(TUS, tus-js-client)──▶ uploadURL (Cloudflare)  ── progress bar
Step 3  GET /gallery/admin/video/:uid/status  ──▶ state != "pendingupload" hone tak (har 3–5 sec)
Step 4  POST /gallery/admin/create  { videoUid: uid, title, ... }  (+ poster chahiye to form-data)
```

#### Step 1: Upload URL lo

`POST /gallery/admin/video/upload-url` · Auth: admin / staff · Body: JSON

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| fileSize | integer | haan | file ka **exact** size bytes mein (`file.size`). Max 30 GB |
| fileName | string | nahi | max 255 |
| maxDurationSeconds | integer | nahi | 1–21600 (default 6 ghante) |

**Request:**

```json
{ "fileSize": 5368709120, "fileName": "bts-full.mp4" }
```

**Success 201:**

```json
{
  "success": true,
  "message": "Video upload URL created",
  "data": {
    "uid": "02177e024227100536932d55b6027479",
    "uploadURL": "<Cloudflare ka one-time TUS upload URL>",
    "videoUrl": "https://customer-<code>.cloudflarestream.com/02177e024227100536932d55b6027479/watch"
  }
}
```

**Errors:** 422 `File Size (in bytes) is required` / `Video cannot be bigger than 30 GB` · 502 Cloudflare token problem (backend ko batao)

#### Step 2: File Cloudflare par bhejo (tus-js-client)

```js
import * as tus from "tus-js-client";

const upload = new tus.Upload(file, {
  uploadUrl: uploadURL,                  // step 1 ka data.uploadURL
  chunkSize: 50 * 1024 * 1024,           // 50 MB (5 MB se bada aur 256 KiB ka multiple hona chahiye)
  retryDelays: [0, 3000, 5000, 10000, 20000],
  onProgress: (sent, total) => setProgress(Math.round((sent / total) * 100)),
  onSuccess: () => pollStatus(uid),      // step 3
  onError: (err) => showError("Upload fail hua, dobara try karo"),
});
upload.start();
```

Is request mein Authorization header **nahi** lagta. `uploadURL` khud one-time permission hai.

#### Step 3: Status check

`GET /gallery/admin/video/:uid/status` · Auth: admin / staff

**Success 200:**

```json
{
  "success": true,
  "message": "Video status fetched",
  "data": {
    "uid": "02177e024227100536932d55b6027479",
    "url": "https://customer-<code>.cloudflarestream.com/02177e024227100536932d55b6027479/watch",
    "state": "ready",
    "readyToStream": true,
    "pctComplete": null,
    "errorReason": null,
    "durationInSeconds": 94,
    "size": 5368709120
  }
}
```

`state` ki values: `pendingupload` (file abhi poori nahi aayi) → `downloading` / `queued` / `inprogress` (Cloudflare process kar raha hai) → `ready`. Ya phir `error` (dekho `errorReason`).

- `pendingupload` ke alawa koi bhi state aate hi step 4 kar sakte ho, `ready` ka wait zaroori nahi.
- **Errors:** 404 `Video not found on Cloudflare Stream`

#### Step 4: Gallery item banao

`POST /gallery/admin/create`, 3.1 wala hi API. Bas `media` file ki jagah `videoUid` bhejo.

- Poster nahi chahiye to JSON bhej sakte ho:

  ```json
  { "videoUid": "02177e024227100536932d55b6027479", "title": "Behind the scenes (full)", "tags": ["bts"], "order": 0, "isActive": true }
  ```

- Poster ke saath bhejna ho to **form-data** bhejo: `videoUid` (text) + `poster` (file) + baaki fields.

**Success 201:** 3.1 jaisa. Poster nahi diya to `poster` aur `thumbnailUrl` mein Stream ka auto thumbnail aata hai, aur `hasCustomPoster: false` hota hai. Cloudflare abhi process kar raha ho to `durationInSeconds` `null` ho sakta hai.

**Errors:**

| Status | message |
| --- | --- |
| 422 | `Video upload is not finished yet` (state abhi `pendingupload` hai) |
| 422 | `Cloudflare could not process this video: <reason>` (state `error` hai. File kharab hai, dusri file try karo) |
| 422 | `Invalid videoUid` |
| 404 | `Video not found on Cloudflare Stream` |
| 400 | `This video is already linked to another gallery item` |

### 3.3 Bulk upload (10 tak images / GIFs)

`POST /gallery/admin/bulk-create` · Auth: admin / staff · Body: **form-data**

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| media | file (multiple) | haan | 1–10 files. Allowed: jpg, jpeg, png, webp, gif, har ek ≤ 10 MB. Same key `media` har file ke liye append karo (`media[]` bhi chalta hai). **Video allowed nahi** |
| tags | text | nahi | saare items par lagte hain |
| isActive | text | nahi | saare items par lagta hai (default `true`) |

- Har file ka alag item banta hai, title khali rehta hai. Title baad mein Update (3.6) se daal sakte ho.
- **Sab ya kuch nahi:** saari files pehle check hoti hain. Ek bhi galat ho to kuch upload nahi hota. Upload beech mein fail ho to jo upload ho chuki thi wo bhi delete ho jaati hain.
- `title`, `description` ya `order` bheja to 422 aata hai, kyunki yahan sirf `tags` aur `isActive` allowed hain.

**Request (JS):**

```js
const fd = new FormData();
selectedFiles.forEach((f) => fd.append("media", f)); // max 10
fd.append("tags", "behind the scenes");
```

**Success 201:**

```json
{
  "success": true,
  "message": "Gallery items created successfully",
  "data": {
    "count": 3,
    "items": [
      {
        "_id": "6aca4289acab35ec9bd561f5",
        "title": "",
        "description": "",
        "mediaType": "image",
        "media": "https://imagedelivery.net/<account-hash>/<image-id>/public",
        "hlsUrl": null,
        "poster": null,
        "thumbnailUrl": "https://imagedelivery.net/<account-hash>/<image-id>/thumbnail",
        "durationInSeconds": null,
        "tags": ["behind the scenes"],
        "order": 0,
        "createdAt": "2026-10-10T13:50:01.295Z",
        "hasCustomPoster": false,
        "isActive": true,
        "createdBy": "6aca427b8f1f88f868cf6439",
        "updatedAt": "2026-10-10T13:50:01.295Z"
      }
    ]
  }
}
```

(`items` mein har file ka ek item hota hai. Yahan sirf ek dikhaya hai.)

**Errors:**

| Status | message |
| --- | --- |
| 422 | `At least one media file is required` |
| 422 | `Maximum 10 files can be uploaded at once` |
| 422 | `Invalid media file clip.mp4. Allowed: .jpg, .jpeg, .png, .webp, .gif` |
| 422 | `GIF <name> is larger than 10 MB. Upload it as a video (mp4) instead` / `Image <name> is larger than 10 MB` |
| 422 | `Title is not allowed` (title / description / order bheja) |
| 500 | Cloudflare upload fail hua. Kuch save nahi hua, dobara try karo |

### 3.4 Saare items (admin list)

`GET /gallery/admin/getAll` · Auth: admin / staff

| Query | Rules |
| --- | --- |
| page | default 1 |
| limit | default 20, max 100 |
| isActive | `true` / `false` ("Hidden" tab ke liye `false`) |
| mediaType | `image` / `gif` / `video` |
| tag | ek tag |
| search | title / description |
| fromDate / toDate | `YYYY-MM-DD` (createdAt) |
| sortBy | `order` / `createdAt` / `updatedAt`. **Na bhejo** to wahi order aata hai jo users ko dikhta hai |
| sortOrder | `desc` (default) / `asc` |

Hidden items bhi aate hain. Deleted items nahi aate.

**Success 200:**

```json
{
  "success": true,
  "message": "Gallery items fetched successfully",
  "data": {
    "total": 7,
    "totalPages": 1,
    "page": 1,
    "limit": 20,
    "data": [
      {
        "_id": "6aca4289acab35ec9bd561f7",
        "title": "",
        "description": "",
        "mediaType": "gif",
        "media": "https://imagedelivery.net/<account-hash>/<image-id>/public",
        "hlsUrl": null,
        "poster": null,
        "thumbnailUrl": "https://imagedelivery.net/<account-hash>/<image-id>/thumbnail",
        "durationInSeconds": null,
        "tags": ["behind the scenes"],
        "order": 0,
        "createdAt": "2026-10-10T13:50:01.296Z",
        "hasCustomPoster": false,
        "isActive": true,
        "createdBy": { "_id": "6aca427b8f1f88f868cf6439", "name": "IFTV Admin", "email": "admin@example.com", "role": "admin" },
        "updatedAt": "2026-10-10T13:50:01.296Z"
      }
    ]
  }
}
```

**Errors:**

| Status | message |
| --- | --- |
| 404 | `No any galleryitem found` (No data) |
| 422 | `Sort By must be one of [order, createdAt, updatedAt]` / `Limit must be less than or equal to 100` / `Media Type must be one of [image, gif, video]` |

### 3.5 Ek item (admin)

`GET /gallery/admin/get/:id` · Auth: admin / staff

Edit form bharne ke liye. Hidden item bhi aata hai, aur `createdBy` populated hota hai (3.4 jaisa).

**Errors:** 404 `Gallery item not found` · 422 `Invalid Gallery item Id`

### 3.6 Item update

`PUT /gallery/admin/update/:id` · Auth: admin / staff

Sirf wahi fields bhejo jo badalne hain. Do tarah se bhej sakte ho:

- **JSON:** sirf text fields ke liye (title, tags, order, isActive, removePoster, videoUid).
- **form-data:** jab `media` ya `poster` file bhi bhejni ho.

| Field | Type | Rules |
| --- | --- | --- |
| title / description | string | create jaise rules. `""` bhejne se clear hota hai |
| tags | string[] | saare tags replace hote hain. `[]` (JSON) ya `tags=` (form) bhejne se clear hote hain |
| order | integer | 0–1000000 |
| isActive | boolean | `false` = users se hide, `true` = wapas dikhao |
| media | file | nayi image / GIF / video. **Type badal sakta hai** (jaise image ki jagah video) |
| videoUid | string | Direct upload wala video lagao (image item bhi video ban jaata hai) |
| poster | file | **sirf video item** par. Naya poster |
| removePoster | boolean | sirf video: custom poster hatao, Stream ka auto thumbnail wapas aa jaata hai |

**Rules:**

- `media` aur `videoUid` saath mein → 422. `poster` aur `removePoster` saath mein → 422.
- Video ki jagah image/GIF lagaya to poster aur duration apne aap hat jaate hain (purana poster Cloudflare se bhi delete hota hai).
- Purani file Cloudflare se **save hone ke baad** delete hoti hai. Update fail ho to item pehle jaisa hi rehta hai.

**Request (JSON):**

```json
{ "title": "Premiere night 2026", "tags": ["events", "red carpet"], "isActive": true }
```

**Request (form-data, naya poster):**

```js
const fd = new FormData();
fd.append("poster", newPosterFile);
fd.append("title", "Teaser (new poster)");
```

**Success 200:** updated item aata hai (3.1 jaisa shape). Jaise `removePoster: true` ke baad:

```json
{
  "success": true,
  "message": "Gallery item updated successfully",
  "data": {
    "_id": "6aca4285acab35ec9bd561e4",
    "title": "Teaser (new poster)",
    "description": "Official teaser",
    "mediaType": "video",
    "media": "https://customer-<code>.cloudflarestream.com/<uid>/watch",
    "hlsUrl": "https://customer-<code>.cloudflarestream.com/<uid>/manifest/video.m3u8",
    "poster": "https://customer-<code>.cloudflarestream.com/<uid>/thumbnails/thumbnail.jpg",
    "thumbnailUrl": "https://customer-<code>.cloudflarestream.com/<uid>/thumbnails/thumbnail.jpg",
    "durationInSeconds": 94,
    "tags": ["trailer"],
    "order": 0,
    "createdAt": "2026-10-10T13:49:57.165Z",
    "hasCustomPoster": false,
    "isActive": true,
    "createdBy": "6aca427b8f1f88f868cf6439",
    "updatedAt": "2026-10-10T13:50:03.826Z"
  }
}
```

**Errors:**

| Status | message |
| --- | --- |
| 422 | `Nothing to update` |
| 422 | `Poster is allowed only for videos` |
| 422 | `Send either a media file or videoUid, not both` / `Send either a poster file or removePoster, not both` |
| 422 | file type / size errors (3.1 jaise), field validation |
| 422 | `Invalid Gallery item Id` |
| 404 | `Gallery item not found` |
| 400 | `This video is already linked to another gallery item` (videoUid kisi aur item mein laga hai) |
| 404 / 422 | videoUid errors (3.2 step 4 jaise) |

### 3.7 Order badlo (drag and drop)

`PUT /gallery/admin/reorder` · Auth: admin / staff · Body: JSON

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| items | array | haan | 1–100 entries, har id sirf ek baar |
| items[].id | string | haan | item ka `_id` |
| items[].order | integer | haan | 0–1000000 |

Drag-drop ke baad screen par dikh rahe items ko unki position ke hisaab se `order` do (0, 1, 2, ...) aur ek hi call mein bhejo. Kisi ek bhi id ke na milne par kuch nahi badalta.

**Request:**

```json
{
  "items": [
    { "id": "6aca4285acab35ec9bd561e8", "order": 0 },
    { "id": "6aca4285acab35ec9bd561e4", "order": 1 },
    { "id": "6aca4283acab35ec9bd561de", "order": 2 }
  ]
}
```

**Success 200:**

```json
{ "success": true, "message": "Gallery order updated successfully", "data": { "updated": 3 } }
```

**Errors:**

| Status | message |
| --- | --- |
| 404 | `Gallery item not found: <id>, <id>` (ye items delete ho chuke hain; list refresh karo) |
| 422 | `Each gallery item can appear only once` |
| 422 | `Send at least one item` / `Maximum 100 items can be reordered at once` |
| 422 | `Invalid gallery item id` / `Order cannot be negative` |

### 3.8 Item delete

`DELETE /gallery/admin/delete/:id` · Auth: admin / staff

Item soft delete hota hai aur uski **files Cloudflare se bhi delete** ho jaati hain (media + poster). Ise **restore nahi** kar sakte. Sirf chhupana ho to Update mein `isActive: false` bhejo. Delete se pehle confirm dialog zaroor dikhao.

**Success 200:**

```json
{ "success": true, "message": "Gallery item deleted successfully", "data": {} }
```

**Errors:** 404 `Gallery item not found` (pehle se delete) · 422 `Invalid Gallery item Id`

### 3.9 Admin panel screens (suggestion)

- **Gallery list:** grid/table mein `thumbnailUrl`, type badge, title, tags, Active toggle (Update `isActive`), aur Edit / Delete buttons. Tabs: All / Images / GIFs / Videos / Hidden. Drag-drop karke reorder.
- **Add item:** single upload (3.1). Video 200 MB se bada ho to apne aap Direct upload (3.2) wala flow chalao aur progress bar dikhao.
- **Bulk upload:** multi-select images/GIFs (3.3).
- **Edit:** text fields, media replace, poster replace / remove.

---

## Changelog

- **2026-10-10:** Pehla version. Isme admin/staff login, Support inbox aur Gallery management hain.
