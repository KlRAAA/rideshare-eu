// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://c54ac878dcc6a78d5b94bf76e3667ec4@o4512106171793408.ingest.us.sentry.io/4512106173956096",

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  // "production" / "preview" on Vercel, "development" locally, so errors can be told apart.
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
  // Every trace locally; a tenth in production keeps within the free quota.
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1,

  dataCollection: {
    // To disable sending user data and HTTP bodies, uncomment the lines below. For more info visit:
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#dataCollection
    // userInfo: false,
    // httpBodies: [],
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
