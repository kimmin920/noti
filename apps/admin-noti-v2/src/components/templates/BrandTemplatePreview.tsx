"use client";

import { useEffect, useRef, useState } from "react";

import type {
  V2BrandTemplateButton,
  V2BrandTemplateCarouselItem,
  V2BrandTemplateCommerce,
  V2BrandTemplateCoupon,
  V2BrandTemplateDetailResponse,
  V2BrandTemplateImage,
  V2BrandTemplateVideo,
  V2BrandTemplateWideItem,
  V2BrandTemplatesResponse,
} from "@/lib/api/v2";

type BrandTemplatePreviewModel =
  | V2BrandTemplateDetailResponse["template"]
  | V2BrandTemplatesResponse["items"][number]
  | {
      ownerLabel: string;
      chatBubbleType:
        | "TEXT"
        | "IMAGE"
        | "WIDE"
        | "WIDE_ITEM_LIST"
        | "PREMIUM_VIDEO"
        | "COMMERCE"
        | "CAROUSEL_FEED"
        | "CAROUSEL_COMMERCE";
      content?: string | null;
      header?: string | null;
      additionalContent?: string | null;
      image?: V2BrandTemplateImage | null;
      buttons?: V2BrandTemplateButton[];
      item?: {
        list: V2BrandTemplateWideItem[];
      } | null;
      coupon?: V2BrandTemplateCoupon | null;
      commerce?: V2BrandTemplateCommerce | null;
      video?: V2BrandTemplateVideo | null;
      carousel?: {
        head?: {
          header?: string | null;
          content?: string | null;
          imageUrl: string;
        } | null;
        list: V2BrandTemplateCarouselItem[];
        tail?: {
          linkMo?: string;
        } | null;
      } | null;
      adult?: boolean | null;
    };

type CarouselPreviewSlide =
  | {
      key: string;
      kind: "head";
      head: NonNullable<NonNullable<BrandTemplatePreviewModel["carousel"]>["head"]>;
    }
  | {
      key: string;
      kind: "item";
      item: V2BrandTemplateCarouselItem;
    };

export function BrandTemplatePreview({
  model,
  compact = false,
}: {
  model: BrandTemplatePreviewModel;
  compact?: boolean;
}) {
  const senderLabel = model.ownerLabel || "@브랜드";

  return (
    <div className={`brand-template-preview-shell${compact ? " compact" : ""}`}>
      <div className="screen_content">
        <div className="biztalk_wrap">
          <span className="identity_avatar" />
          <div className="talk_type">
            <p className="identity_id">
              <b>{senderLabel}</b>
            </p>
            {renderBrandTemplate(model)}
          </div>
        </div>
      </div>
      {model.adult ? <div className="brand-template-adult-chip">성인용 메시지</div> : null}
    </div>
  );
}

function renderBrandTemplate(model: BrandTemplatePreviewModel) {
  const buttons = model.buttons ?? [];
  const coupon = hasCouponContent(model.coupon) ? model.coupon : null;

  switch (model.chatBubbleType) {
    case "TEXT":
      return (
        <StandardBubbleTemplate
          content={model.content}
          image={null}
          buttons={buttons}
          coupon={coupon}
        />
      );
    case "IMAGE":
      return (
        <StandardBubbleTemplate
          content={model.content}
          image={model.image ?? null}
          buttons={buttons}
          coupon={coupon}
          imageVariant="large"
        />
      );
    case "WIDE":
      return (
        <StandardBubbleTemplate
          content={model.content}
          image={model.image ?? null}
          buttons={buttons}
          coupon={coupon}
          imageVariant="large wide"
        />
      );
    case "WIDE_ITEM_LIST":
      return (
        <WideItemListTemplate
          header={model.header}
          items={model.item?.list ?? []}
          buttons={buttons}
          coupon={coupon}
        />
      );
    case "PREMIUM_VIDEO":
      return (
        <PremiumVideoTemplate
          video={model.video ?? null}
          content={model.content}
          buttons={buttons}
        />
      );
    case "COMMERCE":
      return (
        <CommerceTemplate
          image={model.image ?? null}
          commerce={model.commerce ?? null}
          additionalContent={model.additionalContent}
          buttons={buttons}
          coupon={coupon}
        />
      );
    case "CAROUSEL_FEED":
      return <CarouselTemplate kind="feed" carousel={model.carousel ?? null} />;
    case "CAROUSEL_COMMERCE":
      return <CarouselTemplate kind="commerce" carousel={model.carousel ?? null} />;
    default:
      return null;
  }
}

function StandardBubbleTemplate({
  content,
  image,
  buttons,
  coupon,
  imageVariant,
}: {
  content?: string | null;
  image: V2BrandTemplateImage | null;
  buttons: V2BrandTemplateButton[];
  coupon: V2BrandTemplateCoupon | null;
  imageVariant?: string;
}) {
  return (
    <div className="biztalk_area">
      {imageVariant ? <ImageFrame imageUrl={image?.imageUrl || ""} className={imageVariant} /> : null}
      <div className="biztalk_content template_content">
        <div className="pd_8">
          <div className="biztalk_list_box">{content?.trim() || "내용을 입력하면 여기에 표시됩니다."}</div>
        </div>
        <ButtonRows buttons={buttons} layout="stacked" />
        <CouponBox coupon={coupon} />
      </div>
    </div>
  );
}

function WideItemListTemplate({
  header,
  items,
  buttons,
  coupon,
}: {
  header?: string | null;
  items: V2BrandTemplateWideItem[];
  buttons: V2BrandTemplateButton[];
  coupon: V2BrandTemplateCoupon | null;
}) {
  const primary = items[0] ?? null;
  const secondary = items.slice(1, 4);

  return (
    <div className="biztalk_area talk_type1">
      <div className="biztalk_head1">{header?.trim() || "와이드 아이템리스트 헤더"}</div>
      <div className="biztalk_content">
        <a className="biztalk_img_box img_medium">
          {primary?.imageUrl ? <img src={primary.imageUrl} alt="" /> : <div className="biztalk_placeholder">대표 이미지를 추가하면 표시됩니다.</div>}
          <div className="wide-img-title">{primary?.title?.trim() || "대표 아이템 제목"}</div>
        </a>
        <div className="pd_8">
          {secondary.length > 0 ? (
            secondary.map((item, index) => (
              <a className="biztalk_thumb_box" key={`${item.imageUrl}-${index}`}>
                <div className="img">
                  {item.imageUrl ? <img className="img" src={item.imageUrl} alt="" /> : <div className="biztalk_placeholder small" />}
                </div>
                <div className="txt">
                  <p>{item.title?.trim() || `아이템 ${index + 2}`}</p>
                </div>
              </a>
            ))
          ) : (
            <div className="biztalk_empty_note">추가 아이템을 넣으면 여기에 표시됩니다.</div>
          )}
        </div>
        <ButtonRows buttons={buttons} layout="grouped" />
        <CouponBox coupon={coupon} />
      </div>
    </div>
  );
}

function PremiumVideoTemplate({
  video,
  content,
  buttons,
}: {
  video: V2BrandTemplateVideo | null;
  content?: string | null;
  buttons: V2BrandTemplateButton[];
}) {
  return (
    <div className="biztalk_area">
      <a className="biztalk_img_box img_large premium-video-box">
        {video?.thumbnailUrl ? <img src={video.thumbnailUrl} alt="" /> : <div className="biztalk_placeholder">썸네일을 추가하면 표시됩니다.</div>}
        <span className="premium-video-play">▶</span>
      </a>
      <div className="biztalk_content template_content">
        <div className="pd_8">
          <div className="biztalk_list_box">{content?.trim() || "비디오 메시지 내용을 입력하면 여기에 표시됩니다."}</div>
          <p className="premium-video-url">{video?.videoUrl || "Video URL을 입력하면 여기에 표시됩니다."}</p>
        </div>
        <ButtonRows buttons={buttons} layout="stacked" />
      </div>
    </div>
  );
}

function CommerceTemplate({
  image,
  commerce,
  additionalContent,
  buttons,
  coupon,
}: {
  image: V2BrandTemplateImage | null;
  commerce: V2BrandTemplateCommerce | null;
  additionalContent?: string | null;
  buttons: V2BrandTemplateButton[];
  coupon: V2BrandTemplateCoupon | null;
}) {
  return (
    <div className="biztalk_area">
      <ImageFrame imageUrl={image?.imageUrl || ""} className="img_large" />
      <div className="biztalk_content commerce_content">
        <CommerceContent commerce={commerce} />
        {additionalContent?.trim() ? <em className="box_detail_content commerce_additional_copy">{additionalContent.trim()}</em> : null}
        <ButtonRows buttons={buttons} layout="grouped" />
        <CouponBox coupon={coupon} />
      </div>
    </div>
  );
}

function CarouselTemplate({
  kind,
  carousel,
}: {
  kind: "feed" | "commerce";
  carousel: BrandTemplatePreviewModel["carousel"];
}) {
  const slides = buildCarouselSlides(kind, carousel);
  const [activeIndex, setActiveIndex] = useState(0);
  const dragStartXRef = useRef<number | null>(null);
  const dragDeltaXRef = useRef(0);

  useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(slides.length - 1, 0)));
  }, [slides.length]);

  if (slides.length === 0) {
    return <div className="biztalk_empty_note">캐러셀 아이템을 추가하면 여기에 표시됩니다.</div>;
  }

  const slideWidth = kind === "commerce" ? 184 : 178;
  const slideGap = 8;
  const trackOffset = activeIndex * (slideWidth + slideGap);

  const moveToSlide = (nextIndex: number) => {
    setActiveIndex(Math.max(0, Math.min(nextIndex, slides.length - 1)));
  };

  const handlePointerDown = (clientX: number) => {
    dragStartXRef.current = clientX;
    dragDeltaXRef.current = 0;
  };

  const handlePointerMove = (clientX: number) => {
    if (dragStartXRef.current === null) {
      return;
    }
    dragDeltaXRef.current = clientX - dragStartXRef.current;
  };

  const handlePointerEnd = () => {
    if (dragStartXRef.current === null) {
      return;
    }

    if (dragDeltaXRef.current <= -24) {
      moveToSlide(activeIndex + 1);
    } else if (dragDeltaXRef.current >= 24) {
      moveToSlide(activeIndex - 1);
    }

    dragStartXRef.current = null;
    dragDeltaXRef.current = 0;
  };

  return (
    <div className={`carousel-talk carousel-slide ${kind === "commerce" ? "commerce" : "feed"}`}>
      <div className="carousel-inner">
        <div className="slick-slider slick-initialized carousel-slider" style={{ width: "100%" }}>
          <div
            className="slick-list"
            onPointerDown={(event) => handlePointerDown(event.clientX)}
            onPointerMove={(event) => handlePointerMove(event.clientX)}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
            onPointerLeave={handlePointerEnd}
          >
            <div
              className="slick-track"
              style={{
                width: `${slides.length * (slideWidth + slideGap)}px`,
                opacity: 1,
                transform: `translate3d(-${trackOffset}px, 0px, 0px)`,
                gap: `${slideGap}px`,
              }}
            >
              {slides.map((slide, index) => (
                <div
                  key={slide.key}
                  className={`slick-slide${index === activeIndex ? " slick-active slick-current" : ""}${
                    index === activeIndex + 1 ? " slick-peek" : ""
                  }`}
                  style={{ outline: "none", width: `${slideWidth}px` }}
                  tabIndex={-1}
                  aria-hidden={index !== activeIndex && index !== activeIndex + 1}
                  data-index={index}
                >
                  <div>
                    {slide.kind === "head" ? (
                      <div className="talk_type talk_type3 carosel-item">
                        <div className="biztalk_area">
                          <ImageFrame imageUrl={slide.head.imageUrl} className="img_large" />
                          <div className="biztalk_content">
                            <div className="pd_8">
                              <div className="biztalk_list_box">
                                <a className="txt">
                                  <em className="box_detail_content">{slide.head.header?.trim() || "캐러셀 인트로 헤더"}</em>
                                  <p className="box_detail_content">{slide.head.content?.trim() || "캐러셀 인트로 내용을 입력하면 여기에 표시됩니다."}</p>
                                </a>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : kind === "feed" ? (
                      <CarouselFeedCard item={slide.item} index={index} />
                    ) : (
                      <CarouselCommerceCard item={slide.item} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <ul className="slick-dots custom-dot-class">
            {slides.map((slide, index) => (
              <li className={index === activeIndex ? "slick-active" : ""} key={`dot-${slide.key}`}>
                <button
                  type="button"
                  aria-label={`${index + 1}번 슬라이드 보기`}
                  onClick={() => moveToSlide(index)}
                >
                  {index + 1}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function CarouselFeedCard({
  item,
  index,
}: {
  item: V2BrandTemplateCarouselItem;
  index: number;
}) {
  return (
    <div className="talk_type talk_type3 carosel-item">
      <div className="biztalk_area">
        <ImageFrame imageUrl={item.imageUrl || ""} className="img_large" />
        <div className="biztalk_content">
          <div className="pd_8">
            <div className="biztalk_list_box">
              <a className="txt">
                <em className="box_detail_content">{item.header?.trim() || `Carousel ${index + 1}`}</em>
                <p className="box_detail_content">{item.message?.trim() || "메시지를 입력하면 여기에 표시됩니다."}</p>
              </a>
            </div>
          </div>
          <ButtonRows buttons={item.buttons ?? []} layout="grouped" />
          <CouponBox coupon={hasCouponContent(item.coupon) ? item.coupon : null} />
        </div>
      </div>
    </div>
  );
}

function CarouselCommerceCard({
  item,
}: {
  item: V2BrandTemplateCarouselItem;
}) {
  return (
    <div className="talk_type talk_type3 carosel-item">
      <div className="biztalk_area">
        <ImageFrame imageUrl={item.imageUrl || ""} className="img_large" />
        <div className="biztalk_content commerce_content">
          <CommerceContent commerce={item.commerce ?? null} />
          {item.additionalContent?.trim() ? <em className="box_detail_content commerce_additional_copy">{item.additionalContent.trim()}</em> : null}
          <ButtonRows buttons={item.buttons ?? []} layout="grouped" />
          <CouponBox coupon={hasCouponContent(item.coupon) ? item.coupon : null} />
        </div>
      </div>
    </div>
  );
}

function ImageFrame({
  imageUrl,
  className,
}: {
  imageUrl: string;
  className: string;
}) {
  return (
    <a className={`biztalk_img_box ${className}`}>
      {imageUrl ? <img src={imageUrl} alt="" /> : <div className="biztalk_placeholder">이미지를 업로드하면 표시됩니다.</div>}
    </a>
  );
}

function ButtonRows({
  buttons,
  layout,
}: {
  buttons: V2BrandTemplateButton[];
  layout: "stacked" | "grouped";
}) {
  if (buttons.length === 0) {
    return null;
  }

  if (layout === "stacked") {
    return (
      <>
        {buttons.map((button, index) => (
          <div className="biztalk_btn_box" key={`${button.name}-${index}`}>
            <a className="btn">{button.name || button.type}</a>
          </div>
        ))}
      </>
    );
  }

  const widthClass = buttons.length === 1 ? "btn1" : "btn2";

  return (
    <div className="biztalk_btn_box">
      {buttons.map((button, index) => (
        <a className={`btn ${widthClass}`} key={`${button.name}-${index}`}>
          {button.name || button.type}
        </a>
      ))}
    </div>
  );
}

function CouponBox({ coupon }: { coupon: V2BrandTemplateCoupon | null }) {
  if (!coupon) {
    return null;
  }

  return (
    <div className="pd_8">
      <a className="biztalk_coupon_box">
        <span className="btn">
          <em>{coupon.title}</em>
          <span>{coupon.description || "쿠폰 설명"}</span>
        </span>
      </a>
    </div>
  );
}

function CommerceContent({ commerce }: { commerce: V2BrandTemplateCommerce | null }) {
  if (!commerce) {
    return (
      <div className="commerce_price_block">
        <div>
          <h5>커머스 타이틀</h5>
        </div>
        <div className="commerce_price_line">
          <h4 className="main-price">가격 정보</h4>
        </div>
      </div>
    );
  }

  return (
    <div className="commerce_price_block">
      <div>
        <h5>{commerce.title || "커머스 타이틀"}</h5>
      </div>
      {commerce.discountPrice ? (
        <div className="commerce_price_line">
          <div className="main-price">{formatPriceWithSuffix(commerce.discountPrice)}</div>
          {commerce.regularPrice ? <span className="origin-price">{formatPriceWithSuffix(commerce.regularPrice)}</span> : null}
          {commerce.discountRate ? <span className="discount-info">{commerce.discountRate}%</span> : null}
          {!commerce.discountRate && commerce.discountFixed ? (
            <span className="discount-info">{formatPriceWithSuffix(commerce.discountFixed)}↓</span>
          ) : null}
        </div>
      ) : commerce.regularPrice ? (
        <div className="commerce_price_line">
          <h4 className="main-price">{formatPriceWithSuffix(commerce.regularPrice)}</h4>
        </div>
      ) : (
        <div className="commerce_price_line">
          <h4 className="main-price">가격 정보</h4>
        </div>
      )}
    </div>
  );
}

function buildCarouselSlides(
  kind: "feed" | "commerce",
  carousel: BrandTemplatePreviewModel["carousel"],
): CarouselPreviewSlide[] {
  if (!carousel) {
    return [];
  }

  const slides: CarouselPreviewSlide[] = [];

  if (kind === "feed" && carousel.head?.imageUrl) {
    slides.push({
      key: `head-${carousel.head.imageUrl}`,
      kind: "head",
      head: carousel.head,
    });
  }

  for (const [index, item] of (carousel.list ?? []).entries()) {
    slides.push({
      key: `item-${item.imageUrl || index}`,
      kind: "item",
      item,
    });
  }

  return slides;
}

function hasCouponContent(coupon: V2BrandTemplateCoupon | null | undefined): coupon is V2BrandTemplateCoupon {
  return Boolean(coupon && (coupon.title?.trim() || coupon.description?.trim()));
}

function formatPriceWithSuffix(value: number) {
  return `${new Intl.NumberFormat("ko-KR").format(value)}원`;
}
