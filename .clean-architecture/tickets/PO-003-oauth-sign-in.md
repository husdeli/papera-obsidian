# [PO-003] OAuth sign-in and token refresh

**Status**: Completed
**Priority**: Critical
**Effort**: M
**Category**: feature
**Created**: 2026-08-23

## Description

The plugin signs a user in to Papera and keeps a valid access token. Sign-in runs through
Obsidian's protocol handler, so the browser returns the user to the vault after Papera
approves the request.

Papera already runs an OAuth authorization server. `src/features/auth/auth.server.ts` uses
`@better-auth/oauth-provider`, and Papera serves `/.well-known/oauth-authorization-server`.
The plugin is a public client, so it uses PKCE.

**Warning**: the token lands in `data.json` in plaintext, and any other plugin in the vault
can read that file. This is why the access token is short-lived.

## Acceptance Criteria

- [ ] The plugin registers `registerObsidianProtocolHandler("papera-auth")`.
- [ ] A "Sign in" action opens Papera's authorization page in the browser.
- [ ] The authorization code flow uses PKCE, and no client secret ships in the bundle.
- [ ] Papera returns the user to `obsidian://papera-auth`, and the plugin exchanges the code for tokens.
- [ ] The plugin stores an access token and a refresh token in `data.json`.
- [ ] An expired access token refreshes without any user action.
- [ ] One token per vault covers every project the user owns.
- [ ] The plugin records which Papera account the vault is signed in as.
- [ ] Signing in as a second account, while the reserved root holds another account's notes, is refused with an explanation.
- [ ] The refusal leaves every synced note in place and does not clear the first account's tokens.
- [ ] A refresh that Papera refuses puts the plugin in a signed-out state. A refresh that fails
      on the network leaves the tokens in place. Neither deletes a vault file.
- [ ] "Sign out" clears both tokens and deletes no vault file.
- [ ] The HTTP client from PO-002 attaches the access token to every Papera request.

## Implementation Steps

1. **Discovery**: the plugin reads `/.well-known/oauth-authorization-server` to find the authorize and token endpoints.
2. **Client registration**: the plugin registers itself at `/oauth2/register` the first time a person signs in, and stores the returned `client_id` in `data.json`.
3. **Authorization**: the plugin generates a PKCE verifier and a state value, then opens the authorization URL in the browser.
4. **Callback**: the protocol handler receives the code, checks the state, and exchanges the code for tokens.
5. **Refresh**: the HTTP client refreshes the access token when it expires, and retries the request once.
6. **Signed-out state**: a failed refresh clears the tokens and tells the user to sign in again. It never touches the vault.

## Decisions

- **Public client with PKCE**: a plugin bundle is readable, so it holds no client secret.
- **Short-lived access token with refresh**: `data.json` is plaintext, so a leaked access token expires quickly. Papera already stores refresh tokens in `oauth_refresh_token`.
- **A sign-out never deletes notes**: losing a token is not the same as unsyncing a project. PO-007 owns unsyncing.
- **One vault, one Papera account**: mixing two accounts in one folder would make every note's ownership ambiguous. The plugin detects the second account and refuses rather than merging.

### Interview decisions (2026-08-24)

- **One OAuth client per vault.** The plugin registers itself at `/oauth2/register` on the first sign-in and keeps the returned `client_id` in `data.json`. Papera already sets `allowDynamicClientRegistration: true` and `allowUnauthenticatedClientRegistration: true`, so `slide-weaver` needs no change. This makes the PRD's "granted per vault and withdrawn per vault" literally true: withdrawing one vault leaves the person's other vaults signed in. A pre-registered client id would make Papera's grant per `(client, user)`, so one withdrawal would cut off every vault that person owns. This settles the open question the old implementation step 2 named.
- **The account id lives in `data.json` for now.** PO-003 stores the Papera account id beside the tokens. PO-004 adds the durable record in `.papera-index.json`, and the sign-in check prefers the index when it exists. No synced note can exist before PO-004 and PO-006 ship, so a plugin reinstall cannot orphan a note before the index exists. PO-003 therefore reads and writes no vault file. **PO-004 gains one acceptance criterion: the second-account refusal reads the account recorded in the index.**
- **The plugin requests `sync:read` and `offline_access` only.** Phase 1 is a read-only pull, so the consent screen asks for read access only. `offline_access` is what makes Papera issue a refresh token. PO-011 sends the person through the consent screen a second time to add `sync:write`.
- **The Papera origin is `https://papera.dev`.** This replaces the unverified `https://papera.app` placeholder in `src/config/papera.config.ts` and closes its `TODO`. The existing `baseUrl` setting still lets a vault point at a local `slide-weaver` run for testing.

### Confirmed assumptions

- The plugin sends `resource=${baseUrl}/api/sync` on the code exchange and on every refresh. `@better-auth/oauth-provider@1.6.24` issues a JWT access token only when the token request carries `resource`; without it the token is opaque and carries no `aud` and no `sub`.
- The plugin reads the account id from the `sub` claim of the JWT access token. It requests no `openid` scope, so the refusal message names no email address.
- The plugin keeps the PKCE verifier and the `state` value in `data.json` until the callback arrives, because Obsidian on a phone can be killed while the person is in the browser. It clears both after use.
- Refresh is single-flight, and the rotated refresh token reaches `data.json` before the new access token is used. Papera revokes the whole token family when a revoked refresh token is presented again, so a second concurrent refresh would sign the vault out.
- A new authenticated service owns the token and adds the `Authorization` header, then delegates to `paperaHttpClient`. The HTTP client keeps the `AGENTS.md` rule that it reads no settings and holds no base URL.
- "Sign out" calls `/oauth2/revoke` and then clears the tokens. A failed revoke still clears them.
- "Sign in" and "Sign out" live in a plugin settings tab that PO-007 later extends. `design.md` specifies no surface, so the plan chooses the wording.

### Known limit

A live end-to-end sign-in cannot succeed until `slide-weaver` accepts the sync resource and the `sync:read` scope. Papera's `validAudiences` lists only the MCP resource today, and it passes no `scopes` option, so the token request answers `400 invalid_request` and the authorize request answers `invalid_scope`. PO-001 owns both changes. A local `slide-weaver` run with them added verifies PO-003.

## Technical Notes

### Data Requirements

- `data.json` holds the access token, the refresh token, the expiry time, and the Papera account the vault is signed in as.

### Architectural Considerations

- **The state check is the only defence against a forged callback.** Any application can open an `obsidian://` URL.
- **Refresh must be single-flight.** A sync fires many requests at once. Without a single-flight guard, an expired token starts one refresh per in-flight request.

## Testing

- **Unit**: the PKCE verifier and challenge; the state check; the single-flight refresh; the signed-out transition on a failed refresh.
- **API**: the token exchange and the refresh exchange against Papera.
- **Manual**:
  - [ ] Sign in on desktop and confirm the browser returns to the vault.
  - [ ] Sign in on mobile.
  - [ ] Revoke the token in Papera and confirm the plugin signs out and deletes nothing.
  - [ ] Sign in as a second account with notes already synced, and confirm the plugin refuses and keeps every note.

## Related

- Related Tickets: PO-002 (the HTTP client), PO-001 (what the token authenticates)

---

## Iteration Log

- **Iteration 1 (2026-08-23)**: Split out of the original single ticket.
- **Iteration 2 (2026-08-24)**: Feature interview run. Four decisions recorded: one OAuth client per vault, the account id in `data.json`, the scopes `sync:read` and `offline_access`, and the origin `https://papera.dev`.
- **Iteration 3 (2026-08-24)**: The failed-refresh criterion is narrowed. It first said that any failed refresh signs the vault out. Only a refusal from Papera does that now. A lost network must not destroy a session, so a transport failure and a `5xx` answer leave the tokens in place.
