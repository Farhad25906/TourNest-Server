# Tour Nest - Server

Robust and scalable backend for the Tour Nest platform, providing RESTful APIs for tour management, bookings, and payments.


## 🌐 Live Links

- **Client:** [https://tour-nest-client.vercel.app/](https://tour-nest-client.vercel.app/)
- **Server:** [https://tournest-server.onrender.com/](https://tournest-server.onrender.com/)

## 📂 Repository Links

- **Client Repository:** [https://github.com/Farhad25906/TourNest-Client](https://github.com/Farhad25906/TourNest-Client)
- **Server Repository:** [https://github.com/Farhad25906/TourNest-Server](https://github.com/Farhad25906/TourNest-Server)


## 🔐 Credentials

Admin: [farhad@ph.com](mailto:farhad@ph.com) / 123456

Host: [farhadhossen2590@gmail.com](mailto:farhadhossen2590@gmail.com) / 123456

Tourist: [farhadhossen9036@gmail.com](mailto:farhadhossen9036@gmail.com) / 123456


## 🚀 TeckStack

- **Runtime**: [Node.js](https://nodejs.org/)
- **Framework**: [Express.js](https://expressjs.com/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **ORM**: [Prisma](https://www.prisma.io/)
- **Database**: [PostgreSQL](https://www.postgresql.org/)
- **Validation**: [Zod](https://zod.dev/)
- **Payments**: [Stripe API](https://stripe.com/)
- **Cloud Media**: [Cloudinary](https://cloudinary.com/)

### Deployment

- **Frontend:** Vercel
- **Backend:** Render
- **Database:** Neon (PostgreSQL)

## ✨ Core Features (Core Functionalities)

- **Tour Management**: Full CRUD operations for global tours and destinations.
- **Booking Engine**: Sophisticated logic for reservation management and slot tracking.
- **Secure Payments**: Integrated Stripe hooks for safe transaction processing.
- **Review System**: Validated feedback loop for tourists and guides.
- **Subscription Logic**: Role-based access and subscription tier management.
- **Payout Management**: Automated logic for guide earnings and withdrawals.
- **Meta Data**: Analytics for admin and host dashboards.


## Role Based Features  

### For Users

1. **Registration & Login** - Secure authentication with JWT
2. **Profile Creation** - Add personal info, travel interests, and visited countries
4. **Discover Tours** - Search and filter compatible travel companions
4. **Book Tours** - Book Your Tour 
5. **Reviews & Ratings** - Rate and review fellow travelers after trips

### For Admins

1. **Dashboard Access** - Comprehensive platform overview
2. **User Management** - Monitor and manage platform users
3. **Platform Analytics** - Track user activity and engagement


### For Hots

1. **Create Tours** - On the Free Plan, a host can create up to 4 tours per year.
2. **Write Blogs** - On the Free Plan, a host can publish up to 5 blogs per year.
3. **Subscription Management** - Hosts can upgrade their subscription to unlock higher limits, premium features, and advanced management tools.
4. **Payment management** - Manage Your Tour Payments.
5. **Booking Mangement** - Manage Your All Bookings.

## 🔒 Security Features

- JWT-based authentication
- Password hashing with bcrypt
- Protected API routes
- Role-based access control (RBAC)
- Secure payment processing

## 📁 File Structure

```text
server/
├── prisma/               # Database schema and migrations
├── src/
│   ├── app/
│   │   ├── modules/      # Feature modules (Tour, Booking, Payment, etc.)
│   │   ├── routes/       # Centralized API routing
│   │   └── middlewares/  # Global Express middlewares
│   ├── config/           # Environment and app configurations
│   ├── app.ts            # App initialization logic
│   └── server.ts         # Server entry point
└── package.json          # Project dependencies and scripts
```

## 🛠️ Installation Process

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd TourNest/server
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Database Setup**:
   - Configure your `.env` file with `DATABASE_URL`.
   - Run migrations and generate client:
     ```bash
     npx prisma migrate dev
     npx prisma generate
     ```

4. **Run the development server**:
   ```bash
   npm run dev
   ```
