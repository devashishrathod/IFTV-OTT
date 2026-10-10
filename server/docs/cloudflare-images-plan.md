# Cloudflare Images: plan aur status

Last update: 2026-10-10

Saari **nayi image uploads ab Cloudinary ki jagah Cloudflare Images par jaati hain**. Purani images (16 movie posters) abhi Cloudinary par hi hain. Unka migration aur Cloudinary hatana baad ka kaam hai (neeche dekhiye).

| Step | Status |
| --- | --- |
| Cloudflare account setup (variants, token check) | Ho gaya |
| Code: `uploadImage` / `deleteImage` Cloudflare par | Ho gaya (branch `cloudflare-images`) |
| Function-level test, asli Cloudflare par | Pass |
| Admin panel se end-to-end test | Baaki hai, neeche ki checklist dekhiye |
| Purani images ka migration aur Cloudinary hatana | Baad mein |

## Pehle kya tha

- Images Cloudinary par jaati thi (folder `Images`), `services/uploads/index.js` ke `uploadImage` se.
- Videos pehle se Cloudflare Stream par jaate hain. Isme kuch nahi badla.
- Jo services image upload ya delete karti hain:

| Jagah | Upload | Delete |
| --- | --- | --- |
| User profile photo | `updateUserById` | `updateUserById` |
| Category | `createCategory`, `updateCategoryById` | `deleteCategoryById` |
| SubCategory | `createSubCategory`, `updateSubCategoryById` | `deleteSubCategoryById` |
| Banner image | `createBanner` | `deleteBanner` |
| Movie poster | `createMovie`, `updateMovie` | `deleteMovie`, `movieMedia` |

Ye sab `uploadImage` aur `deleteImage` hi call karti hain, isliye inme **koi badlav nahi** hua.

## Cloudflare account

- Cloudflare Images chalu hai. 100,000 images tak ki jagah hai.
- Jo `CLOUDFLARE_ACCOUNT_ID` aur `CLOUDFLARE_API_TOKEN` videos ke liye use hote hain, wahi images ke liye bhi chalte hain. Koi naya env variable nahi chahiye.
- Variants (image sizes):
  - `public`: 1920×1080 ke andar chhota karta hai (pehle 1366×768 tha). Database mein yahi URL save hota hai.
  - `thumbnail`: 400×400 ke andar chhota karta hai. List ya grid ke liye frontend URL mein `/public` ko `/thumbnail` se badal sakta hai.
- Image ka URL kuch aisa dikhta hai: `https://imagedelivery.net/<account hash>/<image id>/public`

## Code mein kya badla

| File | Badlav |
| --- | --- |
| `services/cloudflare/images.js` | Nayi file. `uploadCloudflareImage`, `deleteCloudflareImage`, `isCloudflareImageUrl`, `extractImageId` |
| `services/uploads/index.js` | `uploadImage` ab Cloudflare par jaata hai. `deleteImage` URL dekhkar Cloudflare ya Cloudinary se delete karta hai. Purana Cloudinary code comment mein rakha hai, `uploadVideo` jaisa |
| `services/cloudflare/stream.js` | `isRetryableError` export kiya, taaki images bhi wahi retry rule use karein |
| `constants.js` | `.avif` ko `ALLOWED_IMAGE_EXTENSIONS` se hataya, kyunki Cloudflare ise nahi leta |

### Upload kaise kaam karta hai

- File 10 MB se badi ho to Cloudflare par bheje bina hi 422 aata hai: `Image must be 10 MB or smaller`.
- Cloudflare file ko galat image bataye (400/413/415), to 422 aata hai: `Invalid image: <Cloudflare ka message>`.
- Token galat ho (401/403) to saaf error message aata hai.
- Network error, 5xx ya 429 aaye to 3 baar tak dobara koshish hoti hai (2s, phir 4s ruk kar).
- Temp file ka extension na ho to bhi chalta hai. Cloudflare file ke andar ka data dekhkar type pehchaan leta hai.
- Cloudflare ye formats leta hai: jpeg, png, webp, gif, heic, svg.

### Delete kaise kaam karta hai

| URL | Kya hota hai |
| --- | --- |
| `imagedelivery.net/...` | Cloudflare se delete. Image pehle hi delete ho chuki ho to bhi `true` |
| `res.cloudinary.com/...` | Cloudinary se delete (purani images) |
| Koi aur URL (jaise callwave default) ya khaali | Kuch nahi hota, `false` |

`deleteImage` kabhi error throw nahi karta. Delete fail ho to bas log likhta hai aur `false` lautata hai, Cloudinary wale `deleteFile` ki tarah. Isse category ya movie ka delete sirf image ki wajah se nahi rukta.

## Test results (2026-10-10, asli Cloudflare par)

| # | Test | Nateeja |
| --- | --- | --- |
| 1 | Bina extension wali PNG upload | URL mila |
| 2 | `public` URL kholna | 200 |
| 3 | `thumbnail` URL kholna | 200 |
| 4 | Cloudflare image delete | `true` |
| 5 | Wahi image dobara delete | `true` |
| 6 | Delete ke baad URL kholna | 404 |
| 7 | callwave default URL delete | Skip, `false` |
| 8 | Na mili Cloudinary image delete | Cloudinary ne "not found" bola, `true` |
| 9 | Khaali URL delete | Skip, `false` |
| 10 | AVIF upload | 422, Cloudflare ise nahi leta |
| 11 | Text file upload | 422 Invalid image |
| 12 | 11 MB file upload | 422 Image must be 10 MB or smaller |

Test mein bani saari images delete kar di gayi. Server 15 second chala kar dekha: saare routes mount hue aur MongoDB connect hua.

## Admin panel se end-to-end checklist

- [ ] Nayi movie poster ke saath banao. Poster URL `imagedelivery.net` ka ho aur browser mein khule.
- [ ] Usi movie ka poster badlo. Purani image Cloudflare se delete ho jaye (URL 404 de).
- [ ] Purani movie (Cloudinary poster wali) ka poster badlo. Purana Cloudinary poster delete ho jaye.
- [ ] Category image ke saath banao, phir delete karo.
- [ ] User profile photo badlo.
- [ ] App, web aur admin mein dekho ki koi screen Cloudinary URL mein size nahi jodti (jaise `w_300`).
- [ ] Test ka saara data saaf karo.

## App, web aur admin par asar

- Nayi images ka URL `imagedelivery.net/.../public` hoga. Jo screens sirf URL dikhati hain, unme kuch nahi badlega.
- Chhoti image chahiye to URL ke aakhir mein `/public` ko `/thumbnail` se badlo.
- Ab `.avif` upload nahi hogi. Server 422 lautayega.

## Baad ke kaam

- **Purani images ka migration aur Cloudinary hatana:** `server/scripts/` mein ek script jo 16 movie posters Cloudflare par daale, DB mein URL badle aur Cloudinary se delete kare. Phir ye sab hatana:
  - `helpers/cloudinary`
  - `configs/cloudinary.js`
  - `cloudinary` package
  - `CLOUD_*` env variables
  - `uploadAudio`, `uploadPDF` aur `deletePDF` (inhe koi use nahi karta)
- **`.env` ki security:** `.env` git mein track ho raha hai, aur usme Cloudinary secret, Gmail aur Nodemailer password, MongoDB credentials aur ek purana Cloudflare token hai. Ise git se hatana hai aur saare passwords badalne hain.
