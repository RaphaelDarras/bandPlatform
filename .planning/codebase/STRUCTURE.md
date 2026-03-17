# Codebase Structure

**Analysis Date:** 2026-02-13

## Directory Layout

```
bandPlatform/
├── api/                           # Backend API (Express + MongoDB)
│   ├── models/                    # Mongoose schemas
│   │   ├── Product.js
│   │   ├── Order.js
│   │   ├── Concert.js
│   │   ├── Sale.js
│   │   └── Inventory.js
│   ├── routes/                    # API endpoints
│   │   ├── products.js
│   │   ├── orders.js
│   │   ├── concerts.js
│   │   ├── sales.js
│   │   ├── inventory.js
│   │   ├── auth.js
│   │   └── webhooks.js
│   ├── middleware/                # Express middleware
│   │   ├── auth.js                # JWT verification
│   │   ├── errorHandler.js        # Global error handling
│   │   └── validation.js          # Request validation
│   ├── config/                    # Configuration files
│   │   └── database.js            # MongoDB connection
│   ├── index.js                   # Server entry point
│   ├── package.json
│   └── .env                       # Environment variables (secrets)
│
├── web/                           # Frontend website (React + Vite + Tailwind)
│   ├── src/
│   │   ├── components/            # Reusable components
│   │   │   ├── Header.jsx
│   │   │   ├── Footer.jsx
│   │   │   ├── ProductCard.jsx
│   │   │   └── ...
│   │   ├── pages/                 # Page components
│   │   │   ├── Home.jsx
│   │   │   ├── Shop.jsx
│   │   │   ├── Cart.jsx
│   │   │   ├── Checkout.jsx
│   │   │   ├── OrderConfirmation.jsx
│   │   │   ├── Concerts.jsx
│   │   │   ├── Contact.jsx
│   │   │   └── ...
│   │   ├── context/               # State management
│   │   │   ├── CartContext.jsx
│   │   │   └── AuthContext.jsx
│   │   ├── services/              # API client
│   │   │   └── api.js
│   │   ├── hooks/                 # Custom React hooks
│   │   │   └── ...
│   │   ├── App.jsx                # Root component
│   │   └── main.jsx               # Vite entry point
│   ├── public/                    # Static assets
│   ├── package.json
│   └── .env                       # Environment variables
│
├── mobile/                        # Mobile app (React Native + Expo)
│   ├── app.json                   # Expo configuration
│   ├── src/
│   │   ├── screens/               # Navigation screens
│   │   │   ├── LoginScreen.tsx
│   │   │   ├── ConcertsScreen.tsx
│   │   │   ├── SalesScreen.tsx
│   │   │   ├── CartScreen.tsx
│   │   │   ├── HistoryScreen.tsx
│   │   │   └── ...
│   │   ├── components/            # Reusable components
│   │   │   ├── ProductItem.tsx
│   │   │   ├── CartItem.tsx
│   │   │   └── ...
│   │   ├── services/              # API client
│   │   │   └── api.ts
│   │   ├── context/               # State management
│   │   │   ├── AuthContext.tsx
│   │   │   └── CartContext.tsx
│   │   ├── hooks/                 # Custom hooks
│   │   │   └── ...
│   │   ├── App.tsx                # Root component
│   │   └── navigation/            # Navigation setup
│   │       └── RootNavigator.tsx
│   ├── package.json
│   └── .env                       # Environment variables
│
├── .planning/                     # GSD planning documents
│   └── codebase/                  # Architecture analysis
│       ├── ARCHITECTURE.md        # This file
│       ├── STRUCTURE.md           # Directory layout
│       ├── CONVENTIONS.md
│       ├── TESTING.md
│       ├── STACK.md
│       ├── INTEGRATIONS.md
│       └── CONCERNS.md
│
├── .claude/                       # GSD framework files
│   ├── agents/                    # AI agent definitions
│   ├── commands/                  # GSD commands
│   ├── workflows/                 # GSD workflows
│   └── get-shit-done/             # GSD core
│
├── package.json                   # Root package (monorepo config)
├── roadmap.md                     # Project planning document
├── README.md                      # Project overview
└── .git/                          # Git repository

```

## Directory Purposes

**api/:**
- Purpose: Node.js/Express REST API backend
- Contains: Database models, routes, middleware, business logic
- Key files: `api/index.js` (server entry), `api/models/` (data schemas), `api/routes/` (endpoints)

**web/:**
- Purpose: React frontend for vitrine and e-shop
- Contains: React components, pages, state management, styling
- Key files: `web/src/App.jsx` (root), `web/src/pages/` (page components), `web/src/components/` (reusable components)

**mobile/:**
- Purpose: React Native mobile app for admin concert sales
- Contains: Screens, navigation, components, API integration
- Key files: `mobile/app.json` (Expo config), `mobile/src/screens/` (app screens), `mobile/App.tsx` (root)

**.planning/codebase/:**
- Purpose: Architecture and code structure analysis documents for development reference
- Contains: ARCHITECTURE.md, STRUCTURE.md, CONVENTIONS.md, TESTING.md, STACK.md, INTEGRATIONS.md, CONCERNS.md
- Key files: All documents in this directory serve the GSD framework for implementation

**.claude/:**
- Purpose: Get Shit Done (GSD) framework configuration and workflows
- Contains: Agent definitions, command workflows, templates
- Key files: Framework files - not part of application logic

## Key File Locations

**Entry Points:**
- `api/index.js`: Express server initialization and route registration
- `web/src/main.jsx`: Vite development server and React app mount
- `mobile/App.tsx`: React Native app root component

**Configuration:**
- `api/config/database.js`: MongoDB connection setup
- `web/vite.config.js`: Vite bundler configuration
- `mobile/app.json`: Expo app configuration

**Core Logic:**
- `api/models/*.js`: Data schemas for Products, Orders, Concerts, Sales, Inventory
- `api/routes/*.js`: API endpoint implementations
- `api/middleware/auth.js`: JWT authentication
- `web/src/context/`: State management for cart and auth
- `mobile/src/services/api.ts`: Mobile API client

**Testing:**
- `api/__tests__/` or `api/tests/`: Unit and integration tests for API
- `web/src/__tests__/` or `web/tests/`: React component and utility tests
- `mobile/src/__tests__/`: React Native tests

## Naming Conventions

**Files:**

- **Model files:** PascalCase.js (e.g., `Product.js`, `Order.js`)
- **Route files:** lowercase.js (e.g., `products.js`, `orders.js`)
- **Middleware:** descriptive-name.js (e.g., `auth.js`, `errorHandler.js`)
- **React components:** PascalCase.jsx/tsx (e.g., `ProductCard.jsx`, `LoginScreen.tsx`)
- **Utilities/helpers:** camelCase.js (e.g., `validationHelper.js`, `api.js`)
- **Test files:** Match source file with `.test.js` or `.spec.js` suffix (e.g., `Product.test.js`)

**Directories:**

- **Feature-based:** Group by functionality (e.g., `routes/`, `models/`, `components/`, `pages/`)
- **Lowercase with hyphens for multi-word:** `error-handler`, `auth-middleware`
- **Context: camelCase:** `AuthContext.jsx`, `CartContext.jsx`

## Where to Add New Code

**New Feature (API endpoint):**
- Implementation: `api/models/` (schema if new entity), `api/routes/[feature].js` (endpoints)
- Middleware: `api/middleware/` (if needed for validation)
- Tests: `api/__tests__/[feature].test.js`

**New Component/Module (Web/Mobile):**
- Reusable component: `web/src/components/` or `mobile/src/components/`
- Page component: `web/src/pages/` or `mobile/src/screens/`
- Context/state: `web/src/context/` or `mobile/src/context/`

**Utilities:**
- Shared helpers: `api/utils/` (backend) or `web/src/utils/` (frontend)
- API client: `web/src/services/api.js` or `mobile/src/services/api.ts`

**Configuration:**
- App config: Place in corresponding `config/` directory or root `.env` file

## Special Directories

**.env files:**
- Purpose: Environment variables for sensitive data (API keys, database URLs)
- Generated: No (created manually per environment)
- Committed: No (listed in `.gitignore`)
- Notes: Each application (api, web, mobile) has its own `.env` file

**node_modules/:**
- Purpose: Installed dependencies
- Generated: Yes (via `npm install`)
- Committed: No (listed in `.gitignore`)

**dist/ or build/:**
- Purpose: Compiled/bundled output for production
- Generated: Yes (via `npm run build`)
- Committed: No (listed in `.gitignore`)

**.git/:**
- Purpose: Git version control
- Generated: Yes (created by `git init`)
- Committed: No (ignored by `.gitignore`)

## Monorepo Structure Notes

This is a **monorepo** with three independent applications sharing a common API contract:

- **Root package.json:** Minimal (listed in status)
- **Each app has own package.json:** Allows independent dependency versions
- **Shared dependencies:** Define in root, reference in sub-applications (optional but recommended for consistency)
- **Build/Deploy:** Each app builds and deploys independently
  - API: Render/Railway
  - Web: Vercel/Netlify
  - Mobile: APK generated locally or via Expo Build Service

## Recommended Development Workflow

1. **API Development First:** `cd api && npm install && npm start`
2. **Web Development:** `cd web && npm install && npm run dev`
3. **Mobile Development:** `cd mobile && npm install && expo start`

All three can run simultaneously on different ports (e.g., API on 3000, Web on 5173, Mobile on 8081).

---

*Structure analysis: 2026-02-13*
