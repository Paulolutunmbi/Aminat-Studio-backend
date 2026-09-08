# Aminat Studio API

The Aminat Studio backend is the Express API and persistence layer for the artist portfolio and gallery. It serves artwork and public studio settings, protects administrator operations, stores records in MongoDB, and manages artwork image assets through Cloudinary.

## Overview

The API gives the frontend a durable source of truth for the artwork catalogue and studio profile while keeping administrative operations private. Public visitors can read artwork and settings. An authenticated administrator can manage artworks, featured selections, ordering, studio settings, and account credentials.

## Features

- Express 5 HTTP server with JSON request parsing and credentialed CORS.
- MongoDB persistence through Mongoose.
- Artwork CRUD, ordering, featured-state management, and a maximum of three featured works.
- Public studio settings with protected updates.
- Admin bootstrap on startup from environment configuration.
- JWT-based admin sessions delivered in an `httpOnly` cookie.
- Bcrypt password hashing, password changes, and expiring password-reset tokens.
- Cloudinary upload and deletion for artwork images.
- Optional password-reset email delivery through Resend.
- Health endpoint reporting the current Mongoose connection state.

## Tech Stack

- Node.js and CommonJS modules
- Express 5
- Mongoose 9 and MongoDB
- `jsonwebtoken` for signed sessions
- `bcryptjs` for password hashing
- Cloudinary Node SDK for image assets
- Resend HTTP API for optional password-reset mail
- `dotenv`, `cors`, and `nodemon`

## Architecture

`src/server.js` loads `.env`, configures cookie parsing, CORS, JSON parsing, routes, and startup. Startup connects to MongoDB and then calls `ensureInitialAdmin()` before listening on `PORT`; a missing database connection or invalid admin bootstrap configuration prevents the server from starting.

Routes are mounted under `/api`:

- `/api/health` is the server health check.
- `/api/settings` serves the single `site-settings` document.
- `/api/artworks` serves public artwork reads and protected artwork mutations.
- `/api/admin` serves authentication and password-management endpoints.

## API Endpoints

All successful responses use a JSON object containing `success: true`; resource responses generally place the resource in `data`.

### Health and settings

| Method | Path | Auth | Behavior |
| --- | --- | --- | --- |
| `GET` | `/api/health` | No | Returns API status and Mongoose state (`disconnected`, `connected`, `connecting`, or `disconnecting`). |
| `GET` | `/api/settings` | No | Returns the `site-settings` document, creating the default document if none exists. |
| `PUT` | `/api/settings` | Admin cookie | Updates studio name, artist name, description, email, YouTube URL, TikTok URL, and profile image. |

### Artwork catalogue

| Method | Path | Auth | Behavior |
| --- | --- | --- | --- |
| `GET` | `/api/artworks` | No | Returns all artworks sorted by `order`, `sortOrder`, creation time, and ID. |
| `GET` | `/api/artworks/:id` | No | Returns one artwork by MongoDB ObjectId. |
| `POST` | `/api/artworks` | Admin cookie | Creates an artwork. `title` and an image value (`imageUrl` or `image`) are required. |
| `PUT` | `/api/artworks/:id` | Admin cookie | Updates supported artwork fields, including metadata, image, featured state, and ordering. |
| `DELETE` | `/api/artworks/:id` | Admin cookie | Deletes the artwork and attempts to delete its Cloudinary asset when a public ID is stored. |
| `PATCH` | `/api/artworks/:id/toggle-featured` | Admin cookie | Toggles the artwork's featured state. |
| `PUT` | `/api/artworks/:id/image` | Admin cookie | Replaces an artwork image using `image`, `imageUrl`, `url`, or a file-like payload. |

The implementation also keeps compatibility aliases for artwork upload, image replacement, feature, unfeature, and toggle operations, including `/upload`, `/replace-image`, `/feature`, `/unfeature`, and `/featured`. The frontend uses the canonical paths above.

Artwork image values may be `/images/...` paths, data URLs, local file paths, remote URLs, or Cloudinary URLs. Data URLs, remote URLs, and local file paths are uploaded to Cloudinary by the backend. Existing Cloudinary assets are deleted when a stored Cloudinary-backed image is replaced or deleted.

### Admin authentication

| Method | Path | Auth | Behavior |
| --- | --- | --- | --- |
| `GET` | `/api/admin/status` | Optional cookie | Returns whether the current session is authenticated. |
| `POST` | `/api/admin/login` | No | Validates credentials and sets the `aminat_admin_session` cookie. |
| `POST` | `/api/admin/logout` | Optional cookie | Clears the admin session cookie. |
| `POST` | `/api/admin/change-password` | Admin cookie | Verifies the current password, applies password-strength rules, increments the session version, and clears the current cookie. |
| `POST` | `/api/admin/forgot-password` | No | Creates a 15-minute reset token and sends it through Resend when configured. |
| `POST` | `/api/admin/reset-password` | No | Consumes a valid reset token, updates the password, increments the session version, and clears the current cookie. |

## Authentication and Authorization

Admin credentials are bootstrapped from `ADMIN_EMAIL` and `ADMIN_INITIAL_PASSWORD` only when the configured admin account does not already exist. The initial password is stored as a bcrypt hash; an existing account is not overwritten at startup.

After a successful login, the API signs a JWT containing the admin ID, normalized email, and session version. It sends the token in an `httpOnly` cookie named `aminat_admin_session`. Protected routes verify the signature, load the active admin from MongoDB, and compare the token's session version with the database value. Password changes, password resets, and new logins rotate that version, invalidating older sessions.

The cookie uses `sameSite: 'lax'` and `secure: false` outside production. With `NODE_ENV=production`, it uses `sameSite: 'none'` and `secure: true` for the deployed Vercel frontend and Render API combination. Frontend requests must include credentials.

## Database

MongoDB is required. The connection string comes from `MONGODB_URI`, and the server does not listen until `mongoose.connect()` succeeds.

### Models

- **Admin**: unique normalized email, bcrypt password hash, active flag, last-login timestamp, session version, and hashed password-reset token metadata.
- **Artwork**: title, description, medium, year, image URL/value, Cloudinary public ID, featured flag, category, dimensions, and both `order` and `sortOrder` fields, with timestamps.
- **StudioSettings**: one `site-settings` record containing studio identity, description, contact email, social URLs, profile image, and timestamps.

There are no backend subscriber or message models. The frontend's subscriber and message screens are currently placeholders and are not persisted by this API.

## Project Structure

```text
Aminat-Studio-backend/
├── src/
│   ├── config/              Database, auth, and Cloudinary configuration
│   ├── controllers/         Admin and artwork request handlers plus tests
│   ├── middleware/          Admin session authorization
│   ├── models/              Admin, Artwork, and StudioSettings schemas
│   ├── routes/              API route definitions
│   ├── scripts/             Artwork migration, seed, and Cloudinary test scripts
│   ├── services/            Admin bootstrap, image, and email services
│   └── server.js            Application setup and startup
├── .env.example             Safe environment-variable template
├── package.json              Scripts and dependencies
├── verification_auth.js      End-to-end auth verification script
└── verification_auth_flow.js Extended auth-flow verification script
```

## Getting Started

### Prerequisites

- Node.js with npm
- A MongoDB database and a reachable `MONGODB_URI`
- A Cloudinary account and `CLOUDINARY_URL` (the Cloudinary config is loaded during application startup)
- An admin email and initial password
- A frontend origin for CORS configuration
- A Resend API key only if password-reset email delivery is required

### Installation

```bash
npm install
```

Copy `.env.example` to `.env` in this backend directory and fill in the values locally. Never commit `.env` or place real credentials in documentation.

### Environment Variables

| Variable | Required | Description |
| --- | --- | --- |
| `PORT` | No | HTTP port; defaults to `5000`. |
| `NODE_ENV` | No | Set to `production` for production cookie behavior. |
| `MONGODB_URI` | Yes | MongoDB connection string. |
| `FRONTEND_URL` | Yes for deployed cross-origin use | One or more comma-separated allowed frontend origins; local defaults also allow ports 3000 and 5173. |
| `JWT_SECRET` | Yes for admin login | Secret used to sign and verify admin session JWTs. |
| `SESSION_MAX_AGE_MS` | No | Session lifetime in milliseconds; defaults to seven days. |
| `ADMIN_EMAIL` | Yes | Normalized email for the configured administrator and password-reset target. |
| `ADMIN_INITIAL_PASSWORD` | Required when creating the first admin | Initial password used only for first-account bootstrap. |
| `CLOUDINARY_URL` | Yes | Cloudinary connection URL used for artwork uploads and deletion. |
| `RESEND_API_KEY` | No | Enables password-reset email delivery when present. |
| `RESEND_FROM_EMAIL` | No | Sender address for reset mail; defaults to `onboarding@resend.dev`. |

`ADMIN_NOTIFICATION_EMAIL` appears in one local environment file but is not read by the current source and is not part of the runtime configuration.

### Running Locally

```bash
npm run dev
```

This starts `nodemon src/server.js`, normally at `http://localhost:5000`. The process connects to MongoDB, bootstraps the configured admin if necessary, and then begins listening.

Useful checks and scripts:

```bash
npm run check
npm test
npm run migrate:artworks -- --execute
```

`npm run check` performs a syntax check of `src/server.js`. `npm test` runs the Node test suite. The migration command is disabled unless an approval flag such as `--execute` is supplied; it upserts the five artwork records defined by the migration script and optionally syncs existing local image files to Cloudinary.

## Production

```bash
npm start
```

The production command runs `node src/server.js`. Provide production environment variables through the hosting provider, use HTTPS, restrict `FRONTEND_URL` to trusted origins, and use a strong unique `JWT_SECRET`. The repository has no backend-specific Dockerfile, CI workflow, or hosting manifest, so provider build/start and secret configuration must be supplied by the deployment platform.

## External Services

### Cloudinary

Artwork uploads use the `aminat-studio/artworks` folder and request secure URLs, automatic format selection, and automatic quality. Replacement and deletion attempt to remove the previous stored public ID. Frontend-local `/images/...` paths are retained as paths and do not require Cloudinary.

### Resend

Password reset requests call the Resend API only when `RESEND_API_KEY` is configured. Reset links target `${FRONTEND_URL}/admin/reset-password?token=...` and expire after 15 minutes. Without a working Resend configuration, the reset request returns an error rather than silently reporting success.

## Security

- Keep `.env` out of version control and rotate any credential that has been exposed.
- Use a strong `JWT_SECRET`; without it, admin login and session verification cannot work.
- Passwords are hashed with bcrypt and are never returned by the model's default queries.
- Sessions are `httpOnly`, and session-version changes invalidate older cookies.
- Use HTTPS in production because cross-site cookies require `secure: true`.
- Restrict `FRONTEND_URL` to trusted origins. The server allows a request with no `Origin` header for non-browser/server-to-server checks.
- Validate and constrain production MongoDB and Cloudinary access at the provider level as well as in application configuration.
- The API does not currently implement rate limiting, CSRF tokens, multipart upload middleware, or a centralized error middleware. Review those gaps before exposing it to untrusted high-volume traffic.

## Error Handling

Validation and authentication failures return JSON with `success: false` and a human-readable `message`, commonly using `400`, `401`, `403`, or `404`. Database and service failures generally return `500`; password-reset email delivery failures return `503`. The frontend API wrapper surfaces the returned message to the UI.

The startup path logs configuration or connection failures and exits instead of starting a partially configured server.

## Deployment

The frontend currently defaults to the Render API URL `https://aminat-studio-backend.onrender.com/api` for production builds, and the authentication cookie configuration contains comments for a Vercel frontend talking to a Render backend. No Render configuration file or deployment workflow is present in this repository. Configure the hosting service to run `npm start`, provide all required environment variables, and set `FRONTEND_URL` to the actual deployed frontend origin.

## Known Limitations and Implementation Notes

- There are no subscriber or message API endpoints or database models. Contact inquiries are handled by the frontend through the visitor's email client.
- The API accepts JSON image data URLs and local/remote image sources rather than providing a dedicated multipart upload endpoint.
- Several artwork route aliases remain for compatibility; new clients should use the canonical routes in this README.
- The server includes a small hand-written cookie parser and does not use `cookie-parser`.
- The API health response mounted through `src/routes/index.js` reports `database: "connected"`, while the separate `/api/health` handler reports the actual Mongoose state. Use the latter for an accurate connection-state check.
- There is no automatic seed command in `package.json`; `src/scripts/seedArtworks.js` must be invoked directly if needed.

## Contributing

Run `npm test` and `npm run check` before submitting changes. Update this README whenever routes, models, environment variables, authentication behavior, or deployment assumptions change.

## License

The package declares the ISC license. Confirm the project's distribution requirements with the project owner before publishing or redistributing the application.
