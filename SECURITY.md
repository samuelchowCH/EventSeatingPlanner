# Security & Privacy Policy

## Reporting Security Issues
If you discover a security vulnerability within this repository, please report it by opening a GitHub issue or contacting the project maintainers directly. All legitimate security reports will be promptly investigated.

## Security Architecture & Data Handling

### 1. API Key Protection
- The Google Gemini API key (`GEMINI_API_KEY`) is stored strictly as a server-side environment variable.
- It is **never** embedded in client-side bundles, exported in responses, or committed to Git.
- When running locally or hosting your own instance, supply your own key in `.env` or your hosting platform environment configuration (e.g. Cloud Run, Vercel).

### 2. Client-Side Data Storage & Privacy
- All event seating configurations, guest list records, table definitions, and visual templates are stored **exclusively in your browser's local storage (`localStorage`)**.
- No event data, guest names, or dietary notes are transmitted to external databases or server backends.
- The Node/Express server acts purely as a thin stateless proxy to Gemini API endpoints.
- Clearing your browser cache/storage will erase all locally saved event data.

### 3. Server Security Controls
- **Security Headers**: Managed via `helmet` (Content Security Policy, frameguard, nosniff).
- **CORS**: Restricted using explicit origin allowlists.
- **Payload Limits**: Strict JSON body size limit (4 kB) and input character length caps (500 chars for prompts, 100 chars for event names/venues).
- **Sanitized Errors**: Internal stack traces and raw SDK exception strings are suppressed from API error responses.
- **Local Dev Binding**: Binds strictly to `127.0.0.1` in development mode.
