# Implementation Plan - Filter Couriers for Supervisors

Restrict the list of couriers shown in the "Create Order" page to only those assigned to the logged-in supervisor.

## User Review Required

> [!NOTE]
> This change only affects users with the role of **Supervisor**. Owners will still see all couriers.

## Proposed Changes

### Frontend

#### [page.tsx](c:/Users/Eng.Amjed/Desktop/new-assiut-services/src/app/partner/orders/create/page.tsx)
- Modify `fetchDrivers` function.
- Retrieve the current user from `localStorage`.
- If `user.role === 'supervisor'`, append `&supervisorId=${user.id}` to the API call.
- If `user.role === 'owner'`, keep the call as `/halan/users?role=courier`.

## Verification Plan

### Manual Verification
1.  **Log in as a Supervisor:**
    - Navigate to `/partner/orders/create`.
    - Click "Select Courier".
    - Verify that only the assigned couriers are listed.
2.  **Log in as an Owner:**
    - Navigate to `/partner/orders/create`.
    - Click "Select Courier".
    - Verify that all couriers are listed.
