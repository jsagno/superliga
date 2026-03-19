## Why
The liga-admin entry experience is inconsistent and less secure than liga-jugador. Today, users can land on the root URL before being guided through the intended authentication path, which creates avoidable confusion and increases the chance of unauthorized or ambiguous states.

This change aligns admin access with the same authentication model used by liga-jugador to improve:
- Security consistency across applications
- Predictable role-based access behavior
- UX clarity by sending users immediately to login from root

## What Changes
- Define root URL behavior in liga-admin so visiting `/` redirects directly to the login page.
- Align liga-admin authentication flow and session expectations with liga-jugador’s established authentication method.
- Standardize allowed-role handling so admin authorization behavior is consistent for `ADMIN`, `SUPER_ADMIN`, and `SUPER_USER`.
- Remove ambiguity between app entry points so authentication and authorization decisions happen in a single, consistent path.

## Capabilities
### New Capabilities
- `root-to-login-redirect`: Accessing liga-admin root (`/`) always routes users to the login page as the canonical entry point.
- `shared-auth-foundation`: liga-admin uses the same authentication approach as liga-jugador for consistent identity and session handling.

### Modified Capabilities
- `admin-role-gate-consistency`: Existing admin access checks are aligned to consistently recognize and enforce `ADMIN`, `SUPER_ADMIN`, and `SUPER_USER` behavior under the shared auth model.

## Impact
- Stronger security posture through unified authentication expectations and reduced entry-point ambiguity.
- More coherent user experience across liga-admin and liga-jugador, lowering onboarding and support friction.
- Clearer authorization semantics for privileged roles, reducing risk of inconsistent access outcomes between apps.
- Foundation for future cross-app auth improvements without duplicating divergent auth behavior.