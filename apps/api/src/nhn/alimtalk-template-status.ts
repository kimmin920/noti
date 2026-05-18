export type AlimtalkTemplateApprovalStatus = 'REQ' | 'APR' | 'REJ';

export function normalizeAlimtalkTemplateApprovalStatus(status: string | null | undefined): AlimtalkTemplateApprovalStatus {
  const normalized = String(status || '').toUpperCase();

  if (normalized === 'TSC03' || normalized === 'APR') {
    return 'APR';
  }

  if (normalized === 'TSC04' || normalized === 'REJ') {
    return 'REJ';
  }

  return 'REQ';
}
