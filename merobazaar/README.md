# 🛍️ MeroBazaar — Nepal's Premier Marketplace

A full-stack production-ready marketplace built with **React + Node.js + MongoDB**.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)
- npm / yarn

### 1. Start Backend
```bash
cd backend
cp .env.example .env        # Edit your config
npm install
npm run dev                  # Starts on http://localhost:5000
```

### 2. Seed Database (first run)
```bash
cd backend
npm run seed
```

### 3. Start Frontend
```bash
cd frontend
npm install
npm run dev                  # Opens http://localhost:5173
```

---

## 🔑 Demo Accounts

| Role   | Email                      | Password   |
|--------|----------------------------|------------|
| Admin  | admin@merobazaar.com       | Admin@123  |
| Buyer  | buyer@merobazaar.com       | Buyer@123  |
| Seller | seller@merobazaar.com      | Seller@123 |

---

## 🏗️ Architecture

```
merobazaar/
├── backend/                  # Node.js + Express API
│   ├── src/
│   │   ├── config/           # DB, Cloudinary
│   │   ├── controllers/      # Route handlers
│   │   ├── middleware/        # Auth, error, upload, validate
│   │   ├── models/           # Mongoose schemas
│   │   ├── routes/           # Express routers
│   │   ├── sockets/          # Socket.io live chat
│   │   └── utils/            # JWT, email, seeder
│   └── package.json
├── frontend/                 # React + Vite + Tailwind
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   ├── lib/              # API client, utils
│   │   ├── pages/            # All route pages
│   │   └── store/            # Zustand state
│   └── package.json
└── docker-compose.yml        # Full Docker setup
```

## ✨ Features

### Buyer
- Browse, search, filter products (price, brand, category, rating, stock)
- Product detail with image gallery, specs, reviews
- Cart management with quantity controls
- Wishlist
- Multi-step checkout with address form
- Payment: eSewa, Khalti, Stripe, Cash on Delivery
- Order tracking with live status timeline
- Review & rate products (verified purchase badge)
- Live chat with sellers via Socket.io
- Notifications (order updates, messages)
- Profile with address book, password change

### Seller
- Seller dashboard with analytics
- Product CRUD with Cloudinary image upload
- Inventory management (stock alerts)
- Order management with status updates
- Store profile customization

### Admin
- Full analytics dashboard (revenue, orders, users charts)
- User management (suspend/activate)
- Order management & status control
- Product management
- Category CRUD

## 🔐 Security
- JWT + refresh token rotation
- bcrypt password hashing (12 rounds)
- Rate limiting (100 req/15min, 20 auth/15min)
- Helmet.js security headers
- MongoDB sanitization
- Input validation (Joi)
- CORS configured

## 💳 Payment Integrations
- **eSewa**: Nepal's leading digital wallet
- **Khalti**: Fast mobile payment
- **Stripe**: International card payments
- **Cash on Delivery**: Traditional COD

## 🐳 Docker Deployment
```bash
docker-compose up -d
```
Opens on http://localhost (port 80)

## 📡 API Docs
Base URL: `http://localhost:5000/api`

| Route | Description |
|-------|-------------|
| POST /auth/register | Register new user |
| POST /auth/login | Login & get tokens |
| POST /auth/verify-otp | Verify email OTP |
| GET /products | List products with filters |
| GET /search | Advanced search + facets |
| POST /cart/add | Add to cart |
| POST /orders | Place order |
| POST /payments/esewa/initiate | Start eSewa payment |
| GET /orders/track/:code | Track order |
| GET /admin/dashboard | Admin analytics |
| GET /seller/dashboard | Seller analytics |
