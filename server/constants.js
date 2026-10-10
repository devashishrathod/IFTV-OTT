module.exports = {
  ROLES: Object.freeze({
    ADMIN: "admin",
    STAFF: "staff",
    USER: "user",
  }),

  LOGIN_TYPES: Object.freeze({
    EMAIL: "email",
    MOBILE: "mobile",
    GOOGLE: "google",
    PASSWORD: "password",
    OTHER: "other",
  }),

  PLATFORMS: Object.freeze({
    WEB: "web",
    ANDROID: "android",
    IOS: "ios",
  }),

  SUBSCRIPTION_TYPES: Object.freeze({
    WEEKLY: "weekly",
    MONTHLY: "monthly",
    QUATERLY: "quarterly",
    HALF_YEARLY: "half_yearly",
    YEARLY: "yearly",
  }),

  DURATION_MAP: Object.freeze({
    weekly: 7,
    monthly: 30,
    quarterly: 90,
    half_yearly: 180,
    yearly: 365,
  }),

  SUBSCRIPTION_PLANS: Object.freeze({
    FREE: "free",
    BASIC: "basic",
    PREMIUM: "premium",
    Family: "family",
  }),

  ZIP_CODE_REGEX_MAP: Object.freeze({
    IN: /^[1-9][0-9]{5}$/, // India (6 digits)
    US: /^\d{5}(-\d{4})?$/, // USA (ZIP or ZIP+4)
    CA: /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/, // Canada (A1A 1A1)
    UK: /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i, // United Kingdom (SW1A 1AA)
    AU: /^\d{4}$/, // Australia (4 digits)
    DE: /^\d{5}$/, // Germany
    FR: /^\d{5}$/, // France
    IT: /^\d{5}$/, // Italy
    ES: /^\d{5}$/, // Spain
    BR: /^\d{5}-?\d{3}$/, // Brazil (12345-678 or 12345678)
    RU: /^\d{6}$/, // Russia
  }),

  COUNTRY_NAME_TO_ISO: Object.freeze({
    india: "IN",
    unitedstates: "US",
    usa: "US",
    canada: "CA",
    uk: "UK",
    unitedkingdom: "UK",
    australia: "AU",
    germany: "DE",
    france: "FR",
    italy: "IT",
    spain: "ES",
    brazil: "BR",
    russia: "RU",
  }),

  DEFAULT_IMAGES: Object.freeze({
    CATEGORY:
      "https://callwave.com/wp-content/uploads/2023/11/image-166-1024x523.png",
    MOVIE:
      "https://cdn.prod.website-files.com/619cb1d12095e3f3cdddaeb2/68483b208c04ea886b01c757_Best%20OTT%20Platforms%20for%20Movie%20Buffs.png",
    // BANNER: "",
  }),

  UPLOAD_LIMITS: Object.freeze({
    // Max size for files sent through the server (multipart). GB movies should
    // use the Cloudflare direct upload flow instead of this.
    MAX_FILE_SIZE_MB: Number(process.env.MAX_UPLOAD_SIZE_MB) || 2048,
    // Max time to receive a full request body (large multipart uploads).
    REQUEST_TIMEOUT_MS:
      Number(process.env.REQUEST_TIMEOUT_MINUTES || 60) * 60 * 1000,
  }),

  ALLOWED_VIDEO_EXTENSIONS: Object.freeze([
    ".mp4",
    ".mov",
    ".mkv",
    ".webm",
    ".avi",
    ".m4v",
    ".mpeg",
    ".mpg",
    ".flv",
    ".wmv",
    ".3gp",
  ]),

  ALLOWED_IMAGE_EXTENSIONS: Object.freeze([
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".gif",
  ]),

  // Cloudflare Stream: max duration reserved per direct upload (6h is CF max).
  STREAM_MAX_DURATION_SECONDS: 21600,

  SUPPORT_SOURCES: Object.freeze({
    TICKET: "ticket",
    CONTACT_US: "contact_us",
  }),

  SUPPORT_CATEGORIES: Object.freeze({
    PAYMENT: "payment",
    SUBSCRIPTION: "subscription",
    PLAYBACK: "playback",
    ACCOUNT: "account",
    CONTENT_REQUEST: "content_request",
    FEEDBACK: "feedback",
    OTHER: "other",
  }),

  SUPPORT_STATUSES: Object.freeze({
    OPEN: "open",
    IN_PROGRESS: "in_progress",
    RESOLVED: "resolved",
    CLOSED: "closed",
  }),

  SUPPORT_PRIORITIES: Object.freeze({
    LOW: "low",
    MEDIUM: "medium",
    HIGH: "high",
  }),

  SUPPORT_LIMITS: Object.freeze({
    MAX_ATTACHMENTS: 3,
    MAX_ATTACHMENT_SIZE_MB: 5,
    ALLOWED_ATTACHMENT_EXTENSIONS: Object.freeze([
      ".jpg",
      ".jpeg",
      ".png",
      ".webp",
    ]),
    ALLOWED_ATTACHMENT_MIME_TYPES: Object.freeze([
      "image/jpeg",
      "image/png",
      "image/webp",
    ]),
    MAX_SUBJECT_LENGTH: 150,
    MAX_MESSAGE_LENGTH: 2000,
    MAX_OPEN_TICKETS_PER_USER: 5,
    MAX_CONTACT_US_PER_EMAIL_PER_DAY: 3,
  }),

  // One subscription period a user holds (models/UserSubscription.js)
  USER_SUBSCRIPTION_STATUSES: Object.freeze({
    ACTIVE: "active",
    SCHEDULED: "scheduled",
    EXPIRED: "expired",
    UPGRADED: "upgraded",
    CANCELLED: "cancelled",
  }),

  SUBSCRIPTION_SOURCES: Object.freeze({
    PURCHASE: "purchase",
    RENEWAL: "renewal",
    UPGRADE: "upgrade",
    ADMIN_GRANT: "admin_grant",
  }),

  PAYMENT_PURPOSES: Object.freeze({
    NEW: "new",
    RENEWAL: "renewal",
    UPGRADE: "upgrade",
  }),

  PAYMENT_STATUSES: Object.freeze({
    CREATED: "created",
    PAID: "paid",
    FAILED: "failed",
    EXPIRED: "expired",
  }),

  PAYMENT_PROVIDERS: Object.freeze({
    RAZORPAY: "razorpay",
  }),

  PAYMENT_LIMITS: Object.freeze({
    CURRENCY: "INR",
    // Razorpay does not accept orders below ₹1
    MIN_AMOUNT_PAISE: 100,
    ORDER_EXPIRY_MINUTES: 30,
    MAX_FAILURE_REASON_LENGTH: 500,
  }),

  SUBSCRIPTION_LIMITS: Object.freeze({
    MAX_SCHEDULED: 1,
    // Expiry reminder mails, days before the plan ends
    REMINDER_DAYS: Object.freeze([3, 1]),
    MAX_GRANT_DAYS: 3650,
    MAX_NOTE_LENGTH: 500,
    MAX_PLAN_LINKS_PER_MOVIE: 50,
  }),

  MOVIE_ACCESS_TYPES: Object.freeze({
    FREE: "free",
    PAID: "paid",
  }),

  MOVIE_LOCK_REASONS: Object.freeze({
    LOGIN_REQUIRED: "login_required",
    SUBSCRIPTION_REQUIRED: "subscription_required",
    PLAN_NOT_INCLUDED: "plan_not_included",
  }),

  GALLERY_MEDIA_TYPES: Object.freeze({
    IMAGE: "image",
    GIF: "gif",
    VIDEO: "video",
  }),

  GALLERY_LIMITS: Object.freeze({
    MAX_TITLE_LENGTH: 150,
    MAX_DESCRIPTION_LENGTH: 1000,
    MAX_TAGS: 10,
    MAX_TAG_LENGTH: 30,
    // Cloudflare Images rejects files above 10 MB
    MAX_IMAGE_SIZE_MB: 10,
    MAX_BULK_FILES: 10,
    MAX_REORDER_ITEMS: 100,
    DEFAULT_PAGE_LIMIT: 20,
    MAX_PAGE_LIMIT: 50,
    MAX_ADMIN_PAGE_LIMIT: 100,
  }),
};
