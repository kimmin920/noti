import { redirect } from "next/navigation";
import { buildResourcesKakaoConnectPath } from "@/lib/routes";

export default async function KakaoConnectRoutePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  redirect(appendPreviewQuery(buildResourcesKakaoConnectPath(), resolvedSearchParams));
}

function appendPreviewQuery(path: string, searchParams: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams();
  const dev = firstSearchParam(searchParams.dev);
  if (dev === "1") {
    params.set("dev", "1");
  }

  const query = params.toString();
  if (!query) {
    return path;
  }

  return `${path}${path.includes("?") ? "&" : "?"}${query}`;
}

function firstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
