# Aspect Web App

A Node.js web application for Invoice and Payment Settlement in AspectCTRM.

## Features

- **Login Authentication**: Secure login using AspectCTRM credentials
- **Two-Grid Layout**: View Invoices and Payments side by side
- **Multi-Select**: Select multiple invoices and payments for allocation
- **Create Allocations**: Link payments to invoices with custom amounts
- **Filter & Search**: Filter by counterparty, currency, and status
- **Real-time Updates**: Refresh data with one click

## Prerequisites

1. **Node.js** (v16 or higher)
2. **AspectCTRM** server with webservice access
3. **Webservices deployed** in AspectCTRM (see below)

## Installation

```bash
cd aspect-web-app
npm install
```

## Configuration

1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

2. Edit `.env` with your AspectCTRM server details:
```
ASPECT_BASE_URL=http://your-aspect-server:60000
ASPECT_WEBSERVICE_PATH=/webservice/aspectrs
PORT=3000
SESSION_SECRET=your-secret-key
```

## Required AspectCTRM Webservices

Deploy these webservices in AspectCTRM (Services > Webservices):

1. **getInvoices** - Already exists in your system
2. **getPayments** - Use `webservice_getPayments.js`
3. **getLastMoneyAllocation** - Already exists in your system
4. **createAllocation** - Use `webservice_createAllocation.js`

### Deploying Webservices

1. Go to **Services > Webservices** in AspectCTRM
2. Click **Create Webservice**
3. Name: `getPayments` (or `createAllocation`)
4. Copy the script content from the corresponding `.js` file
5. Save and test

## Running the App

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

Then open http://localhost:3000 in your browser.

## Usage

1. **Login** with your AspectCTRM username and password
2. **Filter** by counterparty, currency, or status (Open/All)
3. **Select invoices** in the left grid
4. **Select payments** in the right grid
5. Optionally enter a specific **allocation amount**
6. Click **Create Allocation**

## Project Structure

```
aspect-web-app/
├── server.js           # Express server with auth
├── routes/
│   └── api.js          # API routes for AspectCTRM
├── public/
│   ├── index.html      # Main dashboard
│   ├── login.html      # Login page
│   ├── css/
│   │   └── styles.css  # Styling
│   └── js/
│       └── app.js      # Frontend logic
├── .env                # Configuration
└── package.json
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/login` | POST | Login with credentials |
| `/auth/logout` | POST | Logout |
| `/auth/user` | GET | Get current user |
| `/api/invoices` | GET | Get all invoices |
| `/api/invoices/unpaid` | GET | Get unpaid invoices |
| `/api/payments` | GET | Get all payments |
| `/api/payments/unallocated` | GET | Get unallocated payments |
| `/api/allocations` | GET | Get money allocations |
| `/api/allocations` | POST | Create allocation |
| `/api/allocations/:id` | DELETE | Delete allocation |

## Troubleshooting

### "Unable to connect to AspectCTRM server"
- Check `ASPECT_BASE_URL` in `.env`
- Ensure AspectCTRM server is running
- Check network connectivity

### "Invalid credentials"
- Verify username/password
- Check user has webservice access in AspectCTRM

### "Failed to fetch payments"
- Ensure `getPayments` webservice is deployed
- Check webservice permissions

## License

Internal use only - AspectCTRM integration
