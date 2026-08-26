/**
 * Direct-request corpus for the wayfinder map (#38). Sits beside the 371-entry
 * `transcripts.ts`, and covers the one shape that corpus has none of.
 *
 * Every existing entry is a DESCRIPTION. Someone explains a system and the tool
 * infers a diagram from the explanation, so the content of the answer is
 * already in the input. Nobody in those 371 simply asks for a diagram.
 *
 *   corpus today   "so the user hits the gateway the gateway calls the auth
 *                   service and then it writes to the orders table"
 *   this file      "how does dns resolution work"
 *
 * The second one is the shortest and, on any product whose pitch is speed, the
 * most common: one line naming a thing, no content, and the model is expected
 * to supply the diagram from its own knowledge. It measures something the rest
 * of the corpus cannot, because the rest of the corpus always hands over the
 * nodes and edges. Here a wrong answer can be well-formed mermaid about the
 * wrong subject, and a right answer requires knowing what a TLS handshake is.
 *
 * ## The two kinds, roughly half each
 *
 *   RECALL      names a well-known mechanism and expects it drawn from
 *               knowledge. `direct-tcp-handshake`, `direct-flow-photosynthesis`.
 *               A competent engineer or teacher could draw these unaided.
 *   DESIGN      names a product or domain and expects a structure invented for
 *               it. `direct-er-ticket-booking`, `direct-class-chess-engine`.
 *               There is no single right answer, only defensible ones, and
 *               these are where `erDiagram` and `classDiagram` come from.
 *
 * ## Conventions, same as `transcripts.ts`
 *
 * 4 to 22 words, every entry. `very-short` is 18 or fewer, so the four longest
 * entries here do not carry it. Typed entries have real capitals and
 * punctuation and are the only channel that can deliver `( ) " /`. Dictated
 * entries have neither and may carry a lexical filler or an ASR homophone;
 * nothing here is long enough to run on, so `run-on` appears nowhere.
 *
 * `expectedType` is what a competent human would draw, chosen under
 * `prompts/l0-core.md`: by what is described, not which words appear. A bare
 * topic still has a describable shape. "How does Kerberos work" is parties
 * passing tickets, so it is a sequence. "What states does a support ticket move
 * through" is one thing changing, so it is a state machine, even though the
 * person wrote the word `flow`.
 *
 * `null` is used twice, and only where there is genuinely nothing to draw. A
 * scorer counts null as a pass, so a null used to dodge a hard call silently
 * inflates the number. Every other entry commits.
 *
 * ## Pairs worth keeping together
 *
 * `direct-flow-parcel-delivery` says "the journey a parcel takes" and wants a
 * flowchart. `direct-journey-airport-security` asks for a user journey by name
 * and wants the flat `journey` image. Deleting either makes the other
 * unmeasurable: together they separate a named type from a stray noun.
 *
 * ## One rule for anyone adding to this file
 *
 * NO ENTRY MAY NEED TWO DIAGRAMS. Nothing here sets `expectedTypes` or
 * `multiFrom`, so #59's multi-diagram numbers stay clean of it. A one-line
 * request that wants two diagrams belongs in `transcripts-multi.ts`.
 */
import type { Transcript } from "./transcripts";

export const DIRECT_TRANSCRIPTS: Transcript[] = [
  // ─────────────────────────────────────────────────────────── sequenceDiagram
  {
    id: "direct-tcp-handshake",
    category: "swe",
    inputMode: "typed",
    useCase: "solo",
    scenario: "bare request for the TCP three-way handshake",
    text: "Draw the TCP three-way handshake.",
    expectedType: "sequenceDiagram",
    phenomena: ["real-punctuation", "very-short", "no-type-keyword"],
    notes:
      "The shortest recall request in the file: five words, no content, and the whole answer has to come from the model's own knowledge of SYN, SYN-ACK, ACK.",
  },
  {
    id: "direct-oauth-pkce",
    category: "swe",
    inputMode: "dictated",
    useCase: "teaching",
    scenario: "spoken request for the OAuth code exchange",
    text: "walk me through the earth code flow with pkce and what each party sends",
    expectedType: "sequenceDiagram",
    phenomena: [
      "no-punctuation",
      "asr-corruption",
      "very-short",
      "weak-keyword-misuse",
    ],
    notes:
      "Tests whether `earth` is read back as `auth` on a request with no other context to recover it from, while the stray word `flow` must not pull the answer to flowchart.",
  },
  {
    id: "direct-dns-resolution",
    category: "swe",
    inputMode: "dictated",
    useCase: "solo",
    scenario: "bare request for recursive DNS resolution",
    text: "so how does dns resolution work from the browser all the way to the root name server",
    expectedType: "sequenceDiagram",
    phenomena: ["no-punctuation", "lexical-filler", "very-short"],
    notes:
      "Named endpoints passing queries between them, which l0-core resolves to sequence rather than flowchart; also checks the resolver, root, TLD and authoritative hops are recalled in order.",
  },
  {
    id: "direct-handshake-correction",
    category: "swe",
    inputMode: "dictated",
    useCase: "solo",
    scenario: "asks for one handshake and swaps it mid-sentence",
    text: "draw the tcp handshake actually no make it the tls one",
    expectedType: "sequenceDiagram",
    phenomena: ["no-punctuation", "self-correction", "very-short"],
    notes:
      "The only self-correction short enough to fit a one-liner: the subject is replaced after nine words, and the end state is the answer.",
  },
  {
    id: "direct-kerberos-auth",
    category: "swe",
    inputMode: "typed",
    useCase: "solo",
    scenario: "bare request for Kerberos authentication",
    text: "How does Kerberos authentication actually work?",
    expectedType: "sequenceDiagram",
    phenomena: ["real-punctuation", "very-short", "no-type-keyword"],
    notes:
      "A question with no structural hint at all, where the right shape only follows from knowing Kerberos is a client, an AS, a TGS and a service passing tickets.",
  },
  {
    id: "direct-card-settlement",
    category: "general",
    inputMode: "dictated",
    useCase: "teaching",
    scenario: "how money moves on a card payment",
    text: "so who actually moves the money when i tap my card at a shop till",
    expectedType: "sequenceDiagram",
    phenomena: ["no-punctuation", "lexical-filler", "very-short"],
    notes:
      "`who ... moves ... to whom` is the sequence tell without any diagram word present; the parties are acquirer, network and issuer, none of which the text names.",
  },
  {
    id: "direct-raft-election",
    category: "swe",
    inputMode: "typed",
    useCase: "solo",
    scenario: "bare request for Raft leader election",
    text: "Show the messages exchanged during a Raft leader election, including the heartbeat that follows.",
    expectedType: "sequenceDiagram",
    phenomena: ["real-punctuation", "very-short", "no-type-keyword"],
    notes:
      "The word `messages` describes the content rather than naming a type, so this tests selection by description on a topic that could also be drawn as a state machine.",
  },
  {
    id: "direct-atm-withdrawal",
    category: "general",
    inputMode: "dictated",
    useCase: "solo",
    scenario: "who talks to whom during a cash withdrawal",
    text: "who talks to who when you take cash out of an atm",
    expectedType: "sequenceDiagram",
    phenomena: ["no-punctuation", "very-short", "no-type-keyword"],
    notes:
      "Ungrammatical on purpose (`who talks to who`), and the participants are entirely implied: card, ATM, switch, issuing bank.",
  },
  {
    id: "direct-restaurant-order",
    category: "general",
    inputMode: "dictated",
    useCase: "solo",
    scenario: "front of house and kitchen on a dinner order",
    text: "like who passes what between the waiter the kitchen and the till when i order dinner and pay at the end",
    expectedType: "sequenceDiagram",
    phenomena: ["no-punctuation", "lexical-filler"],
    notes:
      "A non-software sequence, checking the type choice survives when there is no protocol vocabulary to lean on.",
  },
  {
    id: "direct-k8s-pod-schedule",
    category: "swe",
    inputMode: "dictated",
    useCase: "solo",
    scenario: "control plane components on a pod create",
    text: "so how does kubernetes actually schedule a pod which control plane components talk to each other and in what order",
    expectedType: "sequenceDiagram",
    phenomena: ["no-punctuation", "lexical-filler"],
    notes:
      "Twenty words, so deliberately outside `very-short`; the request explicitly asks for ordering between named components, which is the sequence tell.",
  },
  {
    id: "direct-emergency-dispatch",
    category: "general",
    inputMode: "typed",
    useCase: "solo",
    scenario: "caller, dispatcher and crew on an emergency call",
    text: "Show what happens between caller, dispatcher and ambulance crew on an emergency call.",
    expectedType: "sequenceDiagram",
    phenomena: ["real-punctuation", "list-content", "very-short"],
    notes:
      "Three participants are named outright with no verbs between them, testing that a bare cast list still resolves to a sequence rather than a flowchart of steps.",
  },
  {
    id: "direct-totp-login",
    category: "swe",
    inputMode: "typed",
    useCase: "solo",
    scenario: "TOTP second factor, type named",
    text: "Sequence diagram for logging in with a TOTP code from an authenticator app.",
    expectedType: "sequenceDiagram",
    phenomena: ["strong-keyword", "real-punctuation", "very-short"],
    notes:
      "The strong-keyword control for this block: same shape as its neighbours, but the type is stated, so a miss here is not a type-selection failure.",
  },

  // ─────────────────────────────────────────────────────────────── erDiagram
  {
    id: "direct-er-ticket-booking",
    category: "swe",
    inputMode: "typed",
    useCase: "solo",
    scenario: "schema for a concert ticket platform",
    text: "Help me design the database for a concert ticket booking platform.",
    expectedType: "erDiagram",
    phenomena: ["real-punctuation", "very-short", "no-type-keyword"],
    notes:
      "The canonical design request: `database` implies storage and cardinality, which l0-core sends to erDiagram rather than classDiagram, and every entity has to be invented.",
  },
  {
    id: "direct-er-saas-billing",
    category: "swe",
    inputMode: "typed",
    useCase: "solo",
    scenario: "billing schema, type named, parenthesised entity list",
    text: "ER diagram for a SaaS billing system (plans, seats, invoices, usage records).",
    expectedType: "erDiagram",
    phenomena: [
      "strong-keyword",
      "real-punctuation",
      "fragile-chars",
      "list-content",
      "very-short",
    ],
    notes:
      "Carries literal parentheses, which #32 measured as fragile and only typed input can deliver; the entities arrive as a bare comma list with no relationships stated.",
  },
  {
    id: "direct-er-hospital-records",
    category: "general",
    inputMode: "dictated",
    useCase: "solo",
    scenario: "patient records data model",
    text: "i need a data model for a hospital patient records system appointments prescriptions ward transfers and billing all of it",
    expectedType: "erDiagram",
    phenomena: ["no-punctuation", "list-content"],
    notes:
      "`all of it` asks for entities nobody listed, testing whether the model invents a sensible boundary instead of drawing only the two nouns it was given.",
  },
  {
    id: "direct-er-library-catalogue",
    category: "general",
    inputMode: "typed",
    useCase: "creator",
    scenario: "library schema for a recorded tutorial",
    text: "Design the schema for a public library: books, copies, members, loans, fines.",
    expectedType: "erDiagram",
    phenomena: ["real-punctuation", "list-content", "very-short"],
    notes:
      "First of the erDiagram-plus-creator entries the whole corpus was missing; the book-versus-copy distinction is the modelling call a shallow answer collapses.",
  },
  {
    id: "direct-er-gym-membership",
    category: "general",
    inputMode: "dictated",
    useCase: "creator",
    scenario: "gym membership schema, spoken while recording",
    text: "database for a gym membership system with classes bookings trainers and the membership tiers",
    expectedType: "erDiagram",
    phenomena: ["no-punctuation", "list-content", "very-short"],
    notes:
      "Second erDiagram-plus-creator entry, and the only one spoken: a dictated schema request arrives with no commas, so the entity list has no separators at all.",
  },
  {
    id: "direct-er-airline-reservation",
    category: "swe",
    inputMode: "typed",
    useCase: "solo",
    scenario: "airline reservation entities",
    text: "Entities and relationships for an airline reservation system, please.",
    expectedType: "erDiagram",
    phenomena: ["real-punctuation", "very-short", "no-type-keyword"],
    notes:
      "Says `entities and relationships` without saying `ER diagram`, which is the description-not-keyword case l0-core asks for; also the polite one.",
  },
  {
    id: "direct-er-university-enrolment",
    category: "general",
    inputMode: "dictated",
    useCase: "teaching",
    scenario: "course enrolment model for a class",
    text: "model the data behind a university course enrolment system for my students",
    expectedType: "erDiagram",
    phenomena: ["no-punctuation", "very-short", "no-type-keyword"],
    notes:
      "The many-to-many between students and courses needs a join entity nobody asked for, which is the thing worth measuring here.",
  },
  {
    id: "direct-er-multi-tenant-crm",
    category: "swe",
    inputMode: "typed",
    useCase: "solo",
    scenario: "multi-tenant CRM schema",
    text: "Model a multi-tenant CRM schema: accounts, contacts, deals, activities, and the tenant boundary.",
    expectedType: "erDiagram",
    phenomena: ["real-punctuation", "list-content", "very-short"],
    notes:
      "`tenant boundary` is a constraint rather than an entity, so this tests whether every noun becomes a box, which l0-core explicitly warns against.",
  },
  {
    id: "direct-er-podcast-hosting",
    category: "swe",
    inputMode: "typed",
    useCase: "creator",
    scenario: "podcast platform tables, typed while recording",
    text: "I'm building a podcast hosting platform, design the tables for shows, episodes and subscribers.",
    expectedType: "erDiagram",
    phenomena: ["real-punctuation", "list-content", "very-short"],
    notes:
      "Third erDiagram-plus-creator entry; `tables` is the storage word that separates erDiagram from classDiagram on an otherwise identical request.",
  },
  {
    id: "direct-er-warehouse-inventory",
    category: "general",
    inputMode: "dictated",
    useCase: "solo",
    scenario: "warehouse stock schema",
    text: "give me a schema for warehouse inventory racks bins stock movements that kind of thing",
    expectedType: "erDiagram",
    phenomena: [
      "no-punctuation",
      "lexical-filler",
      "list-content",
      "very-short",
    ],
    notes:
      "`that kind of thing` is an open-ended trailing filler, and a stock movement is an event table rather than a thing, which is the modelling call.",
  },
  {
    id: "direct-er-recipe-app",
    category: "general",
    inputMode: "typed",
    useCase: "solo",
    scenario: "recipe app tables",
    text: "Tables for a recipe app: recipes, ingredients, steps, shopping lists.",
    expectedType: "erDiagram",
    phenomena: ["real-punctuation", "list-content", "very-short"],
    notes:
      "A recipe step is ordered and an ingredient is quantified, so the quantity belongs on the relationship; tests attributes appearing at all on a request that lists none.",
  },
  {
    id: "direct-er-parking-garage",
    category: "general",
    inputMode: "dictated",
    useCase: "solo",
    scenario: "parking app tables",
    text: "what tables would i need for a parking garage app",
    expectedType: "erDiagram",
    phenomena: ["no-punctuation", "very-short", "no-type-keyword"],
    notes:
      "Ten words, no entities offered at all, so the entire schema is the model's invention; the shortest design request in the file.",
  },

  // ────────────────────────────────────────────────────────────── classDiagram
  {
    id: "direct-class-chess-engine",
    category: "swe",
    inputMode: "typed",
    useCase: "solo",
    scenario: "chess engine object model",
    text: "Class diagram for a chess engine: board, pieces, moves, and how the pieces differ.",
    expectedType: "classDiagram",
    phenomena: [
      "strong-keyword",
      "real-punctuation",
      "list-content",
      "very-short",
    ],
    notes:
      "`how the pieces differ` is an inheritance request in plain words, which l0-core uses to separate classDiagram from erDiagram.",
  },
  {
    id: "direct-class-compiler-ast",
    category: "swe",
    inputMode: "typed",
    useCase: "solo",
    scenario: "AST node hierarchy",
    text: "Model the AST node hierarchy for a small expression compiler.",
    expectedType: "classDiagram",
    phenomena: ["real-punctuation", "very-short", "no-type-keyword"],
    notes:
      "`hierarchy` without the word `class`, on a subject where the answer is a base node type and its subclasses rather than tables.",
  },
  {
    id: "direct-class-drawing-app",
    category: "swe",
    inputMode: "dictated",
    useCase: "solo",
    scenario: "drawing app object structure",
    text: "how would you structure the classes for a drawing app tools shapes and layers",
    expectedType: "classDiagram",
    phenomena: ["no-punctuation", "list-content", "very-short"],
    notes:
      "The word `classes` is spoken rather than the phrase `class diagram`, so this is a weak keyword that happens to point at the right type.",
  },
  {
    id: "direct-class-bank-accounts",
    category: "general",
    inputMode: "typed",
    useCase: "teaching",
    scenario: "account types and their shared base",
    text: "Class model for bank accounts: checking, savings, and the base they share.",
    expectedType: "classDiagram",
    phenomena: ["real-punctuation", "very-short", "no-type-keyword"],
    notes:
      "Nearly the same words as an erDiagram request about accounts; only `the base they share` decides it, which is the distinction being measured.",
  },
  {
    id: "direct-class-media-player",
    category: "swe",
    inputMode: "dictated",
    useCase: "solo",
    scenario: "media player structure, ASR-corrupted",
    text: "give me the class structure of a media player with coders playlists and the transport controls and how they relate",
    expectedType: "classDiagram",
    phenomena: ["no-punctuation", "asr-corruption", "list-content"],
    notes:
      "`coders` is Chrome's rendering of `codecs`, and a one-line request carries no surrounding context to recover the word from.",
  },
  {
    id: "direct-class-observer-pattern",
    category: "swe",
    inputMode: "typed",
    useCase: "teaching",
    scenario: "the Observer pattern from memory",
    text: "Draw the Observer pattern.",
    expectedType: "classDiagram",
    phenomena: ["real-punctuation", "very-short", "no-type-keyword"],
    notes:
      "Four words, the floor of this file: a named artefact with a canonical structure the model either knows or does not.",
  },
  {
    id: "direct-class-tower-defence",
    category: "swe",
    inputMode: "dictated",
    useCase: "creator",
    scenario: "game entity hierarchy, spoken while recording",
    text: "classes for a tower defence game towers enemies projectiles and what they inherit from",
    expectedType: "classDiagram",
    phenomena: ["no-punctuation", "list-content", "very-short"],
    notes:
      "`what they inherit from` states the inheritance explicitly, so this is the easy control against the harder bank-accounts case.",
  },
  {
    id: "direct-class-virtual-filesystem",
    category: "swe",
    inputMode: "typed",
    useCase: "solo",
    scenario: "virtual filesystem node types",
    text: "Class hierarchy for a virtual file system (files, directories, symlinks) with the methods.",
    expectedType: "classDiagram",
    phenomena: [
      "real-punctuation",
      "fragile-chars",
      "list-content",
      "very-short",
    ],
    notes:
      "Asks for methods outright, which only classDiagram can express, and delivers the entity list inside parentheses that must end up quoted or removed.",
  },

  // ─────────────────────────────────────────────────────────── stateDiagram-v2
  {
    id: "direct-state-traffic-light",
    category: "general",
    inputMode: "dictated",
    useCase: "solo",
    scenario: "pedestrian crossing signal states",
    text: "state machine for a traffic light at a pedestrian crossing",
    expectedType: "stateDiagram-v2",
    phenomena: ["strong-keyword", "no-punctuation", "very-short"],
    notes:
      "The strong-keyword control for this block, and a cycle with no terminal state, which is the shape a flowchart answer gets wrong.",
  },
  {
    id: "direct-state-vending-machine",
    category: "general",
    inputMode: "typed",
    useCase: "solo",
    scenario: "vending machine states",
    text: "Show the states a vending machine moves through, from idle to dispensing change.",
    expectedType: "stateDiagram-v2",
    phenomena: ["real-punctuation", "very-short", "no-type-keyword"],
    notes:
      "`states ... moves through` is the description l0-core keys on without the phrase `state diagram` appearing.",
  },
  {
    id: "direct-state-support-ticket",
    category: "swe",
    inputMode: "typed",
    useCase: "solo",
    scenario: "support ticket lifecycle, described as a flow",
    text: 'Diagram the flow a support ticket goes through: new, open, "pending customer", closed.',
    expectedType: "stateDiagram-v2",
    phenomena: [
      "weak-keyword-misuse",
      "real-punctuation",
      "fragile-chars",
      "list-content",
      "very-short",
    ],
    notes:
      "The word `flow` points at flowchart while the content is one thing changing state, and the quoted label is a literal double quote the parser has to survive.",
  },
  {
    id: "direct-state-butterfly",
    category: "general",
    inputMode: "dictated",
    useCase: "teaching",
    scenario: "butterfly life cycle for a lesson",
    text: "draw the life cycle of a butterfly for a year six class",
    expectedType: "flowchart",
    phenomena: ["no-punctuation", "very-short", "weak-keyword-misuse"],
    notes:
      "The trailing word `class` is a school year group, not a classDiagram request, and a life cycle of successive irreversible stages is a state machine.",
  },
  {
    id: "direct-state-washing-machine",
    category: "general",
    inputMode: "dictated",
    useCase: "solo",
    scenario: "washing machine cycle states",
    text: "so what states is a washing machine actually in filling washing spinning that sort of thing",
    expectedType: "stateDiagram-v2",
    phenomena: [
      "no-punctuation",
      "lexical-filler",
      "list-content",
      "very-short",
    ],
    notes:
      "The states are dictated as a run of bare gerunds with no separators, and the transitions between them are never stated at all.",
  },
  {
    id: "direct-state-thread-lifecycle",
    category: "swe",
    inputMode: "typed",
    useCase: "teaching",
    scenario: "OS thread lifecycle",
    text: "Lifecycle of an OS thread: new, runnable, running, blocked, terminated.",
    expectedType: "stateDiagram-v2",
    phenomena: ["real-punctuation", "list-content", "very-short"],
    notes:
      "Every state is given and every transition is missing, so the edges are entirely recalled; a list rendered as a straight line would be wrong.",
  },
  {
    id: "direct-state-visa-application",
    category: "general",
    inputMode: "typed",
    useCase: "solo",
    scenario: "visa application states",
    text: "State diagram for a visa application, from submitted through to approved or refused.",
    expectedType: "stateDiagram-v2",
    phenomena: ["strong-keyword", "real-punctuation", "very-short"],
    notes:
      "Two terminal states are named, testing that both end points survive rather than the branch collapsing to one.",
  },
  {
    id: "direct-state-video-upload",
    category: "general",
    inputMode: "dictated",
    useCase: "creator",
    scenario: "video processing states after upload",
    text: "what states does a video go through after you upload it to youtube",
    expectedType: "stateDiagram-v2",
    phenomena: ["no-punctuation", "very-short", "no-type-keyword"],
    notes:
      "A creator asking about their own tooling; the processing and review states are recalled knowledge, not anything the request supplies.",
  },

  // ──────────────────────────────────────────────────────────────── flowchart
  {
    id: "direct-flow-photosynthesis",
    category: "general",
    inputMode: "typed",
    useCase: "teaching",
    scenario: "photosynthesis as a process",
    text: "Explain photosynthesis as a diagram.",
    expectedType: "flowchart",
    phenomena: ["real-punctuation", "very-short", "no-type-keyword"],
    notes:
      "Five words and no structural hint whatsoever, so this is the plainest baseline: inputs to outputs through stages is a flowchart.",
  },
  {
    id: "direct-flow-sourdough",
    category: "general",
    inputMode: "dictated",
    useCase: "solo",
    scenario: "sourdough process from starter to loaf",
    text: "how do you make sourdough from feeding the starter to the finished loaf",
    expectedType: "flowchart",
    phenomena: ["no-punctuation", "very-short", "no-type-keyword"],
    notes:
      "One actor working through steps, which l0-core sends to flowchart rather than sequence; the domain carries no software vocabulary to lean on.",
  },
  {
    id: "direct-flow-compiler-pipeline",
    category: "swe",
    inputMode: "typed",
    useCase: "solo",
    scenario: "compiler stages, direction and grouping requested",
    text: "Flowchart, left to right, of a compiler pipeline grouped into frontend, optimiser and backend.",
    expectedType: "flowchart",
    phenomena: [
      "strong-keyword",
      "direction-hint",
      "grouping",
      "real-punctuation",
      "very-short",
    ],
    notes:
      "The only entry here carrying both a direction hint and an explicit grouping request, so it exercises extractDirection and subgraphs on a one-liner.",
  },
  {
    id: "direct-flow-parcel-delivery",
    category: "general",
    inputMode: "dictated",
    useCase: "solo",
    scenario: "parcel from warehouse to doorstep",
    text: "walk me through the journey a parcel takes from the warehouse to my front door",
    expectedType: "flowchart",
    phenomena: ["no-punctuation", "weak-keyword-misuse", "very-short"],
    notes:
      "`journey` here is a noun about travel, not a request for the journey type; pairs with direct-journey-airport-security, where the same word does name a type.",
  },
  {
    id: "direct-flow-merge-conflict",
    category: "swe",
    inputMode: "typed",
    useCase: "solo",
    scenario: "what to do about a merge conflict",
    text: "What do I do when I hit a merge conflict on feature/login?",
    expectedType: "flowchart",
    phenomena: ["real-punctuation", "fragile-chars", "very-short"],
    notes:
      "A decision and its branches, and the branch name delivers a literal slash that only typed input can produce.",
  },
  {
    id: "direct-flow-clotting-cascade",
    category: "general",
    inputMode: "typed",
    useCase: "teaching",
    scenario: "the coagulation cascade",
    text: "Draw the blood clotting cascade.",
    expectedType: "flowchart",
    phenomena: ["real-punctuation", "very-short", "no-type-keyword"],
    notes:
      "Two converging pathways into a common one, which is a flowchart with a join; tests recall of a structure with no software analogue.",
  },
  {
    id: "direct-flow-election-result",
    category: "general",
    inputMode: "typed",
    useCase: "solo",
    scenario: "votes to a governing party",
    text: "Flowchart of how a UK general election turns votes into a governing party.",
    expectedType: "flowchart",
    phenomena: ["strong-keyword", "real-punctuation", "very-short"],
    notes:
      "The strong-keyword control for this block, on a process with a real branch: an outright majority against a hung parliament.",
  },
  {
    id: "direct-flow-er-triage",
    category: "general",
    inputMode: "dictated",
    useCase: "solo",
    scenario: "emergency department triage",
    text: "how does triage work when someone walks into the emergency room",
    expectedType: "flowchart",
    phenomena: ["no-punctuation", "very-short", "no-type-keyword"],
    notes:
      "Triage is a severity decision with several outgoing branches, so this measures whether a bare `how does X work` produces a decision node at all.",
  },
  {
    id: "direct-flow-jury-trial",
    category: "general",
    inputMode: "dictated",
    useCase: "solo",
    scenario: "criminal case from arrest to verdict",
    text: "how does a criminal case get from arrest to verdict",
    expectedType: "flowchart",
    phenomena: ["no-punctuation", "very-short", "no-type-keyword"],
    notes:
      "Named start and end with everything between them missing, so the intermediate stages are entirely recalled.",
  },
  {
    id: "direct-flow-recycling-plant",
    category: "general",
    inputMode: "typed",
    useCase: "teaching",
    scenario: "sorting mixed waste at a recycling plant",
    text: "How does a recycling plant sort mixed waste? Diagram it for a school talk.",
    expectedType: "flowchart",
    phenomena: ["real-punctuation", "very-short", "no-type-keyword"],
    notes:
      "A sorting line is repeated separation stages, so the risk is a fan-out from one node rather than the sequential filtering that actually happens.",
  },

  // ──────────────────────────────────────────────── named non-editable types
  {
    id: "direct-gantt-renovation",
    category: "general",
    inputMode: "typed",
    useCase: "solo",
    scenario: "renovation schedule, gantt named",
    text: "Gantt chart for a three month house renovation.",
    expectedType: "gantt",
    outcome: "single-image",
    phenomena: [
      "on-request-type",
      "strong-keyword",
      "real-punctuation",
      "very-short",
    ],
    notes:
      "Named types win under l0-core, so one flat image is the correct outcome here; the durations are invented, which is what makes it a bare request rather than a description.",
  },
  {
    id: "direct-timeline-space-race",
    category: "general",
    inputMode: "dictated",
    useCase: "teaching",
    scenario: "space race timeline, named aloud",
    text: "give me a timeline of the space race",
    expectedType: "timeline",
    outcome: "single-image",
    phenomena: [
      "on-request-type",
      "strong-keyword",
      "no-punctuation",
      "very-short",
    ],
    notes:
      "Eight words and every date has to be recalled, unlike creator-timeline-request in the main corpus where the speaker supplies the years.",
  },
  {
    id: "direct-journey-airport-security",
    category: "general",
    inputMode: "typed",
    useCase: "solo",
    scenario: "passenger experience through security, journey named",
    text: "User journey for a passenger going through airport security.",
    expectedType: "journey",
    outcome: "single-image",
    phenomena: [
      "on-request-type",
      "strong-keyword",
      "real-punctuation",
      "very-short",
    ],
    notes:
      "The named half of the pair with direct-flow-parcel-delivery: the same word decides the type here and must be ignored there.",
  },

  // ────────────────────────────────────────────────────────── nothing to draw
  {
    id: "direct-vague-make-diagram",
    category: "general",
    inputMode: "typed",
    useCase: "solo",
    scenario: "a request with no subject at all",
    text: "Make me a diagram.",
    expectedType: null,
    outcome: "no-diagram",
    phenomena: ["real-punctuation", "very-short", "no-type-keyword"],
    notes:
      "The floor case for this file: unmistakably a diagram request and completely undrawable, so anything on the canvas is wrong.",
  },
  {
    id: "direct-vague-backend",
    category: "swe",
    inputMode: "dictated",
    useCase: "solo",
    scenario: "names a subject but no structure",
    text: "something about the backend i guess",
    expectedType: null,
    outcome: "no-diagram",
    phenomena: ["no-punctuation", "lexical-filler", "very-short"],
    notes:
      "Harder than the empty case because `backend` is a real subject, and a plausible three-box guess would score as a hit while being invented whole.",
  },
];

const wordCounts = DIRECT_TRANSCRIPTS.map(
  (t) => t.text.split(/\s+/).length,
).sort((a, b) => a - b);

const byType = DIRECT_TRANSCRIPTS.reduce<Record<string, number>>((acc, t) => {
  const key = t.expectedType ?? "none";
  acc[key] = (acc[key] ?? 0) + 1;
  return acc;
}, {});

const byInputMode = DIRECT_TRANSCRIPTS.reduce<Record<string, number>>(
  (acc, t) => {
    acc[t.inputMode] = (acc[t.inputMode] ?? 0) + 1;
    return acc;
  },
  {},
);

/**
 * Computed, never hardcoded. The distribution is the point of the file: if an
 * edit pushes flowchart past the other types or drops the word ceiling, the
 * numbers move and the drift is visible without re-counting by hand.
 */
export const DIRECT_STATS = {
  count: DIRECT_TRANSCRIPTS.length,
  minWords: wordCounts[0],
  medianWords: wordCounts[Math.floor(wordCounts.length / 2)],
  maxWords: wordCounts[wordCounts.length - 1],
  byType,
  byInputMode,
};
