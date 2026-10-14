# BidFlow

**BidFlow** is a mobile reverse-auction procurement application built with React Native, Expo, and Supabase. It allows buyers to create procurement requests, invite suppliers, and conduct time-limited reverse auctions where suppliers compete by submitting lower bids.

## Features

### Buyer
- Create procurement requests.
- Invite suppliers to participate.
- Start reverse auctions with bidding deadlines.
- View auction details and submitted bids.
- Finalize auctions after their deadlines.

### Supplier
- View procurement invitations.
- Participate in active reverse auctions.
- Submit competitive bids.
- Place lower bids while an auction is active.
- View bidding status and deadlines.

### Auction Management
- Time-limited bidding.
- Server-side bid submission through Supabase.
- Prevention of bidding after auction expiration.
- Auction finalization and lowest-bid evaluation.

## Tech Stack

| Technology | Purpose |
|---|---|
| React Native | Mobile application development |
| Expo | Development and Android builds |
| TypeScript | Application programming |
| Supabase | Backend and database |
| PostgreSQL | Relational data storage |
| Supabase Auth | User authentication |
| Supabase RPC | Auction operations |
| GitHub | Source code version control |

## How BidFlow Works

1. A buyer creates a procurement request.
2. The buyer invites a supplier.
3. The buyer starts a reverse auction.
4. The supplier submits a bid.
5. Suppliers can compete by offering lower prices while bidding remains open.
6. Bidding closes when the deadline passes.
7. The buyer finalizes the auction, and the lowest submitted bid is evaluated.

## Running the Project Locally

**Prerequisites:** Node.js, npm, Expo Go, and a configured Supabase project.

1. Clone the repository:

   ```bash
   git clone https://github.com/jay1234624/bidflow.git
   cd bidflow
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file in the project root and configure the Supabase connection:

   ```env
   EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

   Use the environment variable names expected by `supabase.ts`. The Supabase database schema, policies, and RPC functions must also be configured separately.

4. Start the application:

   ```bash
   npx expo start
   ```

5. Open the application using Expo Go on a compatible device.

## Android Build

BidFlow uses Expo Application Services (EAS) to generate an installable Android APK.

To request a preview APK build:

```bash
eas build --platform android --profile preview
```

The APK can be downloaded from the completed build page on Expo.

## Backend and Security

BidFlow uses Supabase authentication and PostgreSQL Row Level Security (RLS) for access control. Auction operations use database functions, including:

- `start_auction`
- `place_bid`
- `finalize_auction`

Environment configuration is excluded from the Git repository using `.gitignore`.

## Testing

The application has been manually tested for the main procurement workflow, including request creation, supplier invitations, auction creation, bid submission, bidding deadline enforcement, and auction finalization.

## Repository

https://github.com/jay1234624/bidflow