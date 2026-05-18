"use client";

import {
  ActionList,
  ActionMenu,
  BaseStyles,
  Button,
  FormControl,
  Heading,
  IconButton,
  Label,
  NavList,
  PageLayout,
  SegmentedControl,
  Select,
  Text,
  Textarea,
  TextInput,
  ThemeProvider,
  VisuallyHidden,
} from "@primer/react";
import {
  ArchiveIcon,
  BellIcon,
  ChecklistIcon,
  CommentDiscussionIcon,
  DeviceMobileIcon,
  GearIcon,
  KeyIcon,
  MegaphoneIcon,
  PaperAirplaneIcon,
  PeopleIcon,
  ReportIcon,
  SearchIcon,
  ShieldCheckIcon,
} from "@primer/octicons-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";

type ChannelId = "sms" | "alimtalk" | "brand";
type UxSectionId = "single" | "bulk" | "templates" | "logs" | "recipients" | "resources";
type PrimerIcon = typeof PaperAirplaneIcon;

type NavItem = {
  id: UxSectionId;
  label: string;
  description: string;
  icon: PrimerIcon;
};

type Channel = {
  id: ChannelId;
  label: string;
  sender: string;
  policy: string;
  previewTitle: string;
  previewBody: string;
  template: string;
};

const CHANNELS: Channel[] = [
  {
    id: "sms",
    label: "SMS",
    sender: "1588-0000",
    policy: "문자 길이에 따라 SMS, LMS, MMS가 구분됩니다.",
    previewTitle: "[NOTI] 예약 안내",
    previewBody: "5월 15일 오전 10시 상담 예약이 확정되었습니다. 변경이 필요하면 고객센터로 문의해주세요.",
    template: "예약 안내 기본형",
  },
  {
    id: "alimtalk",
    label: "알림톡",
    sender: "NOTI 알림톡 채널",
    policy: "승인된 템플릿만 발송할 수 있습니다.",
    previewTitle: "예약 확정 안내",
    previewBody: "#{고객명}님, #{예약일시} 예약이 확정되었습니다. 방문 전 안내사항을 확인해주세요.",
    template: "예약 확정 안내",
  },
  {
    id: "brand",
    label: "브랜드 메시지",
    sender: "NOTI 브랜드 채널",
    policy: "광고 표기와 수신 동의 상태를 확인합니다.",
    previewTitle: "5월 멤버십 혜택",
    previewBody: "이번 주말까지 사용 가능한 전용 쿠폰이 도착했습니다. 채널 친구에게 먼저 안내됩니다.",
    template: "멤버십 혜택 안내",
  },
];

const NAV_SECTIONS: Array<{ title: string; items: NavItem[] }> = [
  {
    title: "메시지",
    items: [
      { id: "single", label: "단건 발송", description: "수신자 한 명에게 발송", icon: PaperAirplaneIcon },
      { id: "bulk", label: "대량 발송", description: "대상자 목록으로 발송", icon: MegaphoneIcon },
    ],
  },
  {
    title: "운영",
    items: [
      { id: "templates", label: "템플릿", description: "소재와 승인 상태", icon: ChecklistIcon },
      { id: "logs", label: "발송 기록", description: "접수와 결과 이력", icon: ArchiveIcon },
      { id: "recipients", label: "수신자", description: "목록과 동의 상태", icon: PeopleIcon },
      { id: "resources", label: "발신 자원", description: "발신번호와 채널", icon: KeyIcon },
    ],
  },
];

const NAV_ITEMS = NAV_SECTIONS.flatMap((section) => section.items);

const SECTION_COPY: Record<UxSectionId, { title: string; description: string }> = {
  single: {
    title: "단건 발송",
    description: "수신자 한 명에게 보낼 메시지를 작성하고 발송 전 검토합니다.",
  },
  bulk: {
    title: "대량 발송",
    description: "대상자 목록을 선택하고 캠페인 단위로 발송을 접수합니다.",
  },
  templates: {
    title: "템플릿",
    description: "채널별 메시지 소재와 승인 상태를 같은 기준으로 관리합니다.",
  },
  logs: {
    title: "발송 기록",
    description: "단건과 대량 발송 결과를 채널, 상태, 요청 단위로 확인합니다.",
  },
  recipients: {
    title: "수신자",
    description: "발송에 사용할 대상자 목록과 수신 동의 상태를 관리합니다.",
  },
  resources: {
    title: "발신 자원",
    description: "발송에 필요한 발신번호와 카카오 채널 연결 상태를 확인합니다.",
  },
};

const TEMPLATE_ROWS = [
  ["예약 확정 안내", "알림톡", "승인됨", "기본 안내"],
  ["배송 출발 안내", "SMS", "승인됨", "운영"],
  ["5월 멤버십 혜택", "브랜드", "검토 필요", "마케팅"],
];

const LOG_ROWS = [
  ["예약 확정 안내", "알림톡", "단건", "성공", "오늘 10:14"],
  ["멤버십 혜택 안내", "브랜드", "대량", "접수", "오늘 09:42"],
  ["배송 출발 안내", "SMS", "대량", "실패 2건", "어제 18:20"],
];

const RECIPIENT_ROWS = [
  ["VIP 고객", "12,420명", "광고 동의 포함", "사용 가능"],
  ["최근 예약 고객", "3,208명", "알림성 전용", "사용 가능"],
  ["휴면 전환 예정", "864명", "광고 제외", "검토 필요"],
];

const RESOURCE_ROWS = [
  ["대표 발신번호", "1588-0000", "인증됨", "SMS"],
  ["NOTI 알림톡 채널", "@noti", "연결됨", "알림톡"],
  ["NOTI 브랜드 채널", "@noti-brand", "연결됨", "브랜드"],
];

export function RecommendedMessagingUxPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeSection = resolveSection(searchParams.get("view"));
  const [activeChannel, setActiveChannel] = useState<ChannelId>("alimtalk");
  const activeItem = useMemo(() => NAV_ITEMS.find((item) => item.id === activeSection) ?? NAV_ITEMS[0], [activeSection]);
  const pageCopy = SECTION_COPY[activeSection];

  function navigateTo(sectionId: UxSectionId) {
    router.push(buildViewHref(sectionId));
  }

  return (
    <ThemeProvider colorMode="light" preventSSRMismatch>
      <BaseStyles className="primer-ux-root">
        <a className="primer-ux-skip-link" href="#primer-ux-main">본문으로 건너뛰기</a>

        <header className="primer-ux-app-header">
          <a className="primer-ux-brand" href="/ux" aria-label="NOTI 메시징 홈">
            <span className="primer-ux-brand-mark" aria-hidden="true">N</span>
            <span className="primer-ux-brand-text">
              <span className="primer-ux-brand-name">NOTI</span>
              <span className="primer-ux-brand-owner">ACME Corp</span>
            </span>
          </a>

          <div className="primer-ux-context" aria-label="현재 위치">
            <span>ACME Corp</span>
            <span aria-hidden="true">/</span>
            <strong>메시징</strong>
          </div>

          <div className="primer-ux-global-actions" aria-label="전역 작업">
            <IconButton icon={BellIcon} aria-label="알림" variant="invisible" />
            <IconButton icon={GearIcon} aria-label="설정" variant="invisible" />
            <Button variant="invisible" aria-label="계정 메뉴">AC</Button>
          </div>
        </header>

        <PageLayout containerWidth="full" padding="none" columnGap="none" rowGap="none" className="primer-ux-page-layout">
          <PageLayout.Pane
            position="start"
            width="small"
            padding="normal"
            divider="line"
            sticky
            hidden={{ narrow: true, regular: false, wide: false }}
            aria-label="메시징 메뉴"
            className="primer-ux-pane"
          >
            <MessagingNav activeSection={activeSection} onNavigate={navigateTo} />
          </PageLayout.Pane>

          <PageLayout.Content as="div" padding="none" width="full">
            <main id="primer-ux-main" className="primer-ux-main" aria-labelledby="primer-ux-page-title">
              <PageHeading
                title={pageCopy.title}
                description={pageCopy.description}
                activeItem={activeItem}
                activeSection={activeSection}
                onNavigate={navigateTo}
              />

              {activeSection === "single" ? (
                <SendComposer mode="single" activeChannel={activeChannel} onChannelChange={setActiveChannel} />
              ) : null}
              {activeSection === "bulk" ? (
                <SendComposer mode="bulk" activeChannel={activeChannel} onChannelChange={setActiveChannel} />
              ) : null}
              {activeSection === "templates" ? (
                <TemplatesView activeChannel={activeChannel} onChannelChange={setActiveChannel} />
              ) : null}
              {activeSection === "logs" ? <LogsView /> : null}
              {activeSection === "recipients" ? <RecipientsView /> : null}
              {activeSection === "resources" ? <ResourcesView /> : null}
            </main>
          </PageLayout.Content>
        </PageLayout>
      </BaseStyles>
    </ThemeProvider>
  );
}

function MessagingNav({
  activeSection,
  onNavigate,
}: {
  activeSection: UxSectionId;
  onNavigate: (sectionId: UxSectionId) => void;
}) {
  return (
    <NavList aria-label="메시징 메뉴">
      {NAV_SECTIONS.map((section) => (
        <NavList.Group key={section.title} title={section.title}>
          {section.items.map((item) => {
            const Icon = item.icon;

            return (
              <NavList.Item
                key={item.id}
                href={buildViewHref(item.id)}
                aria-current={activeSection === item.id ? "page" : undefined}
                onClick={(event) => {
                  event.preventDefault();
                  onNavigate(item.id);
                }}
              >
                <NavList.LeadingVisual>
                  <Icon />
                </NavList.LeadingVisual>
                {item.label}
                <NavList.Description>{item.description}</NavList.Description>
              </NavList.Item>
            );
          })}
        </NavList.Group>
      ))}
    </NavList>
  );
}

function PageHeading({
  title,
  description,
  activeItem,
  activeSection,
  onNavigate,
}: {
  title: string;
  description: string;
  activeItem: NavItem;
  activeSection: UxSectionId;
  onNavigate: (sectionId: UxSectionId) => void;
}) {
  return (
    <div className="primer-ux-page-head">
      <div className="primer-ux-title-block">
        <Text className="primer-ux-kicker" as="span">메시징 / {activeItem.label}</Text>
        <Heading as="h1" id="primer-ux-page-title" className="primer-ux-title">{title}</Heading>
        <Text as="p" className="primer-ux-description">{description}</Text>
      </div>

      <div className="primer-ux-mobile-menu">
        <ActionMenu>
          <ActionMenu.Button size="large">{activeItem.label}</ActionMenu.Button>
          <ActionMenu.Overlay width="medium">
            <ActionList selectionVariant="single" aria-label="메시징 메뉴">
              {NAV_SECTIONS.map((section) => (
                <ActionList.Group key={section.title}>
                  <ActionList.GroupHeading>{section.title}</ActionList.GroupHeading>
                  {section.items.map((item) => {
                    const Icon = item.icon;

                    return (
                      <ActionList.Item
                        key={item.id}
                        selected={activeSection === item.id}
                        onSelect={() => onNavigate(item.id)}
                      >
                        <ActionList.LeadingVisual>
                          <Icon />
                        </ActionList.LeadingVisual>
                        {item.label}
                        <ActionList.Description>{item.description}</ActionList.Description>
                      </ActionList.Item>
                    );
                  })}
                </ActionList.Group>
              ))}
            </ActionList>
          </ActionMenu.Overlay>
        </ActionMenu>
      </div>
    </div>
  );
}

function ChannelControl({
  activeChannel,
  onChange,
}: {
  activeChannel: ChannelId;
  onChange: (channelId: ChannelId) => void;
}) {
  const selectedIndex = CHANNELS.findIndex((channel) => channel.id === activeChannel);

  return (
    <div className="primer-ux-channel-control">
      <VisuallyHidden id="primer-ux-channel-label">채널</VisuallyHidden>
      <SegmentedControl
        aria-labelledby="primer-ux-channel-label"
        fullWidth={{ narrow: true, regular: false, wide: false }}
        variant={{ narrow: "dropdown", regular: "default", wide: "default" }}
        onChange={(index) => onChange(CHANNELS[index]?.id ?? "sms")}
      >
        {CHANNELS.map((channel, index) => (
          <SegmentedControl.Button
            key={channel.id}
            selected={index === selectedIndex}
          >
            {channel.label}
          </SegmentedControl.Button>
        ))}
      </SegmentedControl>
    </div>
  );
}

function SendComposer({
  mode,
  activeChannel,
  onChannelChange,
}: {
  mode: "single" | "bulk";
  activeChannel: ChannelId;
  onChannelChange: (channelId: ChannelId) => void;
}) {
  const channel = getChannel(activeChannel);
  const isBulk = mode === "bulk";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  return (
    <div className="primer-ux-workspace">
      <section className="primer-ux-workspace-main" aria-labelledby="primer-ux-compose-title">
        <div className="primer-ux-section-head">
          <div>
            <Heading as="h2" id="primer-ux-compose-title" className="primer-ux-section-title">
              {isBulk ? "캠페인 작성" : "메시지 작성"}
            </Heading>
            <Text as="p" className="primer-ux-section-desc">
              채널 선택은 즉시 반영되고, 작성 값은 검토 버튼을 누를 때 적용됩니다.
            </Text>
          </div>
          <ChannelControl activeChannel={activeChannel} onChange={onChannelChange} />
        </div>

        <form className="primer-ux-form" noValidate onSubmit={handleSubmit}>
          {isBulk ? <BulkFields channel={channel} /> : <SingleFields channel={channel} />}
          <div className="primer-ux-form-actions">
            <Button type="submit" variant="primary" leadingVisual={PaperAirplaneIcon}>
              {isBulk ? "발송 검토" : "검토 후 발송"}
            </Button>
          </div>
        </form>
      </section>

      <aside className="primer-ux-side" aria-labelledby="primer-ux-review-title">
        <MessagePreview channel={channel} mode={mode} />
        <ReviewChecklist channel={channel} mode={mode} />
      </aside>
    </div>
  );
}

function SingleFields({ channel }: { channel: Channel }) {
  return (
    <div className="primer-ux-form-stack">
      <FormControl id="single-sender" required>
        <FormControl.Label>발신 자원</FormControl.Label>
        <Select block defaultValue={channel.id}>
          {CHANNELS.map((item) => (
            <Select.Option key={item.id} value={item.id}>{item.sender}</Select.Option>
          ))}
        </Select>
        <FormControl.Caption>{channel.policy}</FormControl.Caption>
      </FormControl>

      <FormControl id="single-recipient" required>
        <FormControl.Label>수신자</FormControl.Label>
        <TextInput block defaultValue="010-1234-5678" leadingVisual={DeviceMobileIcon} />
        <FormControl.Caption>발송 전 수신 동의와 차단 여부를 확인합니다.</FormControl.Caption>
      </FormControl>

      <FormControl id="single-template" required>
        <FormControl.Label>템플릿</FormControl.Label>
        <Select block defaultValue={channel.template}>
          <Select.Option value={channel.template}>{channel.template}</Select.Option>
          <Select.Option value="예약 변경 안내">예약 변경 안내</Select.Option>
          <Select.Option value="배송 출발 안내">배송 출발 안내</Select.Option>
        </Select>
      </FormControl>

      <FormControl id="single-body" required>
        <FormControl.Label>본문</FormControl.Label>
        <Textarea block resize="vertical" rows={7} defaultValue={channel.previewBody} />
      </FormControl>
    </div>
  );
}

function BulkFields({ channel }: { channel: Channel }) {
  return (
    <div className="primer-ux-form-stack">
      <FormControl id="bulk-audience" required>
        <FormControl.Label>대상자</FormControl.Label>
        <Select block defaultValue="recent-reservations">
          <Select.Option value="recent-reservations">최근 예약 고객</Select.Option>
          <Select.Option value="vip">VIP 고객</Select.Option>
          <Select.Option value="inactive">휴면 전환 예정</Select.Option>
        </Select>
        <FormControl.Caption>목록별 동의 상태를 발송 검토 단계에서 확인합니다.</FormControl.Caption>
      </FormControl>

      <FormControl id="bulk-title" required>
        <FormControl.Label>캠페인명</FormControl.Label>
        <TextInput block defaultValue={`${channel.template} 캠페인`} />
      </FormControl>

      <FormControl id="bulk-schedule" required>
        <FormControl.Label>발송 시간</FormControl.Label>
        <Select block defaultValue="now">
          <Select.Option value="now">즉시 발송</Select.Option>
          <Select.Option value="morning">내일 오전 10:00</Select.Option>
          <Select.Option value="custom">직접 지정</Select.Option>
        </Select>
      </FormControl>

      <FormControl id="bulk-template" required>
        <FormControl.Label>템플릿</FormControl.Label>
        <Select block defaultValue={channel.template}>
          <Select.Option value={channel.template}>{channel.template}</Select.Option>
          <Select.Option value="쿠폰 만료 안내">쿠폰 만료 안내</Select.Option>
          <Select.Option value="배송 출발 안내">배송 출발 안내</Select.Option>
        </Select>
      </FormControl>

      <FormControl id="bulk-body" required>
        <FormControl.Label>본문</FormControl.Label>
        <Textarea block resize="vertical" rows={7} defaultValue={channel.previewBody} />
      </FormControl>
    </div>
  );
}

function MessagePreview({ channel, mode }: { channel: Channel; mode: "single" | "bulk" }) {
  return (
    <section className="primer-ux-preview" aria-labelledby="primer-ux-preview-title">
      <div className="primer-ux-section-head compact">
        <div>
          <Heading as="h2" id="primer-ux-preview-title" className="primer-ux-section-title">미리보기</Heading>
          <Text as="p" className="primer-ux-section-desc">{channel.label} 기준</Text>
        </div>
        <Label variant="accent">{mode === "bulk" ? "대량" : "단건"}</Label>
      </div>

      <div className="primer-ux-message-frame" aria-label="메시지 미리보기">
        <div className="primer-ux-phone-top" aria-hidden="true" />
        <article className="primer-ux-message-bubble">
          <strong>{channel.previewTitle}</strong>
          <p>{channel.previewBody}</p>
          <Button size="small" type="button">상세 보기</Button>
        </article>
      </div>
    </section>
  );
}

function ReviewChecklist({ channel, mode }: { channel: Channel; mode: "single" | "bulk" }) {
  const rows = [
    ["채널", channel.label],
    ["발신 자원", channel.sender],
    ["발송 방식", mode === "bulk" ? "대량" : "단건"],
    ["검토 항목", mode === "bulk" ? "대상자와 중복 제거" : "수신자 상태"],
  ];

  return (
    <section className="primer-ux-review" aria-labelledby="primer-ux-review-title">
      <div className="primer-ux-section-head compact">
        <div>
          <Heading as="h2" id="primer-ux-review-title" className="primer-ux-section-title">발송 전 확인</Heading>
          <Text as="p" className="primer-ux-section-desc">제출 전 확인할 항목입니다.</Text>
        </div>
        <ShieldCheckIcon size={16} aria-hidden="true" />
      </div>
      <dl className="primer-ux-definition-list">
        {rows.map(([term, detail]) => (
          <div key={term}>
            <dt>{term}</dt>
            <dd>{detail}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function TemplatesView({
  activeChannel,
  onChannelChange,
}: {
  activeChannel: ChannelId;
  onChannelChange: (channelId: ChannelId) => void;
}) {
  return (
    <section className="primer-ux-box" aria-labelledby="templates-title">
      <div className="primer-ux-section-head">
        <div>
          <Heading as="h2" id="templates-title" className="primer-ux-section-title">템플릿 목록</Heading>
          <Text as="p" className="primer-ux-section-desc">채널 선택은 목록 필터로 즉시 적용됩니다.</Text>
        </div>
        <ChannelControl activeChannel={activeChannel} onChange={onChannelChange} />
      </div>
      <TableToolbar searchLabel="템플릿 검색" />
      <DataTable
        columns={["템플릿", "채널", "상태", "분류"]}
        rows={TEMPLATE_ROWS.map((row) => ({
          cells: row,
          tone: row[2] === "검토 필요" ? "attention" : "success",
        }))}
      />
    </section>
  );
}

function LogsView() {
  return (
    <section className="primer-ux-box" aria-labelledby="logs-title">
      <div className="primer-ux-section-head">
        <div>
          <Heading as="h2" id="logs-title" className="primer-ux-section-title">최근 발송</Heading>
          <Text as="p" className="primer-ux-section-desc">요청 단위로 상세 내역에 진입할 수 있습니다.</Text>
        </div>
        <ActionMenu>
          <ActionMenu.Button>상태</ActionMenu.Button>
          <ActionMenu.Overlay width="small">
            <ActionList selectionVariant="single" aria-label="상태 필터">
              <ActionList.Item selected>전체</ActionList.Item>
              <ActionList.Item>성공</ActionList.Item>
              <ActionList.Item>접수</ActionList.Item>
              <ActionList.Item>실패</ActionList.Item>
            </ActionList>
          </ActionMenu.Overlay>
        </ActionMenu>
      </div>
      <TableToolbar searchLabel="발송 기록 검색" />
      <DataTable
        columns={["발송", "채널", "방식", "상태", "시간"]}
        rows={LOG_ROWS.map((row) => ({
          cells: row,
          tone: row[3].includes("실패") ? "danger" : row[3] === "접수" ? "attention" : "success",
        }))}
      />
    </section>
  );
}

function RecipientsView() {
  return (
    <section className="primer-ux-box" aria-labelledby="recipients-title">
      <div className="primer-ux-section-head">
        <div>
          <Heading as="h2" id="recipients-title" className="primer-ux-section-title">수신자 목록</Heading>
          <Text as="p" className="primer-ux-section-desc">발송 대상과 동의 상태를 함께 확인합니다.</Text>
        </div>
        <Button leadingVisual={PeopleIcon}>목록 추가</Button>
      </div>
      <TableToolbar searchLabel="수신자 목록 검색" />
      <DataTable
        columns={["목록", "대상", "동의 상태", "사용 상태"]}
        rows={RECIPIENT_ROWS.map((row) => ({
          cells: row,
          tone: row[3] === "검토 필요" ? "attention" : "success",
        }))}
      />
    </section>
  );
}

function ResourcesView() {
  return (
    <section className="primer-ux-resource-grid" aria-label="발신 자원">
      {RESOURCE_ROWS.map(([name, value, status, type]) => (
        <article className="primer-ux-box primer-ux-resource" key={name}>
          <div className="primer-ux-resource-icon" aria-hidden="true">
            {type === "SMS" ? <DeviceMobileIcon size={16} /> : <CommentDiscussionIcon size={16} />}
          </div>
          <Heading as="h2" className="primer-ux-section-title">{name}</Heading>
          <Text as="p" className="primer-ux-resource-value">{value}</Text>
          <div className="primer-ux-resource-meta">
            <Label variant="success">{status}</Label>
            <Text as="span">{type}</Text>
          </div>
        </article>
      ))}
    </section>
  );
}

function TableToolbar({ searchLabel }: { searchLabel: string }) {
  return (
    <div className="primer-ux-table-toolbar">
      <FormControl id={`table-search-${searchLabel.replace(/\s+/g, "-")}`}>
        <FormControl.Label visuallyHidden>{searchLabel}</FormControl.Label>
        <TextInput block leadingVisual={SearchIcon} placeholder={searchLabel} />
      </FormControl>
      <Button leadingVisual={ReportIcon}>내보내기</Button>
    </div>
  );
}

function DataTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: Array<{ cells: string[]; tone: "success" | "attention" | "danger" }>;
}) {
  return (
    <div className="primer-ux-table-wrap">
      <table className="primer-ux-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column} scope="col">{column}</th>
            ))}
            <th scope="col">
              <VisuallyHidden>작업</VisuallyHidden>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.cells.join("-")}>
              {row.cells.map((cell, index) => (
                <td key={cell}>
                  {index === 2 || index === 3 ? renderStatusCell(cell, row.tone) : cell}
                </td>
              ))}
              <td className="primer-ux-table-action">
                <Button size="small">상세</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderStatusCell(value: string, tone: "success" | "attention" | "danger") {
  if (["SMS", "알림톡", "브랜드", "단건", "대량"].includes(value)) {
    return value;
  }

  return <Label variant={tone}>{value}</Label>;
}

function getChannel(channelId: ChannelId) {
  return CHANNELS.find((channel) => channel.id === channelId) ?? CHANNELS[0];
}

function resolveSection(value: string | null): UxSectionId {
  return NAV_ITEMS.some((item) => item.id === value) ? (value as UxSectionId) : "single";
}

function buildViewHref(sectionId: UxSectionId) {
  return sectionId === "single" ? "/ux" : `/ux?view=${sectionId}`;
}
