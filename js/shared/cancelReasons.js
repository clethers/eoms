// Fixed list of reasons a client (lead) can be cancelled. Codes are stored on the lead as `cancelReason`; labels are display only.
export const CANCEL_REASONS = [
    { code: 'PRICE_FEES', label: 'Price or installation fees' },
    { code: 'OUT_OF_TOWN', label: 'Out-of-town charges' },
    { code: 'SCHEDULE', label: 'Schedule or availability' },
    { code: 'CHOSE_OTHER_INSTALLER', label: 'Chose another installer' },
    { code: 'OWN_ELECTRICIAN', label: 'Installed by their own electrician' },
    { code: 'DELIVERY_DELAY', label: 'Vehicle or charger delivery delay' },
    { code: 'SITE_REQUIREMENTS', label: 'Site or condominium requirements' },
    { code: 'SERVICE_COMMS', label: 'Service or communication concerns' },
    { code: 'CHANGED_PLANS', label: 'Changed plans or no longer interested' },
    { code: 'OTHER', label: 'Other reason' }
];

export const CANCEL_REASON_OTHER = 'OTHER';

export function isValidCancelReason(code) {
    return CANCEL_REASONS.some(r => r.code === code);
}

/** Display label for a stored reason code ('' when none; unknown codes are shown as-is). */
export function cancelReasonLabel(code) {
    if (!code) return '';
    const r = CANCEL_REASONS.find(x => x.code === code);
    return r ? r.label : String(code);
}
