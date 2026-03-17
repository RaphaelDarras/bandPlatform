# Band Merch Platform

## What This Is

A complete merchandise sales platform for an independent metal band, enabling online sales through an e-shop and inventory tracking at concerts through a mobile app. The online shop handles payment processing (Stripe/PayPal), while the mobile app tracks sales and manages stock. The system unifies inventory management across both channels and provides a showcase website for the band's online presence (bio, music, concerts, contact).

## Core Value

Band members can record merchandise sales at concerts quickly and reliably, with stock automatically synchronized across online and physical sales channels, preventing overselling and lost revenue.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Concert sales tool (mobile app) ready for physical sales at events
- [ ] Real-time inventory management across all sales channels
- [ ] Online e-shop with Stripe and PayPal payment processing
- [ ] Product catalog with images, descriptions, pricing, and stock levels
- [ ] Partner product cost tracking (production fees + revenue sharing percentage)
- [ ] Showcase website with band bio, discography, concert listings, and contact page
- [ ] Admin authentication for mobile app and sensitive operations
- [ ] Order management and fulfillment tracking
- [ ] Sales history and reporting per concert
- [ ] Email confirmations for online orders

### Out of Scope

- iOS mobile app — Android only (APK distribution)
- Real-time chat or customer support — focus on sales
- Complex CRM or marketing automation — use external tools
- Multi-language support — French/English sufficient
- Advanced analytics dashboard — basic reports only for v1
- User accounts for customers — guest checkout sufficient
- Social media integration — external links only

## Context

**Band Status:**
- Preparing release of 4th album with structured singles cycle
- First single (before June) includes merch collaboration with metal clothing brand
- Three additional singles releasing June onwards with music videos
- Album release targeted for October
- Active concert schedule with regular merchandise sales
- Independent/DIY approach with potential label discussions

**Merch Collaboration Model:**
- Partner produces merchandise items
- Both band and partner sell products independently
- Band reimburses production fees plus fixed percentage per sale
- Requires cost tracking and sales attribution

**Existing Systems:**
- Current band website (to be replaced completely)
- Manual sales tracking system (spreadsheets/paper)
- No existing digital inventory management

**Technical Environment:**
- Development on spare time (evenings and weekends)
- Free/low-cost hosting priority (MongoDB Atlas, Render, Vercel)
- Team comfortable with JavaScript/React ecosystem
- Claude Code as primary development assistant

## Constraints

- **Timeline**: Concert sales tool (mobile app + API) must be operational by early April for upcoming events
- **Platform**: Android only for mobile app (no iOS required)
- **Budget**: Free tier hosting and services (MongoDB Atlas 512MB, Render/Railway, Vercel/Netlify)
- **Tech Stack**: Must use MongoDB, Node.js/Express, React, React Native/Expo per planning documents
- **Development Time**: 8-12 hours per week (evenings + weekends)
- **Mobile Distribution**: Direct APK distribution (no Google Play Store initially)
- **Payment Providers**: Must support both Stripe and PayPal for customer choice

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| MongoDB over PostgreSQL | Flexible schema for e-commerce products, free Atlas tier, team familiarity with NoSQL | — Pending |
| Mobile app before online shop | Urgent need for concert sales tool by early April, validates API early, immediate practical value | — Pending |
| React Native + Expo | Simplified APK generation, no Android Studio required initially, OTA updates possible | — Pending |
| Replace website completely | Fresh start with integrated e-shop, modern stack, unified admin panel | — Pending |
| 5-collection data model | Products, Orders, Concerts, Sales, Inventory provides clear separation and audit trail | — Pending |
| JWT authentication | Stateless auth suitable for mobile app, simple to implement, no session storage needed | — Pending |

---
*Last updated: 2026-02-13 after initialization*
