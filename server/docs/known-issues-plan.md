# Known issues and bugs: fix plan

Last update: 2026-10-10 · Status: **sirf list bani hai, abhi kuch fix nahi hua.** Har fix se pehle plan confirm karke hi code badlega.

Ye issues 10 Oct 2026 ko poore backend ka code padhte waqt mile, jab Postman collection ban rahi thi (`server/postman/IFTV.postman_collection.json`). Collection ke descriptions mein bhi ye ⚠️ ke saath likhe hain.

**Priority ka matlab:**
- **P0:** security hole, sabse pehle theek karna hai.
- **P1:** server crash ya data kharab hona.
- **P2:** galat behaviour ya bug.
- **P3:** cleanup ya consistency.

## Sabse pehle kya (suggested order)

1. P0 security: S1 se S7. Inme se S1, S2 aur S6 sabse zaroori hain.
2. P1 stability: B1 se B5.
3. P2 bugs, module ke hisaab se.
4. P3 cleanup.

---

## P0: Security

| ID | Issue | Kahan | Asar | Fix ka idea |
|---|---|---|---|---|
| S1 | `verify-otp-mobile` OTP check hi nahi karta. `loginOrSignin-with-mobile` SMS nahi bhejta, aur `sessionId` hard-coded hai (`0554ea45-...`) | `controllers/auth/verifyOtpWithMobile.js`, `controllers/auth/loginOrSignInWithMobile.js` (2factor ki calls comment out hain) | Registered mobile number pata ho to bina OTP 7 din ka token mil jaata hai | 2factor ka send aur verify dobara chalu karna, ya email jaisa apna OTP (code, expiry, attempts) lagana. OTP galat ho to 400/403 dena |
| S2 | `role` request body se liya jaata hai | `controllers/auth/register.js`, `loginOrSignInWithEmail.js`, `loginOrSignInWithMobile.js`, `login.js` | Koi bhi khud ko `admin` ya `staff` bana sakta hai | Public routes par role hamesha `user`. Admin ya staff sirf admin API ya seed script se banein |
| S3 | Register aur login ke response mein password hash aata hai. Login mein pending `otp` bhi aa sakta hai | `controllers/auth/register.js`, `controllers/auth/login.js`; `models/User.js` mein `password` par `select:false` nahi hai | Hash aur OTP leak | Model mein `password` aur `otp` par `select:false` lagana, ya response mein `toObject()` karke ye fields hata dena |
| S4 | OTP se bane saare users ka password `DEFAULT_PASSWORD` hai (ek hi value) | `loginOrSignInWithEmail.js`, `loginOrSignInWithMobile.js` | Ye value jaanne wala `/auth/login` se kisi bhi OTP user ki tarah login kar sakta hai | Har user ke liye random password, ya OTP users ke liye password login band (loginType check) |
| S5 | `?userId=` se koi bhi login user doosre user ka profile padh ya badal sakta hai (IDOR) | `controllers/users/getUser.js`, `controllers/users/updateUser.js` | Doosre users ka data padhna aur badalna | `userId` query sirf admin ke liye. Normal user hamesha `req.userId` |
| S6 | Admin checks comment out hain, aur `POST /movies/add` par check hai hi nahi | `routes/categories.js`, `routes/subCategories.js`, `routes/banners.js`, `routes/movies.js`, `routes/subscriptions.js` | Koi bhi bina login categories, movies, banners aur plans bana, badal aur delete kar sakta hai | Create, update aur delete par `isAdmin` (ya `validateRoles(ADMIN, STAFF)`) chalu karna. Admin panel ko token bhejna hoga |
| S7 | `.env` git mein track ho raha hai. Usme Cloudinary secret, Gmail aur Nodemailer password, MongoDB credentials aur ek purana Cloudflare token hai | `server/.env`, `.gitignore` (`.env` wali line comment out hai) | Repo jiske paas hai, uske paas saare secrets hain | `.env` ko git se hatana (`git rm --cached`), `.gitignore` theek karna, `.env.example` banana, aur saare secrets badalna |
| S8 | OTP par koi attempt limit nahi, aur resend par koi throttle nahi | `verifyOtpWithEmail.js`, `loginOrSignInWithEmail.js` | 5 minute mein 6 digit ka OTP brute-force ho sakta hai, aur mail spam | Attempt counter (jaise 5 galat ke baad OTP khatam), resend cooldown (jaise 60 second) |
| S9 | `verifyJwtToken` mein `isActive:false` users block nahi hote | `middlewares/verifyJwtToken.js`, `middlewares/validateRoles.js` | Deactivated user ka token chalta rahta hai | `isActive` check jodna (403) |

## P1: Stability (crash ya data kharab)

| ID | Issue | Kahan | Asar | Fix ka idea |
|---|---|---|---|---|
| B1 | OTP routes mein naye user ke liye `User.create` ko `await` nahi kiya jaata | `loginOrSignInWithEmail.js`, `loginOrSignInWithMobile.js` | Galat email, role ya loginType par response 200 aata hai, phir unhandled rejection se **server process crash** ho jaata hai | `await` lagana. `index.js` mein `unhandledRejection` handler bhi |
| B2 | Body na ho to 500 aata hai: `Cannot destructure property ... of undefined` | Auth ke saare routes; category, subCategory aur banner create; subscription create | Galat status code aur ganda message | Controller mein `req.body ?? {}`, ya ek middleware jo body na ho to `{}` set kare |
| B3 | `search` aur `name` filter regex escape nahi hote | `services/categories/getAllCategories.js`, `services/subCategories/...getAll`, `services/banners/getAllBanners.js`, `services/subscriptions/getAllSubscription.js` | `search=(` jaisa input dene par 500 | `escapeRegex` lagana (`services/supports/ticketHelpers.js` mein pehle se hai, use shared util bana sakte hain) |
| B4 | `deleteStreamVideo` Cloudflare ka 404 aane par throw karta hai | `services/cloudflare/stream.js` | Video Cloudflare se pehle hi hat chuka ho to banner ya movie delete hamesha 404 deta hai, aur record kabhi delete nahi hota | `validateStatus` lagana aur 404 ko "pehle hi delete hai, theek hai" maanna |
| B5 | Mongoose validation aur cast errors 500 dete hain | `middlewares/errorHandler.js` | Galat email ya role (register), galat id (subscriptions get aur delete) par 500 | errorHandler mein `ValidationError` aur `CastError` ko 422 banana. Subscriptions mein `validateObjectId` |

## P2: Bugs (module ke hisaab se)

### Auth / Users
| ID | Issue | Kahan | Fix ka idea |
|---|---|---|---|
| A1 | `/auth/login` mein `type` na bhejo to mobile branch chalti hai, aur `Mobile number is required` aata hai. Email wale case ke message mein typo hai: `Eamil is required` | `controllers/auth/login.js` | Jo field bheja gaya ho usse branch tay karna. Typo theek karna |
| A2 | Galat password par 403 aata hai, 401 aana chahiye | `controllers/auth/login.js` | 401 |
| A3 | `verify-otp-email` mein `otp` number bhejo to hamesha `Invalid OTP` aata hai | `controllers/auth/verifyOtpWithEmail.js` | `String(otp)` karke compare karna |
| A4 | `verify-otp-email` mein email na bhejo to `email: null` se dhoondhta hai | same | email zaroori karna (422) |
| A5 | Login `isLoggedIn`, `isOnline` aur `lastActivity` set nahi karta. Logout API hi nahi hai | `login.js`; `controllers/auth/logout.js` khali hai | Login mein ye fields set karna. Logout route banana |
| A6 | Users update mein Joi ki jagah raw body use hoti hai. Form-data se mobile string aata hai, isliye har baar `isMobileVerified` false ho jaata hai. Email bina lowercase kiye compare hota hai | `services/users/updateUserById.js`, `controllers/users/updateUser.js` | Joi ka `value` pass karna. Email pehle lowercase karke compare karna |
| A7 | `address: ""` bhejne se address clear nahi hota | `updateUserById.js` | `!== undefined` check |
| A8 | Profile photo update mein purani image naye upload se **pehle** delete hoti hai | `updateUserById.js` | Pehle naya upload karo, save karo, phir purana delete (movies jaisa) |
| A9 | Duplicate email/mobile check per role hai, aur unique index nahi hai | `register.js`, OTP routes | Do requests ek saath aayein to duplicate users ban sakte hain. Compound unique index `{email, role}` aur `{mobile, role}` (partial, `isDeleted:false`) |
| A10 | Khali files: `services/auth/registerUser.js`, `helpers/auth/index.js`, `controllers/auth/logout.js` | | Implement karna ya hatana |

### Categories / SubCategories
| ID | Issue | Kahan | Fix ka idea |
|---|---|---|---|
| C1 | Update mein `isActive` hamesha ulta ho jaata hai, chahe koi bhi value bhejo (`true` bhejne par active category inactive ho jaati hai) | `services/categories/updateCategoryById.js`, `services/subCategories/updateSubCategoryById.js` | `isActive = value` set karna |
| C2 | Naam trim kiye bina duplicate check hota hai. `" Drama "` se duplicate ban jaata hai | create aur update dono (categories, subCategories, banners) | Joi mein `.trim()`, ya service mein trim karke check |
| C3 | Update mein purani image pehle delete hoti hai, naya upload fail ho to image toot jaati hai | update services | Pehle upload, phir save, phir delete |
| C4 | Category delete karne par uski subCategories delete nahi hoti, aur list mein dikhti rehti hain | `services/categories/deleteCategoryById.js` | Cascade soft delete, ya subCategories getAll mein parent check |
| C5 | Sirf `categoryId` badlo to naye category mein naam ka duplicate check nahi hota. Ek duplicate check dead code hai | `updateSubCategoryById.js` | Check ko theek karna aur dead code hatana |
| C6 | `description: ""` se description clear nahi hoti | update services | `!== undefined` check |
| C7 | SubCategory ki koi default image nahi hai (`DEFAULT_IMAGES.SUBCATEGORY` constant hi nahi hai) | `constants.js`, `createSubCategory.js` | Default image jodna, ya frontend placeholder dikhaye |
| C8 | Messages ek jaise nahi hain: `Category not found` vs `Category not found!`, `SubCategory not found` vs `subCategory not found`, `Invalid category Id` vs `Invalid Category Id`. Categories aur subCategories `cleanJoiError` use nahi karte | services aur controllers | Ek jaisa format |

### Banners
| ID | Issue | Kahan | Fix ka idea |
|---|---|---|---|
| N1 | Update API hai hi nahi: route comment out hai, aur `controllers/banners/update.js` aur `services/banners/updateBanner.js` khali hain | `routes/banners.js` | Update banana (movies update jaisa) |
| N2 | Sirf image wale banner par bhi message `Banner video created successfully` aata hai | `controllers/banners/create.js` | `Banner created successfully` |
| N3 | Video upload ke baad image upload fail ho to video Cloudflare par bekaar pada rehta hai | `services/banners/createBanner.js` | Rollback (movies ka `deleteMedia` pattern) |
| N4 | Image ya video file ka type check nahi hota | `createBanner.js` | `assertImageFile` / `assertVideoFile` (movies wale) |

### Movies
| ID | Issue | Kahan | Fix ka idea |
|---|---|---|---|
| M1 | File type check mein extension **ya** mimetype mein se ek bhi sahi ho to file chal jaati hai, jaise `.txt` file `video/*` mimetype ke saath | `services/movies/movieMedia.js` | Dono zaroori karna |
| M2 | Create mein pehle video upload hota hai, phir image. Badi ya galat image ka pata poora video upload hone ke baad chalta hai | `services/movies/createMovie.js` | Image ka size aur type pehle check karna, ya image pehle upload karna |
| M3 | Duration 0 ya null save ho sakti hai, aur sirf `GET /:id/get` use baad mein theek karta hai. getAll kabhi nahi | `createMovie.js`, `getAllMovies` | Background mein duration fill karna, ya getAll mein bhi |
| M4 | `videoUrl` mein koi bhi URI chal jaata hai, domain check nahi hota | `validator/movies.js` | Sirf Stream domain allow karna |
| M5 | Processing chal rahi ho tab bhi video link ho jaata hai. Sirf `pendingupload` aur `error` block hote hain | `movieMedia.js` | Theek ho sakta hai. Product decision chahiye |

### Subscriptions
| ID | Issue | Kahan | Fix ka idea |
|---|---|---|---|
| P1 | get-all mein anjaan query keys filter ban jaate hain (`?foo=bar` par 404) | `services/subscriptions/getAllSubscription.js` | Sirf jaane-pehchaane filters lena |
| P2 | Galat id par 500 aata hai | `services/subscriptions/*` | `validateObjectId` → 422 |
| P3 | `durationInDays` bina bataye ignore ho jaata hai | `createSubscription` | Joi se hata dena, ya docs mein likhna |
| P4 | `toDate` din ke end tak nahi badhta, baaki modules mein badhta hai | `getAllSubscription.js` | 23:59:59.999 set karna |
| P5 | Controller Joi ka `value` nahi, raw `req.body` save karta hai | `controllers/subscriptions/createSubscription.js` | `value` pass karna |
| P6 | `SUBSCRIPTION_PLANS` constant kahin use nahi hota | `constants.js` | Use karna ya hatana |

## P3: Cleanup aur consistency

| ID | Issue | Fix ka idea |
|---|---|---|
| X1 | Duplicate par kahin 400 aata hai, kahin 409 (subscriptions) | Sab jagah 409 |
| X2 | Lists mein `isActive` filter: `"true"` ke alawa koi bhi value inactive dikhata hai | Joi boolean + sahi conversion |
| X3 | `sortBy` whitelist nahi hai (categories, banners, movies), aur `limit` ki koi max nahi | Whitelist, aur `limit` max 100 |
| X4 | Khali list par 404 aata hai (`pagination` util) | Ye design ka sawaal hai. 200 aur khali `data` behtar hai, lekin frontend se baat karke badalna |
| X5 | `x-www-form-urlencoded` body parse nahi hoti | Zarurat ho to `express.urlencoded()` |
| X6 | `toDate` server ke timezone mein din ke end tak jaata hai | IST ya UTC tay karna |
| X7 | Path ka style ek jaisa nahi: movies mein `/:id/get`, baaki mein `/get/:id`; subscriptions mein `get-all`, baaki mein `getAll` | Naya version aaye tab ek jaisa karna. Abhi badlenge to frontend toot jayega |
| X8 | `ALLOWED_IMAGE_EXTENSIONS` sirf movies mein use hota hai | Categories, subcategories, banners aur users mein bhi lagana |

## Doosri docs mein pehle se likhe kaam

- Purani Cloudinary images ka migration aur Cloudinary hatana: `cloudflare-images-plan.md`
- Support: resolve ke baad auto-close (cron), FCM push, Contact Us par captcha: `support-system-plan.md`

## Fix ka tarika

Har group ke liye pehle chhota plan aur badalne wali files ki list dikhayenge, aapki approval ke baad code karenge. Har fix ke saath:
- Postman collection ke us request ka description aur examples update karna.
- Is doc mein us ID ke aage ✅ aur fix ki tarikh likhna.
