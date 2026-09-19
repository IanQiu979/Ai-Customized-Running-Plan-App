<!--
  SOURCE OF TRUTH — this file is the text published at the public privacy-policy URL the app
  links to (`src/constants/legal.ts`'s `PRIVACY_POLICY_URL`) and that the App Store / Play
  listings will cite. `.github/workflows/publish-legal-pages.yml` renders it to GitHub Pages on
  every push to `main` that touches it. Edit it here; never edit a hosted or copied version.

  Structure mirrors the sibling repo's `docs/privacy-policy.md` (V2.3, Pace Analysis AI). The
  facts are V2.2's own: every claim below was checked against `workers/migrations/`,
  `workers/src/auth.ts`, `workers/src/lib/model.ts`, `workers/src/lib/planPersonalizationPrompt.ts`
  and `workers/src/lib/store.ts`'s `deleteAccount` on 2026-09-19. If a data flow changes, this
  file changes in the same commit — `src/constants/__tests__/legal.test.ts` pins the controller
  identity, the contact address and the absence of placeholders, not the flows themselves.

  Analysis, not legal advice. Drafted from the engineering record of the app as built; counsel
  reviews this policy and the store privacy-label answers before public store submission.

  Under-18 posture (captain, 2026-09-19): 13–17 may use the app WITH a parent's or guardian's
  consent. This policy states that posture; the in-app consent flow that records it is a
  separate task and is not yet built. Until it ships, the consent is a condition of use rather
  than a recorded event.
-->

# Pace Blueprint — Privacy Policy

**Last updated: 2026-09-19**

Pace Blueprint ("the app," "we," "us") is operated by **Ian Qiu**, a sole trader based in
**Thailand**, who is the data controller for the personal data described here. This policy
explains what we collect when you use the app, why, how long we keep it, who else sees it, and
how to get it deleted.

---

## This is not medical advice

Pace Blueprint turns the answers you give in a short intake into a week-by-week running plan.
**It is training guidance, not medical advice, and it does not diagnose or treat injuries.** The
app reduces training volume when you tell it about an injury, but it cannot examine you. If you
have pain, swelling, or a persistent problem, or before making a significant change to how you
train, see a doctor or a qualified sports physiotherapist. Never run through sharp or worsening
pain to follow a plan.

---

## What we collect, and why

| Data | What it is | Why we collect it | Legal basis |
|---|---|---|---|
| Account details | Your name, your email address, and — if you sign up with a password — that password, stored only as a salted hash we cannot reverse | To create and secure your account and let you sign in | Contract (GDPR Art. 6(1)(b)) — necessary to provide the account you asked for |
| Google sign-in details | If you choose Sign in with Google: your Google account identifier, the name, email address and profile-picture link Google shares, and the tokens Google issues so the sign-in works | To let you sign in with Google instead of a password | Contract (GDPR Art. 6(1)(b)) |
| Sign-in sessions | A session token, when it was created, and the IP address and device/browser description of the request that created it | To keep you signed in and to let us detect misuse of an account | Legitimate interest (GDPR Art. 6(1)(f)) in keeping accounts secure |
| Intake answers | Your training goal (in your own words), your age, your running experience, how many days a week you run, your typical weekly distance, your target race distance and date and goal time (if you have one), and a recent race time (if you give one) | To build a plan that fits you — for example, your age sets your estimated maximum heart rate, and your recent time sets your training paces | Contract (GDPR Art. 6(1)(b)) |
| Injury answers | Any injury you choose to declare from a fixed list (knee, shin, ankle, hip, lower back, plantar fascia), and any note you choose to write about it | To reduce the volume and intensity your plan prescribes so it does not aggravate the injury | Explicit consent (GDPR Art. 6(1)(a) and Art. 9(2)(a)) — see "Your injury answers are health data" below |
| Your plans | Every plan the app generates for you: the weeks, the sessions, the distances and paces, the coaching notes, and when it was created | To show you your plans, to let you revisit them, and to count how many plans you have generated in your current period | Contract (GDPR Art. 6(1)(b)) |
| Tier and usage details | Which tier you hold (Free, Pro or Elite), when it started, how many plans you have generated and when, and whether a plan was served from the template fallback | To enforce your tier's plan quota and keep your account working correctly | Contract (GDPR Art. 6(1)(b)) |

We never receive or store payment card details. If a paid tier is offered for purchase, the
purchase is handled by the app store's own billing; we record only which tier you hold and when
it began.

We do not collect your location, your contacts, your photos, your health-app data, or anything
from other apps on your device. The app has no ads, no analytics service and no crash-reporting
service — nothing in it tracks you across other apps or websites.

### Your injury answers are health data

The injuries you declare, and anything you write about them, are information about your health.
We treat them as health data under data protection law (GDPR Article 9; Thailand's Personal
Data Protection Act section 26).

Declaring an injury is optional: the intake's injury question defaults to "None," and the app
builds a full plan without one. By choosing an injury from the list, or writing an injury note,
you consent to us storing it and using it to shape your plan as described in this policy. If
you hold a paid tier, your written injury note (not the list selection) is also included in the
material sent to Anthropic to write your plan's coaching notes — see "Who we share it with."

You can withdraw that consent at any time by editing your intake and setting the injury question
back to "None" and clearing the note (which overwrites the stored answers), by deleting your
account, or by contacting us at the address below. Withdrawing stops any further use of your
injury answers; it does not change plans already generated from them, which remain in your
account until you delete it.

---

## Who we share it with

Our service providers are:

- **Cloudflare** hosts our backend and our database. Everything listed under "What we collect"
  is stored in a Cloudflare D1 database and processed by Cloudflare Workers on our behalf,
  under Cloudflare's data processing terms; Cloudflare does not use your data for its own
  purposes. Cloudflare also keeps short-lived request logs for our backend (the route called,
  the outcome, timestamps and error details) so we can find and fix failures; those logs are not
  designed to hold your intake answers or plans.
- **Anthropic** (maker of the Claude AI models) writes the coaching notes for **paid-tier
  (Pro and Elite) plans only**. Free plans are built entirely by our own code and nothing about
  them is sent to Anthropic. For a paid plan, the numbers in your plan are also computed by our
  own code first; Anthropic then receives a summary of that finished plan (each week's phase,
  volume and sessions — effort, distance or duration, and session structure) together with
  your stated goal, your experience level, the race distance and plan length, whether the
  runner is under 18 (a yes/no flag, not your age), any injury note you wrote, and any note you
  attached to the plan request. It does **not** receive your name, your email address, your
  age, which injuries you selected from the list, or your recent race time. We use Anthropic's commercial API. Under its terms, your data is not used to
  train Anthropic's models. In the ordinary course, Anthropic deletes the inputs and outputs
  from its systems within about 30 days.
  **One exception you should know about:** if Anthropic's automated safety systems flag a
  request, Anthropic may retain the inputs and outputs for **up to two years**. That is outside
  our control and continues to apply even after you delete your account in this app.
- **Google** provides Sign in with Google, if you choose that sign-in method. Google acts as an
  identity provider for that flow only, under Google's own privacy policy.
- **Apple** and **Google Play** distribute the app, and handle any purchase of a paid tier
  through their own billing. Each does so under its own privacy policy, not ours.

We don't sell your data to anyone, and we don't use it for advertising. We do not run our own
analytics, advertising, or crash-reporting service. If you use the app through Apple's
TestFlight, Apple provides us with crash logs and any feedback you choose to send — that is
Apple's service, governed by Apple's privacy policy.

---

## International transfers

Your data crosses borders to reach the service providers listed above:

- **Cloudflare** is a United States company operating a global network. Your account, intake
  answers and plans are stored in a Cloudflare data-centre region chosen by Cloudflare, and
  requests may be processed at any Cloudflare location close to you.
- **Anthropic** processes paid-plan requests in the **United States**.
- **Google** processes Sign in with Google according to its own global infrastructure.

We are established in Thailand. If you are in the EU or UK, these transfers rely on the
provider's standard contractual clauses (SCCs) under its data processing terms, which we accept
when we use the service. If you are in Thailand, the transfers are made to providers that give
contractual data-protection commitments, as the Personal Data Protection Act requires.

---

## Where your data lives, and for how long

- Your account, intake answers, tier and plans are kept **until you delete your account**.
  There is no separate automatic expiry.
- Your intake is a single set of answers. Saving the intake again **overwrites** the previous
  answers; we do not keep a history of them.
- Individual plans cannot be deleted one at a time. Your tier's quota is counted from the
  plans in your account, so a per-plan delete would let a plan count be reset. Deleting your
  account removes every plan at once.
- Sign-in sessions expire automatically — currently seven days after they were last used — and
  are deleted when you sign out or delete your account.
- Deleting your account removes everything in one transaction: your plans, your intake answers,
  your tier record, your profile, your sessions, your sign-in credentials and your account row.
  There is no soft-delete flag and no grace period on our side.
- Deleted data may persist briefly afterward in **Cloudflare's point-in-time database backups**
  (up to 30 days) and request metadata (not your intake answers or plans) may appear in
  **Cloudflare's backend logs** for a few days, until each retention window passes.
- As described above, Anthropic's copy of the material sent for a paid plan follows its own
  retention terms (ordinarily about 30 days, up to two years if flagged), independent of when
  you delete your account in the app.

---

## Your rights

Wherever you're located, we offer these controls to every user:

- **Access.** You can see your intake answers on the intake screen and every plan on the My
  Plans screen.
- **Rectification.** You can change any intake answer at any time by saving the intake again.
- **Deletion.** You can delete your entire account and all of its data directly in the app:
  Settings → Danger zone → Delete account. The deletion is immediate and cannot be undone.
- **Export.** If you'd like a copy of your data in a portable format, contact us (below) and
  we'll provide it. This is currently a manual, support-driven process rather than an automated
  in-app export.
- **Withdraw consent.** You can withdraw your consent to the processing of your injury answers
  at any time — see "Your injury answers are health data" above.
- **Restriction.** You can ask us to pause processing your data while a dispute about it is
  resolved.
- **Objection.** You can object to our processing of your data on grounds relating to your
  particular situation.
- **Complain to a regulator.** If you're in the EU or UK, you have the right to lodge a
  complaint with your local data protection supervisory authority at any time. If you're in
  Thailand, you may complain to the Personal Data Protection Committee. You don't need to
  contact us first.

**However you reach us:** you can also ask us to delete your account and all its data, or
request a copy of everything we hold about you, by emailing us at the address below; we'll
action it within 30 days.

If you are in the EU/UK, these map to your GDPR rights of access (Art. 15), rectification
(Art. 16), erasure (Art. 17), restriction (Art. 18), portability (Art. 20), objection (Art. 21),
withdrawal of consent (Art. 7(3)), and to lodge a complaint with a supervisory authority
(Art. 13(2)(d)). If you are in Thailand, they correspond to your rights under sections 30–36 of
the Personal Data Protection Act B.E. 2562 (2019). If you are in California or another U.S.
state with a comparable law, these map to your rights to know, delete, correct, and obtain a
copy of your personal information.

---

## Age

You must be **13 or older** to use Pace Blueprint. The intake asks for your age and refuses an
age under 13; we do not knowingly hold an account for anyone younger, and if we learn that we
do, we delete it.

If you are **13 to 17**, you may use the app **only with the consent of a parent or guardian**,
who agrees to this policy on your behalf. If you are a parent or guardian and believe your child
is using the app without your consent, contact us at the address below and we will delete the
account. Plans for runners under 18 are also built differently: they never prescribe heart-rate
zones, using effort levels instead.

---

## Changes to this policy

If we materially change what we collect or how we use it, we'll update this page and the "Last
updated" date above. If we materially change how we use your injury answers, we'll ask for your
consent again before the change applies to you.

---

## Contact

Questions about this policy or your data, or to request a deletion or export outside the in-app
tools: **i78979848@gmail.com**
