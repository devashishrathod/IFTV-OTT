# Gallery: plan

Last update: 2026-10-10 · Status: **code poora hai (branch `support-system`, uncommitted). 110/110 end-to-end tests pass hue, aur Postman mein Gallery folder add ho gaya. Commit aur app/web/admin integration abhi baaki hai.** Code mein kya bana aur plan se kya alag hai, wo neeche *Implementation status* mein hai.

Admin panel se admin (ya staff) gallery mein media upload karega, aur ye media app aur web ke gallery section mein dikhega. Gallery **public** hai, use dekhne ke liye login zaroori nahi.

Media teen tarah ka ho sakta hai:

| Type | Kahan store hoga | Poster |
| --- | --- | --- |
| `image` (jpg, jpeg, png, webp) | Cloudflare Images (movie posters wala setup) | Nahi chahiye. Grid ke liye `thumbnail` variant (400x400) apne aap milta hai |
| `gif` | Cloudflare Images (animated GIF chalta hai, max 10 MB) | Nahi chahiye |
| `video` | Cloudflare Stream (movies jaisa) | Admin upload karega. Na kare to Stream ka auto thumbnail use hoga |

- `mediaType` admin nahi bhejega. Server file dekh kar khud set karega: `image/gif` ya `.gif` → `gif`, `video/*` → `video`, baaki image → `image`.
- 10 MB se badi GIF reject hogi, is message ke saath ki "isko video (mp4) ki tarah upload karo".

## Flow

```
Admin panel                          Backend: /gallery                     App / Web (users)
───────────                          ─────────────────                     ─────────────────
Image / GIF file  ──multipart──▶  validate → Cloudflare Images ─┐
Bulk: 10 tak images/GIF ────────▶  sab check → saath upload ─────┤
                                                                ├─▶ GalleryItem save
Chhota video + poster ─multipart─▶ Stream + Images upload ──────┤
                                                                │
Bada video (GB):                                                │
 1. upload-url maango  ─────────▶  Stream direct upload URL     │
 2. browser → Cloudflare (TUS)                                  │
 3. create with videoUid ───────▶  Stream par check + poster ───┘
                                                                        GET /gallery/getAll
Reorder / hide / delete ───────▶  order / isActive / soft delete ────▶ (sirf active items,
                                                                        order ke hisaab se)
```

Video ke dono raaste (file aur direct upload) wahi hain jo movies mein chal rahe hain (`services/cloudflare/stream.js`). Gallery us code ko sirf reuse karegi, movies ka code nahi badlega.

## Data model: `GalleryItem`

| Field | Type | Note |
| --- | --- | --- |
| `title` | String, optional | Max 150 characters |
| `description` | String, optional | Max 1000 characters |
| `mediaType` | `image` / `gif` / `video` | Server set karega |
| `media` | String, required | Image/GIF ke liye Cloudflare Images URL, video ke liye Stream watch URL |
| `poster` | String | Sirf video ke liye. Cloudflare image URL |
| `durationInSeconds` | Number | Sirf video ke liye. Stream se ya file se nikalega |
| `tags` | [String] | Optional, max 10. Lowercase aur trim honge, duplicate hata diye jaayenge |
| `order` | Number, default 0 | Admin ka chuna hua sequence |
| `isActive` | Boolean, default true | Item hide ya show karne ke liye |
| `createdBy` | ref User | Kis admin/staff ne upload kiya |
| `isDeleted` | Boolean, default false | Soft delete |

- Timestamps on rahenge aur `versionKey: false`, baaki models jaisa.
- Index `{ isDeleted: 1, isActive: 1, order: 1, createdAt: -1 }` par lagega.
- Sorting mein pehle `order` asc aata hai, phir `createdAt` desc. Isliye naya item sabse upar dikhega jab tak admin order na badle.

## APIs

Route file `routes/gallery.js` hai, jo apne aap `/gallery` par mount hogi.

### Public (bina login): app aur web

| Method | Route | Kaam |
| --- | --- | --- |
| GET | `/gallery/getAll` | Sirf active aur non-deleted items, paginated. Query: `page`, `limit` (default 20, max 50), `mediaType`, `tag`, `search` (title/description) |
| GET | `/gallery/get/:id` | Ek item. Inactive ya deleted ho to 404 |

Public response mein `createdBy`, `isDeleted` aur `isActive` nahi jaayenge. Ready-to-use URLs saath mein aayenge, taaki app/web ko khud kuch na banana pade:

```json
{
  "_id": "6707f1...",
  "title": "Shooting day 1",
  "description": "Behind the scenes",
  "mediaType": "video",
  "media": "https://customer-xxx.cloudflarestream.com/<uid>/watch",
  "hlsUrl": "https://customer-xxx.cloudflarestream.com/<uid>/manifest/video.m3u8",
  "poster": "https://imagedelivery.net/<hash>/<id>/public",
  "thumbnailUrl": "https://imagedelivery.net/<hash>/<id>/thumbnail",
  "durationInSeconds": 94,
  "tags": ["bts"],
  "order": 0,
  "createdAt": "2026-10-10T10:00:00.000Z"
}
```

`thumbnailUrl` aise banega:

- image/GIF: `media` URL ka variant `/public` se `/thumbnail` kar diya jaata hai.
- video + poster: `poster` URL ka `/thumbnail` variant.
- video bina poster: `https://<stream domain>/<uid>/thumbnails/thumbnail.jpg`. Response mein `poster` bhi yahi URL hota hai, lekin DB mein `poster` `null` hi rehta hai.

`hlsUrl` sirf video ke liye hota hai. Ye DB mein save nahi hote, response banate waqt calculate hote hain.

**Users ise kaise use karenge:**

- **Web:** grid mein `thumbnailUrl` dikhega. Click karne par image/GIF ke liye `media` khulega, aur video ke liye `poster` ke saath Stream player (watch URL ya iframe) chalega.
- **App (Android/iOS):** grid mein bhi `thumbnailUrl` dikhega. Video native player (ExoPlayer/AVPlayer) mein `hlsUrl` se chalega.

### Admin panel (admin + staff)

Har route par `validateRoles(ROLES.ADMIN, ROLES.STAFF)` lagega. Auth hamesha on rahega.

| Method | Route | Kaam |
| --- | --- | --- |
| POST | `/gallery/admin/video/upload-url` | Bade video ke liye direct upload URL. Body: `fileSize`, `fileName` |
| GET | `/gallery/admin/video/:uid/status` | Stream par video ka processing status |
| POST | `/gallery/admin/create` | Multipart request. Ismein `media` file **ya** `videoUid` aata hai, aur optional `poster` (sirf video ke saath), `title`, `description`, `tags`, `order`, `isActive` |
| POST | `/gallery/admin/bulk-create` | Multipart request. `media` mein 1 se 10 images/GIF, aur optional `tags` aur `isActive` jo saare items par lagenge. Video yahan allowed nahi |
| GET | `/gallery/admin/getAll` | Saare non-deleted items, inactive bhi. Query: `page`, `limit`, `isActive`, `mediaType`, `tag`, `search`, `fromDate`, `toDate`, `sortBy`, `sortOrder` |
| GET | `/gallery/admin/get/:id` | Poora item (`createdBy` ke naam aur email ke saath) |
| PUT | `/gallery/admin/update/:id` | Text fields badlo, `media` ya `videoUid` replace karo, `poster` replace karo, ya `removePoster=true` bhejo. Purani file Cloudflare se tabhi delete hogi jab update successful ho jaaye |
| PUT | `/gallery/admin/reorder` | Body `{ items: [{ id, order }] }` hai, max 100 items. Drag-and-drop ke liye |
| DELETE | `/gallery/admin/delete/:id` | Soft delete (`isDeleted: true`) karta hai, aur Cloudflare se media aur poster bhi delete karta hai |

**Media type badalna:** update mein image ki jagah video (ya ulta) bheja ja sakta hai. Tab `mediaType` naye media ke hisaab se badlega. Video se image banne par poster aur duration hata diye jaayenge.

**Bulk create:**

- Sab ya kuch nahi. Ek bhi file invalid ho to koi upload nahi hoga, kyunki saari files pehle check hoti hain.
- Upload beech mein fail ho jaaye to jitni files upload ho chuki hain, wo Cloudflare se delete ho jaayengi.
- Saare items `insertMany` se ek saath save honge. Title khali rahega, admin baad mein update kar sakta hai.

## Validation aur safety

- Joi validator `validator/gallery.js` mein hoga. Errors 422 aur `cleanJoiError` ke saath aayenge (existing pattern).
- File type `ALLOWED_IMAGE_EXTENSIONS` / `ALLOWED_VIDEO_EXTENSIONS` se check hoga. `create` mein sirf ek `media` file allowed hai.
- Video file aur `videoUid` dono bheje to 422.
- Image/GIF ke saath `poster` bheja to 422.
- `videoUid` par movies wala check lagega: video Stream par hona chahiye, uska upload poora hona chahiye aur state `error` nahi honi chahiye. Ek video sirf ek gallery item mein link ho sakta hai.
- Image/GIF max 10 MB (Cloudflare Images ki limit). Video ke liye server ki multipart limit wahi hai jo movies ki hai. GB wala video direct upload se jaayega.
- Create ya update fail ho jaaye to us request mein upload hui files rollback (delete) ho jaayengi, movies jaisa.
- Galat `id` par 422 aata hai, aur item na mile to 404.

## Constants (`constants.js`)

```js
GALLERY_MEDIA_TYPES: Object.freeze({ IMAGE: "image", GIF: "gif", VIDEO: "video" }),

GALLERY_LIMITS: Object.freeze({
  MAX_TITLE_LENGTH: 150,
  MAX_DESCRIPTION_LENGTH: 1000,
  MAX_TAGS: 10,
  MAX_BULK_FILES: 10,
  MAX_REORDER_ITEMS: 100,
  DEFAULT_PAGE_LIMIT: 20,
  MAX_PAGE_LIMIT: 50,
}),
```

## Files

**Naye files:**

- `models/GalleryItem.js`
- `validator/gallery.js`
- `routes/gallery.js`
- `controllers/gallery/`: `index`, `getAll`, `get`, `adminCreate`, `adminBulkCreate`, `adminGetAll`, `adminGet`, `adminUpdate`, `adminReorder`, `adminDelete`, `adminVideo`
- `services/gallery/`: `index`, `createGalleryItem`, `bulkCreateGalleryItems`, `updateGalleryItem`, `getAllGalleryItems`, `adminGetAllGalleryItems`, `getGalleryItem`, `reorderGalleryItems`, `deleteGalleryItem`, `galleryMedia` (mediaType detect karna, file checks, URL formatter)

**Badlenge:**

- `constants.js`: `GALLERY_MEDIA_TYPES` aur `GALLERY_LIMITS` add honge.
- `postman/IFTV.postman_collection.json`: naya **Gallery** folder banega, jisme har API full body, enums, examples aur edge cases ke saath hogi.

**Touch nahi honge:** movies, banners, supports, `services/uploads`, `services/cloudflare/*`. In sab ko sirf reuse kiya jaayega.

## Implementation status (2026-10-10)

**Bane hue files:**

- `models/GalleryItem.js`
- `validator/gallery.js`
- `routes/gallery.js`
- `controllers/gallery/`: `getAll`, `get`, `adminCreate`, `adminBulkCreate`, `adminGetAll`, `adminGet`, `adminUpdate`, `adminReorder`, `adminDelete`, `adminVideo`, `index`
- `services/gallery/`: `createGalleryItem`, `bulkCreateGalleryItems`, `updateGalleryItem`, `getAllGalleryItems`, `adminGetAllGalleryItems`, `getGalleryItem` (public + admin), `reorderGalleryItems`, `deleteGalleryItem`, `galleryMedia`, `index`

**Badle hue files:**

- `constants.js`: `GALLERY_MEDIA_TYPES` aur `GALLERY_LIMITS` add hue.
- Postman collection: **Gallery** folder add hua (Public / Admin / Direct upload). Isme 15 requests aur 51 examples hain, aur saare examples asli server responses se record kiye gaye. 4 naye variables bhi aaye: `galleryItemId`, `galleryVideoItemId`, `galleryVideoUid`, `galleryUploadURL`.

Movies, banners, supports, `services/uploads` aur `services/cloudflare/*` ka code nahi badla. Direct upload ke `upload-url` aur `status` routes movies ki service aur validator ko hi reuse karte hain.

**Plan se jo alag ya extra hai:**

- Controller files ke naam support module jaise `admin*` rakhe gaye hain.
- Bulk upload mein pehle saari files check hoti hain, phir sab saath (parallel) upload hoti hain. Ek bhi fail hui to baaki delete ho jaati hain.
- Bulk mein `title`/`description` bheje to 422 aata hai, kyunki wahan sirf `tags` aur `isActive` allowed hain.
- Admin response mein `hasCustomPoster` field extra hai, taaki admin panel "poster hatao" button dikha sake.
- Direct upload video ki state `queued`/`inprogress` ho tab bhi create ho jaata hai, sirf `pendingupload` aur `error` par reject hota hai. Aise case mein `durationInSeconds` `null` reh sakta hai, movies jaisa.
- Kuch limits pakki ki gayi: `order` 0 se 1000000 tak, har tag max 30 characters, admin list `limit` max 100.
- Khali list par public aur admin `getAll` dono 404 `No any galleryitem found` dete hain, kyunki project ka `pagination` util yahi karta hai.
- Delete hone ke baad DB mein purane URLs rehte hain, lekin files Cloudflare se hat jaati hain.

**Testing:** 110/110 end-to-end checks pass hue. Test throwaway DB par chala, Cloudflare Images/Stream ki calls stub thi, aur test ke baad DB drop ho gaya. Isme ye sab cover hua:

- auth (401 aur user ko 403)
- image, GIF aur video+poster create
- videoUid ke saare cases: ready, inprogress, pending, error, duplicate, unknown
- validation errors
- upload fail hone par rollback
- bulk upload ke saare cases
- update: type change, poster replace/remove, fail hone par item waisa hi rehna
- hide/show aur public filters
- admin list/get
- reorder aur delete

Asli Cloudflare account par abhi test nahi hua hai.

## Decisions (user ne 2026-10-10 ko approve kiye)

1. Gallery public hai, dekhne ke liye login nahi chahiye.
2. Alag albums nahi honge. Filter ke liye sirf `tags` honge. Albums ki zaroorat padi to baad mein `GalleryAlbum` collection banegi.
3. Admin panel ka access admin aur staff dono ko hai.
4. Bulk upload abhi hi banega, kyunki ye chhota kaam hai. Ye sirf images/GIF ke liye hai, max 10.
5. Delete karne par soft delete hoga aur Cloudflare se file bhi hat jaayegi. Iske baad item restore nahi ho sakta.
