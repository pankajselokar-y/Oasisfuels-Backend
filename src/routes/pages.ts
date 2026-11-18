import { Router } from 'express';
import { env } from '../config/env.js';

/**
 * Two public, no-login pages that the Google Play listing needs links to: the privacy policy and how to delete an account.
 * They describe what the app really stores (see the Prisma schema), so change them together with the data model.
 */
export const pageRoutes = Router();

const LAST_UPDATED = '18 November 2026';

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

const business = escapeHtml(env.BUSINESS_NAME);
const contact = env.SUPPORT_EMAIL
  ? `by email at <a href="mailto:${escapeHtml(env.SUPPORT_EMAIL)}">${escapeHtml(env.SUPPORT_EMAIL)}</a>, or at the pump counter`
  : 'at the pump counter';

function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} · ${business}</title>
<style>
  body { font: 16px/1.6 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #101b3b; background: #f4f6fb; margin: 0; }
  main { max-width: 760px; margin: 0 auto; padding: 24px 20px 56px; }
  h1 { font-size: 26px; margin: 8px 0 4px; color: #1b3a8f; }
  h2 { font-size: 19px; margin: 28px 0 6px; }
  p, li { color: #2c3858; }
  .meta { color: #55607a; font-size: 14px; margin: 0 0 12px; }
  a { color: #1b3a8f; }
  ul { padding-left: 22px; }
  code { background: #e8eefc; padding: 1px 6px; border-radius: 6px; }
</style>
</head>
<body><main>
${body}
</main></body>
</html>`;
}

const privacyHtml = page(
  'Privacy Policy',
  `<h1>Privacy Policy</h1>
<p class="meta">${business} Rewards app · Last updated ${LAST_UPDATED}</p>
<p>${business} Rewards is a loyalty app for our fuel pump. This page explains what information the app keeps, why, and the choices you have.</p>

<h2>What we collect</h2>
<ul>
  <li><b>Account details:</b> your name and mobile number. Your PIN is stored only in scrambled (hashed) form, so nobody, including us, can read it.</li>
  <li><b>Vehicles:</b> the vehicle numbers and models you add, or that our cashier enters when you fuel.</li>
  <li><b>Fuel records:</b> each fill-up (amount, litres, date and time) and the reward points it earned.</li>
  <li><b>Location and photo at the pump:</b> when you fuel, our cashier's device records the GPS position and takes a photo of your vehicle's dashboard. The photo is stamped with the date, time and position. This is used to verify that the fill-up really happened.</li>
  <li><b>Gift handover photo:</b> when you collect a reward gift at the pump, our staff take a photo of the handover. It is stamped with the date, time and GPS position and shown in your history. This is used to record that the gift was received.</li>
  <li><b>Rewards and referrals:</b> the rewards you request or receive (the points for a gift are deducted when you request it and returned if the request is cancelled), and who referred you or whom you referred (by mobile number).</li>
</ul>
<p>The app does not use advertising or analytics trackers, and we do not sell your information.</p>

<h2>Why we use it</h2>
<ul>
  <li>To run your account and credit, track and redeem your reward points.</li>
  <li>To verify fuel purchases and prevent misuse of the points scheme.</li>
  <li>To contact you, for example if your vehicle has not fuelled with us for a while, or about a reward.</li>
</ul>

<h2>Who can see it</h2>
<p>Only you (in the app), our pump staff and administrators, who need it to run the scheme, and the hosting and database providers that store the data for us under their own security commitments. Information is sent over encrypted (HTTPS) connections.</p>

<h2>How long we keep it</h2>
<p>For as long as your account exists. When you delete your account, your information is deleted too (see below).</p>

<h2>Your choices</h2>
<ul>
  <li>You can correct your name and manage your vehicles in the app under <b>Profile</b>.</li>
  <li>You can delete your account and all its data any time in the app: <b>Profile → Delete my account</b>. Details are on the <a href="/delete-account">account deletion page</a>.</li>
  <li>Camera and location permissions are only used by our staff's devices at the pump. You can refuse or withdraw them in your phone's settings; the customer app works without them.</li>
</ul>

<h2>Contact</h2>
<p>For questions about your information, contact us ${contact}.</p>`,
);

const deleteHtml = page(
  'Delete your account',
  `<h1>Delete your account</h1>
<p class="meta">${business} Rewards app · Last updated ${LAST_UPDATED}</p>

<h2>Delete it in the app</h2>
<ol>
  <li>Open the app and sign in.</li>
  <li>Go to the <b>Profile</b> tab and scroll to the bottom.</li>
  <li>Tap <b>Delete my account</b>, enter your PIN and confirm.</li>
</ol>
<p>Your account is deleted immediately.</p>

<h2>What is deleted</h2>
<ul>
  <li>Your name, mobile number and PIN.</li>
  <li>Your vehicles, points history and any unused points.</li>
  <li>Your reward requests and fuel records, including the dashboard and gift handover photos and locations.</li>
</ul>
<p>This cannot be undone. People you referred keep their own accounts. You can create a new account at any time, but it starts with no points.</p>

<h2>Cannot open the app?</h2>
<p>Ask us to delete your account: contact us ${contact} and give the mobile number the account was created with. We will confirm once it is done.</p>`,
);

pageRoutes.get('/privacy', (_req, res) => {
  res.type('html').send(privacyHtml);
});

pageRoutes.get('/delete-account', (_req, res) => {
  res.type('html').send(deleteHtml);
});
