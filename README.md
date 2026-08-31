# Aminat Studio Backend

This repository contains the backend foundation for the Aminat Studio artist portfolio application.

## Features

- Express server setup
- CORS configuration for frontend development
- MongoDB connection with Mongoose
- Health check endpoint at `/api/health`

## Required environment variables

Create a local `.env` file based on `.env.example` and provide your own values for:

- `PORT`
- `MONGODB_URI`
- `FRONTEND_URL`

## Scripts

- `npm run dev` - start development server with nodemon
- `npm start` - start production server

## Health check

- `GET /api/health`

Returns a JSON payload with API status and database connection status.
