# Mindspace Member Experience Hub

A small internal tool for tracking member satisfaction across Mindspace locations and creating Salesforce Cases when negative feedback needs follow-up.

**Live demo:** https://mindspace-member-experience-hub.vercel.app/  
**GitHub:** https://github.com/JakubGodlewski/mindspace-member-experience-hub

## Why I built it

When a company operates multiple coworking locations, it can be difficult to keep track of survey responses and make sure negative feedback reaches the right team. A poor experience should not disappear into a spreadsheet or a reporting dashboard.

Member Experience Hub gives an operations team one place to review feedback, spot patterns by location or category, and create a Salesforce Case for a member who needs follow-up.

## What it does

- Shows survey feedback from different locations, including comments and ratings.
- Displays the total number of surveys, average rating, and number of negative responses.
- Filters feedback by location, category, and rating.
- Creates a Case for feedback rated **1 or 2**, using the related Contact.
- Prevents a second Case from being linked to the same feedback record.
- Displays a Salesforce-style Case Number, such as `00000001`.
- Keeps mock Case associations after a page refresh and provides a reset option for demos.

The project uses simulated Salesforce responses; it does not connect to a live Salesforce org.

## Architecture

```text
Next.js / React dashboard
          |
          v
  Next.js API routes
          |
          v
    Feedback service
          |
          v
  SalesforceClient interface
          |
          v
  MockSalesforceClient
       /         \
      v           v
Mock JSON      Redis / KV
```

The browser calls the Next.js API routes rather than talking to Salesforce directly. The service layer checks the business rules, while the Salesforce client handles data access and updates. I used an interface so the mock implementation can be replaced with a real Salesforce API client without rewriting the dashboard.

### Components and responsibilities

| Component | What it does |
|---|---|
| **Next.js** | Runs the web app and the server-side API routes. |
| **React** | Handles the dashboard, filters, loading states, and user actions. |
| **TypeScript** | Defines the types used by the UI, API responses, and Salesforce integration. |
| **Tailwind CSS** | Styles the dashboard and its controls. |
| **`app/page.tsx`** | Fetches feedback, calculates KPIs, applies filters, and handles Case creation and demo reset. |
| **`FeedbackTable`** | Shows feedback records and the Create Case action where applicable. |
| **`FeedbackFilters`** | Filters by location, category, and rating. |
| **`KpiCard`** | Displays summary metrics. |
| **`GET /api/feedback`** | Returns feedback data as JSON. |
| **`POST /api/cases`** | Validates a request and starts the Case creation workflow. |
| **`POST /api/demo/reset`** | Clears mock Case links and resets the Case counter; available in mock mode. |
| **`feedback-service.ts`** | Checks feedback eligibility and coordinates Case creation and linking. |
| **`SalesforceClient`** | Defines the operations the service needs from a Salesforce integration. |
| **`client-factory.ts`** | Chooses the mock client based on the environment configuration. |
| **`MockSalesforceClient`** | Simulates Salesforce queries, Case creation, and record updates. |
| **`mapper.ts`** | Converts Salesforce-style records into the format used by the dashboard. |
| **Mock Salesforce JSON** | Provides sample feedback and related Salesforce records. |
| **Vercel KV / Redis** | Persists mock Case numbers and feedback-to-Case links across serverless requests. |
| **Vitest** | Tests the API, service logic, mapping, and mock storage behavior. |
| **GitHub** | Stores the code and commit history. |
| **Vercel** | Hosts the application and runs its API routes. |

### Why the API runs on the server

A real Salesforce integration would need credentials and access tokens. Those should never be sent to the browser. Server-side routes also give the application one place to enforce validation rules and decide what data to expose to the UI.

## Salesforce data model

| Object | Purpose |
|---|---|
| `Member_Feedback__c` | Survey rating, category, comment, location, submission date, and record relationships. |
| `Contact` | The member associated with the feedback. |
| `Account` | The company associated with the Contact. |
| `Case` | A service issue created from negative feedback. |

`Member_Feedback__c` uses `Contact__c` to reference a Contact and `Case__c` to reference a Case. The UI shows `CaseNumber`, while the Case ID is used internally to maintain the relationship.

## API and Case creation

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/feedback` | Read feedback and related Case information. |
| `POST` | `/api/cases` | Create a Case for eligible negative feedback. |
| `POST` | `/api/demo/reset` | Reset mock Case associations and numbering. |

When someone clicks **Create Case**, the frontend sends the feedback ID to the API. The service checks that the record exists, the rating is 1 or 2, a Contact is present, and no Case is already linked. It then creates a mock Case, links it to the feedback, and returns the Case ID and Case Number. The dashboard shows the Case Number to the user.

## Run locally

Install dependencies:

```bash
npm install
```

Create `.env.local`:

```env
SALESFORCE_MOCK_MODE=true
```

Start the app:

```bash
npm run dev
```

Open http://localhost:3000. Local development uses in-memory mock storage when Redis is not configured.

To run the available checks:

```bash
npm test
npm run lint
npx tsc --noEmit
npm run build
```

## Vercel deployment

The source is hosted on GitHub and the application is available at:

https://mindspace-member-experience-hub.vercel.app/

The intended deployment flow is GitHub push → Vercel build → deployed Next.js app. The API routes run on the server, with Redis used to retain demo state between requests.

### Environment variables

| Variable | Purpose |
|---|---|
| `SALESFORCE_MOCK_MODE` | Set to `true` to use the mock Salesforce client. |
| `KV_REST_API_URL` | Redis/KV REST endpoint. |
| `KV_REST_API_TOKEN` | Authentication token for Redis/KV. |

The variables belong in the Vercel project settings rather than in the repository. Redis credentials are required for the deployed mock because separate serverless functions cannot depend on shared process memory.

## Connecting to a real Salesforce org

**What would I need to change, and what challenges would I expect?**

I would replace `MockSalesforceClient` with a client that uses the Salesforce REST API. The dashboard and most of the service layer could stay as they are because they already depend on the `SalesforceClient` interface.

For authentication, I would use an External Client App with OAuth 2.0 Client Credentials Flow and a dedicated integration user. That user would have only the object and field permissions needed by the application. Client credentials would remain on the server and be stored as environment variables.

Instead of reading the JSON fixture, the client would run SOQL queries against `Member_Feedback__c` and retrieve the relevant Contact, Account, and Case fields. I would need to account for API limits, query pagination, object permissions, and field-level security. If the number of feedback records grew, I would move filtering and pagination to the server rather than load everything into the browser.

Creating a Case would use the Salesforce REST API, followed by an update to `Member_Feedback__c.Case__c`. I would retrieve `CaseNumber` from Salesforce instead of generating it in the application. Salesforce would be the source of truth for these relationships, so Redis would no longer be needed for storing them.

The main reliability concern is that Case creation and feedback linking are two separate operations. If the Case is created but the feedback update fails, an unlinked Case remains. I would add appropriate logging, idempotency checks, and a retry or reconciliation process. I would also handle expired tokens, timeouts, API limits, and temporary Salesforce errors.

## Trade-offs

This is a demo, so I kept the scope focused on one working workflow.

- **Mock data:** No Salesforce org or real member data is needed to run the project.
- **Redis persistence:** The demo behaves consistently across page refreshes and Vercel serverless requests.
- **Separate client interface:** The Salesforce integration can be replaced without changing the UI or business rules.
- **Two-step Case workflow:** Case creation and feedback linking are not atomic. Duplicate links are prevented, but a failed or concurrent request can still leave an unused mock Case.
- **Shared demo state:** The reset endpoint is useful for demonstrations but would need authentication and authorization in a production tool.
