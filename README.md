# 💰 EdenSuite Server - Property Rental & Tour Management System Backend

A robust, scalable, and secure backend API for EdenSuite, powering a comprehensive ecosystem for property rentals and tour management. Built with Node.js, Express, TypeScript, and PostgreSQL (via Prisma).

## 🌐 Live URL

- **Backend API:** [https://eden-suite-server.vercel.app/](https://eden-suite-server.vercel.app/)
- **API Documentation:** `/api/v1`

---

## 🎯 Overview

EdenSuite Server is a production-ready RESTful API designed to handle complex workflows for users, hosts, and administrators. It features role-based access control, secure payment processing, automated notifications, and advanced data management.

### Key Highlights

- ✅ **Modern Backend Stack** - Built with Express 5, TypeScript, and Prisma ORM
- ✅ **Database Excellence** - PostgreSQL for reliable, relational data management
- ✅ **Secure Auth** - JWT-based authentication with access and refresh tokens
- ✅ **Payment Integration** - Stripe integration for bookings and payouts
- ✅ **Media Management** - Cloudinary for high-performance image handling
- ✅ **Email Service** - Automated emails via Nodemailer
- ✅ **Input Validation** - Centralized schema validation using Zod
- ✅ **Error Handling** - Global asynchronous error management

---

## 🚀 Features

### 🔐 Authentication & Authorization

- **JWT Authentication** - Secure token-based system for state-less auth
- **Role-Based Access Control (RBAC)** - Granular permissions for Admin, Host, and User
- **PIN/Password Security** - BCrypt hashing for sensitive credentials
- **Token Refresh** - Long-lived sessions with secure refresh token logic

### 🏠 Property & Tour Management

- **Listing API** - Create, update, and delete property and tour listings
- **Search & Filter** - Advanced querying for locations, prices, and categories
- **Booking Flow** - Transactional booking management with availability checks
- **Reviews System** - CRUD operations for managed guest feedback

### 💸 Financial & Subscriptions

- **Stripe Payments** - Secure checkout for bookings
- **Host Payouts** - Automated tracking and management of host earnings
- **Subscription Plans** - API support for platform pricing and features
- **Global Revenue Tracking** - Administrative tools for financial overview

### 📧 Notifications & Communication

- **Email Templates** - Transactional emails for bookings, resets, and updates
- **Secure SMTP** - Reliable delivery through configured email providers

---

## 🛠️ Tech Stack

| Technology | Purpose | Version |
|------------|---------|---------|
| **Node.js** | Runtime environment | Latest LTS |
| **Express.js** | Web framework | v5.1.x |
| **TypeScript** | Static typing | v5.9.x |
| **Prisma** | ORM for PostgreSQL | v6.16.x |
| **PostgreSQL** | Relational Database | Latest |
| **Cloudinary** | Image hosting/optimization | v2.8.x |
| **Stripe** | Payment processing | v20.0.x |
| **JWT** | Secure authentication | v9.0.x |
| **Zod** | Data validation | v4.1.x |
| **Nodemailer** | Email services | v7.0.x |

---

## 📁 Project Structure

```
Eden-Suite-Server/
├── src/
│   ├── app/
│   │   ├── config/           # App configuration & env variables
│   │   ├── middlewares/      # Express middlewares (Auth, Error handling)
│   │   ├── modules/          # Feature-based business logic
│   │   │   ├── auth/         # Auth logic
│   │   │   ├── user/         # User management
│   │   │   ├── tour/         # Tour operations
│   │   │   ├── property/     # Property operations
│   │   │   ├── payment/      # Stripe integration
│   │   │   └── blog/         # Blog management
│   │   ├── routes/           # Central route management
│   │   └── utils/            # Helper functions (API Response/Error)
│   ├── app.ts                # App initialization
│   └── server.ts             # Server entry point
├── prisma/                   # Database schema & migrations
│   ├── schema.prisma         # Prisma schema definition
│   └── seed.ts               # Database seed script
├── .env                      # Environment variables
├── package.json              # Project dependencies
└── tsconfig.json             # TypeScript configuration
```

---

## 🚦 API Endpoints (Snapshot)

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/login` | User login |
| POST | `/api/v1/auth/refresh-token` | Renew access token |
| POST | `/api/v1/auth/logout` | User logout |

### Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/user/my-info` | Current user profile |
| GET | `/api/v1/tour/all-tours` | List all available tours |
| POST | `/api/v1/booking/create` | Initiate a new booking |

---

## ⚙️ Environment Variables

Create a `.env` file in the root directory:

```env
PORT=5000
DATABASE_URL=postgresql://user:pass@host:port/db?sslmode=require
BCRYPT_SALT_ROUND=10
JWT_SECRET=your_secret
CLOUDINARY_CLOUD_NAME=your_name
CLOUDINARY_API_KEY=your_key
CLOUDINARY_API_SECRET=your_secret
STRIPE_SECRET_KEY=your_stripe_key
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=your_email
SMTP_PASS=your_app_password
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- PostgreSQL Database
- npm / yarn / pnpm

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Farhad25906/Eden-Suite-Server.git
   cd Eden-Suite-Server
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Database Migration**
   ```bash
   npx prisma migrate dev
   ```

4. **Seed Database**
   ```bash
   npm run seed
   ```

5. **Start Development Server**
   ```bash
   npm run dev
   ```

---

## 🔒 Security Best Practices

1. **Strict Validation** - All incoming data validated via Zod schemas.
2. **Secure Hashing** - Passwords never stored in plain text (BCrypt).
3. **Environment Isolation** - Sensitive keys managed via `.env`.
4. **CORS Configuration** - Restricted access to authorized domains only.

---

## 👨‍💻 Author

**Farhad Hossen**
- GitHub: [@Farhad25906](https://github.com/Farhad25906)
- Email: farhadhossen2590@gmail.com

---

## 📄 License

This project is licensed under the MIT License.
