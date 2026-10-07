# F3 SignalR Resource Authorization and Private Event Delivery

Date: 2026-10-07 (Asia/Dhaka). Status: implemented and verified locally.

The invariant is: only users authorized for a resource receive its private realtime data. Authentication establishes identity; a Worker/Customer role does not establish ownership of an arbitrary booking. F5 negotiation rules and F6 refresh-session families remain separate work.

## Original failure and selected design

The original hosted regression reproduced an unrelated customer successfully invoking `JoinBooking`. A custom client could then listen to chat events. Other services sent payment receipts, verification documents and negotiation prices through `Clients.All`, so joining a room was unnecessary for those disclosures. `SendTyping` also trusted arbitrary booking IDs.

The selected alternative from the plan uses current participant queries and user-group delivery. Booking rooms remain compatible with join/leave/rejoin calls, but private delivery never treats their membership as authority. This prevents a removed participant retaining private access through an old room. It also removes duplicate booking-message delivery to the receiver through both room and user routes.

```mermaid
sequenceDiagram
    participant Caller as Authenticated client
    participant Hub as KarigorHub
    participant Policy as BookingAccess
    participant SQL as Current SQL state
    Caller->>Hub: JoinBooking / SendTyping with booking ID
    Hub->>Policy: Resolve participants and active caller
    Policy->>SQL: Booking relationships and LockoutEnd
    SQL-->>Policy: Current participants / no match / failure
    alt Unrelated, suspended, missing, or lookup fails
        Hub-->>Caller: Denied invocation; no private send
    else Authorized participant
        Hub-->>Caller: Join succeeds
        Hub->>Hub: Typing goes only to current other participant's user group
    end
```

## Exact enforcement

- `BookingAccess.GetParticipantsAsync` projects current customer/worker user IDs with `AsNoTracking`. `Contains` is used in hub and REST messaging paths. `IsActiveUserAsync` rejects missing identities and a current Identity `LockoutEnd` suspension.
- `KarigorHub.RequireParticipantAsync` runs for every join and typing invocation, including rejoin. A lookup exception propagates as a failed invocation; there is no cached allow fallback. Admin role alone cannot join chat. `LeaveBooking` only removes the caller's connection.
- `OnConnectedAsync` checks the current user before creating caller-derived `user_<id>` groups. Worker refresh membership uses the validated Worker claim. The existing Admins group remains a compatibility group.
- `NotifyBookingGroupAsync` retains its existing interface name but queries current participants and sends to their user groups, filtering current suspension. Rooms are never used to disclose business DTOs.
- `NotifyAdminsAsync` resolves current Admin assignments from SQL and filters suspended/missing users before sending to their user groups. SOS remains admin-only. A stale Admins group cannot receive operational details by itself.
- `BroadcastAsync(event, object)` was removed. Broad operations accept only an event name and construct a fixed `{ refresh: true }` payload inside the notifier. There is no broad operation accepting a private DTO.
- `MapHub` enables `CloseOnAuthenticationExpiration`. This is access-JWT expiry, not F6 session revocation.
- `signalrService.setAccount` resets room intent and connections when account identity changes. A generation check ignores callbacks from old or still-starting connections. A pending start stops itself when superseded. `AuthContext` calls this on user-ID changes, while token refresh remains the existing implementation.
- Reconnect replays `JoinBooking` against the server. Denied rooms leave the local set and are logged; initial join failure is surfaced in ChatBox. Review refresh listeners re-fetch instead of requiring a globally disclosed booking ID.

## Complete event inventory

| Event / source | Previous delivery | New recipients and payload |
|---|---|---|
| ReceiveMessage / MessagingService | Booking room plus receiver user group | Current booking participants, once per user; caller ReceiverId is overridden by booking state. Existing non-booking direct messages retain their explicit recipient path. |
| UserTyping / KarigorHub | Any caller to OthersInGroup | Caller must currently participate; only the current other active participant receives booking/user/typing fields. Joining first is unnecessary for authorization. |
| PaymentReceived / PaymentService | All connections; provider transaction ID and amounts | Current booking customer/worker; booking/status/fee/amount fields only. Provider transaction ID removed. Payment settlement behavior is unchanged. |
| WorkerVerificationUpdated / AdminService | All connections; full PendingWorkerDto | Current active admins receive the operational DTO. Affected active worker receives only verificationStatus and note. |
| QuotationUpdated / MarketplaceService create/counter/accept | All connections; request/worker/price/booking data | Request owner and this quotation's worker, resolved again from SQL. Competitors receive only their known request ID and Closed status after acceptance, without winning price/booking ID. |
| ServiceRequestCreated / CustomerService | All connections; exact coordinates and request metadata | Worker-role refresh group; fixed refresh hint only. REST listing eligibility remains the read boundary. |
| ReviewCreated / ReviewUpdated / ReviewService | All connections; complete review DTO with booking/customer IDs | All authenticated connections receive a fixed public refresh hint. Public/private review APIs still control subsequent reads. |
| SosAlertTriggered / SosService | Admins | Current active admins only; existing private SOS DTO and recipient intent retained. |
| ReceiveNotification / NotificationService | Intended user's group | Existing server-selected recipients retained; notifier additionally filters current suspension/missing users. |

Resource checks establish authorization at the time of their SQL read. They do not serialize a simultaneous resource reassignment with network delivery. No caller can choose a private event's recipient list through a hub method.

## Files changed for F3

| Files | Change |
|---|---|
| backend/Karigor.Application/Realtime/BookingAccess.cs | Shared current participation, activity and admin-recipient queries |
| backend/Karigor.Application/Realtime/IRealtimeNotifier.cs | Fixed broad refresh operations; remove arbitrary global payload API |
| backend/Karigor.Api/Hubs/KarigorHub.cs | Authorize joins/typing; check active connection identity; worker hints |
| backend/Karigor.Api/Realtime/SignalRRealtimeNotifier.cs | Current participant/admin user delivery; active-user filtering |
| backend/Karigor.Api/Program.cs | Policy DI and close on JWT expiry; also shared with F7 storage/static changes |
| backend/Karigor.Application/Messaging/MessagingService.cs | Share participation policy; avoid duplicate message delivery |
| backend/Karigor.Application/Payments/PaymentService.cs | Scope only the realtime payment event and minimize its payload |
| backend/Karigor.Application/Admin/AdminService.cs | Split admin operational detail and worker result |
| backend/Karigor.Application/Customer/CustomerService.cs | Worker-only discovery refresh hint |
| backend/Karigor.Application/Marketplace/MarketplaceService.cs | Scope three event sites and competitor closure hint; offer mutation/acceptance rules remain unchanged |
| backend/Karigor.Application/Reviews/ReviewService.cs | Two public refresh hints |
| karigor-client/src/services/signalrService.ts; src/context/AuthContext.tsx | Account-bound connection lifecycle, rejoin authorization and denied-room removal |
| karigor-client/src/components/chat/ChatBox.tsx; src/pages/BookingDetailPage.tsx | Surface initial denied join; consume review hints |
| tests/Karigor.Security.Tests/SignalRSecurityTests.cs; ApiSecurityTests.cs | Eleven new hosted cases; promote original membership regression |
| tests/known-security-defects.json | Remove only verified F3 exception at F3 completion; F7 promotion happened separately |
| docs/security/SECURITY_WORKDONE.md; docs/testing/PHASE1_SECURITY_TEST_HARNESS.md; this guide | Study, current gates, implementation evidence |

## Tests and actual results

All hosted tests use real .NET SignalR clients over Long Polling against the actual API/TestServer and an isolated loopback SQL database. Recipient absence uses an awaited per-connection fence sent after business events, rather than an arbitrary sleep.

| Cases | Result / what they prove |
|---|---|
| Original unrelated-user join regression and participant-delivery baseline | Pre-fix: one fail, one pass. Post-fix: both pass, original bodies unchanged. |
| AnonymousAndUnrelatedWorkerAndAdminCannotJoinOrType | Anonymous connection fails; unrelated customer/worker and nonparticipant admin cannot join or type; invalid booking denied. |
| ParticipantsReceiveTypingAndMessageWithoutTrustingCallerReceiver | Three clients; both participants join, only other participant receives typing, participants receive one message each, stranger receives neither; spoofed ReceiverId ignored. |
| ReconnectAndExistingRoomCannotRetainChangedParticipation | Reassign worker in isolated SQL; old room gets no message/typing, old worker cannot type/rejoin after reconnect, current customer rejoins successfully. |
| SuspensionDeniesMethodsAndPrivateDeliveryWithExistingJwt | Current LockoutEnd denies joins/typing and private delivery despite a previously valid JWT/room. |
| PaymentReceiptReachesOnlyBookingParticipants | Actual fake-provider callback; customer/worker receive status/amount; stranger receives nothing; provider transaction ID absent. |
| QuotationCreateCounterAndAcceptReachOnlyTheirThread | Three actual HTTP transitions and three connected clients; only the relevant owner/worker receive thread events. |
| CompetingWorkerReceivesClosedHintWithoutWinningPrice | Competing worker receives own quote and Closed hint; no winning price or booking ID. |
| VerificationAdminDetailsAndWorkerResultAreSeparated | Admin receives documents; worker's exact two-field result is minimized; unrelated customer gets nothing. |
| DiscoveryAndReviewEventsContainOnlyRefreshHint | Actual create request/create review/respond routes; hints have exactly one fixed field; customer gets no worker discovery event. |
| SosDetailsReachOnlyCurrentAdmins | Actual SOS route; admin gets alert; customer and worker get no SOS detail event. |
| DatabaseLookupFailureDeniesJoinAndTyping | EF interceptor fails booking reads in a derived isolated host; both invocations fail; recovery permits authorized join. |

Commands executed:

```text
dotnet test tests/Karigor.Security.Tests/Karigor.Security.Tests.csproj --configuration Release --no-build --filter "Finding=F3" --logger "trx;LogFileName=f3-before.trx" --results-directory TestResults/f3-before
dotnet test tests/Karigor.Security.Tests/Karigor.Security.Tests.csproj --configuration Release --filter "Finding=F3" --logger "trx;LogFileName=f3-after.trx" --results-directory TestResults/f3-after
python scripts/run-security-tests.py --strict --filter "Finding=F3"
npm --prefix karigor-client run build
```

F3 raw and strict gate: **13 passes, zero failures/skips**. Combined backend after F7: **117 executed, 116 passed, one unchanged F5 assertion failure**, accounting exit 0/raw dotnet exit 1. All 13 F3 cases remain green there. Combined browser: **30 passes**, including 11 F7, five existing F1, one F2 and 13 F4 cases. These browser fixtures do not provide a live browser-to-hub socket proof.

Final .NET solution build: zero warnings/errors. Frontend typechecking/build/lint passed; lint retains 20 existing warnings and Vite retains its configuration/bundle warnings. Six Python classifier self-tests passed. `git diff --check` passed with repository line-ending settings.

Reports: `TestResults/f3-before/f3-before.trx`, `TestResults/f3-after/f3-after.trx`, strict F3 `TestResults/security/2d5d82bb99834879874004bb335803d2/security.trx`, combined `TestResults/security/1757007ad9044c5baf4269f8eba241b8/security.trx`, browser `karigor-client/test-results/security-browser/results.json`.

## Failures, alternatives and remaining risks

Lookup failures deny access/private delivery; they never switch to a global or old-room fallback. SignalR failure can lose live invalidation after a SQL commit, so REST re-fetch remains necessary. Existing best-effort notification behavior was retained. No outbox, delivery retry queue, broker, Redis or payment/offer concurrency architecture was added.

Using only room checks would leave stale room membership as a delivery risk. Server-derived user delivery is slightly more expensive and makes every participant connection receive private invalidation even without joining the room; the client already filters messages by booking. Role-only checks and opaque booking IDs do not solve BOLA/IDOR. Signed room tokens add expiry/revocation complexity without replacing current resource checks.

F6 stronger logout/session revocation remains unimplemented. JWT expiry closes connections; current suspension and current resource/admin-recipient queries are implemented, but there is no refresh-family authority. Expiry closure is configured, not a timed WebSocket/IIS test in this suite. Tests use Long Polling/TestServer; WebSockets, multiple nodes, IIS and hosted CI were not run. Recipient reads and delivery are not one SQL transaction, so an in-flight permission change is not an atomic cutoff guarantee.

Discovery hints are minimized, but REST request-detail/listing privacy still needs its own eligibility review. Public review REST DTOs were not redesigned. These are linked read-boundary follow-ups, not silently fixed findings.

A release must restart/disconnect pre-change connections and review compatible client rollout. No deployment, production data access/change, commit, push or merge occurred. The repository is ready to begin local schema-authority reconciliation and F5 work; the remaining F5 red assertion must remain until its consent invariant is repaired.

Concept references: [Microsoft's group security boundary](https://learn.microsoft.com/en-us/aspnet/core/signalr/groups?view=aspnetcore-10.0) and [SignalR authentication lifetime](https://learn.microsoft.com/en-us/aspnet/core/signalr/authn-and-authz?view=aspnetcore-10.0).
