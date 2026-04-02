import type { ReactNode } from "react";
import { AppIcon } from "@/components/icons/AppIcon";
import type { ResourceState } from "../store/types";

/* eslint-disable @next/next/no-img-element */

type StoryContent = {
  lines: ReactNode[];
};

type StoryLinkProps = {
  label: string;
  onClick: () => void;
};

type NoticeItem = {
  tone: "notice" | "update" | "info";
  title: string;
  desc: string;
  time: string;
  icon: "warn" | "check";
};

function StoryLink({ label, onClick }: StoryLinkProps) {
  return (
    <a
      href="#"
      className="dashboard-story-inline-link"
      onClick={(event) => {
        event.preventDefault();
        onClick();
      }}
    >
      {label}
      <AppIcon name="external" className="icon icon-12" />
    </a>
  );
}

function StoryAvatar() {
  return (
    <span className="dashboard-story-avatar">
      <img src="/assets/minu-face.png" alt="민우 아바타" />
    </span>
  );
}

function MessageIcons() {
  return (
    <span className="dashboard-story-inline-icons" aria-hidden="true">
      <span className="dashboard-story-icon-badge">
        <img src="/assets/sms.png" alt="" />
      </span>
      <span className="dashboard-story-icon-badge">
        <img src="/assets/kakao-talk.png" alt="" />
      </span>
    </span>
  );
}

function KakaoMark() {
  return (
    <img
      src="/assets/kakao-talk.png"
      alt=""
      aria-hidden="true"
      className="dashboard-story-inline-mark"
    />
  );
}

function CalendarMark() {
  return (
    <span className="dashboard-story-calendar" aria-hidden="true">
      <span className="dashboard-story-calendar-top">MAR</span>
      <span className="dashboard-story-calendar-date">27</span>
    </span>
  );
}

export function getNoticeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "좋은 아침이에요, 김관리자님";
  if (hour < 18) return "좋은 오후예요, 김관리자님";
  return "좋은 저녁이에요, 김관리자님";
}

export function getNoticeItems(resources: ResourceState): NoticeItem[] {
  const items: NoticeItem[] = [];

  if (resources.sms === "none") {
    items.push({
      tone: "notice",
      icon: "warn",
      time: "SMS",
      title: "발신번호 등록이 아직 안 되어 있어요",
      desc: "발신번호만 등록하면 바로 문자 발송을 시작할 수 있어요. 먼저 번호부터 연결해볼까요?",
    });
  } else if (resources.sms === "pending") {
    items.push({
      tone: "update",
      icon: "check",
      time: "SMS",
      title: "발신번호 서류가 잘 접수되었어요",
      desc: "지금은 검토만 기다리면 돼요. 심사가 끝나면 문자 발송이 자동으로 열립니다.",
    });
  } else if (resources.sms === "rejected") {
    items.push({
      tone: "notice",
      icon: "warn",
      time: "SMS",
      title: "발신번호 신청이 거절되었어요",
      desc: "거절 사유를 확인하고 필요한 서류를 보완해 다시 신청해 주세요.",
    });
  } else {
    items.push({
      tone: "info",
      icon: "check",
      time: "SMS",
      title: "발신번호 심사가 끝났어요",
      desc: "이제 문자 발송 준비가 끝났습니다. 첫 메시지를 바로 보내보셔도 좋아요.",
    });
  }

  if (resources.kakao === "none") {
    items.push({
      tone: "notice",
      icon: "warn",
      time: "KAKAO",
      title: "카카오 채널이 아직 연결되지 않았어요",
      desc: "채널만 연결해두면 알림톡 발송도 바로 시작할 수 있어요. 문자와 함께 준비해둘까요?",
    });
  } else {
    items.push({
      tone: "info",
      icon: "check",
      time: "KAKAO",
      title: "카카오 채널 연결도 끝났어요",
      desc: "이제 알림톡 발송이 가능한 상태예요. 승인된 템플릿만 고르면 바로 보낼 수 있습니다.",
    });
  }

  return items;
}

export function getSidebarStoryContent(
  resources: ResourceState,
  onGoResources: () => void,
) {
  const smsActionLead =
    resources.sms === "none" ? null : resources.sms === "pending" ? (
      <span className="dashboard-story-dot" />
    ) : resources.sms === "rejected" ? (
      <span className="dashboard-story-dot" />
    ) : (
      <span className="dashboard-story-dot success" />
    );

  const scheduledLine =
    resources.scheduled === "active" ? (
      <>
        <CalendarMark /> <span className="dashboard-story-mid">예약 메시지가</span>{" "}
        <span className="dashboard-story-strong">3월 27일</span>{" "}
        <span className="dashboard-story-mid">에 기다리고 있어요.</span>
      </>
    ) : null;

  if (resources.sms === "rejected") {
    return {
      lines: [
        <>
          좋은 하루예요, <StoryAvatar />{" "}
          <span className="dashboard-story-strong">김관리자님</span>
        </>,
        <>
          발신번호 신청이 <span className="dashboard-story-dot" />{" "}
          <span className="dashboard-story-strong">거절</span>{" "}
          <span className="dashboard-story-mid">되었어요.</span>
        </>,
        <>
          <span className="dashboard-story-mid">거절 사유를 확인하고</span>{" "}
          <StoryLink label="다시 신청" onClick={onGoResources} />{" "}
          <span className="dashboard-story-mid">하면 됩니다.</span>
        </>,
        ...(scheduledLine ? [scheduledLine] : []),
      ],
    } satisfies StoryContent;
  }

  if (resources.sms === "none" && resources.kakao === "none") {
    return {
      lines: [
        <>
          좋은 하루예요, <StoryAvatar />{" "}
          <span className="dashboard-story-strong">김관리자님</span>
        </>,
        <>
          지금은 {smsActionLead}{" "}
          <StoryLink label="발신번호 등록" onClick={onGoResources} />{" "}
          <span className="dashboard-story-mid">과</span>
        </>,
        <>
          <StoryLink label="카카오채널 연결" onClick={onGoResources} />{" "}
          <span className="dashboard-story-mid">이 필요해요.</span>
        </>,
        <>
          <span className="dashboard-story-strong">두 가지만 끝내면</span>{" "}
          <span className="dashboard-story-mid">바로</span> <MessageIcons />
          <span className="dashboard-story-mid">메시지를 보낼 수 있어요.</span>
        </>,
        ...(scheduledLine ? [scheduledLine] : []),
      ],
    } satisfies StoryContent;
  }

  if (resources.sms === "pending" && resources.kakao === "none") {
    return {
      lines: [
        <>
          좋은 하루예요, <StoryAvatar />{" "}
          <span className="dashboard-story-strong">김관리자님</span>
        </>,
        <>
          발신번호 서류는 <span className="dashboard-story-dot" />{" "}
          <span className="dashboard-story-strong">검토 중</span>{" "}
          <span className="dashboard-story-mid">이에요.</span>
        </>,
        <>
          <span className="dashboard-story-mid">이 사이에</span>{" "}
          <StoryLink label="카카오채널 연결" onClick={onGoResources} />{" "}
          <span className="dashboard-story-mid">을 해두면</span>
        </>,
        <>
          <KakaoMark /> <span className="dashboard-story-strong">알림톡부터 먼저</span>{" "}
          <span className="dashboard-story-mid">준비할 수 있어요.</span>
        </>,
        ...(scheduledLine ? [scheduledLine] : []),
      ],
    } satisfies StoryContent;
  }

  if (resources.sms === "active" && resources.kakao === "none") {
    return {
      lines: [
        <>
          좋은 하루예요, <StoryAvatar />{" "}
          <span className="dashboard-story-strong">김관리자님</span>
        </>,
        <>
          이제 <span className="dashboard-story-dot success" />{" "}
          <span className="dashboard-story-strong">SMS 발송 준비</span>{" "}
          <span className="dashboard-story-mid">는 끝났고,</span>
        </>,
        <>
          <span className="dashboard-story-mid">남은 건</span>{" "}
          <StoryLink label="카카오채널 연결" onClick={onGoResources} />{" "}
          <span className="dashboard-story-mid">이에요.</span>
        </>,
        <>
          <KakaoMark /> <span className="dashboard-story-strong">문자부터 시작</span>{" "}
          <span className="dashboard-story-mid">하거나 채널 연결을 이어갈 수 있어요.</span>
        </>,
        ...(scheduledLine ? [scheduledLine] : []),
      ],
    } satisfies StoryContent;
  }

  if (resources.sms === "none" && resources.kakao === "active") {
    return {
      lines: [
        <>
          좋은 하루예요, <StoryAvatar />{" "}
          <span className="dashboard-story-strong">김관리자님</span>
        </>,
        <>
          지금은 <span className="dashboard-story-strong">카카오채널 연결</span>{" "}
          <span className="dashboard-story-mid">이 끝나 있어요.</span>
        </>,
        <>
          <span className="dashboard-story-mid">다음으로</span>{" "}
          <StoryLink label="발신번호 등록" onClick={onGoResources} />{" "}
          <span className="dashboard-story-mid">만 마치면</span>
        </>,
        <>
          <KakaoMark /> <span className="dashboard-story-strong">문자와 알림톡을</span>{" "}
          <span className="dashboard-story-mid">함께 운영할 수 있어요.</span>
        </>,
        ...(scheduledLine ? [scheduledLine] : []),
      ],
    } satisfies StoryContent;
  }

  if (resources.sms === "pending" && resources.kakao === "active") {
    return {
      lines: [
        <>
          좋은 하루예요, <StoryAvatar />{" "}
          <span className="dashboard-story-strong">김관리자님</span>
        </>,
        <>
          지금은 <span className="dashboard-story-strong">알림톡 준비</span>{" "}
          <span className="dashboard-story-mid">가 끝나 있고,</span>
        </>,
        <>
          <span className="dashboard-story-dot" />{" "}
          <span className="dashboard-story-strong">발신번호 심사</span>{" "}
          <span className="dashboard-story-mid">만 남아 있어요.</span>
        </>,
        <>
          <KakaoMark /> <span className="dashboard-story-strong">그동안 템플릿을 먼저</span>{" "}
          <span className="dashboard-story-mid">정리해두면 바로 시작할 수 있어요.</span>
        </>,
        ...(scheduledLine ? [scheduledLine] : []),
      ],
    } satisfies StoryContent;
  }

  return {
    lines: [
      <>
        좋은 하루예요, <StoryAvatar />{" "}
        <span className="dashboard-story-strong">김관리자님</span>
      </>,
      <>
        오늘은 <span className="dashboard-story-dot success" />{" "}
        <span className="dashboard-story-strong">모든 채널이 준비 완료</span>{" "}
        <span className="dashboard-story-mid">상태예요.</span>
      </>,
      <>
        <span className="dashboard-story-mid">이제</span> <MessageIcons />{" "}
        <span className="dashboard-story-strong">메시지 채널</span>{" "}
        <span className="dashboard-story-mid">을 모두 쓸 수 있어요.</span>
      </>,
      <>
        <KakaoMark /> <span className="dashboard-story-strong">첫 메시지를 보내기 좋은</span>{" "}
        <span className="dashboard-story-mid">타이밍이에요.</span>
      </>,
      ...(scheduledLine ? [scheduledLine] : []),
    ],
  } satisfies StoryContent;
}
