export type VirtualTourProvider =
  | "matterport"
  | "kuula"
  | "cloudpano"
  | "panorama"
  | "other";

export type NormalizedVirtualTour = {
  provider: VirtualTourProvider;
  tourUrl: string;
  embedUrl: string;
  sourceType: "external" | "panorama";
  previewImageUrl?: string | null;
  roomLabel?: string | null;
  position?: number;
};

export function normalizeVirtualTourUrl(
  value?: string | null
): NormalizedVirtualTour | null {
  const rawUrl = value?.trim();
  if (!rawUrl) return null;

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  if (!["https:", "http:"].includes(url.protocol)) return null;

  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  let provider: VirtualTourProvider = "other";

  if (host.includes("matterport.com")) {
    provider = "matterport";
  } else if (host.includes("kuula.co")) {
    provider = "kuula";
  } else if (host.includes("cloudpano.com")) {
    provider = "cloudpano";
  }

  return {
    provider,
    tourUrl: url.toString(),
    embedUrl: url.toString(),
    sourceType: "external",
  } satisfies NormalizedVirtualTour;
}

export function normalizePanoramaVirtualTourUrl(
  value?: string | null
): NormalizedVirtualTour | null {
  const rawUrl = value?.trim();
  if (!rawUrl) return null;

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  if (!["https:", "http:"].includes(url.protocol)) return null;

  return {
    provider: "panorama",
    tourUrl: url.toString(),
    embedUrl: url.toString(),
    sourceType: "panorama",
    previewImageUrl: url.toString(),
  } satisfies NormalizedVirtualTour;
}

export const virtualTourProviderLabels: Record<VirtualTourProvider, string> = {
  matterport: "Matterport",
  kuula: "Kuula",
  cloudpano: "CloudPano",
  panorama: "Panorama 360",
  other: "Visite virtuelle",
};
