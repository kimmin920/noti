export function statusVariant(status: string): 'secondary' | 'success' | 'warning' | 'danger' | 'outline' {
  if (status.includes('APPROVED') || status === 'APR' || status === 'DELIVERED' || status === 'PUBLISHED') {
    return 'success';
  }
  if (status.includes('REJECT') || status === 'REJ' || status.includes('FAILED') || status === 'DEAD') {
    return 'danger';
  }
  if (status.includes('REQ') || status.includes('SUBMITTED') || status.includes('PROCESSING') || status.includes('ACCEPTED')) {
    return 'warning';
  }
  if (status === 'ARCHIVED') {
    return 'outline';
  }
  return 'secondary';
}
