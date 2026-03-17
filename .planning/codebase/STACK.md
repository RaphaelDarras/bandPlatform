# Technology Stack

**Analysis Date:** 2026-02-13

## Languages

**Primary:**
- JavaScript (Node.js/CommonJS) - Backend API and server tooling
- TypeScript - Planned for API and frontend development

**Secondary:**
- React/JSX - Web frontend (Vite-based)
- React Native/JavaScript - Android mobile app (Expo)

## Runtime

**Environment:**
- Node.js (LTS recommended, version TBD)

**Package Manager:**
- npm
- Lockfile: Not yet present (initial setup phase)

## Frameworks

**Backend:**
- Express.js - REST API framework

**Frontend:**
- React 18+ - Web application (with Vite bundler)
- React Native (with Expo) - Android mobile application

**Styling:**
- Tailwind CSS - Web frontend styling

**Mobile UI:**
- React Native Paper - Material Design components for mobile

## Key Dependencies

**Backend/Core:**
- `express` - REST API server
- `mongoose` - MongoDB ODM (Object Document Mapper)
- `dotenv` - Environment variable management
- `jsonwebtoken` (JWT) - Authentication token generation/validation
- `bcrypt` - Password hashing for admin authentication

**Payment Processing:**
- `stripe` - Stripe payment SDK
- `@paypal/checkout-server-sdk` - PayPal payment processing
- `joi` or `express-validator` - Request validation

**Frontend/Web:**
- `react` - UI framework
- `react-router` - Client-side routing
- `axios` - HTTP client for API calls
- `@stripe/stripe-js` - Stripe frontend library
- `@stripe/react-stripe-js` - React components for Stripe
- `react-paypal-js` - PayPal integration
- `react-hook-form` - Form handling
- `zustand` or Context API - State management

**Mobile:**
- `react-native` - Mobile framework
- `expo` - Managed React Native platform
- `react-navigation` - Mobile app routing
- `axios` - HTTP client

**Development/Utilities:**
- `nodemailer` - Email notifications (optional)
- `swagger-ui-express` - API documentation (optional)

## Configuration

**Environment:**
- `.env` file pattern for configuration
- Key environment variables required:
  - Database connection (MongoDB Atlas URI)
  - JWT secret
  - Stripe API keys (test and production)
  - PayPal API credentials
  - API port/host
  - Frontend API base URL
  - Email service credentials (if used)

**Build:**
- Vite configuration for React frontend (planned)
- Expo configuration for React Native app (planned)
- Express server entry point: `index.js` (from package.json)

## Platform Requirements

**Development:**
- Node.js LTS
- npm or yarn
- Git
- VSCode with extensions:
  - ESLint + Prettier
  - MongoDB for VS Code
  - Thunder Client (API testing)
  - GitLens
  - Tailwind CSS IntelliSense
  - ES7+ React/Redux snippets

**Production:**
- MongoDB Atlas (free tier with 512MB)
- Backend hosting: Render.com, Railway.app, or Heroku
- Frontend hosting: Vercel, Netlify
- Mobile: Direct APK distribution or web hosting

## Project Structure (Planned)

```
band-merch-shop/
├── api/                    # Express backend
│   ├── index.js
│   ├── package.json
│   └── models/            # Mongoose schemas
├── web/                    # React frontend
│   ├── package.json
│   └── src/
└── mobile/                 # React Native with Expo
    ├── package.json
    └── src/
```

## Special Notes

**CommonJS vs ESM:**
- Current package.json specifies `"type": "commonjs"` for Node.js compatibility
- Plan involves migrating to TypeScript for better type safety

**Database:**
- MongoDB (NoSQL) for flexible e-commerce schema
- Primary collections: Products, Orders, Concerts, Sales, Inventory
- Mongoose for schema validation and relationships

**Authentication:**
- JWT-based for mobile app (admin access)
- Public routes for Products and Orders (frontend e-shop)
- Protected routes for Sales, Concerts, Inventory (admin only)

---

*Stack analysis: 2026-02-13*
