# Support system: plan

Last update: 2026-10-10 · Status: **code poora hai (branch `support-system`), 58/58 end-to-end tests pass. Commit aur app/web/admin integration baaki hai.** Code mein kya hua aur plan se kya alag hai, wo neeche *Implementation status* mein hai.

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

## Implementation status (2026-10-10)

Saari files banai, aur saare 12 routes chal rahe hain. Plan se ye cheezein thodi alag hain ya plan mein nahi thi:

| Baat | Kya kiya |
| --- | --- |
| Nayi helper file | `helpers/nodeMailer/supportMailLayout.js`: teeno support mails ka layout aur bhejne ka code. User ka likha text HTML mein escape hota hai, taaki koi mail mein HTML ya script na ghusa sake |
| Nayi helper file | `services/supports/ticketHelpers.js`: ticketId se create (takraav par dobara koshish), status aur uske timestamps, user view, ticket dhoondhna, regex escape, date range |
| Attachments ka field naam | `attachments` aur `attachments[]` dono chalte hain |
| Closed ticket par admin reply | 400 aata hai. Pehle `admin/update` se status badal kar ticket dobara kholna hoga |
| `assignedTo` | Sirf active admin ya staff user ho sakta hai, warna 422. `null` bhejne se assign hata jaata hai |
| User reply par admin ko mail | Nahi jaata. Reply admin inbox mein `lastReplyAt` ke saath dikhta hai |
| Khaali list (`/my`, `admin/getAll`) | 404 `No any supportticket found` aata hai. Repo ka `pagination` util yahi karta hai, banners aur movies jaisa. App use "koi ticket nahi" ki tarah dikhaye |
| Contact Us ka response | Sirf `ticketId`, `status` aur `createdAt` lautta hai, poora ticket nahi |
| `admin/getAll` ka sort | `sortBy` mein sirf `createdAt`, `updatedAt` ya `lastReplyAt` chalta hai |
| Search | Regex ke special characters escape hote hain, isliye `(.*` jaisa input server crash nahi karta |

### End-to-end test (2026-10-10): 58/58 pass

- Test ek alag database (`iftv_support_e2e_test`) par chala, jo test ke baad drop ho gaya. Asli `Iftv-ott` database mein kuch nahi likha gaya.
- Emails ek nakli mailer se pakdi gayi, koi asli mail nahi gayi.
- Attachments asli Cloudflare par upload hue, aur test ke baad teeno delete ho gaye.

Kya kya check hua:

- **Contact Us:**
  - Sahi request par 201, aur ticket number ka format sahi.
  - Galat email ya category par 422.
  - Honeypot bhara ho to 201 aata hai, lekin kuch save nahi hota.
  - Ek email se 4th request par 429.
  - Har request par do mails: visitor ko aur support team ko.
  - Mail mein user ka HTML escape hota hai.
- **User tickets:**
  - Bina token 401. `platform` na ho to 422.
  - 4 attachments, `.txt` file ya 6MB file par 422.
  - 2 attachments ke saath ticket bana, aur dono ke URL browser mein khule.
  - Name aur email account se aaye. User ko `adminNote` aur `assignedTo` nahi dikhte.
  - `/my`, `get`, kisi aur user ka ticket (404), aur galat id (422).
- **Admin:**
  - Normal user ko 403. Staff ko access milta hai.
  - Saare filters, search aur sort chalte hain.
  - Reply karne par status `in_progress` hota hai, sender ki details aati hain, aur user ko mail jaata hai.
  - Update se priority, note aur assign badalte hain. Normal user ko assign karne par 422.
  - Resolve par mail jaata hai.
  - User ke reply se ticket wapas `open` hota hai.
  - Close, dobara close (400), aur closed ticket par user ya admin ka reply (400).
  - Contact Us par staff ka reply aur resolve ek hi mail mein visitor ko jaata hai.
- **Limits aur baaki:**
  - 6th khula ticket banane par 429.
  - Stats ki ginti sahi aati hai.
  - Soft delete ke baad admin aur user dono ko 404.

### Postman

Saare 12 APIs `server/postman/IFTV.postman_collection.json` ke **Supports** folder mein hain, teen sub-folders mein: Public, User aur Admin. Har request ke saath body, enums, limits, error cases aur asli recorded example responses hain.

### Abhi baaki

- [ ] Code review aur commit
- [ ] App aur web: My Tickets aur ticket form (login ke saath), aur web ka Contact Us form (chhupe hue `website` field ke saath)
- [ ] Admin panel: inbox, ticket ki detail, reply, update aur stats ka badge
- [ ] Ek asli Gmail se mail ka test (local test mein mail nakli mailer se pakdi gayi thi)

## Baad ke kaam

- Resolve hone ke 7 din baad ticket apne aap close ho. Iske liye cron chahiye, aur abhi `jobs/index.js` khali hai.
- Admin reply par FCM push notification. User model mein `fcmToken` hai, lekin Firebase setup nahi hai.
- Spam badhe to Contact Us par captcha (reCAPTCHA ya Cloudflare Turnstile).
