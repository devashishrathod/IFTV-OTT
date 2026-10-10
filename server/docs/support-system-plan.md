# Support system: plan

Last update: 2026-10-10 · Status: **design approve hua, code Cloudflare Images ke end-to-end test ke baad shuru hoga**

Support mein aane ke do raaste hain:

- **Login wala ticket**: app aur web dono par.
- **Contact Us**: sirf web par, bina login.

Dono ek hi collection (`supporttickets`) mein save hote hain aur admin ke paas **ek hi inbox** mein dikhte hain. Fark sirf jawab pahunchne mein hai. Ticket wale user ko jawab app/web ke thread mein aur email par milta hai, jabki Contact Us wale visitor ko sirf email par.

## Flow

```
App / Web (user, visitor)        Backend: /supports                 Admin panel (admin, staff)
─────────────────────────        ──────────────────                 ──────────────────────────
Ticket form (login,      ─┐
  app + web, 0–3 images)  ├──▶  Validate + spam check
Contact Us form          ─┘     (honeypot, limits, file check)
  (sirf web, bina login)               │
                                       ▼
                                SupportTicket save
                                (SUP-ID, status open)   ───────▶  Inbox (ek hi list,
                                mail: user + support team          source / status filter)
                                                                          │
                                                                          ▼
                                Reply save              ◀───────  Admin / staff reply
                                (open → in_progress)               (status, priority, assign)
                                   │           │
My Tickets + email       ◀────────┘           │
  (ticket: thread app/web mein,                │
   user reply ya close kare)                   │
Sirf email (Contact Us visitor) ◀─────────────┘
```

Ticket wala user thread mein reply karta hai to wo reply isi raaste se dobara admin tak jaata hai. Contact Us wala visitor email ka jawab de to wo mail support mailbox mein aata hai.

### Status ka safar

```
        ┌──────── user close ya admin (kabhi bhi) ────────┐
        │                                                 ▼
      open ──admin reply──▶ in_progress ──admin──▶ resolved ──admin / user──▶ closed
        ▲                                             │                    (koi reply nahi)
        └────────── user ne reply kiya → wapas open ──┘
```

- Admin ya staff seedha koi bhi status set kar sakta hai.
- `open` ticket par admin reply kare to ticket apne aap `in_progress` ho jaata hai.
- User `resolved` ticket par reply kare to ticket wapas `open` ho jaata hai.
- `closed` ticket par koi reply nahi ho sakta. Naya issue ho to naya ticket banana hoga.
- Status `resolved` hone par `resolvedAt` set hota hai, aur `closed` hone par `closedAt`.

## Data model: `SupportTicket`

| Field | Type | Ticket | Contact Us | Note |
| --- | --- | --- | --- | --- |
| `ticketId` | String, unique | Haan | Haan | `SUP-YYMMDD-XXXX` (tarikh + 4 random digits). Takraav ho to naya number banega |
| `source` | `ticket` / `contact_us` | `ticket` | `contact_us` | |
| `user` | ref User | Haan | `null` | |
| `name`, `email` | String | Account se | Form se, zaroori | |
| `mobile` | String | Account se | Form se, optional | |
| `category` | enum | Zaroori | Zaroori | Values neeche constants mein |
| `subject` | String | Zaroori | Zaroori | Max 150 characters |
| `message` | String | Zaroori | Zaroori | Max 2000 characters |
| `attachments` | [String] | Max 3 | Nahi | Cloudflare image URLs |
| `platform` | `web` / `android` / `ios` | Haan | `web` | |
| `appVersion` | String | Optional | Nahi | Debug ke liye |
| `status` | enum | Haan | Haan | Default `open` |
| `priority` | enum | Haan | Haan | Default `medium`, sirf admin badlega |
| `replies` | [Reply] | Haan | Haan | Neeche dekhiye |
| `assignedTo` | ref User | Optional | Optional | Admin ya staff |
| `adminNote` | String | Optional | Optional | Andar ka note, user ko kabhi nahi dikhega |
| `lastReplyAt`, `resolvedAt`, `closedAt` | Date | | | |
| `isDeleted` | Boolean | | | Soft delete |

Timestamps on rahenge aur `versionKey: false`, baaki models jaisa.

**Reply (har reply ka structure):**

- `sender`: ref User. Contact Us wale guest ke liye `null`.
- `senderRole`: `user`, `admin` ya `staff`.
- `message`: max 2000 characters.
- `attachments`: max 3.
- `createdAt`

**Indexes:**

- `ticketId` (unique)
- `{ user, status }`
- `{ status, source, createdAt }`
- `{ email, source, createdAt }`

### Constants (`constants.js`)

| Constant | Values |
| --- | --- |
| `SUPPORT_SOURCES` | `ticket`, `contact_us` |
| `SUPPORT_CATEGORIES` | `payment`, `subscription`, `playback`, `account`, `content_request`, `feedback`, `other` |
| `SUPPORT_STATUSES` | `open`, `in_progress`, `resolved`, `closed` |
| `SUPPORT_PRIORITIES` | `low`, `medium`, `high` |
| `SUPPORT_LIMITS` | 3 attachments, har ek 5 MB, message 2000, subject 150, ek user ke 5 khule tickets, ek email se 24 ghante mein 3 Contact Us |

## API contract (`/supports`)

Response ka format `sendSuccess` wala hi rahega. Validation fail ho to 422. Ticket na mile ya kisi aur ka ho to 404. Limit paar ho to 429.

### Public (bina login)

| Method | Route | Body | Kaam |
| --- | --- | --- | --- |
| POST | `/supports/contact-us` | JSON: `name`, `email`, `mobile?`, `category`, `subject`, `message`, `website` (honeypot, khaali hona chahiye) | Web ka Contact Us form. Response mein `ticketId` aata hai |

### User (`verifyJwtToken`)

| Method | Route | Body / Query | Kaam |
| --- | --- | --- | --- |
| POST | `/supports/create` | form-data: `category`, `subject`, `message`, `platform`, `appVersion?`, `attachments` (0–3 files) | Naya ticket. Name, email aur mobile account se apne aap aate hain |
| GET | `/supports/my` | `page`, `limit`, `status?` | Apne tickets, sabse naya pehle. List mein sirf `replyCount` aur `lastReplyAt`, poore replies nahi |
| GET | `/supports/get/:id` | | Ek ticket aur poora thread. `adminNote` aur `assignedTo` nahi aate |
| POST | `/supports/reply/:id` | form-data: `message`, `attachments` (0–3) | Reply. `resolved` ticket ho to wapas `open` ho jaata hai. `closed` ticket par 400 |
| PUT | `/supports/close/:id` | | Apna ticket band karna |

### Admin (`validateRoles(ADMIN, STAFF)`)

| Method | Route | Body / Query | Kaam |
| --- | --- | --- | --- |
| GET | `/supports/admin/getAll` | `page`, `limit`, `source?`, `status?`, `category?`, `priority?`, `platform?`, `assignedTo?`, `search?` (ticketId, name, email, subject), `fromDate?`, `toDate?`, `sortBy?`, `sortOrder?` | Saare tickets, filters ke saath |
| GET | `/supports/admin/get/:id` | | Poori detail, user ki info ke saath |
| POST | `/supports/admin/reply/:id` | form-data: `message`, `attachments` (0–3), `status?` | Admin ka reply. Contact Us ho to reply email se bhi jaata hai |
| PUT | `/supports/admin/update/:id` | JSON: `status?`, `priority?`, `assignedTo?`, `adminNote?` | Ticket ki details badalna |
| DELETE | `/supports/admin/delete/:id` | | Soft delete |
| GET | `/supports/admin/stats` | `fromDate?`, `toDate?` | Har status aur source ke tickets ki ginti, dashboard badge ke liye |

`/supports` par auth **shuru se on** rahega, kyunki isme users ka personal data hai. Baaki kuch routes par `isAdmin` abhi comment out hai, wahan aisa nahi karenge.

### Attachments ka tarika

- **App, web ya admin file bhejega, URL nahi.** File multipart form-data ke `attachments` field mein jaati hai, chahe ek ho ya teen.
- Backend har file check karta hai: max 3 files, har ek max 5 MB, sirf jpg, jpeg, png ya webp (extension aur mimetype dono). Galat file par 422.
- Check pass hone ke baad files Cloudflare Images par upload hoti hain (`uploadImage`). Unke URL save hote hain aur response mein lautte hain.
- Agar upload ke baad database mein save fail ho jaye, to jo images upload hui thi wo Cloudflare se delete kar di jaati hain.

## Emails (nodemailer)

| Kab | Kisko | Kya hota hai mail mein |
| --- | --- | --- |
| Ticket ya Contact Us bana | User / visitor | Ticket number, subject, "hum jaldi jawab denge" |
| Ticket ya Contact Us bana | Support team (`NODEMAILER_EMAIL`) | Ticket number, source, category, kisne bheja, message ki pehli lines |
| Admin ne reply kiya | User / visitor | Admin ka reply aur ticket number |
| Ticket `resolved` hua | User | Resolve ki khabar, aur reply karke ticket wapas kholne ka tarika |

Mail fail ho jaye to bhi ticket ban jaata hai. Error sirf log mein jaata hai.

## Spam se bachav (koi naya package nahi)

- Ek login user ke ek saath max 5 tickets khule (`open`, `in_progress` ya `resolved`) reh sakte hain.
- Contact Us mein ek email se 24 ghante mein max 3 messages.
- Contact Us form mein ek chhupa hua `website` field (honeypot) hai. Bhara ho to jawab normal success dikhta hai, lekin kuch save nahi hota.
- Saare text fields trim hote hain, aur max length lagti hai. Email `validator` package se check hota hai.

## Kaun kya kar sakta hai

| Kaam | Guest | User | Staff | Admin |
| --- | --- | --- | --- | --- |
| Contact Us bhejna | Haan | Haan | Haan | Haan |
| Ticket banana, apne tickets dekhna, reply, close | Nahi | Sirf apne | Sirf apne | Sirf apne |
| Saare tickets dekhna, reply, update, stats | Nahi | Nahi | Haan | Haan |
| Ticket delete karna (soft) | Nahi | Nahi | Haan | Haan |

## Kaun si files banengi aur badlengi

| File | Naya / Badlav | Kya hoga |
| --- | --- | --- |
| `models/SupportTicket.js` | Naya | Schema, reply ka structure, indexes |
| `validator/supports.js` | Naya | Joi schemas: contact-us, create, reply, my-list query, admin list query, admin update |
| `routes/supports.js` | Naya | 12 routes, apne aap `/supports` par mount |
| `controllers/supports/` | Naya | `index.js` + `contactUs`, `create`, `getMy`, `get`, `reply`, `close`, `adminGetAll`, `adminGet`, `adminReply`, `adminUpdate`, `adminDelete`, `adminStats` |
| `services/supports/` | Naya | `index.js` + har kaam ka service, aur `attachments.js` (files check, upload, fail hone par rollback) |
| `helpers/supports/generateTicketId.js` | Naya | `SUP-YYMMDD-XXXX` banana |
| `helpers/nodeMailer/` | Naya + `index.js` mein badlav | `sendSupportTicketCreatedMail`, `sendSupportAdminAlertMail`, `sendSupportReplyMail` |
| `constants.js` | Badlav | Support ke constants |

Koi naya env variable aur koi naya npm package nahi chahiye.

## Code shuru karne se pehle approval

- [ ] Cloudflare Images ka end-to-end test pass (`cloudflare-images-plan.md` dekhiye)
- [ ] Data model aur API contract approve
- [ ] Categories ki list theek hai
- [ ] Limits theek hain: 3 attachments, 5 MB, 5 khule tickets, Contact Us 3 baar har 24 ghante
- [ ] Staff ko delete ka haq dena hai ya sirf admin ko
- [ ] Code shuru karne ki go-ahead

## Baad ke kaam

- Resolve hone ke 7 din baad ticket apne aap close ho. Iske liye cron chahiye, aur abhi `jobs/index.js` khali hai.
- Admin reply par FCM push notification. User model mein `fcmToken` hai, lekin Firebase setup nahi hai.
- Spam badhe to Contact Us par captcha (reCAPTCHA ya Cloudflare Turnstile).
