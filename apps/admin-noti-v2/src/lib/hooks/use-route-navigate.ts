"use client";

import { usePathname, useRouter } from "next/navigation";
import { getPageIdByPath, getRouteByPageId } from "@/lib/routes";
import { useAppStore } from "@/lib/store/app-store";
import type { PageId } from "@/lib/store/types";

export function useRouteNavigate() {
  const router = useRouter();
  const pathname = usePathname();
  const navigateState = useAppStore((state) => state.navigate);
  const startNavigationPending = useAppStore((state) => state.startNavigationPending);

  return (page: PageId) => {
    const currentPage = pathname ? getPageIdByPath(pathname) : null;
    if (currentPage === page) {
      return;
    }

    navigateState(page, pathname ? getPageIdByPath(pathname) : null);
    startNavigationPending(page);
    router.push(getRouteByPageId(page).path);
  };
}
