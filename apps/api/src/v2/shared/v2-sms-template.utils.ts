import { BadRequestException } from '@nestjs/common';
import { classifyDomesticSmsBody, extractRequiredVariables } from '@publ/shared';
import { NhnSmsTemplate, NhnSmsTemplateCategory } from '../../nhn/nhn.service';

type SmsSenderNumber = {
  id: string;
  phoneNumber: string;
};

export const SMS_TEMPLATE_PARENT_CATEGORY_NAME = 'NOTI';

export function buildUserSmsTemplateCategoryName(userId: string) {
  const categoryName = userId.trim();
  if (!categoryName) {
    throw new BadRequestException('SMS 템플릿 카테고리 이름으로 사용할 사용자 식별자가 없습니다.');
  }

  if (categoryName.length > 50) {
    throw new BadRequestException('SMS 템플릿 카테고리 이름으로 사용할 사용자 식별자가 너무 깁니다.');
  }

  return categoryName;
}

export function findSmsTemplateParentCategory(categories: NhnSmsTemplateCategory[]) {
  return (
    categories.find(
      (item) => item.useYn === 'Y' && item.categoryName.trim() === SMS_TEMPLATE_PARENT_CATEGORY_NAME
    ) ?? null
  );
}

export function findUserSmsTemplateCategory(categories: NhnSmsTemplateCategory[], userId: string) {
  const parent = findSmsTemplateParentCategory(categories);
  if (!parent) {
    return null;
  }

  const categoryName = buildUserSmsTemplateCategoryName(userId);
  return (
    categories.find(
      (item) =>
        item.useYn === 'Y' &&
        item.categoryName === categoryName &&
        item.categoryParentId === parent.categoryId
    ) ?? null
  );
}

export function serializeSmsTemplateCategory(item: NhnSmsTemplateCategory) {
  return {
    categoryId: item.categoryId,
    categoryParentId: item.categoryParentId,
    depth: item.depth,
    categoryName: item.categoryName,
    categoryDesc: item.categoryDesc
  };
}

export function summarizeNhnSmsTemplateItem(template: NhnSmsTemplate, senderNumbers: SmsSenderNumber[] = []) {
  const body = normalizeNhnSmsTemplateBodyForUi(template.body ?? '');
  const updatedAt = template.updateDate || template.createDate || new Date().toISOString();
  const sendType = resolveNhnSmsTemplateSendType(template, body);
  const senderNumberId = findSmsSenderNumberId(senderNumbers, template.sendNo);

  return {
    id: template.templateId,
    name: template.templateName || template.templateId,
    body,
    status: template.useYn === 'Y' ? 'PUBLISHED' : 'ARCHIVED',
    requiredVariables: extractRequiredVariables(body),
    updatedAt,
    latestVersion: null,
    versionCount: 1,
    providerStatus: template.useYn === 'Y' ? 'APR' : 'REG',
    nhnTemplateId: template.templateId,
    templateCode: template.templateId,
    lastSyncedAt: updatedAt,
    senderNumberId,
    sendNo: template.sendNo,
    categoryId: template.categoryId,
    categoryName: template.categoryName,
    sendType,
    title: template.title,
    description: template.templateDesc,
    attachments: normalizeNhnSmsTemplateAttachments(template.attachFileList)
  };
}

export function summarizeNhnSmsTemplateDetail(template: NhnSmsTemplate, senderNumbers: SmsSenderNumber[] = []) {
  const item = summarizeNhnSmsTemplateItem(template, senderNumbers);
  const createdAt = template.createDate || item.updatedAt;

  return {
    ...item,
    syntax: 'MUSTACHE_LIKE',
    createdAt,
    versions: []
  };
}

export function normalizeNhnSmsTemplateBodyForUi(body: string) {
  return String(body ?? '').replace(/##\s*([^#]+?)\s*##/g, (_, key: string) => {
    const trimmed = key.trim();
    return trimmed ? `#{${trimmed}}` : '';
  });
}

export function normalizeDigits(value: string | null | undefined) {
  return String(value || '').replace(/\D/g, '');
}

function resolveNhnSmsTemplateSendType(template: NhnSmsTemplate, body: string): 'SMS' | 'LMS' | 'MMS' {
  if ((template.attachFileList ?? []).length > 0) {
    return 'MMS';
  }

  if (template.sendType === '0') {
    return 'SMS';
  }

  const classified = classifyDomesticSmsBody(body);
  return classified === 'OVER_LIMIT' || classified === 'MMS' ? 'LMS' : classified;
}

function normalizeNhnSmsTemplateAttachments(attachments: NhnSmsTemplate['attachFileList']) {
  return (attachments ?? []).map((attachment) => ({
    fileId: attachment.fileId,
    fileName: attachment.fileName,
    filePath: attachment.filePath,
    size: attachment.fileSize,
    previewDataUrl: null
  }));
}

function findSmsSenderNumberId(senderNumbers: SmsSenderNumber[], sendNo: string | null) {
  const normalizedSendNo = normalizeDigits(sendNo);
  if (!normalizedSendNo) {
    return null;
  }

  return senderNumbers.find((item) => normalizeDigits(item.phoneNumber) === normalizedSendNo)?.id ?? null;
}
