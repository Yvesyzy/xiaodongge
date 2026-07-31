import { InputError } from "./entry";
import { getAllEntries } from "./stats";
import { buildAbstractMusicMap, type VisualizationFilters } from "../../shared/visualizations";

export async function getAbstractMusicMapFromParams(searchParams: URLSearchParams) {
  return buildAbstractMusicMap(await getAllEntries(), readVisualizationFilters(searchParams, { month: true }));
}

function readVisualizationFilters(searchParams: URLSearchParams, options: { month?: boolean; rating?: boolean }): VisualizationFilters {
  return {
    year: readNumberParam(searchParams, "year"),
    month: options.month ? readNumberParam(searchParams, "month") : null,
    artistName: searchParams.get("artistName") ?? searchParams.get("artist"),
    albumName: searchParams.get("albumName") ?? searchParams.get("album_id"),
    mood: searchParams.get("mood"),
    minRating: options.rating ? readNumberParam(searchParams, "min_rating") : null,
    maxRating: options.rating ? readNumberParam(searchParams, "max_rating") : null,
  };
}

function readNumberParam(searchParams: URLSearchParams, key: string) {
  const value = searchParams.get(key);
  if (!value) return null;
  const number = Number(value);
  if (!Number.isFinite(number)) throw new InputError(`${key} 必须是数字`);
  return number;
}
