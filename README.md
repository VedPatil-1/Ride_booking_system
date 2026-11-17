<<<<<<< HEAD
\# Ride Booking System



A backend-focused ride booking system built with Node.js, Express, MongoDB, Redis, and BullMQ. It supports asynchronous driver assignment, event-driven services using Redis Streams, load testing, and a React admin dashboard.



\## Features



\### 1. Ride Booking and Driver Assignment

\- Create ride requests through REST APIs.

\- Store ride information in MongoDB.

\- Process driver assignment asynchronously using BullMQ and Redis.

\- Simulate 10 drivers with independent 50% acceptance probabilities.

\- Assign a driver or mark the ride as `NO\_DRIVER\_FOUND` after three rejections.

\- Recover failed assignment jobs.



\### 2. Event-Driven Architecture

\- Publish ride lifecycle events using Redis Streams.

\- Support `RIDE\_REQUESTED`, `RIDE\_ASSIGNED`, and `RIDE\_NO\_DRIVER\_FOUND`.

\- Independent Billing and Operations consumers.

\- Separate consumer groups for independent event processing.

\- Acknowledgment and duplicate-processing protection.



\### 3. Load Testing

\- Submit 100 ride requests concurrently.

\- Verify final ride statuses.

\- Detect duplicate driver assignments.

\- Identify rides stuck without a final status.



\### 4. Admin Dashboard

\- Overview of ride statistics.

\- Searchable and filterable ride records.

\- Driver assignment information.

\- Event monitoring.

\- System health monitoring.



\## Tech Stack



\- \*\*Backend:\*\* Node.js, Express.js

\- \*\*Database:\*\* MongoDB, Mongoose

\- \*\*Queue:\*\* Redis, BullMQ

\- \*\*Event Streaming:\*\* Redis Streams

\- \*\*Frontend:\*\* React, Vite

\- \*\*Testing:\*\* Custom 100-ride concurrent load test



\## Project Structure



```text

Ride\_booking\_system/

├── client/                 # React admin dashboard

├── scripts/                # Load testing scripts

├── src/

│   ├── config/             # Database and Redis configuration

│   ├── consumers/          # Billing and Operations consumers

│   ├── controllers/        # API controllers

│   ├── events/              # Ride event publishing

│   ├── middleware/         # Admin authentication

│   ├── models/             # MongoDB models

│   ├── routes/             # API routes

│   ├── services/           # Assignment and recovery logic

│   ├── app.js

│   ├── server.js

│   └── worker.js

├── .env.example

├── package.json

└── README.md

```



\## Setup and Installation



\### Prerequisites

\- Node.js

\- MongoDB Atlas or MongoDB

\- Redis-compatible service



\### 1. Clone the repository



```bash

git clone YOUR\_GITHUB\_REPOSITORY\_URL

cd Ride\_booking\_system

```



\### 2. Install backend dependencies



```bash

npm install

```



\### 3. Configure environment variables



Create a `.env` file using `.env.example` as a reference and configure your MongoDB, Redis, and admin API key settings.



\### 4. Start the backend services



Run each command in a separate terminal:



```bash

npm start

npm run worker

npm run billing

npm run operations

```



\### 5. Start the admin dashboard



```bash

cd client

npm install

npm run dev

```



Configure the dashboard API URL and backend proxy settings using `client/.env.example` if needed.



\## Testing



Run the project checks:



```bash

npm run check

```



Run the 100-ride concurrent load test:



```bash

npm run test:100

```



\*\*Verified load test result:\*\* 100 rides created, 87 assigned, 13 with no driver found, zero duplicate assignments, and zero rides without a final status.



\## Security



\- Keep real credentials in local `.env` files.

\- Never commit database passwords, Redis credentials, or admin API keys.

\- Admin API routes require a configured admin API key.



\## Author



Ved Patil

=======
# Ride_booking_system
>>>>>>> 8fe3e4967da1ba7e9bf29d1a7053399eba05a843
