// One-time Web Push setup for the real Supabase project.
//   npm run push:setup
// Generates a VAPID key pair and a webhook secret and prints exactly what to
// run / paste. Nothing is written to disk or sent anywhere.

import crypto from "node:crypto";

import webpush from "web-push";

const { publicKey, privateKey } = webpush.generateVAPIDKeys();
const secret = crypto.randomBytes(32).toString("base64url");
const ref = process.argv[2] ?? "<project-ref>";

console.log(`
Web Push setup (keep this output private)
=========================================

1) .env.local and Vercel environment variables:

   NEXT_PUBLIC_VAPID_PUBLIC_KEY=${publicKey}

2) Edge Function secrets (from this folder):

   npx supabase secrets set \\
     VAPID_PUBLIC_KEY=${publicKey} \\
     VAPID_PRIVATE_KEY=${privateKey} \\
     VAPID_SUBJECT=mailto:you@example.com \\
     PUSH_WEBHOOK_SECRET=${secret}

3) Deploy the function (it checks the shared secret itself):

   npx supabase functions deploy send-push --no-verify-jwt

4) In the Supabase SQL editor (tells the database where to send pushes):

   select vault.create_secret('https://${ref}.supabase.co', 'project_url');
   select vault.create_secret('${secret}', 'push_webhook_secret');

Then open Settings -> Notificari in the app and press "Activeaza notificarile".
`);
