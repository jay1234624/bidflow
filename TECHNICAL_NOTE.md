# BidFlow — Technical Note

## 1. Project Overview

BidFlow is a mobile reverse-auction procurement application that allows buyers to create purchasing requests and invite suppliers to compete by offering lower prices. The application supports time-limited bidding and auction finalization.

## 2. System Architecture

**Frontend:** React Native with Expo and TypeScript provides the mobile user interface for buyers and suppliers.

**Backend:** Supabase provides user authentication, PostgreSQL database storage, and database functions for auction operations.

**Communication:** The mobile application communicates with Supabase to retrieve procurement data and perform authenticated auction operations.

**Android Distribution:** Expo Application Services (EAS) generates an installable Android APK using the preview build configuration.

## 3. Database and Security

The application uses Supabase PostgreSQL to manage procurement requests, supplier invitations, auctions, and bids.

Supabase Authentication identifies users, while Row Level Security (RLS) policies help restrict database access.

Important auction operations are implemented using PostgreSQL functions exposed through Supabase RPC:

- `start_auction`: Starts a reverse auction.
- `place_bid`: Processes supplier bids.
- `finalize_auction`: Finalizes an auction after its deadline.

This design keeps important auction operations on the backend rather than relying entirely on frontend checks.

## 4. Reverse-Auction Workflow

1. A buyer creates a procurement request.
2. The buyer invites a supplier.
3. The buyer starts an auction with a deadline.
4. The supplier submits a bid during the active auction.
5. Suppliers compete by offering lower prices.
6. Bid submissions are prevented after the deadline.
7. The buyer finalizes the expired auction, and the lowest submitted bid is evaluated.

The core reverse auction workflow was tested using bids of ₹45 and ₹40, with ₹40 confirmed as the lowest submitted bid.

## 5. Implementation Decisions

**React Native and Expo:** Enable mobile development with a shared JavaScript/TypeScript codebase and simplify Android build generation.

**Supabase:** Combines authentication, relational database storage, and backend operations without requiring a separately hosted custom API server.

**Database RPC functions:** Centralize important auction actions and support server side validation.

**Git and GitHub:** Provide version control and a shareable source repository.

## 6. Testing and Limitations

The application was manually tested for buyer request creation, supplier invitations, auction creation, bid submission, deadline enforcement, and auction finalization.

The Android APK was successfully generated using EAS. Installation and end-to-end testing of the standalone APK remain to be verified.

The repository contains application source code but does not currently include a complete Supabase database migration or setup script.

## 7. Project Links

**Source Code:** https://github.com/jay1234624/bidflow

**Android APK Build:** https://expo.dev/accounts/sahaijay/projects/bidflow/builds/8463c03d-4548-43b0-b0aa-e1a00a0e9e08