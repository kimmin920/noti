import { extractRequiredVariablesFromSources } from '@publ/shared';
import type { NhnAlimtalkTemplate } from './nhn.service';

type AlimtalkActionVariableSource = {
  linkMo?: string | null;
  linkPc?: string | null;
  schemeIos?: string | null;
  schemeAndroid?: string | null;
  telNumber?: string | null;
};

export function extractAlimtalkTemplateRequiredVariables(
  template: Pick<
    NhnAlimtalkTemplate,
    'templateContent' | 'templateExtra' | 'templateTitle' | 'templateSubtitle' | 'buttons' | 'quickReplies'
  >
): string[] {
  return extractRequiredVariablesFromSources([
    template.templateContent,
    template.templateExtra,
    template.templateTitle,
    template.templateSubtitle,
    ...extractAlimtalkActionVariableSources(template.buttons),
    ...extractAlimtalkActionVariableSources(template.quickReplies)
  ]);
}

export function normalizeRequiredVariableList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.map((item) => String(item || '').trim()).filter(Boolean))].sort();
}

function extractAlimtalkActionVariableSources(actions?: AlimtalkActionVariableSource[] | null): string[] {
  return (actions ?? []).flatMap((action) => [
    action.linkMo ?? null,
    action.linkPc ?? null,
    action.schemeIos ?? null,
    action.schemeAndroid ?? null,
    action.telNumber ?? null
  ]).filter((value): value is string => typeof value === 'string');
}
