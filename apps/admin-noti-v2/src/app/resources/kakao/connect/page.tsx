import { redirect } from "next/navigation";
import { buildResourcesKakaoConnectPath } from "@/lib/routes";

export default async function KakaoConnectRoutePage() {
  redirect(buildResourcesKakaoConnectPath());
}
