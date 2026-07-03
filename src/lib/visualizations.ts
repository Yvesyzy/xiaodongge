import { InputError } from "./entry";
import { getAllEntries } from "./stats";
import { buildAbstractMusicMap, buildEmotionUniverse, UNIVERSE_GROUP_BY_OPTIONS, type UniverseGroupBy, type VisualizationFilters } from "../../shared/visualizations";

export async function getAbstractMusicMapFromParams(searchParams: URLSearchParams) {
  return buildAbstractMusicMap(await getAllEntries(), readVisualizationFilters(searchParams, { month: true }));
}

export async function getEmotionUniverseFromParams(searchParams: URLSearchParams) {
  return buildEmotionUniverse(await getAllEntries(), readVisualizationFilters(searchParams, { rating: true, group: true }));
}

function readVisualizationFilters(searchParams: URLSearchParams, options: { month?: boolean; rating?: boolean; group?: boolean }): VisualizationFilters {
  const groupBy = options.group ? readGroupBy(searchParams.get("group_by")) : undefined;
  return {
    year: readNumberParam(searchParams, "year"),
    month: options.month ? readNumberParam(searchParams, "month") : null,
    artistName: searchParams.get("artistName") ?? searchParams.get("artist"),
    albumName: searchParams.get("albumName") ?? searchParams.get("album_id"),
    mood: searchParams.get("mood"),
    minRating: options.rating ? readNumberParam(searchParams, "min_rating") : null,
    maxRating: options.rating ? readNumberParam(searchParams, "max_rating") : null,
    groupBy,
  };
}

function readNumberParam(searchParams: URLSearchParams, key: string) {
  const value = searchParams.get(key);
  if (!value) return null;
  const number = Number(value);
  if (!Number.isFinite(number)) throw new InputError(`${key} 必须是数字`);
  return number;
}

function readGroupBy(value: string | null): UniverseGroupBy {
  if (!value) return "year";
  if (UNIVERSE_GROUP_BY_OPTIONS.includes(value as UniverseGroupBy)) return value as UniverseGroupBy;
  throw new InputError("group_by 必须是 year / artist / album / mood");
}
