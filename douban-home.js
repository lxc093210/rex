WidgetMetadata = {
  id: "lxc093210.douban.home",
  title: "豆瓣个人主页",
  version: "1.0.0",
  requiredVersion: "0.0.1",
  description: "读取个人 Douban Bridge 配置，为 Forward 主页提供豆瓣电影、剧集和综艺目录。",
  author: "lxc093210",
  site: "https://github.com/lxc093210/rex",
  icon: "https://stremio-addon-douban.baran.wang/icon.png",
  modules: buildModules([
    { id: "movie_hot_gaia", type: "movie", title: "豆瓣热门电影" },
    { id: "movie_weekly_best", type: "movie", title: "一周口碑电影榜" },
    { id: "movie_real_time_hotest", type: "movie", title: "实时热门电影" },
    { id: "movie_top250", type: "movie", title: "豆瓣电影 Top250" },
    { id: "movie_showing", type: "movie", title: "影院热映" },
    { id: "__movie_yearly_ranking__", type: "movie", title: "豆瓣年度高分电影" },
    { id: "tv_hot", type: "series", title: "近期热门剧集" },
    { id: "tv_american", type: "series", title: "近期热门美剧" },
    { id: "tv_korean", type: "series", title: "近期热门韩剧" },
    { id: "tv_domestic", type: "series", title: "近期热门国产剧" },
    { id: "tv_japanese", type: "series", title: "近期热门日剧" },
    { id: "show_hot", type: "series", title: "近期热门综艺节目" },
    { id: "tv_documentary", type: "series", title: "近期热门纪录片" },
    { id: "tv_real_time_hotest", type: "series", title: "实时热门电视" },
    { id: "tv_chinese_best_weekly", type: "series", title: "华语口碑剧集榜" },
    { id: "tv_global_best_weekly", type: "series", title: "全球口碑剧集榜" },
    { id: "show_chinese_best_weekly", type: "series", title: "国内口碑综艺榜" },
    { id: "show_global_best_weekly", type: "series", title: "国外口碑综艺榜" },
    { id: "__tv_yearly_ranking__", type: "series", title: "豆瓣年度高分剧集" },
  ]),
};

const BASE_URL = "https://stremio-addon-douban.baran.wang/9f1117ce-6cf3-45b6-840b-b36392f01989";
const PAGE_SIZE = 20;

function buildModules(catalogs) {
  return catalogs.map((catalog) => ({
    id: catalog.id,
    title: catalog.title,
    functionName: "loadDoubanCatalog",
    cacheDuration: 900,
    params: [
      { name: "catalogType", type: "constant", value: catalog.type },
      { name: "catalogId", type: "constant", value: catalog.id },
      { name: "page", title: "页码", type: "page" },
    ],
  }));
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function getTmdbId(item) {
  return toNumber(item && item.tmdbId) || toNumber(String((item && item.tmdb_id) || "").replace(/^tmdb:/, ""));
}

function getDoubanId(item) {
  return String((item && item.id) || "").replace(/^douban:/, "");
}

function mapGenres(genres) {
  return Array.isArray(genres)
    ? genres.map((title) => ({ id: String(title), title: String(title) }))
    : undefined;
}

function mapMeta(item, mediaType) {
  const tmdbId = getTmdbId(item);
  const common = {
    title: item.name,
    posterPath: item.poster,
    backdropPath: item.background,
    description: item.description,
    releaseDate: item.year ? `${item.year}-01-01` : undefined,
    genreItems: mapGenres(item.genres),
  };

  if (tmdbId) {
    return {
      id: tmdbId,
      type: "tmdb",
      mediaType,
      ...common,
    };
  }

  const doubanId = getDoubanId(item);
  return {
    id: `douban:${doubanId}`,
    type: "url",
    link: `douban:${doubanId}`,
    ...common,
  };
}

async function loadDoubanCatalog(params = {}) {
  const catalogType = params.catalogType === "series" ? "series" : "movie";
  const catalogId = String(params.catalogId || "");
  if (!catalogId) throw new Error("缺少豆瓣目录 id");

  const page = Math.max(1, Number(params.page || 1));
  const skip = (page - 1) * PAGE_SIZE;
  const url = `${BASE_URL}/catalog/${catalogType}/${encodeURIComponent(catalogId)}/skip=${skip}.json`;

  try {
    const response = await Widget.http.get(url);
    const body = response && response.data;
    if (!body || !Array.isArray(body.metas)) throw new Error("豆瓣目录响应格式不正确");
    const mediaType = catalogType === "series" ? "tv" : "movie";
    return body.metas.map((item) => mapMeta(item, mediaType));
  } catch (error) {
    console.error(`[douban:${catalogId}] 加载失败:`, error.message || error);
    throw error;
  }
}

async function loadDetail(link) {
  const value = String(link || "");
  if (!value.startsWith("douban:")) return null;

  const encodedId = encodeURIComponent(value);
  for (const type of ["movie", "series"]) {
    try {
      const response = await Widget.http.get(`${BASE_URL}/meta/${type}/${encodedId}.json`);
      const meta = response && response.data && response.data.meta;
      if (meta) {
        return {
          id: value,
          type: "url",
          link: value,
          title: meta.name,
          posterPath: meta.poster,
          backdropPath: meta.background,
          description: meta.description,
          genreItems: mapGenres(meta.genres),
        };
      }
    } catch (error) {
      // Try the other media type; an unknown type is handled below.
    }
  }
  return null;
}

