# Intent extraction, measured

Corpus: 96 entries from `apps/app/fixtures/transcripts.ts` (#52).
Scored against `expectedType`, with `null` treated as the flowchart default,
matching `buildUserPrompt:161`'s `intent.diagramType || "flowchart"`.

## Overall

**`decided` is the number that matters.** It scores only the transcripts where a
human committed to an answer. `strict` adds the 23 ambiguous ones and forces them
to flowchart, which is what the app does today, so it rewards guessing flowchart
rather than being right. An on-request type must match exactly in both.

| strategy                              |         decided |      strict |
| ------------------------------------- | --------------: | ----------: |
| 1. shipped (last keyword wins)        | **63%** (46/73) | 72% (69/96) |
| 2a. strong keywords, last wins        | **79%** (58/73) | 84% (81/96) |
| 2b. strong keywords, first wins       | **79%** (58/73) | 84% (81/96) |
| always flowchart (control)            | **67%** (49/73) | 75% (72/96) |
| 3. model output                       | **81%** (59/73) | 75% (72/96) |
| 4. keyword OVERRIDES model (rejected) | **79%** (58/73) | 74% (71/96) |

## By phenomenon (decided)

| phenomenon            |   n | 1. shipped (last keyword wins) | 2a. strong keywords, last wins | 2b. strong keywords, first wins | always flowchart (control) | 3. model output | 4. keyword OVERRIDES model (rejected) |
| --------------------- | --: | -----------------------------: | -----------------------------: | ------------------------------: | -------------------------: | --------------: | ------------------------------------: |
| `weak-keyword-misuse` |   8 |                            25% |                           100% |                            100% |                       100% |             50% |                                   50% |
| `strong-keyword`      |  12 |                            42% |                            92% |                             92% |                        25% |            100% |                                   92% |
| `no-type-keyword`     |  16 |                            20% |                            20% |                             20% |                        20% |             90% |                                   90% |
| `asr-corruption`      |  13 |                            75% |                            75% |                             75% |                        75% |             75% |                                   75% |
| `changes-mind`        |   3 |                            67% |                            67% |                             67% |                        67% |             67% |                                   33% |
| `code-paste`          |   7 |                            71% |                            71% |                             71% |                        57% |             86% |                                   86% |
| `mermaid-paste`       |   4 |                            50% |                           100% |                            100% |                        75% |            100% |                                  100% |

## By input mode (decided)

| mode     |   n | 1. shipped (last keyword wins) | 2a. strong keywords, last wins | 2b. strong keywords, first wins | always flowchart (control) | 3. model output | 4. keyword OVERRIDES model (rejected) |
| -------- | --: | -----------------------------: | -----------------------------: | ------------------------------: | -------------------------: | --------------: | ------------------------------------: |
| dictated |  75 |                            60% |                            77% |                             77% |                        65% |             81% |                                   79% |
| typed    |   8 |                            75% |                            88% |                             88% |                        75% |             63% |                                   63% |
| pasted   |  13 |                            69% |                            85% |                             85% |                        69% |             92% |                                   92% |

## Every case the shipped code gets wrong

| id                                     | expected        | shipped said        | transcript                                                                                  |
| -------------------------------------- | --------------- | ------------------- | ------------------------------------------------------------------------------------------- |
| `swe-oauth-sequence-explicit`          | sequenceDiagram | **flowchart**       | draw a sequence diagram for the OAuth flow so the browser hits our login endpoint we redir… |
| `swe-payment-class-in-a-flow`          | flowchart       | **classDiagram**    | so the checkout starts when the user hits pay we validate the cart then we call the paymen… |
| `swe-flow-then-class-word`             | flowchart       | **classDiagram**    | add a flow chart of the signup process email goes in we create the User class record then … |
| `swe-sequence-word-as-ordering`        | flowchart       | **sequenceDiagram** | I need the sequence of steps for a database migration first we take a backup then we run t… |
| `swe-timeline-word-noise`              | flowchart       | **sequenceDiagram** | give me the rollout timeline we ship to internal on Monday then ten percent on Wednesday t… |
| `swe-flow-becomes-sequence`            | sequenceDiagram | **flowchart**       | show the checkout as a flow chart cart then payment then confirmation actually no do it as… |
| `swe-microservice-sequence`            | sequenceDiagram | **flowchart**       | the front end asks the order service to place an order the order service asks inventory to… |
| `swe-inheritance-no-keyword`           | classDiagram    | **flowchart**       | there is a base Notification and then Email and Sms and Push all extend it each one has a … |
| `gen-class-word-in-school-sense`       | flowchart       | **classDiagram**    | students book a class then they get a confirmation email and if they cancel more than a da… |
| `gen-sequence-word-in-dance-sense`     | flowchart       | **sequenceDiagram** | the routine has three parts the warm up then the main sequence then the cool down and each… |
| `swe-payment-webhook-sequence`         | sequenceDiagram | **flowchart**       | stripe sends us a webhook our handler verifies the signature then it asks the order servic… |
| `swe-grpc-streaming-sequence`          | sequenceDiagram | **flowchart**       | the client opens a stream over G R P C and sends a subscribe message the server acknowledg… |
| `gen-restaurant-order-sequence`        | sequenceDiagram | **flowchart**       | the customer tells the waiter what they want the waiter passes it to the kitchen the kitch… |
| `swe-repository-pattern-class`         | classDiagram    | **flowchart**       | there is a Repository interface with find and save and then PostgresRepository and InMemor… |
| `swe-event-hierarchy-class`            | classDiagram    | **flowchart**       | we have an abstract Event with a timestamp and then OrderPlaced OrderShipped and OrderCanc… |
| `gen-library-model-class`              | classDiagram    | **flowchart**       | a Member can borrow many Books each Book belongs to one Author and an Author can have writ… |
| `paste-mermaid-with-banned-constructs` | flowchart       | **classDiagram**    | Clean this up please: flowchart TD A[(Database)] --> B{{Decision}} B --> C[/Report/] clas…  |
| `paste-mermaid-fenced`                 | sequenceDiagram | **flowchart**       | ```mermaid sequenceDiagram participant U as User participant A as API U->>A: login A-->>U:… |
| `paste-typescript-interfaces`          | classDiagram    | **flowchart**       | interface User { id: string; email: string; orders: Order[]; } interface Order { …          |
| `paste-sql-schema`                     | erDiagram       | **flowchart**       | CREATE TABLE users ( id UUID PRIMARY KEY, email TEXT NOT NULL ); CREATE TABLE orders …      |
| `swe-er-request-dictated`              | erDiagram       | **flowchart**       | I need an entity relationship diagram customers place orders orders contain line items and… |
| `swe-state-machine-request`            | stateDiagram-v2 | **flowchart**       | draw the state machine for an order it starts as pending goes to paid then to shipped and … |
| `swe-state-diagram-explicit`           | stateDiagram-v2 | **flowchart**       | State diagram for the socket: disconnected -> connecting -> connected, and connected -> cl… |

## Mid-transcript type flips

Auto mode feeds a growing transcript. Each change of detected type swaps the
canvas to a different diagram **and** invalidates the prompt cache (#51).
Simulated by replaying each transcript word by word. A first detection
(`null` to a type) is not counted; only a change between two types is,
because only that swaps an already-drawn diagram.

| strategy         | transcripts that flip | total flips |
| ---------------- | --------------------: | ----------: |
| 1. shipped       |                     3 |           3 |
| 2a. strong, last |                     0 |           0 |

Transcripts that flip under the shipped code:

`swe-oauth-sequence-explicit` — 1 flip(s)
`swe-flow-then-class-word` — 1 flip(s)
`paste-mermaid-with-banned-constructs` — 1 flip(s)

## Direction

`extractDirection` has never been measured. The bar is whether it beats
always answering `TD`, which is what `intent-extraction.ts:293` already
hardcodes on the recovery path.

- transcripts with a deliberate direction hint: **4**
- of those, a direction was detected: **3**
- transcripts with NO hint: **92**
- of those, a direction was wrongly detected: **3**

False positives:

| id                                     | detected | why                                                                    |
| -------------------------------------- | -------- | ---------------------------------------------------------------------- |
| `paste-mermaid-extend`                 | TD       | Here's what we have already: flowchart TD A[Client] --> B[API] B --> … |
| `paste-mermaid-with-banned-constructs` | TD       | Clean this up please: flowchart TD A[(Database)] --> B{{Decision}} B … |
| `paste-mixed-dictation-and-paste`      | TD       | flowchart TD A[Ingest] --> B[Validate] B --> C[Load] so basically add… |

## On-request types

#44's guard is conditional: a single `image` element is `ok` when the user
asked for a type the converter cannot make editable, `broken` otherwise.

| measure                                     | count |
| ------------------------------------------- | ----: |
| transcripts that request an on-request type |     4 |
| correctly detected                          | **4** |
| false positives across the other 92         | **0** |

- `swe-gantt-request` want gantt, got gantt
- `gen-pie-request` want pie, got pie
- `gen-mindmap-request` want mindmap, got mindmap
- `swe-gitgraph-request` want gitGraph, got gitGraph

## erDiagram and stateDiagram-v2

Transcripts expecting a type the app does not yet ship: **4**

| id                           | expected        | shipped says | strong keywords say |
| ---------------------------- | --------------- | ------------ | ------------------- |
| `paste-sql-schema`           | erDiagram       | null         | **erDiagram**       |
| `swe-er-request-dictated`    | erDiagram       | null         | **erDiagram**       |
| `swe-state-machine-request`  | stateDiagram-v2 | null         | **stateDiagram-v2** |
| `swe-state-diagram-explicit` | stateDiagram-v2 | null         | **stateDiagram-v2** |

## Strategy 3 detail

Live run against `claude-sonnet-4-6` through CLIProxyAPI, 96 calls.
Median latency **5.3s**, min 2.3s, max 168.7s.

Not a shortcut: the model was asked to _draw_, exactly as #42's call 1 would,
and the type was read off line one of what came back. Asking a model to
classify and asking it to draw are different tasks and can disagree.

| id                              | expected     | model drew          | agrees |
| ------------------------------- | ------------ | ------------------- | ------ |
| `swe-login-trivial`             | flowchart    | **sequenceDiagram** | no     |
| `swe-payment-class-in-a-flow`   | flowchart    | **sequenceDiagram** | no     |
| `swe-sequence-word-as-ordering` | flowchart    | **sequenceDiagram** | no     |
| `swe-timeline-word-noise`       | flowchart    | **sequenceDiagram** | no     |
| `swe-auth-cache-corrupted`      | flowchart    | **sequenceDiagram** | no     |
| `swe-redis-kafka-corrupted`     | flowchart    | **sequenceDiagram** | no     |
| `swe-queue-homophone`           | flowchart    | **sequenceDiagram** | no     |
| `swe-nginx-async-corrupted`     | flowchart    | **sequenceDiagram** | no     |
| `swe-s3-grpc-corrupted`         | flowchart    | **sequenceDiagram** | no     |
| `swe-correction-simple`         | flowchart    | **sequenceDiagram** | no     |
| `swe-correction-of-direction`   | flowchart    | **sequenceDiagram** | no     |
| `swe-class-becomes-flow`        | flowchart    | **sequenceDiagram** | no     |
| `swe-versioned-names`           | flowchart    | **sequenceDiagram** | no     |
| `swe-long-incident`             | flowchart    | **sequenceDiagram** | no     |
| `swe-websocket-lifecycle`       | flowchart    | **stateDiagram-v2** | no     |
| `swe-k8s-deploy`                | flowchart    | **sequenceDiagram** | no     |
| `swe-cache-invalidation`        | flowchart    | **sequenceDiagram** | no     |
| `swe-retry-logic`               | flowchart    | **sequenceDiagram** | no     |
| `swe-terraform-apply`           | flowchart    | **sequenceDiagram** | no     |
| `gen-empty-ish`                 | flowchart    | **none**            | no     |
| `gen-library-model-class`       | classDiagram | **erDiagram**       | no     |
| `typed-parens-in-names`         | flowchart    | **sequenceDiagram** | no     |
| `typed-multiline`               | flowchart    | **sequenceDiagram** | no     |
| `typed-reserved-word-literal`   | flowchart    | **stateDiagram-v2** | no     |
| `paste-very-long-file`          | flowchart    | **sequenceDiagram** | no     |

### On-request types, strategy 3

The model produced the requested non-editable type in **4 of 4** cases.

- `swe-gantt-request` want gantt, drew gantt
- `gen-pie-request` want pie, drew pie
- `gen-mindmap-request` want mindmap, drew mindmap
- `swe-gitgraph-request` want gitGraph, drew gitGraph

## What each strategy does with the 23 ambiguous transcripts

Nothing to score against, so this reports behaviour. `expectedType: null`
means a human would not commit to one type.

| strategy                              | flowchart | sequenceDiagram | classDiagram | erDiagram | stateDiagram-v2 |
| ------------------------------------- | --------: | --------------: | -----------: | --------: | --------------: |
| 1. shipped (last keyword wins)        |        23 |               0 |            0 |         0 |               0 |
| 2a. strong keywords, last wins        |        23 |               0 |            0 |         0 |               0 |
| 2b. strong keywords, first wins       |        23 |               0 |            0 |         0 |               0 |
| always flowchart (control)            |        23 |               0 |            0 |         0 |               0 |
| 3. model output                       |        13 |               9 |            0 |         0 |               1 |
| 4. keyword OVERRIDES model (rejected) |        13 |               9 |            0 |         0 |               1 |

Sample size 23.
