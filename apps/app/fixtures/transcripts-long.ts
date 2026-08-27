/**
 * THROWAWAY fixture for wayfinder ticket #54 (map #38). Not the shipped corpus.
 *
 * The 371-entry corpus tops out at 181 words and has a median of 36. That is
 * fine for measuring type selection, which is what it was built for, and
 * useless for separating Medium from High: the whole premise of High's two
 * passes is that one pass loses track of a long input, and nothing in the
 * corpus is long enough to lose track of.
 *
 * Ten entries, 300 to 750 words, written so a careful reader finds things a
 * hurried one drops. Every entry deliberately carries at least four of:
 *
 *   - a group named once, in passing, and never repeated
 *   - a failure path stated once and moved past
 *   - something optional, planned, or not built yet
 *   - a main path distinguished from edge cases
 *   - an indirect, async or eventual relationship
 *   - a revision that supersedes something said earlier
 *   - an aside, analogy or crosstalk that is not part of the diagram
 *   - enough content for more than one diagram
 *
 * `expectedTypes` is what a good answer draws. `notes` says what separates a
 * careful answer from a hurried one, which is the thing being measured.
 *
 * If these do separate the levels, they get folded into the real corpus and
 * this file goes away.
 */
import type { Transcript } from "./transcripts";

export const LONG_TRANSCRIPTS: Transcript[] = [
  {
    id: "long-meet-checkout-rearchitecture",
    category: "swe",
    inputMode: "dictated",
    useCase: "meeting",
    scenario: "architecture review of a checkout rewrite, two teams present",
    expectedType: "sequenceDiagram",
    expectedTypes: ["sequenceDiagram", "flowchart"],
    multiFrom: "medium",
    phenomena: ["run-on", "crosstalk", "self-correction", "multi-diagram"],
    notes:
      "The retry-and-dead-letter path is stated once. The fraud service is explicitly not built yet, which is the dashed case. The card path is called the one that ninety percent of orders take, which is the thick case. Payments team and orders team are named as owners exactly once each.",
    text: "okay so this is the checkout rewrite let me walk through where we landed after last week so the entry point is still the same the client posts to the orders api and that hasnt changed what has changed is everything behind it right so orders api used to write straight to postgres and call stripe inline and that was the whole problem because when stripe was slow we held the connection so now orders api does three things it validates the cart it reserves inventory and then it drops a message on the payments queue and returns immediately to the client with a pending status thats the main path thats what ninety percent of orders do card payment nothing weird now the payments worker picks that message up and thats owned by the payments team everything before it is the orders team im saying that because we keep arguing about it in standup so payments worker calls stripe and if stripe says yes it writes the payment record and publishes an order confirmed event and the orders api is listening for that eventually and flips the order to confirmed its not synchronous the client is polling or we push over the websocket we havent decided sorry actually we have decided its the websocket ignore the polling thing if stripe says no we mark the payment failed and we release the inventory reservation and thats the bit everyone forgets the release has to happen or we leak stock and then if stripe times out or the worker crashes the message goes back on the queue and we retry three times and after three we drop it in the dead letter queue and someone gets paged the fraud check the fraud check is not built we talked about it we want it between validate cart and reserve inventory but its not there its q3 at the earliest so dont draw it as if it exists but i do want to see where it goes oh and the inventory service the reserve inventory call goes through inventory service not directly to the db that matters because inventory has its own postgres and thats the only thing that talks to it thats the whole point of the split",
  },
  {
    id: "long-incident-review-payment-outage",
    category: "swe",
    inputMode: "dictated",
    useCase: "meeting",
    scenario: "post-incident review, timeline plus the resulting state machine",
    expectedType: "flowchart",
    expectedTypes: ["flowchart", "stateDiagram-v2"],
    multiFrom: "medium",
    phenomena: ["run-on", "trails-off", "multi-diagram"],
    notes:
      "Two diagrams: the incident timeline and the order state machine the fix introduced. Three phases are named. The rollback that did not work is the failure path, and the config flag is the thing that actually worked. The analogy about a burst pipe is not a diagram.",
    text: "right so this is the payment outage from the fourteenth im going to go through it in three parts what we saw what we did and what we changed so first part what we saw at 2:04 in the morning the error rate alert fires on checkout its at eleven percent normally we sit under a tenth of a percent oncall picks it up at 2:09 first thing they do is look at the app servers cpu is fine memory is fine no deploys in the window at least none that showed in the dashboard which turned out to be wrong so they look at the database and connections are pinned at max which is two hundred and thats the moment it becomes obvious its a connection problem not a code problem second part what we did the first thing was roll back and that did not work and thats the important bit because we assumed it would we rolled back the api deploy from the previous evening error rate did not move at all stayed at eleven so then someone actually reads the deploy log properly and there was a second deploy a background job change that went out at midnight through a different pipeline nobody was watching that one and that job was opening a connection per iteration instead of using the pool so the fix that actually worked was a config flag we disabled the job entirely with a feature flag at 2:41 and connections drained and error rate was back to normal by 2:47 and then the third part what we changed so the order state machine now has an explicit stuck state before it used to go pending then either confirmed or failed and if the payment worker died in the middle it just sat in pending forever and nobody knew now pending has a timeout on it fifteen minutes and if it hasnt moved it goes to stuck and stuck has a manual retry that puts it back to pending or an operator can force it to failed which releases the inventory confirmed is terminal failed is terminal stuck is not its just a place to sit and be noticed its like a burst pipe you dont want the water spreading you want it in one room where you can see it anyway thats the metaphor i used with the exec so also the job pipeline now goes through the same deploy dashboard as everything else thats a process change not a diagram thing",
  },
  {
    id: "long-teach-http-caching-lecture",
    category: "general",
    inputMode: "dictated",
    useCase: "teaching",
    scenario: "a lecture on http caching, request flow plus cache state",
    expectedType: "flowchart",
    expectedTypes: ["flowchart", "sequenceDiagram", "stateDiagram-v2"],
    multiFrom: "high",
    phenomena: ["run-on", "analogy", "multi-diagram"],
    notes:
      "Three diagrams if you follow it carefully: the decision flow, the revalidation exchange, and the freshness state machine. The library-book analogy is explicitly labelled as an analogy and is not a diagram. The stale-while-revalidate path is mentioned once and is the detail a hurried answer drops.",
    text: "so today im doing http caching and i want to build this up in layers because everyone thinks they know it and then gets stale-while-revalidate wrong so lets start with the simplest possible question the browser wants a resource what happens first it checks its own cache thats it thats the first fork if theres nothing in the cache it goes to the network done thats the cold path if there is something in the cache the next question is is it fresh and freshness is just max-age against the age of the entry if its fresh you serve it from cache you do not touch the network at all thats the whole point people miss this they think the browser always asks it doesnt now if its stale thats where it gets interesting because stale does not mean useless stale means you have to check so the browser sends a conditional request and a conditional request is the browser saying i have version abc do you still have version abc and it sends that as an if-none-match header with the etag and now the server has two answers it can give if the resource hasnt changed the server sends back a 304 not modified with no body and thats tiny thats the win and the browser then refreshes the age on its cached copy and serves it if the resource has changed the server sends a full 200 with the new body and a new etag and the browser replaces its entry so those are the two branches of the conditional request think of it like a library book with a due date if its not due yet you just read it if its due you dont throw it away you go and ask the librarian is there a newer edition and they either say no youre fine keep it or they hand you the new one thats the analogy dont draw the library im just saying it now the third thing and this is the one that trips people stale-while-revalidate says you may serve the stale copy immediately and do the revalidation in the background so the user gets an instant response from a copy you know is old and the cache gets refreshed after the fact so the entry has more than two conditions it is fresh or it is stale but still servable or it is stale and too old to serve and it moves between those on time alone nothing else triggers it and the revalidation moves it back to fresh so its a proper little state machine fresh goes to stale after max-age stale goes to expired after the stale-while-revalidate window and a successful revalidation from either one puts you back to fresh and a failed revalidation while youre in the stale window you can still serve which is the whole reason the feature exists",
  },
  {
    id: "long-design-review-notification-service",
    category: "swe",
    inputMode: "dictated",
    useCase: "meeting",
    scenario:
      "design review, service architecture plus the delivery record model",
    expectedType: "flowchart",
    expectedTypes: ["flowchart", "erDiagram"],
    multiFrom: "medium",
    phenomena: ["run-on", "self-correction", "multi-diagram"],
    notes:
      "Three named boundaries: ingest, routing, delivery. Email and push exist, sms is planned. The digest path is called rare compared to the immediate path. A revision mid-way replaces per-channel tables with one table plus a channel column.",
    text: "alright notification service design review im going to describe the pipeline and then the data model so the pipeline has three parts and i want them drawn as three parts because thats how were splitting the work ingest routing and delivery ingest is one thing its an api endpoint other services post a notification intent to it and it does almost nothing it validates the payload it writes a notification record and it puts an id on the routing queue thats ingest thats all it does deliberately routing is where the logic lives routing reads the user preferences and the notification type and decides which channels this goes to and there can be more than one it also decides immediate versus digest immediate is the normal case thats the vast majority digest is the rare one where we batch things up and send once a day and that goes to a completely different scheduler so from routing you either fan out to the channel queues right away or you write a digest row and stop delivery is per channel we have email delivery which goes through sendgrid and we have push delivery which goes through firebase and sms is designed but not built we have the interface for it we do not have a provider contract yet so put it in but make it clear its not real each channel worker takes from its queue calls the provider and writes a delivery attempt and if the provider returns a retryable error we back off and requeue up to five times and if its a permanent failure like a bounced address we mark the delivery failed and we also flag the users channel as unhealthy so routing stops picking it now the data model originally i had a table per channel email_deliveries push_deliveries and so on and thats wrong scrap that were doing one deliveries table with a channel column because the fields are the same anyway so notifications is the parent one row per intent it has an id a user id a type a payload as json and a created at and then deliveries has an id a notification id a channel an attempt count a status and a last error and one notification has many deliveries obviously and then users has many notifications and users also has channel preferences which is its own table user id channel enabled and a healthy flag so a user has many channel preferences one per channel",
  },
  {
    id: "long-interview-ride-hailing-design",
    category: "swe",
    inputMode: "dictated",
    useCase: "interview",
    scenario:
      "system design interview, candidate thinks aloud and revises twice",
    expectedType: "flowchart",
    expectedTypes: ["flowchart", "stateDiagram-v2"],
    multiFrom: "medium",
    phenomena: [
      "run-on",
      "self-correction",
      "deictic-reference",
      "multi-diagram",
    ],
    notes:
      "The candidate revises the matching design twice; only the last version counts. The trip state machine is the second diagram. Surge pricing is explicitly deferred. The interviewer's interjection about scale is crosstalk, not content.",
    text: "okay so ride hailing let me start with the rider requesting a trip and work outward the rider opens the app and the app is already streaming their location so when they hit request we have a pickup point and a destination and that goes to the trip service the trip service creates a trip in requested state and then it needs to find a driver so my first thought is we query the driver table for drivers within a radius and sort by distance and thats fine for a small city and its going to fall over immediately because that query is a table scan on every request so let me redo that we keep driver locations in redis with a geospatial index and the trip service asks redis for the nearest twenty drivers and thats a millisecond not a query actually let me refine that once more because nearest twenty is wrong too we want nearest twenty who are online and not currently on a trip so the redis set only contains available drivers and when a driver accepts we remove them from the set and when they drop off we put them back thats cleaner sure yeah were talking maybe fifty thousand concurrent drivers in a city so redis is fine for that so the matching service takes those candidates and sends a request to the first one and they have fifteen seconds to accept if they accept the trip moves to accepted and we notify the rider if they decline or time out we go to the next candidate and if we exhaust all twenty we widen the radius once and if that fails we tell the rider no drivers available and the trip goes to cancelled now the trip itself has a proper lifecycle requested then accepted then the driver drives over and we go to arrived then the rider gets in and its in progress then completed and payment happens off the back of completed asynchronously we do not block the trip on the payment and from requested you can go to cancelled and from accepted you can go to cancelled and the rider is charged a fee in that case but from in progress you cannot cancel you can only complete or if something goes really wrong theres a support override that force completes it surge pricing is out of scope you said not to worry about pricing so im leaving it the location updates during the trip are a separate stream the driver app pushes location every four seconds to a location service and the rider app subscribes to that and the trip service is not in that path at all which matters because otherwise the trip service is handling the highest volume traffic in the system for no reason",
  },
  {
    id: "long-creator-script-oauth-explainer",
    category: "swe",
    inputMode: "dictated",
    useCase: "creator",
    scenario: "video script, the pkce exchange plus the token state",
    expectedType: "sequenceDiagram",
    expectedTypes: ["sequenceDiagram", "stateDiagram-v2"],
    multiFrom: "medium",
    phenomena: ["run-on", "analogy", "multi-diagram"],
    notes:
      "The valet key analogy is explicitly for narration, not a diagram. The refresh rotation and the reuse-detection revocation are each stated once. The implicit flow is mentioned only to reject it.",
    text: "okay this is the oauth video script im going to narrate the exchange and then talk about what happens to the token afterwards so the setup is a mobile app that wants to read your calendar and the thing you have to understand is the app never sees your password ever thats the entire point im going to use the valet key line here you give the valet a key that starts the car but doesnt open the glovebox thats narration dont put a car in the diagram so the flow the app generates a random string called a code verifier and hashes it and that hash is the code challenge and it keeps the verifier and sends only the challenge so the app opens a browser to the authorization server with the client id the redirect uri and that code challenge the user sees the login page and this is the authorization server talking to the user not the app the app is not in this conversation the user logs in and approves the scopes and then the authorization server redirects back to the app with an authorization code and that code is useless on its own thats the key bit now the app takes that code and posts it directly to the token endpoint along with the original code verifier and the server hashes the verifier and checks it matches the challenge it stored and if it does it returns an access token and a refresh token if it doesnt it returns an error and the whole thing is dead which is what stops someone who intercepted the code from using it were not covering the implicit flow its deprecated i mention it in one line and move on so then the token lifecycle the access token is short lived fifteen minutes usually and it starts valid and it becomes expired on time alone nothing else and when its expired the app posts the refresh token and gets a new access token and a new refresh token because we rotate them and the old refresh token is now invalid and heres the good part if someone tries to use that old refresh token the server knows it was already used and it treats that as a compromise and revokes the entire token family so the user gets logged out everywhere thats reuse detection so the access token is valid or expired the refresh token is valid or used or revoked and used goes to revoked the moment someone tries it again",
  },
  {
    id: "long-handover-legacy-billing",
    category: "swe",
    inputMode: "dictated",
    useCase: "meeting",
    scenario: "handover of a legacy billing system, warts included",
    expectedType: "flowchart",
    expectedTypes: ["flowchart", "erDiagram"],
    multiFrom: "medium",
    phenomena: ["run-on", "trails-off", "multi-diagram"],
    notes:
      "The nightly cron and the webhook are two entry points to the same path. The reconciliation script is described as a thing nobody should touch, the legacy proration table as deprecated but still read. Both are the dashed cases.",
    text: "so youre taking over billing im sorry in advance let me tell you how it actually works not how the wiki says it works there are two ways a charge happens and everyone assumes theres one the normal way is the nightly cron it runs at 3am it finds every subscription whose period ends today it computes the amount and it calls stripe and writes an invoice thats the boring path thats ninety five percent of revenue the other way is the webhook when someone upgrades mid cycle stripe sends us a subscription updated webhook and we compute a proration and charge immediately and that path shares the amount computation with the cron but nothing else so if you change the computation you change both and people have broken that twice now the amount computation reads three things it reads the plan the seat count and the discount and discounts are where it gets ugly because there are two discount tables theres discounts which is the current one and theres legacy_prorations which is deprecated and we do not write to it anymore but the computation still reads it for about four hundred customers who were grandfathered in 2019 do not delete it do not touch it there is also a reconciliation script that runs weekly and compares our invoices against stripes and writes a mismatch report and honestly nobody has read that report in a year it emails a distribution list that half of us are not on anymore its there its running leave it alone if a charge fails stripe tells us via a payment failed webhook and we mark the invoice failed and we start dunning which is three emails over ten days and if it still hasnt paid the subscription goes to past due and then after another five days we suspend it and suspended means the api keys stop working but the data is still there we dont delete anything for ninety days now the data model subscriptions has an id a customer id a plan id a status a current period start and end invoices has an id a subscription id an amount a status and a stripe invoice id one subscription has many invoices customers has many subscriptions plans is basically static there are eleven rows and it has a price and an interval and discounts hangs off customers not off subscriptions which is a mistake but its been that way for six years anyway ill send you the runbook such as it is",
  },
  {
    id: "long-meet-data-platform-two-topics",
    category: "swe",
    inputMode: "dictated",
    useCase: "meeting",
    scenario: "a meeting that covers two genuinely unrelated systems",
    expectedType: "flowchart",
    expectedTypes: ["flowchart", "flowchart"],
    multiFrom: "low",
    phenomena: ["run-on", "crosstalk", "multi-diagram"],
    notes:
      "Two unrelated pipelines in one meeting, which must be two fences and not one merged diagram. The hiring chatter at the start and the calendar exchange at the end are neither. Tests the fence-splitting rule under length.",
    text: "morning everyone ok before we start does anyone know if the offer went out for the data eng role no ok ill chase it so two things on the agenda today the events pipeline and the reporting refresh theyre unrelated im doing them in one meeting because youre all here so events pipeline first the sdk in the client batches events and posts them every thirty seconds to the collector the collector does nothing clever it validates the schema and writes to kafka if the schema is wrong it writes to a dead letter topic instead and we look at that weekly then theres an enrichment consumer that reads from kafka joins on the user dimension and writes back to an enriched topic and then two things read that enriched topic the warehouse loader which batches to s3 and copies into snowflake every fifteen minutes and the realtime aggregator which keeps counters in redis for the live dashboard those are two separate consumers on the same topic they dont know about each other second thing the reporting refresh completely different system this is the thing finance uses so at 6am a scheduler kicks off a dbt run dbt reads the raw tables in snowflake and builds the staging models then the marts and then when the marts are done it triggers a metabase cache warm so the dashboards are fast when people log in at 9 if any dbt model fails the whole run stops and we get a slack alert and the marts keep yesterdays data which is the right behaviour we would rather show stale than wrong and theres a manual rerun button for when someone fixes the upstream data those two things do not touch each other the events pipeline lands in snowflake and the reporting reads snowflake and thats the only relationship and i dont want them drawn as one thing because people keep thinking theyre one thing ok thats it can we do the retro on thursday instead ive got the customer call wednesday",
  },
  {
    id: "long-teach-database-normalisation",
    category: "general",
    inputMode: "dictated",
    useCase: "teaching",
    scenario: "normalisation walkthrough, the bad model then the good one",
    expectedType: "erDiagram",
    expectedTypes: ["erDiagram", "erDiagram"],
    multiFrom: "low",
    phenomena: ["run-on", "self-correction", "multi-diagram"],
    notes:
      "Two ER diagrams, before and after, which is the case where two fences of one type are correct because they are two different things. A hurried answer draws only the final model and loses the teaching point.",
    text: "right normalisation im going to show you a bad schema and then fix it and i want you to see both because seeing the bad one is how you recognise it in the wild so here is the bad one its one table called orders and it has an order id a customer name a customer email a customer address a product name a product price a quantity and an order date thats it one table and it looks fine and it is a disaster so whats wrong first if a customer places three orders their name and email and address are in there three times and if they move house you have to update three rows and if you miss one you now have two truths thats an update anomaly second you cannot store a customer who has never ordered anything there is nowhere to put them thats an insertion anomaly and third if you delete their only order you delete the customer thats a deletion anomaly and fourth product price is the price at the time of the order or the current price of the product nobody knows because the column is doing two jobs now lets fix it we pull customers out into their own table customer id name email address and orders keeps an order id an order date and a customer id and one customer has many orders then we pull products out product id name and current price and now the quantity and the price at time of sale those belong to neither orders nor products they belong to the line so we need a join table order items with an order id a product id a quantity and a unit price and unit price is a copy on purpose that is not denormalisation that is recording a historical fact the product price can change tomorrow and the invoice must not so one order has many order items and one product appears in many order items and that is the many to many resolved properly and the address actually let me go further on that a customer can have a shipping address and a billing address and they can change over time so addresses should be its own table too with a customer id and a type and then orders points at a specific address row so the invoice still shows where it actually went even after they move that is the same historical fact problem as the price so one customer has many addresses and one order has one shipping address",
  },
  {
    id: "long-planning-mobile-release",
    category: "general",
    inputMode: "typed",
    useCase: "meeting",
    scenario: "release planning, a process with gates and an owner split",
    expectedType: "flowchart",
    phenomena: ["real-punctuation", "self-correction"],
    notes:
      "Typed, not dictated, and still long. Four named gates, three owning teams, an optional beta ring, and one path described as what almost every release does against two exception paths. A single diagram, so it tests depth rather than fence splitting.",
    text: "Here's the release process as it stands after the retro, please turn this into something I can put in the handbook.\n\nEverything starts when the release branch is cut from main. That's automated, it happens Tuesday at noon, nobody does it by hand. Once the branch exists, CI runs the full suite - unit, integration, and the UI snapshot tests. That's gate one. If any of it fails the branch is dead, we fix on main and cut again, we do not patch the release branch. That has caused problems before.\n\nGate two is the internal build. QA gets a TestFlight build and has 48 hours. They're checking the release checklist, not doing exploratory testing, that's a different activity that happens continuously. If QA signs off we move on. If QA finds a blocker it goes back to main, same as gate one, and we recut.\n\nGate three is the beta ring, and this one is optional. For a normal release we skip it entirely - that's what almost every release does. We only use the beta ring when the release touches payments or auth, and then it goes to about two thousand external users for five days and we watch crash-free rate. If crash-free drops below 99.5% we pull it.\n\nGate four is the staged rollout to the app stores. 1% for a day, 10% for a day, 50% for a day, then 100%. Release engineering owns this, not QA and not the feature teams. At any stage we can halt, and halting is not the same as rolling back - halt just stops the percentage increasing, the users who already have it keep it. An actual rollback means shipping a new build with the change reverted, because you cannot un-ship from the app store. People get this wrong constantly.\n\nOwnership: the feature teams own everything up to the branch cut. QA owns gates two and three. Release engineering owns gate four and the halt decision. Actually, correction - the halt decision is release engineering's call for crashes, but for a business problem, like a pricing bug, it's the product owner. Two different people depending on why.\n\nAfter 100% we tag the release and the branch is deleted. Hotfixes cut from the tag, not from main.",
  },
];

const words = (t: Transcript) => t.text.trim().split(/\s+/).length;
export const LONG_STATS = {
  count: LONG_TRANSCRIPTS.length,
  minWords: Math.min(...LONG_TRANSCRIPTS.map(words)),
  medianWords: LONG_TRANSCRIPTS.map(words).sort((a, b) => a - b)[
    Math.floor(LONG_TRANSCRIPTS.length / 2)
  ],
  maxWords: Math.max(...LONG_TRANSCRIPTS.map(words)),
};
