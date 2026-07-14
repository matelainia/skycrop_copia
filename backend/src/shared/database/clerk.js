import { createClerkClient } from '@clerk/backend';
import env from '../config/env.js';

export const clerkClient = createClerkClient({
  secretKey: env.CLERK_SECRET_KEY,
  publishableKey: env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
});

export default clerkClient;
