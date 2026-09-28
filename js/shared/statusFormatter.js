// Display labels for stored status/stage codes. Codes themselves never change.
export const STATUS_LABELS = {
    INITIAL_CONTACT: 'New Inquiry',
    SITE_VISIT_SCHEDULED: 'Pending Inspection',
    SITE_VISIT_COMPLETED: 'Completed Inspection',
    QUOTE_SENT: 'Quote Sent',
    QUOTE_ACCEPTED: 'Quote Approved',
    INSTALLATION_SCHEDULED: 'Pending Installation',
    INSTALLATION_COMPLETE: 'Completed Installation',
    JOB_CHECKOUT_COMPLETE: 'Job Closed',
    CANCELED: 'Cancelled',
    PENDING_QA: 'For Review',
    REJECTED: 'Needs Revision',
    COMMISSIONED: 'Completed Installation',
    ASSIGNED_PENDING_INSPECTION: 'Pending Inspection',
    ASSIGNED_PENDING_INSTALLATION: 'Pending Installation',
    READY_FOR_INSTALLATION: 'Pending Installation',
    DRAFT: 'Draft',
    APPROVED: 'Approved',
    OPEN: 'Open',
    RESOLVED: 'Resolved',
    ACTIVE: 'Active',
    SUSPENDED: 'Suspended'
};

export function formatStatus(status) {
    if (!status) return 'No status';
    if (STATUS_LABELS[status]) return STATUS_LABELS[status];
    // Unknown code: Title Case it rather than printing raw SHOUTY_SNAKE.
    return String(status).replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}
