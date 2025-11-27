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

  PRODUCT_TYPES: Object.freeze({
    GROCERY: "grocery",
    ELECTRONICS: "electronics",
    CLOTHING: "clothing",
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
};
