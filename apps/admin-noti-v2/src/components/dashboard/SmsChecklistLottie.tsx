"use client";

import Lottie from "lottie-react";

import ideaAnimation from "@/components/dashboard/sms-idea-bulb.lottie.json";
import highFiveAnimation from "@/components/dashboard/sms-highfive.lottie.json";
import rejectedAnimation from "@/components/dashboard/sms-rejected-flag.lottie.json";
import reviewAnimation from "@/components/dashboard/sms-review-document.lottie.json";

type SmsChecklistLottieVariant = "idea" | "review" | "done" | "rejected";

type LottieLayer = {
  nm?: string;
  hd?: boolean;
  ks?: {
    o?: {
      k?: number;
    };
  };
  layers?: LottieLayer[];
};

type LottieAsset = {
  layers?: LottieLayer[];
};

type LottieAnimation = {
  layers?: LottieLayer[];
  assets?: LottieAsset[];
};

function hideBackgroundLayers<T extends LottieAnimation>(source: T): T {
  const animation = structuredClone(source);

  const visitLayers = (layers?: LottieLayer[]) => {
    if (!layers) {
      return;
    }

    for (const layer of layers) {
      if (layer.nm === "BG") {
        layer.hd = true;
        if (layer.ks?.o) {
          layer.ks.o.k = 0;
        }
      }

      visitLayers(layer.layers);
    }
  };

  visitLayers(animation.layers);
  for (const asset of animation.assets ?? []) {
    visitLayers(asset.layers);
  }

  return animation;
}

const animationByVariant: Record<SmsChecklistLottieVariant, LottieAnimation> = {
  idea: hideBackgroundLayers(ideaAnimation),
  review: hideBackgroundLayers(reviewAnimation),
  done: hideBackgroundLayers(highFiveAnimation),
  rejected: hideBackgroundLayers(rejectedAnimation),
};

export function SmsChecklistLottie({ variant }: { variant: SmsChecklistLottieVariant }) {
  return (
    <div className="ci-lottie-shell" data-variant={variant} aria-hidden="true">
      <Lottie animationData={animationByVariant[variant]} autoplay loop className="ci-lottie" />
    </div>
  );
}
