// Unwired access control matrix. 
// Designed to map 1:1 to Postgres RLS policies in Phase 2.

export const ROLES = {
    OPERATIONS: 'operations',
    CUSTOMER_CARE_MANAGER: 'customer_care_manager',
    LEAD_ENGINEER: 'lead_engineer',
    ADMIN: 'admin'
};

export const PERMISSIONS_MATRIX = [
    {
        resource: 'ocular_inspections',
        operation: 'create_edit_own',
        allowedRoles: [ROLES.OPERATIONS, ROLES.CUSTOMER_CARE_MANAGER, ROLES.LEAD_ENGINEER, ROLES.ADMIN]
    },
    {
        resource: 'ocular_inspections',
        operation: 'qa_approve_reject',
        allowedRoles: [ROLES.CUSTOMER_CARE_MANAGER, ROLES.LEAD_ENGINEER, ROLES.ADMIN]
    },
    {
        resource: 'ocular_inspections',
        operation: 'delete',
        allowedRoles: [ROLES.LEAD_ENGINEER, ROLES.ADMIN]
    },
    {
        resource: 'installation_records',
        operation: 'create_edit',
        allowedRoles: [ROLES.OPERATIONS, ROLES.CUSTOMER_CARE_MANAGER, ROLES.LEAD_ENGINEER, ROLES.ADMIN],
        condition: 'own_assigned_rn_for_inspector'
    },
    {
        resource: 'sales_pipeline',
        operation: 'manage',
        allowedRoles: [ROLES.CUSTOMER_CARE_MANAGER, ROLES.LEAD_ENGINEER, ROLES.ADMIN]
    },
    {
        resource: 'client_directory',
        operation: 'view',
        allowedRoles: [ROLES.CUSTOMER_CARE_MANAGER, ROLES.LEAD_ENGINEER, ROLES.ADMIN]
    },
    {
        resource: 'client_directory',
        operation: 'archive_delete',
        allowedRoles: [ROLES.ADMIN]
    },
    {
        resource: 'support_tickets',
        operation: 'file',
        allowedRoles: [ROLES.OPERATIONS, ROLES.CUSTOMER_CARE_MANAGER, ROLES.LEAD_ENGINEER, ROLES.ADMIN]
    },
    {
        resource: 'support_tickets',
        operation: 'resolve',
        allowedRoles: [ROLES.CUSTOMER_CARE_MANAGER, ROLES.LEAD_ENGINEER, ROLES.ADMIN]
    },
    {
        resource: 'user_management',
        operation: 'manage',
        allowedRoles: [ROLES.ADMIN]
    },
    {
        resource: 'audit_logs',
        operation: 'view',
        allowedRoles: [ROLES.ADMIN]
    },
    {
        resource: 'master_data_catalog',
        operation: 'edit',
        allowedRoles: [ROLES.LEAD_ENGINEER, ROLES.ADMIN]
    }
];

export function hasPermission(role, resource, operation) {
    const policy = PERMISSIONS_MATRIX.find(p => p.resource === resource && p.operation === operation);
    if (!policy) return false;
    return policy.allowedRoles.includes(role);
}
