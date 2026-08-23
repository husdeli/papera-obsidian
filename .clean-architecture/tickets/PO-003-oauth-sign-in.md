# [PO-003] OAuth sign-in and token refresh

**Status**: Not Started
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
- [ ] A failed refresh puts the plugin in a signed-out state and deletes no vault file.
- [ ] "Sign out" clears both tokens and deletes no vault file.
- [ ] The HTTP client from PO-002 attaches the access token to every Papera request.

## Implementation Steps

1. **Discovery**: the plugin reads `/.well-known/oauth-authorization-server` to find the authorize and token endpoints.
2. **Client registration**: Papera recognises the plugin as an OAuth client. Open question T4 in `roadmap.md` decides between a pre-registered client id and dynamic client registration.
3. **Authorization**: the plugin generates a PKCE verifier and a state value, then opens the authorization URL in the browser.
4. **Callback**: the protocol handler receives the code, checks the state, and exchanges the code for tokens.
5. **Refresh**: the HTTP client refreshes the access token when it expires, and retries the request once.
6. **Signed-out state**: a failed refresh clears the tokens and tells the user to sign in again. It never touches the vault.

## Decisions

- **Public client with PKCE**: a plugin bundle is readable, so it holds no client secret.
- **Short-lived access token with refresh**: `data.json` is plaintext, so a leaked access token expires quickly. Papera already stores refresh tokens in `oauth_refresh_token`.
- **A sign-out never deletes notes**: losing a token is not the same as unsyncing a project. PO-007 owns unsyncing.

## Technical Notes

### Data Requirements

- `data.json` holds the access token, the refresh token and the expiry time.

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

## Related

- Related Tickets: PO-002 (the HTTP client), PO-001 (what the token authenticates)

---

## Iteration Log

- **Iteration 1 (2026-08-23)**: Split out of the original single ticket.
