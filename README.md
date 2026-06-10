# InvoiceSnap

A mobile app for pharmaceutical distributors and pharmacy staff to scan invoices, extract structured data via AI, track product expiry dates, and generate billing reports.

**Live demo:** https://invoice-snap-xi.vercel.app

---

## What it does

InvoiceSnap uses Google Gemini Vision to read photos of pharmaceutical invoices and extract structured data — shop name, invoice date, and line items including batch number, expiry date, quantity, and price. Once scanned, invoices are stored per user and surfaced through expiry alerts and monthly billing reports.

---

## Features

- **Invoice scanning** — photograph or upload an invoice image; Gemini 2.5 Flash extracts the data automatically
- **Expiry alerts** — items grouped into expired, expiring this month, and expiring next month
- **Billing reports** — monthly summaries broken down by shop, with total amounts and item counts
- **Invoice management** — view, expand, and delete previously scanned invoices
- **Google OAuth** — session-based authentication; all data is scoped to the logged-in user

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React Native (Expo), TypeScript |
| Backend | Python, FastAPI |
| Database | MongoDB |
| AI / OCR | Google Gemini 2.5 Flash (via `emergentintegrations`) |
| Auth | Google OAuth via Emergent Auth |

---

## Project structure

```
InvoiceSnap/
├── frontend/           # React Native / Expo app
│   └── app/
│       ├── index.tsx          # Login / landing screen
│       └── (tabs)/
│           ├── _layout.tsx    # Tab navigator (Home, Scan, Invoices, Alerts, Reports)
│           ├── index.tsx      # Dashboard with stats and quick actions
│           ├── scan.tsx       # Camera capture + OCR results
│           ├── invoices.tsx   # Invoice list with expand/collapse
│           ├── alerts.tsx     # Expiry alert tabs
│           └── reports.tsx    # Monthly billing reports
├── backend/
│   └── server.py              # FastAPI app with all API routes
├── tests/                     # Test suite
├── test_reports/              # Generated test output
├── backend_test.py            # Backend API test script
├── auth_testing.md            # Guide for testing auth-gated endpoints
└── image_testing.md           # Guide for testing OCR with real images
```

---

## API reference

All endpoints are under `/api`. Protected endpoints require `Authorization: Bearer <session_token>`.

### Public

| Method | Path | Description |
|---|---|---|
| GET | `/api/` | Health check |
| GET | `/api/health` | Health check (detailed) |

### Auth

| Method | Path | Description |
|---|---|---|
| GET | `/api/auth/session` | Initiate OAuth session |
| GET | `/api/auth/me` | Get current user |
| POST | `/api/auth/logout` | End session |

### Invoices (protected)

| Method | Path | Description |
|---|---|---|
| POST | `/api/invoices/scan` | Scan invoice image, extract data |
| GET | `/api/invoices` | List all invoices for the user |
| GET | `/api/invoices/{id}` | Get a single invoice |
| DELETE | `/api/invoices/{id}` | Delete an invoice |

### Alerts & Reports (protected)

| Method | Path | Description |
|---|---|---|
| GET | `/api/expiry-alerts` | Items grouped by expiry window |
| GET | `/api/reports/monthly?year=YYYY&month=MM` | Monthly report by shop |
| GET | `/api/reports/summary` | Overall counts and totals |

---

## Running locally

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn server:app --reload
```

Requires environment variables:
- `MONGO_URL` — MongoDB connection string
- `DB_NAME` — database name (default: `test_database`)
- `GEMINI_API_KEY` — Google Gemini API key

### Frontend

```bash
cd frontend
npm install
npx expo start
```

Requires a `.env` file pointing `EXPO_PUBLIC_API_URL` at your backend.

---

## Testing

Run the backend test suite (requires a running backend and MongoDB):

```bash
python backend_test.py
```

The script covers health checks, session-based auth, invoice listing, expiry alerts, and monthly/summary reports. It creates a throwaway test user in MongoDB and cleans up after itself.

For manual auth testing against a live environment, see [`auth_testing.md`](auth_testing.md).

---

## Data model

Each scanned invoice stores:

```json
{
  "user_id": "...",
  "shop_name": "City Pharma",
  "invoice_date": "2025-07-15",
  "items": [
    {
      "name": "Paracetamol 500mg",
      "batch_no": "BT2024X",
      "expiry_date": "2026-03-01",
      "quantity": 100,
      "price": 4.50
    }
  ],
  "total_amount": 450.00,
  "created_at": "2025-07-15T10:30:00Z"
}
```

---

## License

Not specified. Contact the repository owner for usage terms.# Here are your Instructions
