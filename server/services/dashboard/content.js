const Movie = require("../../models/Movie");
const Category = require("../../models/Category");
const SubCategory = require("../../models/SubCategory");
const Banner = require("../../models/Banner");
const GalleryItem = require("../../models/GalleryItem");
const Subscription = require("../../models/Subscription");
const {
  MOVIE_ACCESS_TYPES,
  GALLERY_MEDIA_TYPES,
  DASHBOARD_LIMITS,
} = require("../../constants");
const { toCircle, toCounts, first, sumBy } = require("./helpers");

const isActive = { $ne: ["$isActive", false] };
const countIf = (cond) => ({ $sum: { $cond: [cond, 1, 0] } });
const totalsGroup = { _id: null, total: { $sum: 1 }, active: countIf(isActive) };

const activeCounts = async (Model) => {
  const [row] = await Model.aggregate([{ $match: { isDeleted: false } }, { $group: totalsGroup }]);
  return { total: row?.total || 0, active: row?.active || 0 };
};

// Top languages by movie count; the rest are summed into "other"
const topLanguages = (rows) => {
  const top = rows.slice(0, DASHBOARD_LIMITS.TOP_LANGUAGES);
  const rest = rows.slice(DASHBOARD_LIMITS.TOP_LANGUAGES);
  if (rest.length) top.push({ _id: "other", label: "Other", count: sumBy(rest, "count") });
  return toCircle(top, { labelOf: (row) => row.label || row._id });
};

/**
 * What is in the catalog today (snapshot, no date range). categoryId narrows
 * the movie numbers.
 */
exports.contentSection = async ({ filters }) => {
  const [[movies], [gallery], categories, subCategories, banners, plans] = await Promise.all([
    Movie.aggregate([
      { $match: filters.movieMatch },
      {
        $facet: {
          totals: [
            {
              $group: {
                ...totalsGroup,
                // Movies saved before accessType existed count as free
                paid: countIf({ $eq: ["$accessType", MOVIE_ACCESS_TYPES.PAID] }),
                withoutVideo: countIf({ $in: [{ $ifNull: ["$video", ""] }, [""]] }),
              },
            },
          ],
          byCategory: [
            { $group: { _id: "$categoryId", count: { $sum: 1 } } },
            {
              $lookup: {
                from: Category.collection.name,
                localField: "_id",
                foreignField: "_id",
                pipeline: [{ $project: { name: 1 } }],
                as: "category",
              },
            },
          ],
          byLanguage: [
            { $unwind: "$languages" },
            { $group: { _id: "$languages", count: { $sum: 1 } } },
            { $sort: { count: -1, _id: 1 } },
          ],
        },
      },
    ]),
    GalleryItem.aggregate([
      { $match: { isDeleted: false } },
      {
        $facet: {
          totals: [{ $group: totalsGroup }],
          byMediaType: [{ $group: { _id: "$mediaType", count: { $sum: 1 } } }],
        },
      },
    ]),
    activeCounts(Category),
    activeCounts(SubCategory),
    activeCounts(Banner),
    activeCounts(Subscription),
  ]);

  const movieTotals = first(movies.totals);
  const total = movieTotals.total || 0;
  const paid = movieTotals.paid || 0;
  const galleryTotals = first(gallery.totals);
  const mediaCounts = toCounts(Object.values(GALLERY_MEDIA_TYPES), gallery.byMediaType);

  return {
    kpis: { totalMovies: total },
    section: {
      movies: {
        total,
        active: movieTotals.active || 0,
        inactive: total - (movieTotals.active || 0),
        free: total - paid,
        paid,
        withoutVideo: movieTotals.withoutVideo || 0,
      },
      categories,
      subCategories,
      banners,
      gallery: {
        total: galleryTotals.total || 0,
        active: galleryTotals.active || 0,
        ...mediaCounts,
      },
      plans,
    },
    circles: {
      moviesByAccessType: toCircle(
        [
          { _id: MOVIE_ACCESS_TYPES.FREE, count: total - paid },
          { _id: MOVIE_ACCESS_TYPES.PAID, count: paid },
        ],
        { keys: Object.values(MOVIE_ACCESS_TYPES) }
      ),
      moviesByCategory: toCircle(movies.byCategory, {
        labelOf: (row) => row.category?.[0]?.name || "Uncategorized",
      }),
      moviesByLanguage: topLanguages(movies.byLanguage),
      galleryByMediaType: toCircle(gallery.byMediaType, {
        keys: Object.values(GALLERY_MEDIA_TYPES),
      }),
    },
  };
};
