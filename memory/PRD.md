# Invoice Scanner App - PRD

## Overview
A mobile app for pharmacy/medical stores to scan invoices, extract item data, track medicine expiry dates, and generate billing reports.

## Core Features

### 1. Invoice Scanning & OCR
- Capture invoice image via camera or gallery
- AI-powered extraction using Gemini Flash Vision:
  - Shop name
  - Invoice date
  - Items with: name, batch no, expiry date, quantity, price

### 2. Expiry Reminders (In-App)
- Dashboard alerts for medicines expiring:
  - This month
  - Next month
- List view of items by expiry date

### 3. Billing Reports
- Monthly breakdown by shop
- Date-wise purchase details
- Total billing amounts per shop

### 4. User Authentication
- Google OAuth via Emergent Auth
- Secure session management

## Tech Stack
- Frontend: Expo React Native
- Backend: FastAPI
- Database: MongoDB
- AI/OCR: Gemini Flash Vision (emergentintegrations)
- Auth: Emergent Google OAuth

## Database Collections
- users: User profiles
- user_sessions: Auth sessions
- invoices: Invoice metadata
- invoice_items: Individual line items
