# Zappy Postman Docs

Import these files in Postman:

- `docs/postman/zappy-backend.postman_collection.json`
- `docs/postman/zappy-local.postman_environment.json`

## Usage Flow (Auth + Protected APIs)

1. Run backend on `http://localhost:4000`
2. Select environment: `Zappy Local`
3. Run Auth flow in order:
   - `Signup OTP Request`
   - `Signup OTP Verify`
   - `Signup`
   - `Login` (auto-saves `accessToken` and `refreshToken`)
4. Use protected module endpoints (Contacts/Campaigns/etc.) with saved token and `x-org-id`.

## Notes

- Collection is module-wise for frontend reference.
- Some modules are scaffolded and return placeholder responses until implementation is completed.
- Auth endpoints are implemented and include OTP-gated signup.
