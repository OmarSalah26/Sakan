<div align="center">
  <img src="frontend/public/logo.png" alt="Sakan logo" width="150" />

Sakan | سكن

Student Housing, Organized.





A full-stack student-housing platform built for the Egyptian market — bringing students, owners, and brokers into one structured place to discover, compare, publish, and manage student accommodation.

  <p>
    <a href="https://www.sakan-egy.com/">Live Demo</a>
    ·
    <a href="#screenshots">Screenshots</a>
    ·
    <a href="#quick-start">Quick Start</a>
    ·
    <a href="#team">Team</a>
  </p>

  <p>
    <img src="https://img.shields.io/badge/React-18.3.1-61DAFB?logo=react&logoColor=white" alt="React" />
    <img src="https://img.shields.io/badge/Vite-5.4.10-646CFF?logo=vite&logoColor=white" alt="Vite" />
    <img src="https://img.shields.io/badge/FastAPI-0.115%2B-009688?logo=fastapi&logoColor=white" alt="FastAPI" />
    <img src="https://img.shields.io/badge/SQLAlchemy-2.0%2B-D71F00?logo=sqlalchemy&logoColor=white" alt="SQLAlchemy" />
    <img src="https://img.shields.io/badge/Leaflet-1.9.4-199900?logo=leaflet&logoColor=white" alt="Leaflet" />
    <img src="https://img.shields.io/badge/Vercel-Ready-000000?logo=vercel&logoColor=white" alt="Vercel" />
    <img src="https://img.shields.io/badge/Python-3.11%2B-3776AB?logo=python&logoColor=white" alt="Python" />
    <img src="https://img.shields.io/badge/Status-Active%20Development-0D63EA" alt="Status" />
  </p>
</div>

Product Overview

Searching for student accommodation can become a fragmented process: listings live across social media, important details are often missing, and students may need several calls before they know whether a place actually fits.

Sakan turns that process into a structured housing marketplace.

The platform lets students discover and compare listings using organized information such as location, room type, price, amenities, advertiser type, available beds, photos, and map location — while owners and brokers get a dedicated environment to publish and manage their housing inventory.

Core idea: put the important housing information in front of the student before the call or visit.

Live Demo

🌐 Open Sakan

Explore the current web experience, including housing discovery, filtering, listing details, and the platform's student-focused interface.

Screenshots

Discover & Search



Listing Details



Responsive Experience



Screenshot note: the preview images above were prepared from the project's current UI direction and bundled repository assets so the GitHub README has a visual product showcase without relying on external mockups.

What Sakan Solves

Challenge

Sakan approach

Scattered student-housing posts

A dedicated student-housing marketplace

Missing or inconsistent listing details

Structured listing fields and organized property information

Repeated calls to collect basic information

Details are surfaced directly in the listing

Hard-to-compare options

Filters, standardized listing cards, and detailed pages

Unclear property location

Interactive maps and location coordinates

Owners and brokers struggling to reach students

Dedicated listing and advertiser workflows

Listings becoming outdated

Status, availability, republish, deactivate, and moderation flows

Key Capabilities

For Students

Browse student-housing listings.

Filter by governorate, city, neighborhood, gender, price, room type, amenities, and advertiser type.

View detailed property pages with media and structured information.

Explore properties on interactive maps.

Bookmark listings.

Contact advertisers.

View advertiser profiles and ratings.

Report listings that are no longer vacant.

Use the housing guide and pre-contract information pages.

For Owners & Brokers

Create and manage housing listings.

Publish structured property, pricing, room, and location information.

Upload listing photos and videos.

Manage available beds and listing status.

Republish, deactivate, reactivate, update, and delete listings.

Maintain advertiser profiles.

Receive and manage messages through the advertiser inbox.

Track ratings and platform activity.

For Administrators

Manage users and advertiser accounts.

Review and manage listings.

Handle complaints and reports.

Verify accounts and ratings.

Moderate users and listings.

Manage governorates and platform availability.

Manage advertiser messages and administrative workflows.

Maps & Location

Leaflet-powered interactive maps.

OpenStreetMap and satellite/hybrid map layers.

Draggable property markers.

Browser geolocation support for picking a property location.

Map-aware listing presentation.

Authentication & Trust

Phone-based onboarding and authentication flows.

Password authentication and password-change support.

Role-based account types for students, brokers/owners, and admins.

PBKDF2-HMAC-SHA256 password hashing in the backend.

Verification flags, ratings, complaints, reporting, and moderation workflows.

Architecture

flowchart LR
    U[Students / Owners / Brokers / Admins]
    FE[React + Vite Frontend]
    API[FastAPI REST API]
    ORM[SQLAlchemy ORM]
    DB[(SQLite / PostgreSQL)]
    MAP[Leaflet Maps]
    MEDIA[Cloudinary]
    OTP[Akedly OTP]

    U --> FE
    FE --> API
    FE --> MAP
    API --> ORM
    ORM --> DB
    API --> MEDIA
    API --> OTP

Repository structure

Sakan-main/
├── .github/
│   └── workflows/
├── backend/
│   ├── app/
│   │   └── main.py
│   ├── tests/
│   ├── requirements.txt
│   └── ...
├── frontend/
│   ├── public/
│   ├── src/
│   ├── package.json
│   ├── vite.config.js
│   └── vercel.json
├── docs/
│   └── screenshots/
├── sakan.db
└── README.md

Tech Stack

Layer

Technologies

Frontend

React 18, Vite, Leaflet, Lucide React

Backend

FastAPI, Uvicorn, Pydantic

Data Access

SQLAlchemy

Database

SQLite for local development, PostgreSQL support for deployment

Media

Cloudinary

OTP

Akedly integration

Testing

Pytest

Frontend Deployment

Vercel

Maps

Leaflet + OpenStreetMap / satellite-hybrid tiles

Quick Start

Prerequisites

Python 3.11+

Node.js 18+

npm

Git

1. Clone

git clone <your-repository-url>
cd Sakan-main

2. Start the backend

cd backend
python -m venv .venv

Windows

.venv\Scripts\activate

macOS / Linux

source .venv/bin/activate

Install dependencies:

pip install -r requirements.txt

Run FastAPI:

uvicorn app.main:app --reload --port 8000

Backend:

http://localhost:8000

Swagger / OpenAPI:

http://localhost:8000/docs

3. Start the frontend

Open a second terminal:

cd frontend
npm install
npm run dev

Vite will print the local frontend URL in the terminal.

Environment Variables

Frontend

Create frontend/.env when you need to override the API target:

VITE_API_BASE=http://localhost:8000

The application also has built-in development/production fallbacks for the API base URL.

Backend

# Database
DATABASE_URL=

# Cloudinary
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Akedly OTP integration
AKEDLY_API_KEY=
AKEDLY_PIPELINE_ID=

# Testing
TESTING=false

For local development, the backend can fall back to SQLite when DATABASE_URL is not provided.

Never commit secrets, API credentials, or .env files.

API Surface

The FastAPI backend includes endpoint groups for the main platform workflows:

Domain

Examples

Health

GET /health

Authentication

/auth/register, /auth/login, /auth/verify

Listings

/listings, /listings/{listing_id}

Listing lifecycle

Republish, deactivate, reactivate, delete

Beds

/listings/{listing_id}/beds

Bookmarks

/bookmarks

Ratings

/ratings/advertiser, /ratings/property

Complaints

/complaints + admin moderation

Profiles

/users/{user_id}/profile

Governorates

/governorates + admin management

Waitlist

/waitlist + admin management

Messaging

Advertiser inbox + admin messaging

Uploads

Avatar, listing image, and listing video uploads

For the complete request/response schema, run the backend and use /docs.

Testing

The backend contains automated tests for authentication, onboarding, dashboards, listing workflows, beds, search scope, ratings, moderation, and related platform behavior.

Run:

cd backend
pytest

Deployment

Frontend — Vercel

The frontend already contains Vercel configuration under frontend/vercel.json.

Set the production API URL in Vercel environment variables:

VITE_API_BASE=https://your-api-domain.com

Backend

The FastAPI application can be deployed to a Python/ASGI-compatible service.

For production, configure:

PostgreSQL through DATABASE_URL.

Cloudinary credentials for external media storage when enabled.

Akedly credentials when OTP delivery is enabled.

Production environment variables and secret management.

A production ASGI process such as Uvicorn.

Engineering Notes

Database strategy

The repository supports SQLite for local development while the backend contains PostgreSQL-oriented production support through DATABASE_URL.

Media handling

Listing and profile media can be uploaded through the backend and stored through Cloudinary when the integration is configured.

Security

Passwords are hashed server-side using PBKDF2-HMAC-SHA256. Authentication, account verification, moderation, ratings, complaints, and role-based platform behavior are implemented in the backend.

Team

Built by:

Contributor

GitHub

Abdallah Salah

@ABDALLAH749

Omar Salah Hemied

@OmarSalah26

Islam Abdo

@islam-abdo-1

Team profiles





Project Status

Active development. The repository currently brings together the web frontend, FastAPI backend, database layer, authentication flows, listing management, maps, media uploads, moderation workflows, messaging, and automated backend tests.

License

No open-source license is currently specified in this repository.

<div align="center">
  <sub>Built for a more organized student-housing experience in Egypt.</sub>
</div>
