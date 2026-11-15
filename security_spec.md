# Security Specification (`security_spec.md`)

## 1. Data Invariants
1. **Global Default-Deny**: All unlisted paths default to `allow read, write: if false;`.
2. **Verified Identity**: All authenticated writes require `request.auth != null && request.auth.token.email_verified == true`.
3. **PII Split-Collection Isolation**: `/users/{userId}` holds only non-PII public fields (`uid`, `username`, `displayName`, `role`, `createdAt`, `updatedAt`). Sensitive PII (`email`, `phone`, `accountCardCode`, `accountPointsBalance`) is strictly isolated in `/users/{userId}/private/{docId}` and readable/writable only by `isOwner(userId)` or `isAdmin()`.
4. **Privilege Escalation Prevention**: Users creating their `/users/{userId}` profile can only set `role == 'CUSTOMER'` or `role == 'MERCHANT_OWNER'` (never `PLATFORM_ADMIN`). `uid` and `createdAt` are immutable on update.
5. **Relational Sync & Master Gate**: `/users/{userId}/cards/{cardId}` requires `exists(/databases/$(database)/documents/users/$(userId))` and `exists(/databases/$(database)/documents/stores/$(incoming().storeId))`.
6. **Terminal State Locking**: `/orders/{orderId}` cannot be updated by non-admins once `existing().status in ['COMPLETED', 'REJECTED']`.
7. **Temporal Integrity**: All `createdAt` and `updatedAt` fields must equal `request.time`.

## 2. The "Dirty Dozen" Payloads
1. **Payload 1 (Shadow Field Injection on `/users/{userId}`)**: Includes `isSuperAdmin: true` ghost key -> Rejected by `keys().hasOnly(...)`.
2. **Payload 2 (Self-Assigned Admin Role on `/users/{userId}` Create)**: Sets `role: "PLATFORM_ADMIN"` -> Rejected by role enum guard.
3. **Payload 3 (Unverified Email Spoof Attack)**: Authenticated user with `email: "ahmed.tito.h1@gmail.com"` and `email_verified: false` -> Rejected by `isVerified()` / `isAdmin()`.
4. **Payload 4 (Cross-User PII Read on `/users/{otherUid}/private/info`)**: Authenticated user reads another user's private PII doc -> Rejected by `isOwner(userId) || isAdmin()`.
5. **Payload 5 (ID Poisoning Attack)**: 500-character or special-character document ID on `/stores/{storeId}` -> Rejected by `isValidId(storeId)`.
6. **Payload 6 (Client Timestamp Forgery)**: Sets `createdAt` to a past timestamp instead of `request.time` -> Rejected by `incoming().createdAt == request.time`.
7. **Payload 7 (Immutable Field Mutation on Update)**: Attempts to mutate `ownerId` or `createdAt` on `/stores/{storeId}` -> Rejected by immutability gate and `affectedKeys().hasOnly(...)`.
8. **Payload 8 (Orphaned Loyalty Card Creation)**: Creates `/users/{userId}/cards/{cardId}` pointing to non-existent `storeId` -> Rejected by `exists(/databases/$(database)/documents/stores/$(incoming().storeId))`.
9. **Payload 9 (Negative Balance / Value Poisoning)**: Creates or updates a card with `currentBalance: -500` or string `"1000"` -> Rejected by `isValidLoyaltyCard(incoming())`.
10. **Payload 10 (Terminal Order State Mutation)**: Attempts to change `/orders/{orderId}` from `COMPLETED` back to `PENDING` as non-admin -> Rejected by terminal state lock.
11. **Payload 11 (Unauthorized Order List Scraping)**: Queries `/orders` without filtering `resource.data.customerId == request.auth.uid` -> Rejected by Query Enforcer on `allow list`.
12. **Payload 12 (Oversized String Denial-of-Wallet)**: Sends a 10,000-character `summaryText` on `/orders/{orderId}` -> Rejected by `summaryText.size() <= 500`.
