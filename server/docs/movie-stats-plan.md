# Movie stats (views / plays): plan

Last update: 2026-11-03 · Status: **code poora hai (branch `support-system`, uncommitted). 145/145 end-to-end tests pass hue. Postman mein "Movie Stats" folder add hua, Dashboard request update hua, aur `docs/frontend/` ke teeno docs update hue (web / app section 6, admin section 9 + section 8).**

Har movie ka count rakhna hai ki wo kitni baar **dekhi gayi (view)** aur kitni baar **play hui (play)**. Ye numbers movie ke neeche website / app par dikhte hain (popularity), aur admin ko poori report milti hai.

## Confirmed decisions (user, 2026-11-03)

- View tab gina jaata hai jab frontend `POST /movies/:id/track` bhejta hai, `GET /movies/:id/get` se apne aap nahi. Isse admin panel ke calls count nahi hote.
- Admin / staff ki activity nahi gini jaati.
- Same viewer 30 minute ke andar wahi event dobara bheje to dobara nahi gina jaata.
- Public mein sirf views + plays (aur unke short labels) dikhte hain.
- **Progress / watch-time / completion abhi nahi banana.** Sirf view aur play hain.

## Kya gina jaata hai

| Number | Matlab |
| --- | --- |
| views | Movie page / screen kitni baar khula |
| uniqueViewers | Kitne alag viewers ne page khola |
| plays | Video kitni baar start hua |
| uniquePlayers | Kitne alag viewers ne play kiya |
| playRate | `plays / views × 100` (1 decimal), views 0 ho to 0 |
| lastViewedAt / lastPlayedAt | Aakhri gina gaya view / play |

**Viewer** = login user (`user:<userId>`) ya guest ka device (`device:<deviceId>`). Guest ko `deviceId` bhejna zaroori hai. Ek guest baad mein login kare to wo naya viewer hai.

**Viewer type** (event ke din ke hisaab se): `guest`, `user` (login, plan nahi), `subscriber` (login + chalta plan).

## Counting rules

1. Movie delete ho to `404 Movie not found`. Inactive movie par count hota hai, `getMovie` jaisa hi.
2. Admin / staff token → `counted: false, reason: "staff"`.
3. Guest bina `deviceId` → `422 deviceId is required for guests`. Expire / galat token guest maana jaata hai.
4. Paid movie par `play`, aur viewer ke paas access nahi (`applyMovieAccess` wala hi rule) → `counted: false, reason: "movie_locked"`. `view` hamesha gina jaata hai.
5. Same viewer + same movie + same event, pichhle gine gaye event se 30 min ke andar → `counted: false, reason: "repeat"`. Platform ya din badalne se ye rule nahi tootta.
6. Baaki sab → `counted: true`. Viewer ka us movie par pehla view / play ho to `uniqueViewers` / `uniquePlayers` bhi +1.

`counted: false` hamesha **200** ke saath aata hai (error nahi), taaki frontend ko kuch handle na karna pade.

## Data kaise store hota hai

| Jagah | Kya | Kyun |
| --- | --- | --- |
| `Movie.stats` | `views`, `uniqueViewers`, `plays`, `uniquePlayers`, `lastViewedAt`, `lastPlayedAt` (all-time counters, `$inc`) | List / detail mein bina extra query ke, aur `sortBy=views/plays` ke liye. Index `{ isDeleted, stats.plays }` aur `{ isDeleted, stats.views }` |
| `MovieViewer` (naya) | Har movie + viewer ki ek row: views, plays, last times, type, platform. Unique index `{ movieId, viewerKey }` | 30-min repeat check aur "pehli baar" ka check **ek atomic query** mein (neeche) |
| `MovieActivity` (naya) | Har movie + viewer + IST din + platform ki ek row: views, plays, type. Unique index `{ movieId, viewerKey, day, platform }` | Date range, charts, platform / type circles, viewers list. Har event ka alag doc nahi banta, isliye collection chhota rehta hai |

**Atomic repeat check:** `MovieViewer.findOneAndUpdate({ movieId, viewerKey, lastAt: null ya < 30 min pehle }, { $inc, $set }, { upsert: true, returnDocument: "before" })`.
- Row nahi hai → insert (pehli baar, gina gaya).
- Row hai aur 30 min se purana → update (gina gaya). Purane doc se pata chalta hai ki pehli baar tha ya nahi.
- Row hai par window ke andar → upsert insert try karta hai, unique index par `E11000` → `repeat`.

Isliye ek saath 8 duplicate requests aayein to bhi sirf 1 ginti hai (e2e mein test hua).

## APIs

| API | Auth | Kaam |
| --- | --- | --- |
| `POST /movies/:id/track` | optional (`optionalAuth`) | Body `{ event: view\|play, platform?, deviceId? }`. Response `{ counted, reason, stats }` |
| `GET /movies/getAll`, `GET /movies/:id/get` | optional | Har movie mein `stats: { views, plays, viewsLabel, playsLabel }` (`1.5K`, `2.3M`). Naye `sortBy`: `views`, `plays`, `trending` |
| `GET /movies/stats` | sirf admin | Saari movies ki ranking. Filters: range, platform, categoryId, accessType, isActive, search, sortBy, sortOrder, page, limit. `summary` + har movie ka `inRange` aur `allTime` |
| `GET /movies/:id/stats` | sirf admin | Ek movie: `allTime`, `overview` (KPI + pichhla period), `charts.points`, `circles` (viewsByPlatform, playsByPlatform, viewersByType, playersByType). Filters: range, groupBy, platform, compare |
| `GET /movies/:id/viewers` | sirf admin | Range mein har viewer ki row (user ya guest device): views, plays, platforms, last times. Filters: range, platform, viewerType, sortBy, page, limit |
| `GET /dashboard/admin` | sirf admin | Naya: `overview.movieViews` / `moviePlays` (KPI), chart series `movieViews` / `moviePlays`, `content.topMovies` (range ke top 5). `platform` + `categoryId` filter lagta hai, `planId` nahi |

Date filters dashboard wale hi hain (`validator/dashboard.js` ka `rangeKeys` + `resolveRange` ab shared hai). `all_time` pehli `MovieActivity` ke din se.

**`sortBy=trending`:** pichhle 7 din (aaj milake) ke plays, barabar ho to views, phir all-time plays.

## Files

| File | Change |
| --- | --- |
| `constants.js` | `MOVIE_EVENTS`, `MOVIE_VIEWER_TYPES`, `MOVIE_TRACK_SKIP_REASONS`, `MOVIE_STATS_LIMITS` |
| `models/Movie.js` | `stats` field + 2 indexes |
| `models/MovieViewer.js`, `models/MovieActivity.js` | naye |
| `models/validObjectId.js` | `movieField` |
| `services/movies/trackMovie.js` | track logic |
| `services/movies/movieStatsView.js` | public / all-time stats ka shape, `1.5K` labels |
| `services/movies/activityHelpers.js` | range match, unique count wale `$group` / `$project` |
| `services/movies/movieStats.js`, `movieLeaderboard.js`, `movieViewers.js` | 3 admin APIs |
| `services/movies/getAllMovies.js` | `sortBy=views/plays/trending` |
| `services/dashboard/movieActivity.js` + `index.js` | dashboard mein movie views / plays + top movies |
| `validator/movies.js`, `validator/dashboard.js` | naye validators, range shared |
| `controllers/movies/stats.js`, `get.js`, `getAll.js`, `index.js`, `routes/movies.js` | routes + public `stats` |

## Testing

`scratchpad/movie-stats-e2e/run.js` (session scratchpad, repo mein nahi): asli server throwaway DB `iftv_e2e_moviestats` par chalta hai, end mein DB drop. **145/145 pass.** Cover kiya:
- track validation (event, platform, deviceId, unknown key, bad / missing / deleted movie, bad token)
- guest view, 30-min repeat, alag platform par bhi repeat, window ke baad dobara ginti, unique na badhna
- view + play same viewer, admin / staff skip, user vs subscriber type
- paid movie lock (guest, user), subscriber play
- purani movie bina `stats` field
- 8 parallel duplicate requests → 1 ginti; 6 alag guests parallel → 6
- public `stats` shape, labels (`1.5K`, `2.3M`), `sortBy` views / plays / trending + pagination, update se `stats` set nahi hota
- 3 admin APIs: auth (401 / 403), saare filters, sort, pagination, rank, summary, KPI comparison, chart buckets, week groupBy, circles, viewers list, errors
- dashboard: KPIs, chart series, topMovies, category / platform / all_time filters, purane validators
- movie delete hone ke baad leaderboard / dashboard se bahar

## Abhi nahi hai / aage

- Watch-time, progress, completion (user ne abhi mana kiya).
- Rate limit nahi hai: koi har request mein naya `deviceId` bheje to guest views badha sakta hai. Zaroorat ho to IP rate limit add kar sakte hain.
- Tracking 2026-11-03 se shuru; purana koi data nahi hai.
