/**
 * Replacements for the 63 functionally redundant entries in the 371-entry corpus
 * (wayfinder ticket #54, map #38). Not a new corpus: each entry here takes the
 * slot of one entry listed in `DUPES.txt`, so the corpus keeps its size.
 *
 * WHAT WAS REDUNDANT. `DUPES.txt` groups entries by
 * `(expectedType, useCase, inputMode, phenomena)`. Forty-three groups had more
 * than one member, which means every member after the first measures exactly
 * what the first already measured. Sixty-three entries were doing no work.
 *
 * WHAT REPLACES THEM. Each entry keeps the `expectedType` of the entry it
 * replaces, and `expectedTypes` / `multiFrom` where those were set, so no type
 * or fence-count coverage is lost. Everything else moves: different domain,
 * different situation, and deliberately a different length.
 *
 * LENGTH IS THE POINT. The corpus puts 75% of its entries in a single 25-59 word
 * bucket, median 36, maximum 181. That measures type selection and nothing else.
 * Real dictation runs from a one-line request to a ten-minute walkthrough, so
 * these 63 are spread deliberately:
 *
 *     60-149 words    18    about a minute of speech
 *     150-399 words   24    one to three minutes
 *     400-899 words   16    three to six minutes
 *     900-1500 words   5    a seven to twelve minute meeting
 *
 * The short end is already the corpus's strength, so nothing here is short. That
 * costs one thing worth naming: `misfire-single-word` was the degenerate
 * one-word input and its replacement is a 90-word misfire instead. The degenerate
 * case now has no entry. Add one back as a plain short entry if it matters.
 *
 * DISFLUENCY. The corpus header sets a Switchboard target of 6-10 disfluencies
 * per 100 words and the corpus delivers about 1.0, because at 36 words there is
 * no room for a repair. These run 4-8 per 100: restarts, abandoned clauses,
 * numbers corrected mid-sentence, `sorry the other way round`, trailing off.
 * Filled pauses stay out, because Chrome strips them.
 *
 * NOT ALL OF IT IS THE DIAGRAM. Every entry over 150 words carries something
 * that is not structure: a scheduling exchange, a hiring aside, a joke, a
 * tangent. A correct answer excludes it. Each `notes` says which part that is,
 * because excluding it is the thing being measured at length.
 *
 * ON `expectedType: null`. Five entries here are null with
 * `outcome: "no-diagram"`. That is not a dodged judgement, it is the judgement:
 * a misfire or a contentless refinement turn has no correct diagram, and the
 * corpus needs long examples of both, since every existing refusal entry is
 * under thirty words. Exactly one entry is null with the normal `diagram`
 * outcome, `rep-solo-herbarium-specimen-model`, and it is null because both
 * readings are defensible and scoring it either way punishes a correct model.
 *
 * DOMAINS. The corpus puts 23% of its entries in one fictional e-commerce
 * company. No domain here appears more than three times.
 */
import type { Transcript } from "./transcripts";

export const REPLACEMENT_TRANSCRIPTS: Transcript[] = [
  {
    id: "rep-meet-burst-main-incident",
    category: "general",
    inputMode: "dictated",
    useCase: "meeting",
    scenario:
      "water utility post-incident review, the response process and the incident status it moved through",
    expectedType: "flowchart",
    expectedTypes: ["flowchart", "stateDiagram-v2"],
    multiFrom: "low",
    phenomena: [
      "multi-diagram",
      "no-punctuation",
      "run-on",
      "long",
      "self-correction",
      "multi-speaker",
      "crosstalk",
      "trails-off",
    ],
    notes:
      "Replaces multi-incident-flow-and-states. Same pair of diagrams at twenty times the length, so the state machine has to survive nine hundred words of process before it is reached. Three intake routes, and the third is the one they actually get. The tanker path is stated once and only applies to a care home or a hospital. The duty engineer's interruption about the on-call rota, the argument about whose budget the road reinstatement comes out of, and the closing exchange about moving Thursday's meeting are none of them diagram content. The four-hours figure is corrected to six.",
    text: "right so this is the post incident on the burst main on cranford road and im doing it in two halves the response process first and then the way we track the status of the incident itself because those two got completely muddled in the write up last time and nobody could read it so the response the way it actually happens is a report comes in and it can arrive three ways it can be a member of the public on the emergency line it can be the pressure telemetry firing an alarm on its own at the district meter or it can be the council ringing us because theyve already closed the road and honestly the third one is the one we get most often which is not a great look for us sorry can i just ask does the telemetry one page anybody overnight or does it sit on the screen till someone looks it pages after twenty minutes if nobodys picked it up right ok either way it lands in the control room and the controller does the same thing regardless of where it came from which is why i want it drawn as three arrows into one box the controller pulls up the district on the network model and looks at whether the pressure drop is real because about a third of the public reports are somebody elses leak or a private supply pipe so theres a confirm step and if it doesnt confirm we log it and close it and thats the end of that branch if it does confirm the controller sets a severity and severity is basically how many properties are downstream and whether any of them are sensitive and sensitive means a hospital a care home a school with no alternative supply and that severity decides everything downstream so from there we dispatch a first response van and the van crew does the valve work they isolate the section and isolating is the thing that stops the water going into the road but it also takes those properties off supply which is the trade were making every single time and thats worth having on the picture sorry can we come back to the rota thing after im halfway through no its fine ill wait so once the section is isolated two things happen in parallel and i do mean parallel not one after the other the repair crew gets tasked and the customer comms go out and comms is an automated text to everyone on the affected list plus a notice on the website and if the severity flagged a care home or a hospital then and only then we deploy a bowser and a tanker to that site and thats a separate crew again that path is rare maybe six times a year but when we miss it it is the thing that ends up in the paper the repair itself is dig down expose the pipe fit the collar or replace the section pressure test refill and then we bring the section back on slowly because if you bring it back fast you get discoloration complaints for a week and thats not just an annoyance every one of those calls is logged as a water quality contact and water quality contacts go to the regulator so a slow refill genuinely saves us money and the crews know that and they still do it fast when theyre on their third job of the night which is a resourcing problem not a process problem and while im on it the reason we send a first response van and then a repair crew separately instead of one crew who can do both is purely historical the first response fleet is on a different contract and every year somebody asks and every year the answer is the contract runs to twenty twenty nine and then the last step is reinstatement which is the road surface and thats a contractor not us and thats where it sits for days sometimes and yeah i know whose budget that is were not doing that argument again now the status side because this is the bit finance and the regulator actually look at the incident record starts at reported and reported means somebody said something and we havent looked yet from reported it either goes to confirmed or it goes to closed no fault and closed no fault is an end from confirmed it goes to isolated once the valves are shut and from isolated it goes to under repair when the crew is physically on site and from under repair it goes to supply restored and supply restored is not closed thats the distinction everyone gets wrong supply restored means water is back and the road is still open and were still holding the incident from supply restored we go to awaiting reinstatement and only when the contractor signs off does it go to closed and closed is terminal and the other one is from any of confirmed isolated or under repair we can go to escalated if it runs past what was it four hours no sorry six hours its six since the april change and escalated isnt a dead end you come back out of it into whatever you were in it just changes who gets woken up right thats the whole thing can we do thursday at eleven instead ive got the regulator call at nine and i will not be in a fit state",
  },
  {
    id: "rep-meet-vet-case-handling",
    category: "general",
    inputMode: "dictated",
    useCase: "meeting",
    scenario:
      "veterinary practice discussing how a case is handled and the states the case record moves through",
    expectedType: "flowchart",
    expectedTypes: ["flowchart", "stateDiagram-v2"],
    multiFrom: "low",
    phenomena: [
      "multi-diagram",
      "no-punctuation",
      "run-on",
      "long",
      "self-correction",
    ],
    notes:
      "Replaces multi-support-flow-and-ticket-states. Handling process plus record lifecycle, same split, different trade. The referral path is stated once. The complaint about the printer and the line about Marcus being on holiday are not diagram content. `awaiting owner` is the state that makes the machine non-trivial, because it is reachable from two places and returns to both.",
    text: "right so the case handling thing lets get it written down because were training two new nurses in september and honestly im tired of explaining it so a case starts when the animal arrives it arrives either as a booked appointment or as a walk in emergency and the walk ins go straight to the go straight to the triage nurse and the booked ones go to reception first no sorry to the desk for the paperwork and then to a consult room right triage decides one of three things it goes straight through to the vet now it waits and gets seen in order or its actually not urgent and we book it for later in the week the vet consults and from the consult you either treat and discharge on the day or you admit for a procedure or you refer out referring out is the rare one obviously thats specialist orthopaedics or oncology mostly and it goes to a partner practice and we still keep the record open on our side which surprises people if we admit theres a consent call to the owner and a quote and the quote has to be accepted before we do anything non urgent and thats the bit that stalls constantly people just dont pick up honestly then procedure then recovery then discharge ok and discharge always has a follow up scheduled even if its just a phone check right now the record itself the status field it starts at open when the animal walks in it goes to in consult and then either to closed which is treat and discharge or to admitted and admitted goes to in procedure to recovering to closed and from admitted or from in consult it can go to awaiting owner which is that consent problem and awaiting owner comes back to whichever one it left from it isnt a dead end and theres a referred status which sits alongside and stays until the partner sends the report back and closed is closed but we can reopen it within thirty days if the animal comes back on the same problem because otherwise the follow up gets billed as a new case and the owners quite rightly complain and while were here the printer at the back desk is still eating labels and marcus is away until the ninth so nobody has looked at it",
  },
  {
    id: "rep-standup-archive-digitisation",
    category: "general",
    inputMode: "dictated",
    useCase: "meeting",
    scenario:
      "two archivists giving unrelated standup updates on one microphone",
    expectedType: "flowchart",
    expectedTypes: ["flowchart", "flowchart"],
    multiFrom: "low",
    phenomena: [
      "multi-diagram",
      "no-punctuation",
      "run-on",
      "long",
      "multi-speaker",
      "self-correction",
      "trails-off",
    ],
    notes:
      "Replaces multi-standup-two-updates. Two genuinely unrelated workflows in one recording, at fifteen times the length, so the seam is far from both ends instead of in the middle. The seam is `thats me` followed by a different voice. The conservation queue and the map digitisation share a building and nothing else, and merging them into one chart is the failure. The exchange about the loan to the county museum and the biscuit tin are neither diagram.",
    text: "ok ill go first so the conservation queue im still working through the nineteen twenties parish registers and the process is the same as it was but ive tightened it up so a volume comes off the shelf and the first thing is condition assessment and thats me or shona nobody else and we grade it one to four one is fine two needs surface cleaning three needs rebinding four is do not touch send it out and grade four goes to the external conservator in leeds and comes back weeks later grades one two and three all go into the same tray but they get different treatment two gets dry cleaning with the smoke sponge three goes to the bench for resewing and a new case and one skips straight to the next stage which is the boxing so everything converges again at boxing you make a phase box you label it you update the location field in the catalogue and it goes back on the shelf and the important thing is the catalogue update happens at boxing not at assessment because we used to do it at assessment and then things sat on the bench for a month showing as available and people would request them thats the change from last month thats me anyone got the leeds invoice by the way no ok right my turn so the map digitisation completely separate thing different room different funding so the maps come out of the plan chest flat and they go on the copy stand and we shoot them at six hundred dpi and if theyre bigger than the stand which the estate maps all are we shoot them in tiles and stitch them afterwards in the software and stitching is where everything goes slow because the software wants an overlap of about a third and the person shooting it never leaves enough so we reshoot maybe one in five sheets after that the raw tiff goes into the ingest folder and overnight the script generates the derivatives which is a jpeg for the website and a smaller one for the thumbnails and it writes a checksum and then the tiff goes to the preservation store and the derivatives go to the delivery server and those are two different places on purpose and then the metadata gets keyed in by hand afterwards which is the bottleneck honestly its always the metadata and i keep saying were going to get a student in for it and we keep not doing it so those two things dont touch at all the conservation queue is books and the digitisation is maps and the only connection is that im in both of them which is not a connection oh and the loan to the county museum did the courier form come back because they wanted it by friday and someone has taken the biscuits again",
  },
  {
    id: "rep-call-telecom-two-provisioning-lines",
    category: "swe",
    inputMode: "dictated",
    useCase: "meeting",
    scenario:
      "two teams on one call, each describing a provisioning pipeline that does not touch the other",
    expectedType: "flowchart",
    expectedTypes: ["flowchart", "flowchart"],
    multiFrom: "low",
    phenomena: [
      "multi-diagram",
      "no-punctuation",
      "run-on",
      "long",
      "multi-speaker",
      "crosstalk",
      "self-correction",
    ],
    notes:
      "Replaces multi-two-services-one-call. The signal is `we share a ticket queue and thats it`, said once, nine hundred words in. Two disconnected components in one document is the tempting wrong answer. The fixed-line side has an explicit not-built-yet branch for the new ONT model. The mobile side revises the retry count from five to three. The opening chat about the offer for the second-line engineer and the closing calendar exchange are neither diagram. Two named owners, one per pipeline.",
    text: "morning both right before we start did the offer go out for the second line engineer role no ok can someone chase hr because we lose the candidate on friday otherwise so two things on this call fixed line provisioning and mobile sim activation and im doing them together only because you two are both here theyre not related ill go first on fixed so an order lands from the sales portal into the provisioning api and the api does one thing it writes the order and puts it on the queue it does not validate anything beyond the shape of the payload which is deliberate obviously because sales kept getting five hundreds and ringing us then the address matcher picks it up and this is the part that fails the most honestly it takes whatever the customer typed and matches it against the address database to get a uprn and if it matches exactly we carry on if it matches more than one candidate it goes to a manual queue and someone in the provisioning team eyeballs it and picks one and if it matches nothing at all right we reject the order back to sales with a reason code and thats a real end state that isnt an error yeah once we have a uprn we do a line check against the openreach api and that tells us whether theres a working pair whether theres fibre to the premises and what speed we can actually deliver and if the speed is below what was sold we stop and raise a downgrade offer to the customer and they either accept the lower speed or cancel and if they accept we amend the order and carry on assuming we get past that we book an engineer appointment and thats a slot booking against the openreach diary and thats an external call that times out more than id like basically and then on the day the engineer installs the ont and the router and calls the activation endpoint and activation flips the service to live and triggers the first bill now the bit that isnt built we have a new ont model coming in q4 that self activates so the engineer doesnt call anything the ont calls home when it gets power and we havent got the callback handler for that at all so draw it but make it obvious its not there yes and thats my teams end to end sarah owns everything from the queue onwards im just the api yeah sorry go ahead so mobile is completely different shape it starts from the same portal but it goes to a different endpoint and honestly it should probably be the same endpoint but thats a conversation for another day a sim activation request comes in with an iccid and an msisdn and the first thing is the iccid has to exist in our stock inventory because we buy sims in batches and if the iccid isnt in inventory somebody has typed it wrong or its a competitors sim and we reject immediately if it is in inventory we check its state and a sim in inventory is either unallocated or allocated or already active and only unallocated can proceed obviously then we call the hlr provisioning gateway and that writes the subscriber profile and thats the actual activation as far as the network is concerned and that call is synchronous and slow and it fails maybe two percent of the time and when it fails we retry with backoff up to five no sorry its three now we dropped it to three after the march incident because five was piling up behind the gateway and making it worse and after three failures it goes to a dead letter queue and an engineer looks at it in the morning if the gateway succeeds we write the subscriber record on our side and we send the welcome sms and the welcome sms is fire and forget we genuinely do not care if it lands and i say that and marketing care very much so theres an argument to be had about whether we retry it and my position is that if the sim works the customer knows and if it doesnt work the sms is irrelevant and theres one more thing behind all of this which is number range management because msisdns come out of blocks were allocated and theres a reservation step i skipped where the portal reserves a number before the order is even placed and if the order never completes that reservation expires after seventy two hours and the number goes back in the pool and then separately theres a port in path if the customer is bringing a number from another network and that adds a whole donor network exchange before any of this happens which is a nine day process and i am not describing that today thats its own thing so the two pipelines the fixed one and the mobile one they share a ticket queue for manual intervention and thats it thats the only thing they have in common they dont call each other they dont share a database they dont share a queue people keep drawing them as one system because theyre both called provisioning and then they ask why the fixed line failure didnt show up on the mobile dashboard so please two separate pictures ok are we still on for the review on the fourteenth i might have to move it ive got the vendor in that week",
  },
  {
    id: "rep-teach-walkie-talkie-handshake",
    category: "swe",
    inputMode: "dictated",
    useCase: "teaching",
    scenario:
      "a radio-procedure analogy for a connection handshake, then the real exchange",
    expectedType: "sequenceDiagram",
    expectedTypes: ["sequenceDiagram", "sequenceDiagram"],
    multiFrom: "high",
    phenomena: [
      "analogy",
      "multi-diagram",
      "no-punctuation",
      "run-on",
      "no-type-keyword",
      "long",
      "self-correction",
    ],
    notes:
      "Replaces teach-analogy-mutex. Same shape, analogy then the real thing, both as exchanges between two named parties, and only worth two fences at High. Longer than the entry it replaces but still short, so it tests whether the analogy survives being brief rather than being buried.",
    text: "so before the handshake heres the radio version youve all heard it in films im on a walkie talkie i say bravo this is alpha do you read over and bravo says alpha this is bravo loud and clear over and then i say roger out and only after that do we start talking thats three messages before any content and everyone thinks thats padding it isnt its both sides proving they can hear and be heard now the real one the client sends a syn the server replies syn ack the client sends ack and thats it same three same reason each side has proved it can send and that the other can receive and only then does the data go and the sequence numbers ride along on those three so youve also agreed where the counting starts sorry where each side starts counting",
  },
  {
    id: "rep-teach-bakery-job-queue",
    category: "general",
    inputMode: "dictated",
    useCase: "teaching",
    scenario:
      "a bakery order board used to explain a print spooler, where both halves use the same words",
    expectedType: "sequenceDiagram",
    expectedTypes: ["sequenceDiagram", "sequenceDiagram"],
    multiFrom: "high",
    phenomena: [
      "analogy",
      "multi-diagram",
      "no-punctuation",
      "run-on",
      "no-type-keyword",
      "long",
    ],
    notes:
      "Replaces teach-analogy-dns. Same difficulty: `queue`, `job`, `ticket` and `order` are literally true of the bakery and of the spooler, so there is no lexical boundary between the analogy and the system, only a semantic one at `now the printer version`. Two fences at High, one at Low.",
    text: "right so think about the counter at a bakery you ask for two sourdough and they write it on a ticket and put the ticket on a spike and hand you a number and you go and sit down youre not watching them bag it the person on the ovens works the spike in order and when your ticket comes up they call your number and if theyre out of sourdough your ticket comes back to the counter and someone has to tell you now the printer version you hit print the application hands a job to the spooler the spooler gives it an id and returns immediately and your application carries on the spooler feeds jobs to the printer one at a time and if the printer is out of paper the job comes back and the spooler raises a notification at you same spike same ticket",
  },
  {
    id: "rep-teach-passport-visa-chain",
    category: "swe",
    inputMode: "dictated",
    useCase: "teaching",
    scenario:
      "border-control analogy for certificate chains, then the real verification exchange",
    expectedType: "sequenceDiagram",
    expectedTypes: ["sequenceDiagram", "sequenceDiagram"],
    multiFrom: "high",
    phenomena: [
      "analogy",
      "multi-diagram",
      "no-punctuation",
      "run-on",
      "no-type-keyword",
      "long",
      "self-correction",
      "asr-corruption",
    ],
    notes:
      "Replaces residual-analogy-oauth-valet. Analogy first, real exchange second, two sequences at High. The revocation aside is explicitly parked and is not part of either diagram. `certificate authority` comes through as `certificate or thority` once, and `root` as `route` twice, which is the corruption a careful reader has to see through to get the entity names right.",
    text: "ok certificates and i want to do the passport thing first because it makes the chain obvious so you land at a border and you hand your passport to the officer and the officer does not ring your parents to check who you are and they dont ring your school they look at the passport and they check it was issued by a country whose stamp they already trust and thats it thats the whole trick the trust was established years ago between the two governments and it gets reused at the desk in two seconds and if youre from somewhere that needs a visa then theres one more hop your passport plus a visa issued by the country youre entering and the officer checks the visa against their own records so its passport signed by your government visa signed by mine and the officer only actually trusts one signature directly which is their own governments now the real one your browser opens a connection to a server the server sends back its certificate and usually an intermediate as well and the browser checks the server certificate was signed by the intermediate and the intermediate was signed by a route certificate that the browser already has in its store and that route certificate is the only thing the browser trusts on its own it came with the machine so the browser walks up the chain and stops the moment it reaches something already in the store and if it walks all the way up and finds nothing it knows you get the warning page and the thing people get wrong is the server does not talk to the certificate or thority during the handshake at all that conversation happened months ago when the certificate was issued im not doing revocation today thats a different lesson and honestly its a mess but yes the route store is the trust anchor",
  },
  {
    id: "rep-teach-line-layout-and-checks",
    category: "general",
    inputMode: "dictated",
    useCase: "teaching",
    scenario:
      "induction session on a bottling line, the physical line and the quality checks that run against it",
    expectedType: "flowchart",
    expectedTypes: ["flowchart", "flowchart"],
    multiFrom: "medium",
    phenomena: [
      "multi-diagram",
      "no-punctuation",
      "run-on",
      "long",
      "self-correction",
      "trails-off",
    ],
    notes:
      "Replaces multi-ci-and-branching. Same reason it is medium and not low: the line and the check regime could be forced into one document as two disconnected components, and they read far better as two. The checks do not sit at one point on the line, they sample from four points, which is what stops them being nodes in the first chart. The bit about Danny's leaving do and the argument about the fifteen-minute figure are not diagram content.",
    text: "right induction so this is the bottling hall and im going to walk you down the line first and then separately im going to tell you about the checks because the checks arent a step on the line theyre a thing that happens alongside and people always try to draw them as a step so the line the bulk tank feeds the filler through a plate chiller and the chiller is set to two degrees and everything downstream assumes that obviously so if the chiller trips the whole line stops out of the filler the bottles go through the crowner which puts the cap on and then the crowner feeds the pasteuriser and the pasteuriser is a tunnel a tunnel pasteuriser it takes about forty minutes end to end and it is basically the slowest thing in the building so everything is paced by it after the pasteuriser theres a rinse and a dryer right and then the labeller and the labeller is where you will spend most of your life because it jams if the bottles are even slightly wet which is why the dryer matters more than it looks then the date coder which is an inkjet on the shoulder and then the packer which drops them into trays and then the shrink wrapper and then palletising and thats a robot and you do not go past the yellow line while its running ok now the checks completely separate schedule the qa tech pulls samples at four points and only four the bulk tank before we start the filler every thirty minutes the pasteuriser exit once an hour and the finished pallet once a batch and each sample gets a different set of tests the tank sample gets gravity ph and a sensory the filler sample gets fill height and dissolved oxygen and a torque no thats the finished one ignore that and dissolved oxygen is the one that gets people sacked frankly the pasteuriser exit gets a pu count which is the pasteurisation units and the finished sample gets a torque test on the cap and it goes into the retention library for a year and each of those has a pass fail right and a fail does different things depending which point it came from a tank fail stops the batch before we run a filler fail we quarantine everything since the last good sample which is thirty minutes worth or up to an hour if somebody missed one a pasteuriser fail is an automatic hold on the whole run and a finished pack fail is a customer recall conversation and that goes to the quality manager not to you so two pictures please the line and the check regime and dont put the qa tech on the line drawing because she isnt on it shes across it oh and danny leaves on the twenty second so if you want to sign the card its in the office and no the tunnel is not fifteen minutes i dont know who told you fifteen",
  },
  {
    id: "rep-teach-bill-into-law",
    category: "general",
    inputMode: "dictated",
    useCase: "teaching",
    scenario:
      "civics lecture: the general legislative procedure, then one real bill traced through it",
    expectedType: "flowchart",
    expectedTypes: ["flowchart", "flowchart"],
    multiFrom: "medium",
    phenomena: [
      "multi-diagram",
      "no-punctuation",
      "run-on",
      "long",
      "self-correction",
      "trails-off",
    ],
    notes:
      "Replaces multi-definition-and-example. The rule and then a worked example of the rule, which is two flowcharts because the example takes one specific route and the rule holds every route. A hurried answer draws the general procedure and folds the example into it as labels, which loses exactly the teaching point. The private member's ballot is mentioned once as a branch that almost never completes. The digression about the reading list and the exam format is not diagram content.",
    text: "right settle down so today is how a bill becomes an act and im going to do it twice first the general procedure as it exists on paper and then were going to take one actual bill and walk it through so you can see how different the real route looks so the general one right a bill can start in one of three ways a government bill which is the overwhelming majority a private members bill which comes out of the ballot at the start of the session and a private bill which is a different animal entirely and affects one organisation or one place and im mentioning it so you know it exists and then were ignoring it the private members route i want you to notice because almost none of them finish they run out of time on a friday and thats not a failure of the process thats the process working as designed to keep the government in control of the timetable which you can think is good or bad but know that its deliberate ok so a government bill is drafted by parliamentary counsel from instructions from the department and then it gets introduced in one house and introduction is called first reading and first reading is a formality basically theres no debate the title is read and thats it then second reading and second reading is the debate on the principle not the detail right the question is do we want a law about this at all and honestly if it falls here it is dead if it passes it goes to committee and committee is basically line by line every clause gets a vote amendments get moved and this is where most of the actual change happens then report stage which is the whole house looking at what committee did and having another go at amending it and then third reading which in the commons is short and is the last chance to reject the whole thing and then it goes to the other house and the other house does the entire thing again first reading second reading committee report third reading and this is where it gets interesting right because the second house will amend it and then the bill comes back to the first house and the first house either accepts the amendments or rejects them and sends it back and that ping pong can go round several times and if they cannot agree the bill falls at the end of the session unless the government uses the parliament acts which is rare and then royal assent and its an act ok and commencement is a separate thing entirely which is honestly the trap most of you will fall into in the exam an act can be passed and not be in force because commencement is by order and can be months or years later or never for some sections so thats the shape right now the worked example lets take the burial and cremation bill from the last session because it does something instructive it was a government bill introduced in the lords not the commons which people find odd but well uncontroversial technical bills often start in the lords to save commons time so first reading in the lords formality second reading in the lords and it was broadly welcomed there were three speeches and it went to grand committee which is a lords thing where you cannot vote so amendments are moved and withdrawn to get a ministerial answer on the record and thats a stage the general diagram doesnt have and grand committee only happens for bills that arent contentious if it were contentious it would go to committee of the whole house on the floor which is a different room and a different set of rules and you need to know that both exist report stage in the lords picked up two government amendments both drafting third reading in the lords passed on the nod then to the commons first reading formality second reading and here it got a real debate because a backbench member raised the question of who owns the remains and that was not in the bill at all committee stage in the commons a public bill committee sixteen members eleven sittings and two opposition amendments were pushed to a division and both lost report stage and this is the bit i want you to remember at report stage the government moved its own amendment which did most of what the opposition had asked for in committee and that is completely normal and it is how the process actually works the government does not accept an opposition amendment it accepts the idea and redrafts it third reading passed and then back to the lords with commons amendments and the lords agreed them without a vote so no ping pong and royal assent and then commencement two months for most of it and the section on the registers came into force the following april by order so if you draw those two side by side the general one has every branch and the real one takes one path through and has a stage the general one didnt mention and that gap is the whole point of the lecture right the reading list is on the portal the exam is two questions from four and no you cannot use your notes obviously ill say it again next week because half of you arent here",
  },
  {
    id: "rep-teach-picking-routes",
    category: "general",
    inputMode: "dictated",
    useCase: "teaching",
    scenario:
      "warehouse training: the obvious picking route and the zone-picking one that replaced it",
    expectedType: "flowchart",
    expectedTypes: ["flowchart", "flowchart"],
    multiFrom: "medium",
    phenomena: [
      "multi-diagram",
      "no-punctuation",
      "run-on",
      "long",
      "self-correction",
    ],
    notes:
      "Replaces multi-naive-and-optimised-query. The slow path and the fast one, drawn as two so the difference is visible, which is why it is medium: one chart with a branch technically holds both and shows nothing. The consolidation step exists only in the second route and is the thing a hurried answer drops, because it is the cost the second route pays.",
    text: "right so picking the way it used to be done and the way we do it now and i want both on the board because if you only see the new one you wont understand why any of it is shaped like that the old way one picker one order you get handed a pick list you start at the front of the warehouse you walk to the first location scan the bin take the item scan the item put it in the tote walk to the next location and so on until the list is done and then you walk back to dispatch and drop the tote and pick up the next list and the problem is obvious once you see it a twelve line order can have you walking the full length of the building three times because the list is in the order the customer added things to their basket and the customer does not know where anything is we measured it once and it was something like sixty percent of the shift was walking sixty five actually the new way we split the building into six zones and a picker stays in their zone all day so an order comes in and it gets exploded into one sub list per zone and only the zones that have something on that order and each picker picks their zone lines into a tote a tote with the order id on it and the totes travel on the conveyor to consolidation and consolidation is a new step that didnt exist before somebody has to match the totes back together and check the order is complete before it goes to packing and that step is real work and it is the price you pay so the picker walks almost nothing but you have added a station and if a zone is slow the whole order waits at consolidation which is a queue you didnt have before",
  },
  {
    id: "rep-solo-post-production-deps",
    category: "general",
    inputMode: "dictated",
    useCase: "solo",
    scenario: "film post-production asset dependency graph",
    expectedType: "flowchart",
    phenomena: ["no-punctuation", "no-type-keyword", "run-on", "long"],
    notes:
      "Replaces swe-monorepo-graph. Keeps the ambiguity that entry existed for: a pure dependency graph is defensibly a flowchart and defensibly a class diagram, and nothing in the text says which. Longer, and the chain is four deep rather than two, so a wrong type costs more.",
    text: "so the shot dependencies for the vault sequence the final comp depends on the beauty render the shadow pass and the plate and the beauty render depends on the lighting scene which depends on the layout and the layout depends on the tracked camera and the tracked camera depends on the cleaned plate not the raw plate the cleaned plate is its own thing that comes out of paint and paint takes the raw plate and the rotoscoping so if the plate gets re graded everything above the cleaned plate has to go again which is why we are not re grading anything and the shadow pass shares the lighting scene with the beauty render so those two move together",
  },
  {
    id: "rep-solo-school-district-lines",
    category: "general",
    inputMode: "dictated",
    useCase: "solo",
    scenario: "who reports to whom across a school district",
    expectedType: "flowchart",
    phenomena: [
      "no-punctuation",
      "no-type-keyword",
      "run-on",
      "long",
      "self-correction",
    ],
    notes:
      "Replaces gen-org-chart. Still a tree, still defensibly a class diagram to a human, but with a dotted line that a strict tree cannot hold: the safeguarding lead reports to the head for line management and to the trust for safeguarding. That second edge is the thing a hurried answer drops to keep the tree clean.",
    text: "right ok the reporting lines for the trust so the chief executive sits at the top and under her theres the director of education the finance director and the head of operations the director of education has the four secondary heads and the eleven primary heads reporting in and each head has their own senior team but im not going down that far the finance director has payroll procurement and the two management accountants operations has estates catering it and transport and then the safeguarding lead is the awkward one and i always get this wrong when i explain it because she reports to the director of education for line management day to day but for anything safeguarding she goes straight to the chief executive and to the trustee with the safeguarding brief and that second line is not a dotted courtesy thing it is the actual escalation route",
  },
  {
    id: "rep-solo-smart-meter-collection",
    category: "swe",
    inputMode: "dictated",
    useCase: "solo",
    scenario:
      "how a meter reading gets from the meter to the billing system, no type word used",
    expectedType: "sequenceDiagram",
    phenomena: [
      "no-type-keyword",
      "no-punctuation",
      "run-on",
      "long",
      "self-correction",
    ],
    notes:
      "Replaces swe-microservice-sequence. Five named parties passing messages in a fixed order, and not one word that names a diagram type, so the default-to-flowchart path is what this catches. The nightly reconciliation pull is a second exchange between two of the same parties and belongs in the same fence, not a second one. The aside about the tariff change is not structure.",
    text: "right so how a reading actually gets to a bill because i keep having to explain this the meter itself wakes up every half hour and takes a register read and it does not send it anywhere immediately it holds it the concentrator on the substation polls the meters the concentrator polls the meters on its mesh every four hours sorry every six on the rural ones and it asks each one give me everything since the last sequence number and the meter answers with a block of half hourly values and the concentrator acknowledges with the highest sequence number it got and thats important because the meter only clears its buffer when it sees that acknowledgement then the concentrator pushes up to the head end system over the cellular link and the head end validates the block checks the meter is one of ours checks the readings are monotonic and if theyre not it flags an exception and asks the concentrator to resend that window if it is happy it writes the readings to the reading store and publishes a notification and the billing engine is the one listening for that notification and it pulls the settlement periods it needs and calculates the charge and separately every night billing asks the head end directly for a summary count so it can compare what it thinks it has against what the head end thinks it sent and any gap goes on the exception report and somebody in the data team works through that in the morning and the tariff change in october makes none of this harder it just changes the calculation at the very end",
  },
  {
    id: "rep-solo-lab-result-callback",
    category: "swe",
    inputMode: "dictated",
    useCase: "solo",
    scenario: "a pathology result finding its way back to the patient record",
    expectedType: "sequenceDiagram",
    phenomena: [
      "no-type-keyword",
      "no-punctuation",
      "run-on",
      "long",
      "self-correction",
    ],
    notes:
      "Replaces swe-payment-webhook-sequence. The callback shape, with the acknowledgement going back the other way, which is the detail that makes it a sequence rather than a chain. No type word anywhere.",
    text: "ok so when a sample comes in the ordering system sends an order message to the lab system with the patient identifier and the tests requested and the lab system replies straight away with an accession number and thats all it says at that point well thats all we care about at that point then the analyser does its thing which can be twenty minutes or two days depending on the test and when the result is authorised by a biomedical scientist the lab system sends a result message back to the ordering system quoting that accession number and the ordering system writes it to the record and sends an acknowledgement back and if the lab does not get that acknowledgement within an hour no within thirty minutes it sends the result again",
  },
  {
    id: "rep-solo-receipt-printer-drivers",
    category: "swe",
    inputMode: "dictated",
    useCase: "solo",
    scenario:
      "one printing interface with three implementations behind it in a hospitality till system",
    expectedType: "classDiagram",
    phenomena: [
      "no-type-keyword",
      "no-punctuation",
      "run-on",
      "long",
      "self-correction",
    ],
    notes:
      "Replaces swe-repository-pattern-class. Interface plus implementations, but with a shared abstract base under the interface holding two of the three, which a two-level reading flattens. The methods are named, which is what keeps it a class diagram rather than an ER diagram. The line about the kitchen printer being on order is an implementation that does not exist yet.",
    text: "ok the printing layer so theres one interface everything else in the till talks to and its called receipt sink and it has three methods open drawer print lines and cut and thats it deliberately small then underneath there are the actual drivers we have an epson driver a star driver and a pdf driver and the pdf one is for emailing a copy to the customer so it implements print lines properly and open drawer and cut are no ops on it which is a bit ugly but its fine the epson and the star are both escpos underneath so theres an abstract escpos printer class in between that holds the byte building and the two concrete ones only differ in the cut command and the drawer kick sequence so they override those two and inherit everything else the pdf one does not sit under escpos printer it implements the interface directly and then theres a printer registry that holds a map of station name to receipt sink so the front of house station and the bar station can be different hardware and the till just asks the registry for the sink for its station name and the kitchen printer is a fourth one thats on order and isnt written yet also the escpos base holds the codepage handling which is the part everyone gets wrong with accented characters",
  },
  {
    id: "rep-solo-observation-event-types",
    category: "swe",
    inputMode: "dictated",
    useCase: "solo",
    scenario: "a hierarchy of telescope alert types, heard badly",
    expectedType: "classDiagram",
    phenomena: [
      "no-type-keyword",
      "no-punctuation",
      "run-on",
      "long",
      "asr-corruption",
      "self-correction",
    ],
    notes:
      "Replaces swe-event-hierarchy-class. Keeps the inheritance shape and adds the corruption the original's scenario claimed but its phenomena did not carry. `transient` arrives as `transit`, `supernova` as `super nova`, and `base class` as `basic lass`, so the word that would name the type is destroyed while the structure survives intact.",
    text: "ok so the alert types all of them come from one basic lass called observation alert and that has the timestamp the ra and dec and the instrument id underneath it theres transit alert and periodic alert and transit alert is anything that appears and goes and periodic alert is anything that repeats under transit alert we have super nova alert which adds a light curve id and a classification and we have gamma burst alert which adds a fluence and a duration and under periodic alert theres variable star alert which adds a period and an amplitude and thats the lot everything else we treat as unclassified which is just the base one on its own sorry theres one more theres a heartbeat alert as well but that one doesnt inherit from anything it sits on its own",
  },
  {
    id: "rep-meet-blood-bank-schema",
    category: "swe",
    inputMode: "dictated",
    useCase: "meeting",
    scenario:
      "blood service redesigning the donation schema, table names badly transcribed",
    expectedType: "erDiagram",
    phenomena: [
      "asr-corruption",
      "no-punctuation",
      "run-on",
      "no-type-keyword",
      "long",
      "self-correction",
    ],
    notes:
      "Replaces meet-er-corrupted-names. Ten times the length and the corruption is consistent rather than one-off: `donor` is `donna` throughout, `apheresis` is `a pheresis`, `serology` is `sarah ology`. Consistency is what makes it recoverable, because `donna id` appears on three tables and only an entity name behaves like that. Six entities and one deliberate one-to-one that the speaker corrects to one-to-many. The exchange about the Tuesday session at the university and the van being off the road is not schema.",
    text: "ok so this is the donation side of the model not the hospital side were doing hospital next week so start with the donna table one row per person who has ever given and it has the donna id the nhs number where we have it name date of birth blood group and a deferral flag and the deferral flag is wrong actually its not a flag its a whole other thing ill come back to it then sessions a session is a place and a date so the church hall in stroud on the fourteenth and it has a session id a venue id a date a start and end time and a target which is how many units were hoping for and venues is its own little table because we go back to the same halls year after year so one venue has many sessions and one session belongs to one venue then the donation table and this is the centre of everything a donation has a donation id a donna id a session id a start time an end time the type which is whole blood or a pheresis and a volume and one donna has many donations obviously over a lifetime and one session has many donations and thats the many to many resolved because donations is sitting between donna and session anyway now from one donation you can get more than one thing out of it and this is where people get confused a whole blood donation gets separated into red cells plasma and sometimes platelets so theres a components table with a component id a donation id a component type an expiry date and a current status and one donation has many components and thats a real one to many i want to say one to one because it feels like one bag but its not its three then the testing every donation gets a set of tests run on it and each test is its own row so a test result has a result id a donation id a test code a value and a pass or fail and the test codes come from a little reference table and the sarah ology screens are in there alongside the grouping tests and one donation has many test results and if any of them fail the components from that donation all get their status set to discarded so theres a dependency there that isnt a foreign key its logic and then the deferral thing i said id come back to a deferral is a period not a flag so its a table deferral id donna id start date end date reason code and permanent yes or no and one donna has many deferrals over time and the current deferral is just the one where today is between the dates and the reason codes are another reference table so thats six real tables plus the two reference ones and can somebody confirm the tuesday session at the university is still on because the van is off the road until wednesday and if it isnt on we need to tell them today not friday",
  },
  {
    id: "rep-meet-fisheries-quota-schema",
    category: "general",
    inputMode: "dictated",
    useCase: "meeting",
    scenario:
      "fisheries authority working out the catch recording tables, the counting words come through wrong",
    expectedType: "erDiagram",
    phenomena: [
      "asr-corruption",
      "no-punctuation",
      "run-on",
      "no-type-keyword",
      "long",
    ],
    notes:
      "Replaces cov-er-asr-cardinality. Same failure mode, worse: `allocation` arrives as `a location`, which is a grammatical noun phrase and reads as a geographic attribute rather than an entity, and `quota` arrives as `quoter` twice. The cardinality on landings to species is the one that has to survive, because it is the only many-to-many and it is stated in the damaged sentence.",
    text: "so the catch recording model as it stands we have vessels one row per registered boat with the vessel id the port of registry the length class and the owner and owner is a separate table because one owner can have four boats then licences a licence is issued to a vessel for a period so licence id vessel id valid from valid to and the gear types allowed and one vessel has many licences over the years but only one current then trips a trip is a departure and a return so trip id vessel id departure port departure time return port return time and one vessel has many trips then landings and a landing is what came off the boat at the end of a trip and its per species so a landing has a landing id a trip id a species code a live weight and a presentation and one trip has many landings and one species appears in many landings so the join is already there we dont need another table then the quoter side a quoter is set per species per year for the whole fleet and then theres a location which is the bit each producer organisation gets out of that quoter so a location has an id a quoter id an organisation id a tonnage and a year and one quoter has many of those and the vessels belong to an organisation so the uptake is landings rolled up against the location for whichever organisation the vessel is in and that rollup is a view not a table",
  },
  {
    id: "rep-chat-empty-canvas-ramble",
    category: "general",
    inputMode: "typed",
    useCase: "chat",
    scenario:
      "a long typed refinement turn arriving when nothing has been drawn yet",
    expectedType: null,
    outcome: "no-diagram",
    phenomena: [
      "refinement",
      "deictic-reference",
      "not-a-request",
      "real-punctuation",
      "no-type-keyword",
      "long",
    ],
    notes:
      "Replaces chat-refine-nothing-to-refine. The original made refusal easy by being eight words. This is ninety, and length is exactly what makes it dangerous: there are enough nouns in it to assemble something that looks like a diagram, and every one of them is a complaint about the tool rather than a thing to draw. There is no previous diagram, every pointer is dangling, and none of the requests is expressible in mermaid anyway. Drawing anything here is worse than refusing.",
    text: "Can you tidy this up a bit? The spacing is all wrong on the left hand side and that box near the top is sitting too close to the one under it. I'd move the whole middle section across and shrink the labels a bit, they're overpowering everything. Also the arrows are too thick, they were fine before. Just make it look more like the last one, you know the style I mean, and get rid of whatever that thing at the bottom is meant to be.",
  },
  {
    id: "rep-chat-donation-page-nonrequest",
    category: "general",
    inputMode: "typed",
    useCase: "chat",
    scenario: "a long, polite typed message that never asks for anything",
    expectedType: null,
    outcome: "no-diagram",
    phenomena: [
      "refinement",
      "not-a-request",
      "real-punctuation",
      "no-type-keyword",
      "long",
    ],
    notes:
      "Replaces chat-refine-vague-improve. A hundred words of context, gratitude and hedging with not one instruction in it. Politeness is the trap: the message reads cooperative, so the pull is to produce something to be helpful. The honest outcome is to leave the canvas alone and say there is nothing to act on. Nothing here says what to change, only that the writer is unsure.",
    text: "Thanks, this is roughly what I was after. I showed it to Priya and she had thoughts, though she couldn't really articulate them either, which is very much her. I think the issue is more that I'm not sure it's saying the right thing rather than anything specific being wrong with it. Maybe it's fine and I'm overthinking it. We've got until Thursday before it goes in the trustees' pack so there's time. Anyway, have a look and see what you think, you've got a better eye for this than I have.",
  },
  {
    id: "rep-teach-silkworm-instars",
    category: "general",
    inputMode: "dictated",
    useCase: "teaching",
    scenario:
      "a biology class on complete metamorphosis, one animal through its stages",
    expectedType: "stateDiagram-v2",
    phenomena: [
      "no-punctuation",
      "run-on",
      "no-type-keyword",
      "long",
      "self-correction",
      "analogy",
    ],
    notes:
      "Replaces teach-water-cycle-states. One organism changing condition, with the same failure the original guarded: a flowchart of this loses that it is one animal throughout. Adds two things the short version could not carry, a self-loop on the larval stage that repeats four times and a diapause branch out of the pupa that rejoins later, and the temperature and photoperiod triggers are named per transition. The digression about the mulberry supplier and the exam is not diagram content.",
    text: "right so complete metamorphosis and were using the silkworm because you can actually watch it happen in the room and because the stages are so distinct that nobody argues about where one ends so it begins as an egg and the egg is a state not an event it can sit there for days or for months depending on temperature and the trigger out of it is warmth roughly twenty five degrees and enough of it for long enough and then it hatches into the first instar larva now instar is the word for the stage between moults and this is the bit i want you to get because the larva does not just grow continuously it grows until the cuticle wont stretch any further and then it stops eating it sits still for a day and it moults and it comes out as the next instar and it does that four times so first instar to second to third to fourth to fifth and each of those transitions is a moult and each moult is triggered by the same thing which is the animal outgrowing its own skin so on the board thats one state with a loop back onto itself if you want to be economical or five states in a row if you want to be honest and i prefer honest because they look different and they eat different amounts the fifth instar is the one that eats an enormous amount and then stops and when it stops it starts spinning and spinning is the transition not a state it takes about three days and at the end of it its inside the cocoon and its a pupa now the pupa is where it gets interesting because in a lot of species and in this one under the right conditions the pupa can enter diapause which is a suspended state it can sit there through a winter and nothing happens and what pushes it into diapause is not temperature its photoperiod its day length experienced by the mother actually not by the larva itself which is a lovely bit of biology and comes out of diapause with cold followed by warming so on the diagram diapause hangs off pupa and comes back to pupa its not a dead end and then from pupa you get eclosion which is the emergence of the adult moth and the adult moth does not eat at all it has no functioning mouthparts it exists to mate and lay and then it dies so adult goes to dead and dead is terminal and the eggs the adult lays start the whole thing again so theres a cycle back from adult to egg and thats the loop that makes this a cycle rather than a line and it is one animal the whole way through thats the point its not four organisms in a queue its the same individual and if you draw it as four boxes with arrows youve drawn a production line and lost the biology someone remind me to ring the mulberry people because the third years need leaves by the fifteenth and this is on the paper by the way both the instar count and the diapause trigger",
  },
  {
    id: "rep-teach-case-lifecycle-terminal",
    category: "general",
    inputMode: "dictated",
    useCase: "teaching",
    scenario:
      "law school session on the states a civil claim passes through, with explicit start and end",
    expectedType: "stateDiagram-v2",
    phenomena: [
      "no-punctuation",
      "run-on",
      "no-type-keyword",
      "long",
      "self-correction",
    ],
    notes:
      "Replaces state-terminal-and-start. Keeps the requirement for `[*]` at both ends, which is the token that looks like a malformed node label to anything doing bracket repair, and gives it two terminal states rather than one plus a stayed state that is explicitly not terminal. `stayed` returning to `allocated` is the transition a hurried answer draws as an end.",
    text: "so the life of a civil claim and i want you to draw this with a proper start and a proper end because the ends matter legally nothing exists before the claim form is issued so theres an initial marker and the first real state is issued and issued means the court has stamped it and it has a number from issued you go to served once the defendant has actually received it and there is a time limit on that and if you miss it the claim goes nowhere and thats an end from served the defendant either files a defence or doesnt and if they dont you get default judgment and default judgment is terminal if they do file you move to defended and from defended the court allocates it to a track small claims fast track or multi track so allocated is the next state and from allocated you go into directions and then to listed and then to trial and out of trial comes judgment and judgment is terminal and the other route out of almost anywhere is settlement the parties agree and the claim is discontinued or stayed by consent and discontinued is terminal but stayed is not stayed is a pause you can lift a stay and go back to allocated and people draw stayed as an end and it is not and one more thing from judgment you can get permission to appeal which sounds like it reopens it but it doesnt it starts a different proceeding so for our purposes judgment is still terminal",
  },
  {
    id: "rep-teach-entity-component-system",
    category: "swe",
    inputMode: "dictated",
    useCase: "teaching",
    scenario:
      "explaining entity-component-system to people who have only written inheritance",
    expectedType: "classDiagram",
    phenomena: [
      "no-punctuation",
      "run-on",
      "no-type-keyword",
      "long",
      "self-correction",
      "analogy",
    ],
    notes:
      "Replaces teach-mvc-class. Keeps the borderline the original had: the whole explanation is about what may reference what, which is a class diagram statement, and a beginner audience would accept boxes and arrows. Harder here, because the speaker explicitly contrasts an inheritance tree with the composition model that replaces it, so a correct answer has to choose which of the two to draw and the answer is the second one. The spreadsheet analogy is narration, not a diagram.",
    text: "ok so entity component system and im going to start by drawing the thing were replacing because otherwise this makes no sense so the way most of you would write a game is you have a base class called game object and it has a position and an update method and then you inherit player from it and enemy from it and then you need a flying enemy so you inherit that from enemy and then you need a flying enemy that also shoots and now you have a problem because the shooting code is over in player and you either copy it or you push it up into game object where it does not belong and honestly everyone who has written a game has been in that exact hole so now the other way an entity is nothing it is an id it has no fields it has no methods it is a number and that is genuinely all it is a component is a plain bag of data with no behaviour at all so position is a component with an x and a y velocity is a component with a dx and a dy health is a component with current and max sprite is a component with a texture id and a frame and weapon is a component with a damage a cooldown and a time since last fired and none of those have methods on them at all right they are data and an entity has some set of components attached and which set is decided at runtime not at compile time so a player is an entity with position velocity health sprite and weapon and a wall is an entity with position and sprite and nothing else and a bullet is an entity with position velocity sprite and damage and there is no class called wall anywhere in the codebase obviously right then the systems and a system is where all the behaviour lives a movement system knows about position and velocity and nothing else and every frame it looks at every entity that has both of those and adds the velocity to the position and it does not know or care whether that entity is a player a bullet or a falling rock basically a render system knows about position and sprite a combat system knows about weapon and health and a health system knows about health so the systems reference the components and the components reference nothing and the entity references components and the direction of all of that is the actual content of what im telling you the component knows nothing about the system that reads it think of it like a spreadsheet where each component is a column and each entity is a row and most cells are empty and a system is a formula that only looks at two columns thats the mental model ok im not drawing the spreadsheet the thing to take away is that the tree i drew first has behaviour and data welded together and the second one has them completely apart and thats why you can add shooting to anything yeah",
  },
  {
    id: "rep-teach-instrument-taxonomy",
    category: "general",
    inputMode: "dictated",
    useCase: "teaching",
    scenario:
      "music class on how instruments are classified, with one that refuses to fit",
    expectedType: "classDiagram",
    phenomena: ["no-punctuation", "run-on", "no-type-keyword", "long"],
    notes:
      "Replaces teach-inheritance-animals. The textbook hierarchy, but the piano is explicitly called a member of two branches, which an inheritance tree cannot hold and a careful answer either draws twice or annotates. That contradiction is the teaching point and is the thing a hurried answer smooths over by picking one parent.",
    text: "so classifying instruments the system everyone uses splits them by how the sound is actually produced not by what theyre made of so at the top you have instrument and everything has a pitch range and a name under that you have aerophone chordophone membranophone and idiophone and later people added electrophone so aerophone is anything where a column of air vibrates so thats flutes and clarinets and trumpets and the subdivision under that is whether theres a reed and whether the reed is single or double so clarinet is single reed oboe is double reed flute is no reed at all chordophone is a vibrating string and under that you split by how you set the string going which is plucked bowed or struck so guitar and harp are plucked violin and cello are bowed and here is the awkward one the piano is struck a hammer hits a string so the piano is a chordophone which surprises people who have spent years calling it percussion and the fair answer is that it is both it is a chordophone by the strict rule and everyone in an orchestra treats it as percussion and both of those are true membranophone is a stretched skin so drums and idiophone is where the body of the thing itself vibrates with no skin and no string so thats a cymbal a triangle a xylophone",
  },
  {
    id: "rep-misfire-proofreading-aloud",
    category: "general",
    inputMode: "dictated",
    useCase: "misfire",
    scenario:
      "someone proofreads a gallery press release out loud with the mic live",
    expectedType: null,
    outcome: "no-diagram",
    phenomena: ["not-a-request", "no-punctuation", "long", "self-correction"],
    notes:
      "Replaces misfire-reading-aloud. The original was eighteen words and obviously not a request. This is ninety and reads like a process: `first` `then` `following that` `finally`. Those are the words a type-detector keys on, and none of them is an instruction to draw anything. The speaker is reading their own copy back to catch a repetition, which the self-correction at the end makes explicit.",
    text: "the gallery will open the new wing to the public on the fourth of march following a period of staff familiarisation the wing will initially operate reduced hours from ten until four then from the first of april full opening hours will apply following that the temporary entrance on castle street will close and finally the visitor car park will revert to its normal charging structure no thats three followings in one paragraph read it again the gallery will open the new wing to the public on the fourth of march after a period of staff familiarisation",
  },
  {
    id: "rep-misfire-landlord-call",
    category: "general",
    inputMode: "dictated",
    useCase: "misfire",
    scenario:
      "the app is listening while someone is on the phone about a broken boiler",
    expectedType: null,
    outcome: "no-diagram",
    phenomena: ["not-a-request", "no-punctuation", "long", "run-on"],
    notes:
      "Replaces misfire-single-word. Note the coverage cost: the original was the one-word degenerate input and nothing here is short, so that case now has no entry in the corpus. What this tests instead is a ninety-word misfire dense with sequence words and a genuine branch, `if he cant get the part then`, which is a decision node in every respect except that nobody asked for one. The other half of the call is not audible, so this is not multi-speaker.",
    text: "no i rang on monday and they said someone would come out within forty eight hours and nobody came and then i rang again yesterday and they said it had been logged as a routine job not an emergency well its august so technically no i suppose not but the shower is cold as well its not just the heating right so if he cant get the part then what happens does it get escalated or do i have to ring again because ive rung three times now and each time it starts from the beginning no i understand thats not you",
  },
  {
    id: "rep-meet-trial-tables-then-randomisation",
    category: "swe",
    inputMode: "dictated",
    useCase: "meeting",
    scenario:
      "clinical trial system: the data model, then separately the randomisation call path",
    expectedType: "erDiagram",
    expectedTypes: ["erDiagram", "sequenceDiagram"],
    multiFrom: "low",
    phenomena: [
      "multi-diagram",
      "no-punctuation",
      "run-on",
      "no-type-keyword",
      "long",
      "self-correction",
    ],
    notes:
      "Replaces multi-er-then-call-order. The seam is `right thats the tables now the other thing` and neither half refines the other, so last-intent-wins drops the schema entirely. The randomisation exchange names four parties and has a rejection path back to the site. The unblinding path is described once and belongs to the sequence, not the schema. The line about the monitor visit in Leeds is neither.",
    text: "so two things the model and then the randomisation call because theyre both on the same ticket and theyre not the same problem model first the top of it is study one row per protocol with a study id a sponsor a phase and a status then sites a site is a hospital taking part so site id study id principal investigator name and an activation date and one study has many sites obviously then subjects and a subject belongs to exactly one site and one study so subject id site id a screening number an enrolment number a date of birth year only not full date because of identifiability and a status then visits a visit is a scheduled contact so visit id subject id a visit name like week four a planned date an actual date and a completed flag and one subject has many visits then forms each visit has several case report forms so form id visit id form type and a completion status and each form has many fields but were not modelling fields as rows were storing the whole form as json in a data column with a schema version alongside it and i know thats not lovely and its what were doing then adverse events which hang off the subject not the visit because they can happen at any time so event id subject id onset date severity outcome and a relatedness assessment and one subject has many events and separately the randomisation table which is one row per subject with the subject id the arm the stratum and the timestamp and thats one to one with subject except that not every subject gets randomised because some fail screening so its zero or one right thats the tables now the other thing the randomisation call the site coordinator finishes the eligibility form in the edc and hits randomise and the edc posts to the randomisation service with the subject id and the stratification factors which are site and disease severity and the randomisation service first calls back to the edc to verify the subject is still eligible and has not already been randomised and thats a real round trip not a cached check because we had a double randomisation in the last study and if that check fails the service returns a rejection and the edc shows the coordinator an error and nothing is written if it passes the service picks the next allocation from the block for that stratum and writes the randomisation row and returns the kit number not the arm to the coordinator because the site is blinded so the coordinator only ever sees a kit number and then the service notifies the drug supply system so the depot knows to ship and separately it writes to the audit log which is its own service and for unblinding theres a completely separate path where the investigator calls the emergency number and a pharmacist with the code list looks it up and thats deliberately manual and off system also the monitor is in leeds on the ninth so if we want the site table done by then",
  },
  {
    id: "rep-meet-permit-tables-and-status",
    category: "general",
    inputMode: "dictated",
    useCase: "meeting",
    scenario:
      "planning department: the permit tables plus the status the application moves through",
    expectedType: "erDiagram",
    expectedTypes: ["erDiagram", "stateDiagram-v2"],
    multiFrom: "low",
    phenomena: [
      "multi-diagram",
      "no-punctuation",
      "run-on",
      "no-type-keyword",
      "long",
      "self-correction",
    ],
    notes:
      "Replaces multi-er-and-lifecycle. Same argument as the original: the status column is a state machine, and folding it into the ER diagram as an attribute loses the transitions while folding the tables into the state diagram loses the schema. Harder here because the consultation period is both an entity with dates and a state the application sits in, so a careless answer draws it once and picks the wrong diagram for it.",
    text: "right so the planning system the tables first applications is the main one application id reference number site address parcel id applicant id application type received date target date and a current status and the reference number is generated not natural i mean its ours not theirs then applicants which is a person or a company with contact details and one applicant has many applications then documents each application has many documents so document id application id document type filename uploaded date and a redacted flag because some of them have personal details in and cant go on the public register then consultees a consultee is a body we have to ask like the highways authority or the environment agency and theres a consultation table joining application to consultee with a sent date a due date a response date and a response type and thats a many to many resolved then comments which are public objections and supports so comment id application id name postcode sentiment and text and one application has many comments then decisions decision id application id decision date outcome and a set of conditions and conditions is its own table hanging off decision because theres many of them now the status side an application starts at received and from received it goes to validated once the fees are paid and the drawings are right or back to invalid if theyre not and invalid sits there until the applicant fixes it and then it goes to validated from validated it goes to consultation which is a real period twenty one days and it sits in that state the whole time sorry twenty one for most of them and thirty for a major and then to assessment and from assessment either to committee if its a big one or straight to decision if the officer can decide it and from committee to decision and decision splits to approved or refused and refused can go to appealed and appeal comes back as allowed or dismissed and theres also withdrawn which you can reach from anywhere before decision",
  },
  {
    id: "rep-creator-printer-checklist-and-job-states",
    category: "swe",
    inputMode: "dictated",
    useCase: "creator",
    scenario:
      "video on resin printing: a maintenance checklist with no order, then the printer's job states",
    expectedType: "flowchart",
    expectedTypes: ["flowchart", "stateDiagram-v2"],
    multiFrom: "low",
    phenomena: [
      "multi-diagram",
      "list-content",
      "grouping",
      "no-punctuation",
      "run-on",
      "long",
    ],
    notes:
      "Replaces multi-checklist-and-deploy-states. The checklist half is the one that gets turned into a tree: the speaker says twice that the order does not matter, and the correct drawing is a container with items and no edges. The second half is a real machine with real triggers. Two fences because they are different types, not because they are different topics.",
    text: "right so before every print theres a list of things i check and im going to put them on screen as a list because the order genuinely does not matter you can do them in any order you like so resin level in the vat film tension on the fep and you check that by tapping it it should sound like a drum bed levelled and i mean actually re levelled if youve knocked it not just looked at it lcd clean no cured lumps stuck to it room temperature above twenty because cold resin is why your supports fail and the file sliced with the right profile for the resin youre actually using not the one you used last time thats six things and again no order theyre just six things now separately the printer itself has states and this one is a proper state machine so it starts idle and when you send a job it goes to preparing which is it heating the vat if you have a heater and homing the plate and from preparing it goes to printing and printing is a loop of lift expose lower but i dont want that drawn as separate states thats one state from printing you can go to paused which you can do yourself or which happens automatically if the lid comes off and paused goes back to printing when you resume from printing you go to finished when the last layer is done and finished goes back to idle when you take the plate off and the failure one is from printing to error which is a detected delamination or the file being unreadable and error only goes to idle after you acknowledge it on the panel it will not clear itself",
  },
  {
    id: "rep-creator-van-fleet-tradeoff",
    category: "general",
    inputMode: "dictated",
    useCase: "creator",
    scenario:
      "video comparing electric and diesel delivery vans, two lists then the decision they feed",
    expectedType: "flowchart",
    expectedTypes: ["flowchart", "flowchart"],
    multiFrom: "low",
    phenomena: [
      "multi-diagram",
      "list-content",
      "grouping",
      "no-punctuation",
      "run-on",
      "long",
      "self-correction",
    ],
    notes:
      "Replaces multi-pros-cons-then-decision. Two groups with no internal flow and one decision that does have flow, and the failure mode is drawing all three as one chart, which forces arrows onto the list items. Longer than the original so the lists are five and four items rather than two and two, which makes the arrow-forcing failure much more visible. The payload figure is corrected from nine hundred to seven fifty. The bit about the sponsor and the comments is not diagram content.",
    text: "ok so this is the electric versus diesel question for a small delivery fleet and im going to put the case for each on screen as two groups and then the decision separately because the decision is not just add up the ticks so for electric the points are running cost per mile is about a third and thats the headline and its real congestion charge and clean air zone exemption which if you are anywhere near a city centre is enormous maintenance is genuinely lower theres no clutch no exhaust no oil changes drivers overwhelmingly prefer them which sounds soft and honestly matters a lot when you are trying to keep drivers and the corporate reporting side because a lot of contracts now ask you about it thats five things right and they dont connect to each other in any way theyre just five reasons right for diesel the points are purchase price is still meaningfully higher even after grants payload is lower because the battery is heavy and thats about seven fifty kilos of usable payload on a comparable van sorry i said nine hundred earlier its seven fifty depot power is the big one because if your yard cant take another two hundred kilowatts you are talking about a grid connection application and that is a year and possibly a lot of money and range in winter which is real and everybody underestimates it obviously so thats four ok now the decision and this one is a flow because the questions come in an order and each one can end it first question what is your longest daily route and if its over a hundred and eighty miles in winter conditions well stop the answer is diesel for that route dont argue with the physics if its under that second question can your depot supply the power and thats a phone call to your dno not a guess basically and if the answer is no then the question becomes can you charge somewhere else overnight and if theres no answer to that its diesel again if power is fine third question what is your payload on a typical day and if you are regularly within seven fifty kilos of the limit you cannot afford the battery weight and its diesel and if you got through all three then its electric and the payback is somewhere around four years at current fuel prices maybe and that number moves so check it yourself link to the spreadsheet is below and yes this video is not sponsored by anyone before somebody asks in the comments again",
  },
  {
    id: "rep-solo-ground-station-pass",
    category: "swe",
    inputMode: "dictated",
    useCase: "solo",
    scenario:
      "satellite pass operations: the uplink procedure and the link state beside it",
    expectedType: "flowchart",
    expectedTypes: ["flowchart", "stateDiagram-v2"],
    multiFrom: "low",
    phenomena: [
      "multi-diagram",
      "no-punctuation",
      "run-on",
      "long",
      "self-correction",
    ],
    notes:
      "Replaces multi-request-flow-and-retry-states. The procedure and the link state machine, same split as the original, but the state machine has a hold state that the procedure never mentions and the procedure has a step that only happens on the first pass of the day. Neither half is complete without the other, which is what makes it two fences rather than one.",
    text: "notes for the pass procedure so the sequence is we get the we get the tle update from the tracking feed in the morning and we propagate it and that gives us the pass windows for the day and then per pass twenty minutes before aos we load the command stack and the command stack is built from whatever the planning tool spat out overnight and it gets a checksum and the checksum has to match what the planning tool recorded obviously then at aos minus five or minus ten if its a low pass the antenna slews to the predicted acquisition point and we start the receiver and wait then at aos we look for carrier lock and if we get carrier we go for frame sync and if we get frame sync we start telemetry capture and only once telemetry is flowing and the spacecraft clock looks sane do we start uplinking commands and we uplink one at a time and wait for the acknowledgement counter to increment before sending the next one and if it doesnt increment within two seconds we resend the same command and after three resends no its two now after two we abort the stack and just record telemetry for the rest of the pass then at los we stop capture and slew back to stow and on the first pass of the day only we also dump the recorder well not the first pass the first pass over our own station which takes the whole window so no commanding on that one now the link itself as a state its unlocked to start and unlocked goes to carrier lock when we see the signal and carrier lock goes to frame sync when the sync word comes through and frame sync goes to locked when we have three good frames in a row and from locked we can go back to frame sync if we drop frames and all the way back to unlocked if the signal goes and theres a hold state which we go into deliberately when the elevation is low and multipath is bad and hold means keep the lock dont command and hold comes back to locked when we clear twenty degrees",
  },
  {
    id: "rep-solo-allotment-waiting-list",
    category: "general",
    inputMode: "dictated",
    useCase: "solo",
    scenario:
      "allotment association: the application steps and the tenancy status alongside",
    expectedType: "flowchart",
    expectedTypes: ["flowchart", "stateDiagram-v2"],
    multiFrom: "low",
    phenomena: ["multi-diagram", "no-punctuation", "run-on", "long"],
    notes:
      "Replaces multi-onboarding-flow-and-states. Steps plus a status, same pair, at a scale a single volunteer would actually dictate. The notice period is a state and not a step, which is the seam between the two halves.",
    text: "right so the waiting list process someone fills in the form on the website we check theyre in the parish because out of parish goes on a separate list behind everyone else then they go on the list with a date and when a plot comes free we offer it to the top of the list and they have fourteen days to say yes and if they say no they keep their place once but a second no drops them to the bottom then they sign the tenancy and pay the rent pro rata and get a key and separately the tenancy status is applied then offered then active and active goes to under notice if theres a cultivation warning and under notice goes back to active if they sort it out or to terminated if they dont and active goes to surrendered if they give it up themselves",
  },
  {
    id: "rep-creator-sequencing-warning-and-schema",
    category: "swe",
    inputMode: "dictated",
    useCase: "creator",
    scenario:
      "tutorial recording: a warning about sample identifiers, then the sequencing lab schema",
    expectedType: "erDiagram",
    expectedTypes: ["flowchart", "erDiagram"],
    multiFrom: "medium",
    phenomena: [
      "multi-diagram",
      "no-punctuation",
      "run-on",
      "long",
      "self-correction",
    ],
    notes:
      "Replaces multi-warning-and-schema, and changes the use case to creator, because erDiagram with useCase creator had zero entries corpus-wide. The warning half is one statement worth keeping and is a single box, not a process, which is the shape the l1 rules give it. Medium because the warning is arguably a caption rather than a fence. The plate-and-well composite key is the schema detail a hurried answer flattens into one column. The aside about the microphone and the earlier take is not content.",
    text: "right take two the microphone was clipping on the last one so before i show you the schema theres one thing i want on screen on its own because it is the single most expensive mistake in this whole domain and it is this never join anything on the sample barcode the barcode is printed on a tube and tubes get relabelled and reused and the same barcode string will exist twice in your data within a year i have seen it end a project put that in a box on its own dont bury it in the diagram right now the actual model the top of it is project one row per piece of work with a project id a name a principal investigator and a funder then subject and a subject belongs to a project and has a subject id a project id an anonymised code and a consent version and consent version matters because it decides what you are allowed to do with the data later then sample and a sample is physical material taken from a subject at a point in time so sample id subject id tissue type collection datetime and that barcode i just told you not to join on and one subject has many samples then library and this is where people get lost a library is a sample that has been prepared for sequencing so its library id sample id protocol index sequence and a concentration and one sample can produce several libraries because you might prep it twice or prep it two different ways so that is one to many not one to one then the physical run so theres a flowcell table with a flowcell id a run date an instrument id and a chemistry version and libraries get loaded onto lanes on a flowcell so theres a lane table with a flowcell id and a lane number and the primary key is the pair not a synthetic id and then a loading table joining library to lane with a proportion because you pool libraries in a lane and one library goes on many lanes and one lane holds many libraries so thats your many to many and then results a fastq file record with a lane reference a library reference a read number a path and a checksum and the checksum is not decoration it is how you know the file on the cheap storage is the file you think it is and instruments is a little reference table because you will want to ask whether the weird batch effect is one machine and if the instrument is only a string on the flowcell row you cannot",
  },
  {
    id: "rep-meet-foodbank-schema-then-rota",
    category: "general",
    inputMode: "dictated",
    useCase: "meeting",
    scenario:
      "food bank trustees: the stock and referral tables, then the volunteer rota which is not a schema",
    expectedType: "erDiagram",
    expectedTypes: ["erDiagram", "flowchart"],
    multiFrom: "low",
    phenomena: [
      "multi-diagram",
      "no-punctuation",
      "run-on",
      "long",
      "self-correction",
    ],
    notes:
      "Replaces multi-drift-schema-then-rota. A schema and then something that is not a schema at all, with the drift happening at `anyway the other thing`. The rota half is a process with a decision in it and must not be forced into the ER diagram as more tables. The remark about the freezer is neither half.",
    text: "so the database first because sarah wants it before the trustees meeting we need clients and a client is a household not a person so household id a reference an area a household size and a registration date and were not storing names in the same table as the need data thats deliberate then referrals and a referral comes from an agency so referral id household id agency id issue date expiry date and a number of parcels authorised and one household has many referrals over time and agencies is its own table with a name a type and a contact then parcels a parcel is one actual bag handed over so parcel id referral id issue date centre id and a size and one referral has many parcels up to the number authorised then stock and stock is by item type not by individual tin so item id category unit and a target level and then a stock movement table with item id centre id quantity direction and a date and direction is in or out and the current level is the sum which i know some of you hate and it is right because we need the history for the donation reporting and centres is a table too we have four now anyway the other thing the rota because we still havent fixed it so at the moment someone posts the week on the whatsapp group and people reply and thats it what i want is the coordinator publishes the shifts for the month on the first volunteers claim a shift and if a shift is still unclaimed seven days out it goes to the reserve list who get a text and if it is still unclaimed two days out the coordinator rings people and if that fails we run short handed and the warehouse shift is the one that cannot run short handed so that one escalates to a trustee and thats a different thing from the tables entirely and also the freezer at the north centre is making a noise again",
  },
  {
    id: "rep-teach-escrow-and-payment-hold",
    category: "swe",
    inputMode: "dictated",
    useCase: "teaching",
    scenario:
      "conveyancing escrow drawn as a process, then the marketplace hold drawn as an exchange",
    expectedType: "sequenceDiagram",
    expectedTypes: ["flowchart", "sequenceDiagram"],
    multiFrom: "low",
    phenomena: [
      "multi-diagram",
      "analogy",
      "no-punctuation",
      "run-on",
      "long",
      "self-correction",
    ],
    notes:
      "Replaces multi-analogy-valet-and-oauth. The analogy is asked for explicitly, `put the house one up too`, so it is a fence rather than narration, and it is a process with a decision while the real system is an exchange between named parties, so the two fences are different types. That asymmetry is the thing to get right: drawing both as sequences loses that nobody in the conveyancing story is passing messages in a fixed order.",
    text: "ok so holds and escrow and im going to do the house version first and put the house one up too because i think seeing them side by side is worth it so youre buying a house you do not hand the seller the money and hope you send the money to your solicitor and it sits in the client account and it is not the sellers money and it is not your money any more either and thats the whole trick then on completion day theres a set of conditions the seller has to have provided the discharge for their mortgage the transfer deed has to be signed the searches have to be clear and if all of those are satisfied the solicitor releases the money and the keys are released and if any of them isnt satisfied the money goes back to you and the sale falls through so as a process its money in then a set of checks then a branch release or return now the marketplace version and this one is genuinely a conversation between four parties so the buyer clicks pay and the app sends an authorisation request to the payment provider and note the word authorisation not capture the provider goes to the card network and the card network comes back with an approval and what that has actually done is put a hold on the buyers card the money has not moved it is reserved and there is a clock on it usually seven days provider tells the app the hold is in place and the app tells the seller you have an order ship it and the seller ships and marks it shipped and the app tells the buyer its on the way and then when the buyer confirms delivery or the confirmation window expires whichever comes first the app sends a capture request to the provider quoting the original authorisation and the provider tells the network and now the money actually moves and the provider tells the app captured and the app credits the seller balance and if the buyer opens a dispute before capture the app sends a void instead of a capture and the hold is released and nothing ever moved and thats the case people forget because it looks like a refund and it is not a refund a refund is money going back after it moved a void is money that never moved sorry i should have said that earlier its the important difference and if the seller never ships the hold just expires on its own and the provider tells nobody which is why the app has to poll",
  },
  {
    id: "rep-teach-library-holds-and-edge-cache",
    category: "swe",
    inputMode: "dictated",
    useCase: "teaching",
    scenario:
      "a library reservation system and an edge cache, both drawn as exchanges",
    expectedType: "sequenceDiagram",
    expectedTypes: ["sequenceDiagram", "sequenceDiagram"],
    multiFrom: "low",
    phenomena: [
      "multi-diagram",
      "analogy",
      "no-punctuation",
      "run-on",
      "long",
      "self-correction",
    ],
    notes:
      "Replaces multi-analogy-phonebook-and-dns. Both halves drawn, both sequences, because the speaker says draw both. The parties differ between the two halves even though the shape is identical, so the two fences are not copies of each other with words swapped, and merging them into one produces a diagram with six lifelines and no meaning.",
    text: "right im going to draw both of these because the parallel only lands if you see them together so the library first you go to your branch and you ask for a book they dont have and the librarian checks the county catalogue the county catalogue and finds it at another branch and requests it and that branch takes it off the shelf and puts it in the van and the van comes round and your branch texts you and you come and get it and now heres the bit that matters the book stays at your branch for a while after you return it before it goes home so if someone else asks for it next week your branch already has it and nobody rings the county and nobody sends a van now the edge cache the browser asks the nearest edge node for the file the edge node doesnt have it so it asks the origin and the origin sends it back and the edge node keeps a copy and serves it to the browser and the next person in that city gets it from the edge node and the origin never hears about it at all and both of them have the same expiry problem well the same eviction problem the branch eventually sends the book back and the edge node eventually throws the file away and in both cases the question of how long is a policy decision that somebody argues about",
  },
  {
    id: "rep-solo-atm-withdrawal-sequence",
    category: "swe",
    inputMode: "dictated",
    useCase: "solo",
    scenario:
      "cash machine withdrawal across the card network, asked for as a sequence diagram",
    expectedType: "sequenceDiagram",
    phenomena: [
      "strong-keyword",
      "no-punctuation",
      "run-on",
      "long",
      "self-correction",
    ],
    notes:
      "Replaces swe-oauth-sequence-explicit. Names the type in the first four words, same as the original, so what changes is the load: five parties instead of three, a reversal path that runs the messages backwards, and a timeout case where the acquirer never hears back. A correct answer keeps the reversal in the same fence, because it is part of the same exchange.",
    text: "draw me a sequence diagram of a cash withdrawal at an atm right so the customer puts the card in and enters the pin and the atm builds an authorisation request and the pin is verified either offline on the chip or online depending on the card and assume online here well assume online so the atm sends the request to the acquirer which is whoever owns the machine and the acquirer sends it to the card network and the network routes it to the issuing bank based on the card number and the issuer checks the balance and the daily limit and the fraud rules and the velocity checks and answers approve or decline and that answer comes back the same way network to acquirer to atm and if its an approval the atm dispenses the cash and then sends a completion message back to the acquirer and this is the part people miss the dispense happens before the completion so if the machine jams after the approval the issuer has already reserved the money and the atm has to send a reversal which goes atm to acquirer to network to issuer and the issuer releases the hold and the other case is the atm never gets an answer at all because the link dropped and then it doesnt dispense and it also sends a reversal blind because it has no idea whether the issuer approved it or not and the issuer has to cope with a reversal for something it may never have authorised",
  },
  {
    id: "rep-creator-paste-immunisation-ddl",
    category: "swe",
    inputMode: "pasted",
    useCase: "creator",
    scenario:
      "creator pastes registry DDL mid-recording and asks for the diagram to put on screen",
    expectedType: "erDiagram",
    phenomena: [
      "code-paste",
      "real-punctuation",
      "fragile-chars",
      "strong-keyword",
      "long",
    ],
    notes:
      "Replaces paste-sql-schema, and changes the use case to creator, which is one of the three erDiagram creator entries the corpus had none of. Names the type in words, so nothing is ambiguous. Carries the fragile characters only this channel can produce: parentheses, commas inside them, a quoted default and a composite unique constraint spanning two columns, which is the relationship a column-by-column reader misses.",
    text: "Need this on screen for the next section - give me an ER diagram of it, entities and cardinality, don't bother with every column.\n\nCREATE TABLE patient (\n  patient_id BIGINT PRIMARY KEY,\n  nhs_number CHAR(10) UNIQUE,\n  born_on DATE NOT NULL\n);\nCREATE TABLE vaccine (\n  vaccine_id INT PRIMARY KEY,\n  brand TEXT NOT NULL,\n  disease TEXT NOT NULL\n);\nCREATE TABLE batch (\n  batch_id TEXT PRIMARY KEY,\n  vaccine_id INT REFERENCES vaccine(vaccine_id),\n  expires_on DATE\n);\nCREATE TABLE administration (\n  admin_id BIGINT PRIMARY KEY,\n  patient_id BIGINT REFERENCES patient(patient_id),\n  batch_id TEXT REFERENCES batch(batch_id),\n  given_at TIMESTAMPTZ DEFAULT now(),\n  site TEXT CHECK (site IN ('left arm', 'right arm', 'thigh')),\n  dose_number SMALLINT NOT NULL,\n  UNIQUE (patient_id, batch_id, dose_number)\n);",
  },
  {
    id: "rep-meet-timetable-join-table",
    category: "general",
    inputMode: "dictated",
    useCase: "meeting",
    scenario:
      "school timetabling: working out live that two join tables are needed, not one",
    expectedType: "erDiagram",
    phenomena: [
      "no-punctuation",
      "run-on",
      "no-type-keyword",
      "long",
      "self-correction",
      "multi-speaker",
    ],
    notes:
      "Replaces meet-er-many-to-many. Same activity, working out a join table in the room, but at length the working is visible: the speaker proposes one join table, a second voice points out the room clash, and the model ends with two join tables and a period entity that did not exist at the start. Only the end state is the answer, which is the l0 rule this entry exists to test. The exchange about the mock exam week is not schema.",
    text: "right timetabling so we have students and we have courses and a student takes several courses and a course has several students so thats a join table enrolments student id course id and thats fine thats the easy bit and we have teachers and a teacher teaches several courses and hang on can a course have two teachers yes it can we do co teaching in year twelve ok so thats another join not a column on courses so course teachers course id teacher id now the problem is that none of that has told us when anything happens because a course isnt a thing that happens a course is a thing that exists so we need a period and a period is a day and a slot so period id day of week slot number and theres forty of them in a week and then the thing that actually happens is a course meeting in a room in a period with a teacher and thats not enrolments and its not course teachers its a third thing so lets call it a session session id course id period id room id teacher id and one course has many sessions across the week and one period has many sessions because lots of things happen at the same time in different rooms and thats fine but yes exactly you cant have two sessions in the same room in the same period so thats a unique constraint on room and period and equally you cant have the same teacher in two rooms at once so thats a unique on teacher and period and actually you cant have a student in two places either but the student isnt on the session row the student is on enrolments so that clash is a join away and thats going to be the slow query so we do need rooms as a table room id name capacity and a type because you cant put a chemistry class in a normal room and courses needs a required room type so the solver can match and students needs a form group which is another table because form groups have a tutor and a base room so the count is students courses teachers rooms periods form groups and then enrolments course teachers and sessions and sessions is the one that carries all the constraints and the earlier idea of one big join table was wrong because it was trying to be enrolment and scheduling at the same time and those change on completely different rhythms enrolment changes twice a year and the timetable changes weekly when someone is off and can we not do this in mock week please because half of us are invigilating",
  },
  {
    id: "rep-meet-flight-planning-layers",
    category: "swe",
    inputMode: "dictated",
    useCase: "meeting",
    scenario: "arguing about the layering of a flight planning desktop app",
    expectedType: "classDiagram",
    phenomena: [
      "no-punctuation",
      "run-on",
      "no-type-keyword",
      "long",
      "self-correction",
    ],
    notes:
      "Replaces meet-class-service-layer. Layering again, but the content is a rule about which direction references may point, which is what makes it a class diagram rather than a flowchart of a request. The violation named at the end is an existing edge that should not exist and belongs on the diagram, because leaving it off draws the intended design rather than the real one.",
    text: "so the layering argument again lets just settle it on paper the bottom is the data layer the bottom is the data layer and thats the nav database reader the aircraft performance tables and the weather client and none of those know anything about flight plans they return rows and structures above that is the domain layer or the model layer whatever you want to call it and that is where flight plan lives and a flight plan has a route which is a list of legs and a leg has a from waypoint a to waypoint an altitude and a planned speed and flight plan has methods on it total distance total fuel and validate and validate is the interesting one honestly its the only interesting one because it needs the performance tables so flight plan depends on the data layer which is allowed downward is always allowed then the service layer well the application layer has the planner which builds a flight plan from a departure a destination and a set of preferences and the filer which turns a flight plan into the filing format and sends it and the planner depends on flight plan and on the nav reader and the filer depends on flight plan only then the ui layer on top and the ui depends on the services and on the domain and nothing in the domain or the services may reference anything in the ui and thats the rule and the reason im labouring it is that flight plan currently has a method called show conflicts that pops a dialog and that is a domain object reaching into the ui and it needs to come out but while it is there it goes on the diagram because otherwise were drawing the design we wish we had",
  },
  {
    id: "rep-creator-animation-state-machine",
    category: "swe",
    inputMode: "dictated",
    useCase: "creator",
    scenario:
      "tutorial on a character animation state machine, transitions with conditions",
    expectedType: "stateDiagram-v2",
    phenomena: [
      "no-punctuation",
      "run-on",
      "no-type-keyword",
      "long",
      "self-correction",
    ],
    notes:
      "Replaces creator-react-render-states. Keeps the role of being the state machine people actually draw, and adds guarded transitions with named conditions, which is where a model either labels the edges or produces an unreadable mesh. The any-state interrupt to hit reaction is stated once and is the transition a hurried answer omits because it does not fit a chain.",
    text: "right so the locomotion state machine and everything ill say here applies whatever engine youre in so we start in idle and idle plays the breathing loop and from idle we go to walk when the input magnitude goes above about point two ish and from walk to run when it goes above point eight and both of those come back down the same way with a bit of hysteresis so you dont flicker on the boundary and hysteresis just means the threshold coming down is lower sorry the threshold going up is higher than the threshold coming down from any of idle walk or run you can go to jump when the jump button is pressed and grounded is true and grounded is the important half of that condition because otherwise you get double jumps for free jump goes to fall automatically when the vertical velocity turns negative and fall goes to land when grounded becomes true again and land is a short state it plays a recovery and exits to idle or straight to walk if the player is still holding a direction because otherwise it feels sticky and then theres the one people forget from anywhere at all including mid jump you can go to hit reaction when you take damage and hit reaction goes back to fall if you were airborne or to idle if you were grounded and thats not a transition from one state its a transition from all of them and if youre in an engine that makes you draw every arrow by hand thats twelve arrows and youll want to group it and theres also dead which you can reach from anywhere and never leave",
  },
  {
    id: "rep-chat-recycling-add-branch",
    category: "general",
    inputMode: "typed",
    useCase: "chat",
    scenario:
      "second turn: adds a branch and renames a node on a diagram already drawn",
    expectedType: "flowchart",
    phenomena: [
      "refinement",
      "deictic-reference",
      "real-punctuation",
      "no-type-keyword",
      "long",
    ],
    notes:
      "Replaces refine-2-add-a-branch. The original was nine words and the whole diagram had to survive; this is seventy, and the added risk is that it now contains enough nouns to look like a fresh request. Nothing in this turn says what the process is, so a model that rebuilds from this text alone produces a three-node diagram about contamination and loses everything else. `the sorting one` and `that last box` both point at the canvas.",
    text: 'Three things. Add a branch off the sorting one for contaminated loads - if the bale fails the visual check it goes to reject and then to landfill, and label that edge "contaminated". Also rename that last box, it should say "baled and weighed", not just "baled". And the arrow between the top two is the wrong way round, that was me describing it badly, so flip it. Everything else stays as it is, don\'t move things around.',
  },
  {
    id: "rep-chat-container-customs-states",
    category: "swe",
    inputMode: "typed",
    useCase: "chat",
    scenario: "clean typed request for the customs status of a container",
    expectedType: "stateDiagram-v2",
    phenomena: ["strong-keyword", "real-punctuation", "fragile-chars", "long"],
    notes:
      "Replaces chat-state-first-turn. Same clean typed opening, and the same structural trap in a different form: `held` is reachable from three named states and returns to whichever it came from, which needs six edges rather than the two a chain would produce. The slashes, parentheses and the quoted status name are literal characters this channel delivers and dictation cannot.",
    text: "Draw a state diagram for a shipping container's customs status. States: Manifested, Arrived, \"Under Examination\", Cleared, Released, Held. Manifested -> Arrived on vessel berthing. Arrived -> Under Examination if it's selected for scan (about 4%), otherwise Arrived -> Cleared. Under Examination -> Cleared or -> Held. Cleared -> Released once duty/VAT is paid. Held can be entered from Arrived, Under Examination or Cleared, and returns to whichever state it came from once the query is resolved. Released is final.",
  },
  {
    id: "rep-teach-mass-balance",
    category: "general",
    inputMode: "dictated",
    useCase: "teaching",
    scenario:
      "process engineering class: the general balance, then a worked reactor example",
    expectedType: "flowchart",
    expectedTypes: ["flowchart", "flowchart"],
    multiFrom: "medium",
    phenomena: [
      "no-punctuation",
      "run-on",
      "no-type-keyword",
      "analogy",
      "multi-diagram",
      "long",
      "self-correction",
    ],
    notes:
      "Replaces teach-double-entry-accounting. Same underlying idea, every effect is paired, in a different discipline. Two flowcharts, the abstract balance and the worked unit, and medium rather than low because one chart with both would technically hold them. The bathtub is explicitly called an analogy and is not a fence. The recycle stream is stated once and is the edge that makes the second chart a cycle instead of a line.",
    text: "ok mass balance and the reason im spending a whole session on something that is arithmetic is that everything else this year rests on it so the general statement first what goes in either comes out or accumulates inside or gets consumed by reaction and there is no fourth option right atoms do not vanish so in equals out plus accumulation plus consumption minus generation and if youre at steady state accumulation is zero which is the case we will use for the next six weeks obviously and if theres no reaction consumption and generation are both zero and youre left with in equals out which is basically the version most of you already believe think of a bath with the tap running and the plug out if the level is steady the tap is exactly matching the drain and if you turn the tap up the level rises and the drain rate rises with it until they match again thats accumulation going positive and then back to zero im not drawing the bath its just so you have something physical in your head right now the worked one lets do a stirred tank reactor making an ester so you have two feed streams coming in one is the acid one is the alcohol and they both go into the mixer and out of the mixer is a single combined stream into the reactor and the reactor also has a catalyst feed which is small and which we still have to count and out of the reactor you have one stream containing product unreacted acid unreacted alcohol water and catalyst and that goes to the separator and the separator gives you two streams overhead which is your product plus some water and bottoms which is the unreacted stuff plus the catalyst and now the bit that makes it interesting ok the bottoms do not leave the process the bottoms go back round and join the mixer inlet and thats the recycle and once you have a recycle you have to be very careful about what you mean by conversion because the conversion per pass through the reactor is low and the overall conversion across the whole process is high and those are two different numbers and honestly half of you will use the wrong one in the exam and the overhead goes to a drier and out of the drier is product and a small water stream that leaves and thats your only real exit apart from the purge and yes we need a purge on the recycle sorry i should have said that when i drew the recycle if you recycle without purging anything inert accumulates forever so a small fraction of the bottoms is bled off before the recycle joins the mixer so on the second picture the boxes are mixer reactor separator drier and the arrows are the streams and every box balances on its own and the whole thing balances as well and if you draw the envelope around the whole process the recycle is inside it and does not appear at all which is the neatest thing in the entire subject",
  },
  {
    id: "rep-misfire-poolside-drill",
    category: "general",
    inputMode: "dictated",
    useCase: "misfire",
    scenario:
      "leisure centre staff room, mic left running while a drill is arranged",
    expectedType: null,
    outcome: "no-diagram",
    phenomena: [
      "not-a-request",
      "crosstalk",
      "multi-speaker",
      "no-punctuation",
      "long",
      "self-correction",
    ],
    notes:
      "Replaces misfire-lunch-order. Ten times the length and much closer to the line: three voices agreeing an evacuation procedure with real steps, real roles and a real decision, and not one word asking for it to be drawn. That is the distinction being measured. Describable structure is not a request for a diagram, and every keyword a detector looks for is present here. The correct answer is still nothing.",
    text: "is it half nine or ten because the timetable says ten but dean told the lifeguards half nine its ten the notice went up on friday right so when the alarm goes the lifeguards clear the water first thats the whole point of doing it at ten because the aqua class is out by then and then everybody goes out through the fire door by the sauna not through reception i know but thats not what the drill says the drill says the sauna door well then somebody needs to actually update it because we have been doing it the other way for two years no hang on if the pool hall goes out through the sauna and the gym goes out through the fire escape at the back they both end up in the same bit of the car park and thats fine thats where the assembly point is who does the roll call is it duty manager duty manager yes and reception brings the list out and if somebody is missing then what you dont go back in you tell the fire service is anyone doing the tea",
  },
  {
    id: "rep-solo-peer-review-states",
    category: "general",
    inputMode: "dictated",
    useCase: "solo",
    scenario:
      "journal editor talking through what happens to a manuscript, never naming a diagram type",
    expectedType: "stateDiagram-v2",
    phenomena: [
      "no-punctuation",
      "run-on",
      "no-type-keyword",
      "long",
      "self-correction",
      "trails-off",
    ],
    notes:
      "Replaces trap-state-real-but-buried. A real state machine with the word never spoken, at ten times the length, and the burial is worse: the text is full of people doing things, which reads as a process, and every one of those actions is a trigger on a transition of one manuscript. The desk reject, the withdraw and the two revision routes all leave from the same state, which is the fan-out a chain cannot express. The complaint about reviewer availability in August is not structure.",
    text: "let me just talk this through so i can see it a manuscript arrives through the portal and the first thing is right its with the editorial office and theyre checking the formatting the ethics statement the data availability statement and whether the figures are actually legible and if any of that is wrong it goes back to the author well back to the corresponding author and sits there until they fix it and honestly some of them never do and after ninety days we treat that as withdrawn so once it passes that check its with me and im deciding whether to send it out at all and a good third of them i desk reject a good third maybe more and desk reject is the end theres no appeal in practice if i do send it out it goes to reviewer invitation and that is genuinely the worst part of my job because i invite six and two say yes and three dont answer and one says yes and then vanishes so it can sit in invitation for weeks so once i have two accepted reviewers it moves to under review and under review means the clock is running and theyve got twenty one days and when both reports are in it comes back to me and now theres a real fan out from there ok because i can accept outright which almost never happens obviously i can ask for minor revision i can ask for major revision or i can reject and if its minor revision the author sends it back and i look at it myself and its usually accept and if its major revision the author sends it back and it goes out to the same reviewers again if theyll take it which puts it back in under review and thats the loop that makes this awkward to draw because major revision goes back to a state its already been in and the manuscript can go round that twice and after twice i just make a decision either way anyway because it isnt fair to keep them hanging and from accepted it goes to production and production is copyediting then proofs then the author checks the proofs and then its published and published is the end and separately at almost any point before acceptance the author can withdraw and thats an end too and after publication theres retraction which i genuinely hope not to use but it exists and it is reachable from published and its the only thing that is and honestly the whole shape is fine its just that august exists and nobody reviews anything in august",
  },
  {
    id: "rep-solo-freight-class-tariff",
    category: "general",
    inputMode: "dictated",
    useCase: "solo",
    scenario:
      "haulage rating model where class means a rate band, not a type in code",
    expectedType: "erDiagram",
    phenomena: [
      "weak-keyword-misuse",
      "no-punctuation",
      "run-on",
      "no-type-keyword",
      "long",
    ],
    notes:
      "Replaces trap-class-meaning-ticket-class. Same trap, more of it: `class` appears five times and every one means a freight rate band. Last-match type detection returns classDiagram; a human returns erDiagram, and the two are close enough that the wrong answer looks nearly right until you notice it has drawn rate bands as types with inheritance. The columns, the effective dates and the join through the tariff line are what settle it.",
    text: "right the rating model as it needs to be so a customer has an account and an account has a contract and a contract has a start and an end and a payment term then consignments a consignment has an id an account id a collection depot a delivery postcode a piece count a gross weight a volume and a class and the class is the freight class which is a band from one to eleven and it comes off the commodity and the density so its derived at booking time and then stored because if the tariff changes we still need to know what class it was rated at on the day then the tariff a tariff has an id a name a valid from and a valid to and then tariff lines and a tariff line is the actual money so tariff id class weight break from weight break to and a rate per kilo and one tariff has a lot of lines because its eleven classes times about six weight breaks and one class appears in many tariff lines across many tariffs then contracts point at a tariff and can also have overrides so theres a contract override table with a contract id a class and a discount percentage and one contract has many overrides one per class at most then the charge on the consignment is a lookup find the tariff for the contract on that date find the line matching the class and the weight break apply the override for that class if there is one and add the surcharges and surcharges is its own table with a code a basis and an amount and a join to the consignment because you can have several so tail lift plus timed delivery plus fuel and fuel is a percentage of the base which is why the order of application matters",
  },
  {
    id: "rep-solo-herbarium-specimen-model",
    category: "general",
    inputMode: "dictated",
    useCase: "solo",
    scenario: "herbarium specimen model, defensible as either shape",
    expectedType: null,
    phenomena: ["no-punctuation", "no-type-keyword", "run-on", "long"],
    notes:
      "Replaces er-vs-class-both-defensible, and is the only entry in this file that is null with a normal diagram outcome. Attributes and a containment relationship, no methods and no inheritance, and no storage vocabulary at all: nothing says table, column, row or key, and nothing says class, extends or method. erDiagram and classDiagram are both right and scoring must accept either, or the entry punishes a correct answer.",
    text: "right so the specimen model a sheet has an accession number a collector a collector number a collection date and a locality and the locality has a latitude a longitude an elevation and a free text description well the elevation is blank more often than not and the locality belongs to the sheet it is not shared between sheets even when two people collected in the same field then a sheet carries one or more determinations and a determination has a name a determiner a date and a status and the current name of the specimen is whichever determination is most recent and the earlier ones stay because they are part of the history and a sheet also has images and an image has a resolution a colour target and a capture date",
  },
  {
    id: "rep-solo-policy-hierarchy-corrupted",
    category: "swe",
    inputMode: "dictated",
    useCase: "solo",
    scenario:
      "insurance policy type hierarchy, the structural words heard wrong",
    expectedType: "classDiagram",
    phenomena: [
      "asr-corruption",
      "no-punctuation",
      "no-type-keyword",
      "run-on",
      "long",
      "self-correction",
    ],
    notes:
      "Replaces class-corrupted-glass. Same idea, wider damage: `subclass` comes through as `sub glass`, `inherits` as `in herits`, `abstract` as `a stract`, and `override` survives intact, which is the one word left that says this is a type hierarchy at all. The structure is fully recoverable from the fields and the overriding, which is the point.",
    text: "ok so the policy types theres a base thing called policy and its a stract you never make one directly and it holds the policy number the inception date the expiry date the premium and the excess and it has a method called calculate premium which is empty on the base well not empty it throws then motor policy in herits from policy and adds the registration the vehicle value and the ncd years and it does override calculate premium then home policy in herits from policy as well and adds the property value the rebuild cost and the postcode band and it overrides calculate premium too and then under home policy theres a sub glass called landlord policy which adds the number of tenancies and a loss of rent limit and it overrides calculate premium again calling the parent version first and adding to it and separately theres travel policy which comes off the base and adds a destination zone a trip length and a medical declaration flag and it does not override anything it uses the base one which is currently empty and that is a bug",
  },
  {
    id: "rep-chat-paste-farm-telemetry-spec",
    category: "swe",
    inputMode: "pasted",
    useCase: "chat",
    scenario:
      "pastes a webhook contract from a farm sensor vendor and asks for the call order",
    expectedType: "sequenceDiagram",
    phenomena: [
      "code-paste",
      "strong-keyword",
      "real-punctuation",
      "fragile-chars",
      "long",
    ],
    notes:
      "Replaces paste-openapi-fragment. Same channel, same hazards, different shape: the fragile characters here are braces, a colon-prefixed path parameter, an arrow made of characters, and a `#` in a comment, which starts a comment in some mermaid contexts and is the visibility marker in classDiagram. The registration call and the callback go in opposite directions between the same two parties, which is what makes it a sequence.",
    text: 'Turn this into a sequence diagram - who calls who, in order.\n\n# Vendor: Fieldsense v2 (draft)\nPOST /v2/subscriptions            {"farm_id": 42, "callback": "https://..."}  -> 201 {"sub_id": "..."}\nGET  /v2/devices/:device_id       -> 200 {"battery": 91, "last_seen": "..."}\nWEBHOOK POST <your callback>      {"sub_id": "...", "device_id": "...", "moisture": 0.31}\n  - we retry 3x (30s/5m/1h) unless you answer 2xx\n  - respond 410 to have the subscription torn down',
  },
  {
    id: "rep-solo-ev-charging-session",
    category: "swe",
    inputMode: "dictated",
    useCase: "solo",
    scenario: "the states an EV charging session goes through, clearly spoken",
    expectedType: "stateDiagram-v2",
    phenomena: ["no-punctuation", "run-on", "no-type-keyword", "long"],
    notes:
      "Replaces cov-state-asr-transitions, which was tagged asr-corruption while its own notes said nothing in it was corrupted. This one is honestly labelled: clean audio, no corruption, so it is a control for any corrupted state entry rather than for one specific partner. Six states, two of them reachable only on failure, and the suspended-by-vehicle case that returns to charging on its own.",
    text: "ok so the session states available is the resting state nothing plugged in and from available we go to occupied when the cable is inserted and the connector is locked and occupied is not charging yet nothing is flowing from occupied we go to authorising when the driver taps a card or the app sends a start and authorising either succeeds and we go to preparing or it fails or it times out which we count as a fail and we go back to occupied with a message on the screen preparing is the handshake with the vehicle and it takes a few seconds and from preparing we go to charging and charging is where the energy actually moves and from charging we can go to suspended and suspended has two flavours suspended by the vehicle which is the car deciding it is full enough for now and that one comes back to charging on its own and suspended by the charger which is us curtailing for grid reasons and that one comes back when we say so from charging or from suspended we go to finishing when the driver stops it or the vehicle stops drawing and finishing unlocks the connector and from finishing we go to available once the cable is out and separately from almost any state we can go to faulted and faulted needs a reset either remote or someone physically pressing the button and faulted goes to available",
  },
  {
    id: "rep-solo-roastery-batch-line",
    category: "general",
    inputMode: "dictated",
    useCase: "solo",
    scenario: "a coffee roasting batch from green bean to pallet, no branches",
    expectedType: "flowchart",
    phenomena: ["no-punctuation", "run-on", "long", "self-correction"],
    notes:
      "Replaces swe-ci-pipeline, and keeps the job that entry was doing: it is the plain linear baseline the corpus header says #47 needs something ordinary to measure. Still linear, no decisions, no fan-out, just longer, so it measures whether a straight chain survives four hundred words rather than thirty-five. If a model invents branches here it is inventing them.",
    text: "right so the batch sheet in order green beans come out of the store and get weighed into the hopper and the weight is recorded against the batch number then the roaster is brought up to charge temperature and the charge temperature is set by the profile for that origin well by the profile for that origin and the batch size and then the beans drop into the drum and thats the charge and the clock starts from there its the profile doing the work the gas comes down as the beans absorb heat and the temperature dips and then starts climbing again and that low point is the turning point and its recorded then it runs through the drying phase and then the maillard phase and then first crack and first crack gets timed and then the development time runs from first crack to drop and the ratio of those two is the number everyone argues about then the beans drop into the cooling tray and the agitator runs and they need to be under forty degrees within four minutes sorry within three we tightened that in june then they go into the destoner which pulls out anything that isnt a bean and there is always something then into the degassing bin and they sit there for a minimum of twelve hours because if you bag them straight off the roaster the bags inflate and split and then theyre weighed into bags and the bags get a valve and a label and the label carries the batch number the roast date and the origin then the bags go into cases and the cases go onto a pallet and the pallet gets a sheet and goes to the loading bay and thats the batch done and every step writes to the same batch record so at the end you can pull one number and see the whole thing",
  },
  {
    id: "rep-chat-radio-playout-labels",
    category: "general",
    inputMode: "typed",
    useCase: "chat",
    scenario:
      "radio hour clock typed with brackets and times inside the labels",
    expectedType: "flowchart",
    phenomena: ["real-punctuation", "fragile-chars", "long"],
    notes:
      "Replaces typed-parens-in-names. Same fragile characters, more of them and more varied: parentheses, a colon, an at sign, a slash and a pipe, all inside label text where they have to be quoted rather than escaped away. #46 measured an unquoted parenthesis killing the whole diagram, not one node, so this fails wholesale or not at all.",
    text: "Make me a flowchart of the hour clock, left to right: Top of hour News (3:00) -> Sting -> Travel/Weather (0:45) -> Music bed A -> Link (live) -> Ad break 1 (2:00) -> Music bed B -> Feature @ :30 -> Ad break 2 (1:30) -> Music bed C -> Back-anno | promo -> Handover (0:20). Keep the times in the labels exactly as written.",
  },
  {
    id: "rep-creator-appointment-schema-before-after",
    category: "swe",
    inputMode: "dictated",
    useCase: "creator",
    scenario:
      "database design video: the appointment schema as inherited, then as rebuilt, both shown",
    expectedType: "erDiagram",
    expectedTypes: ["erDiagram", "erDiagram"],
    multiFrom: "low",
    phenomena: [
      "multi-diagram",
      "no-punctuation",
      "run-on",
      "long",
      "self-correction",
    ],
    notes:
      "Replaces multi-two-schemas-compared, and changes the use case to creator, the third of the three erDiagram creator entries the corpus lacked. `show both of these on screen` makes two fences required rather than a High nicety, and two fences of the same type is the case people collapse into one. The slot-versus-appointment split is the whole content of the second model and does not exist in the first. The remark about the client's NDA is not schema.",
    text: "right this is the one youve all been asking for the appointment booking schema and im going to show both of these on screen at the same time the one they had and the one we ended up with because the difference is the entire video so what they had was one table called appointments and it had an appointment id a patient id a clinician id a start time an end time a room a status a reason for visit and a cancelled reason and thats it and it worked for about two years and then it stopped and heres why the first thing is a clinician doesnt just have appointments a clinician has availability and availability exists whether or not anyone has booked it and in that model there is nowhere to put availability so they were creating placeholder appointment rows with a patient id of zero and if you have ever seen a magic value in a foreign key column you know what happened next second thing a room is a string and there are eleven rooms and they are spelled four different ways in the data third thing an appointment can be for two clinicians a doctor and an interpreter and there is one clinician id column so they made a second appointment row for the interpreter and now cancelling one does not cancel the other so heres the rebuild we split it into slot and appointment and this is the key move a slot is a piece of a clinicians diary it has a slot id a clinician id a start a duration a room id and a slot type and it exists on its own an appointment is a booking against a slot so it has an appointment id a slot id a patient id a reason and a status and the appointment is optional so a slot with no appointment is availability and that magic patient id is gone rooms becomes its own thing room id name capacity and a type and slot points at it clinicians becomes its own thing obviously with a role and then for the two clinician problem theres an appointment participant table with an appointment id a clinician id and a role so the doctor and the interpreter are two rows against one appointment and cancelling the appointment cancels both by definition and then status i want to say status lives on the appointment and actually it needs to be in two places because a slot can be blocked without an appointment ever existing so slot has a state and appointment has a state and they are different vocabularies and yes that is more tables and every one of them is answering a question the first model could not answer at all i cant tell you who the client was theres an nda but you can probably guess from the room names",
  },
  {
    id: "rep-solo-drone-classes-and-states",
    category: "swe",
    inputMode: "dictated",
    useCase: "solo",
    scenario:
      "survey drone fleet: the object model, and the flight state one of them carries",
    expectedType: "classDiagram",
    expectedTypes: ["classDiagram", "stateDiagram-v2"],
    multiFrom: "low",
    phenomena: [
      "multi-diagram",
      "no-punctuation",
      "run-on",
      "long",
      "self-correction",
    ],
    notes:
      "Replaces multi-class-and-state-of-one. The classes and then the states one class carries, same split. The flight mode field is named as an enum in the first half and expanded into a machine in the second, which is precisely the seam: the field is not the machine and drawing it as an attribute loses every transition.",
    text: "ok so the fleet model theres an aircraft class with a serial a model an airframe hours a battery cycles count and a current flight mode and a method for pre flight check well two methods theres the pre flight check and a post flight log then theres a mission class with a mission id an aircraft a pilot a survey area a planned altitude and a list of waypoints and a waypoint has a latitude a longitude an altitude and an action and the action is photo or hover or nothing and mission has methods estimate duration and validate against airspace then theres a pilot class with a licence number a currency date and a list of type ratings and an aircraft model requires a type rating so theres a check between them and then payload is its own hierarchy with a base payload class holding a mass and a mount type and then rgb camera and multispectral camera and lidar unit all inheriting from it and each adds its own fields and an aircraft has one payload fitted at a time now the flight mode i mentioned on aircraft that is a whole machine on its own it starts at disarmed and disarmed goes to armed when the pilot arms it and the pre flight passes and armed goes back to disarmed after thirty seconds of nothing happening sixty now actually armed goes to takeoff and takeoff goes to hover and hover goes to auto when the mission is engaged and auto goes back to hover when the pilot takes the sticks and from hover or auto you can go to return to home which is triggered either by the pilot or automatically by low battery or by losing the link and return to home goes to landing and landing goes to disarmed and theres also failsafe which is reachable from anything airborne and goes to landing immediately",
  },
  {
    id: "rep-meet-transit-two-topics-crosstalk",
    category: "general",
    inputMode: "dictated",
    useCase: "meeting",
    scenario:
      "transit authority operations meeting covering two unrelated processes with a side conversation across the seam",
    expectedType: "flowchart",
    expectedTypes: ["flowchart", "flowchart"],
    multiFrom: "low",
    phenomena: [
      "multi-diagram",
      "crosstalk",
      "multi-speaker",
      "no-punctuation",
      "run-on",
      "long",
      "self-correction",
      "trails-off",
    ],
    notes:
      "Replaces multi-topic-drift-with-crosstalk. Two unrelated processes, gate faults and depot turnaround, and the side conversation about the union meeting starts inside the first topic and finishes inside the second, so the crosstalk straddles the seam rather than sitting neatly between the two. That is the hard part: the boundary is a topic change, not a pause. Three voices. The revision on the fault threshold from three to five is real content; the union exchange and the closing bit about the new signage supplier are not.",
    text: "ok so two things this morning gate faults and depot turnaround and theyre nothing to do with each other so gate faults first the way it works now a gate goes down and there are three ways we find out the gateline staff see it and radio it in the gate reports itself over the network because they do self report now most of them or a passenger complains at the window and honestly the self report is the one we trust least because it fires on paper jams that clear themselves so whichever way it comes in it lands with the station supervisor and the supervisor does a first look which is basically is the coin box full is there paper is something obviously jammed in the throat and about half of them are fixed right there and never go any further if the supervisor cant fix it they raise a job on the maintenance system and the job gets a priority and priority is driven by how many gates are down at that station not by how long its been broken so one gate down at a station with twelve gates is a low priority and one gate down at a station with two gates is urgent then the job goes to the regional technician who is covering maybe eleven stations and they attend and either fix it on site or swap the unit for a spare and take the broken one back to the workshop and if a station drops below a certain number of working gates we open the gateline which means everybody walks through free and that is a revenue decision not a maintenance one so it goes to the duty controller not to the technician and the other thing on the gate side that nobody ever writes down is the spares pool because the technician can only swap a unit if theres a spare at the workshop and the spares come from units weve already repaired so it is a loop and when the loop runs dry which it does every february because of the salt everything becomes a fix on site job and the attend times double and if a unit cant be repaired at all it goes back to the manufacturer for exchange and thats a six week round trip and we have eleven out with them right now and the contract says fifteen working days which has never once happened sorry is the union thing at eleven or twelve twelve i think in the boardroom no its been moved to the annexe because theyre doing the floor in the boardroom and is anyone from our side actually going because if not theyll minute whatever they like right and the threshold for opening the gateline used to be three working gates and its five now since the january review so five yes so second thing depot turnaround completely separate this is buses this is nothing to do with gates a bus comes back into the depot at the end of a duty and the driver parks it on the arrival lane and takes the ticket machine out and the ticket machine goes to the docking rack in the office and that downloads the days data and charges it overnight then the bus goes through the wash and the wash is automatic but somebody has to drive it through and thats the shunter and after the wash it goes to refuelling and the refuel is metered against the fleet number and then to the pit if it is due an inspection and the inspection interval is by mileage not by date and the mileage comes off the download from the ticket machine which is the only place those two things connect and that connection is a report not a system if it does not need an inspection it goes straight to the parking apron and gets allocated to a duty for the morning and the allocation is done by the depot supervisor at about ten at night and if a bus fails the inspection it goes to the workshop lane and it comes out of the allocation pool and the supervisor has to find a spare and we run about eight percent spares which is not enough on a bad week and if the wash is broken which it is roughly monthly the buses skip it and go straight to refuelling and we do them by hand at the weekend and the other thing on the depot side is the defect book so if a driver reports a defect during the day it goes in the book at the end of the duty and the book is a paper book still and the engineering foreman reads it in the morning and decides whether that bus goes out or not and that decision happens after the allocation not before so the supervisor allocates a bus at ten at night and the foreman pulls it at six in the morning and nobody has told the running board and thats the single biggest cause of a missed first departure and yes weve talked about doing the book electronically for four years and the reason we havent is that the tablets do not survive a bus was there anything else oh the signage supplier came back with the quote and its double so we are going out to tender again",
  },
  {
    id: "rep-interview-batch-to-streaming",
    category: "swe",
    inputMode: "dictated",
    useCase: "interview",
    scenario:
      "candidate describes the nightly batch a bank runs today, then the streaming design that replaces it",
    expectedType: "flowchart",
    expectedTypes: ["flowchart", "flowchart"],
    multiFrom: "low",
    phenomena: [
      "multi-diagram",
      "no-punctuation",
      "run-on",
      "long",
      "self-correction",
      "crosstalk",
    ],
    notes:
      "Replaces multi-before-after-monolith-split. Before and after, two charts, and the second is not a redraw of the first: the cutover period where both run and are compared is described as a third thing that lives on the second chart only. The interviewer's question about ordering is crosstalk and its answer is content. The candidate revises the window from midnight to eleven.",
    text: "ok so the current shape is a nightly batch and let me draw that first because the constraints all come from it so at close of business the core banking system produces a set of extract files one per product so current accounts savings loans cards and those land on an ftp server sftp now but it was ftp for years and they land at different times which is the first problem right the cards one is usually two hours after the others then a scheduler basically waits for all of them to be present and if one is missing at a cut off which is midnight sorry eleven it runs anyway with what it has and flags it once theyre all there it runs a loader that parses each file and writes into staging tables and then a transformation job runs which joins them and works out the balances sorry the positions and then a reconciliation step compares the totals against a control file that core banking also sends and if the totals dont match the whole thing stops and somebody gets called at three in the morning obviously and if they do match it publishes the warehouse tables and then the reporting jobs run off that and finance has their numbers by about six in the morning on a good day honestly on a good day right now the target shape core banking emits an event per transaction onto a log and the events carry the account the amount the type and a timestamp and a sequence number per account yeah ordering only matters within an account not globally which is what makes this tractable a stream processor consumes that log and maintains the position per account as running state and the position is available continuously not once a day i mean continuously and the same processor emits a position changed event downstream and then theres a materialiser that writes the current positions into a serving store that reporting reads and separately the raw event log is archived to object storage for replay because if the processor logic is wrong you rebuild from the log rather than asking core banking for the files again and the reconciliation still exists it just changes shape core banking still emits a control total at end of day and the processor compares its computed total against it and raises an alert on a mismatch instead of stopping everything and the third thing which only exists on the second picture is the cutover for about six months both run the batch and the stream and theres a comparator that reads yesterdays warehouse table and the streams position for the same instant and reports differences and that comparator is throwaway and honestly it is also the only reason anyone will trust the new one",
  },
  {
    id: "rep-interview-two-ticketing-clients",
    category: "swe",
    inputMode: "dictated",
    useCase: "interview",
    scenario:
      "candidate walks two different purchase paths for a live events platform",
    expectedType: "sequenceDiagram",
    expectedTypes: ["sequenceDiagram", "sequenceDiagram"],
    multiFrom: "low",
    phenomena: [
      "multi-diagram",
      "no-punctuation",
      "run-on",
      "long",
      "self-correction",
      "crosstalk",
    ],
    notes:
      "Replaces multi-two-sequences-different-clients. Two exchanges told one after the other, and they share the inventory service but nothing else, which is what makes them two fences rather than one with an alt. The box office path has a fallback the online path does not have, and the online path has a queue the box office path does not. The interviewer's question about the hold duration is crosstalk. The candidate corrects the hold from ten minutes to eight.",
    text: "ok so ill do the online purchase first and then the box office one because they look similar and they really arent so online the customer is on the event page and the page has already asked the inventory service for availability right by section not by seat because honestly seat level for a twenty thousand seat venue on sale is too much data to push so the browser asks for sections and gets counts then the customer picks a section and quantity and hits continue and now the browser goes to the queue service so this is the bit that only exists online at high demand you get a token and a position and you sit there and the queue service holds you and when it lets you through it hands you a signed entry token and then the browser calls the reservation service with that token and the section and the quantity and the reservation service calls inventory to actually take the seats and inventory returns specific seat ids and puts a hold on them and the hold is eight minutes sorry i said ten earlier its eight and reservation returns the seats to the browser and then the customer enters payment details and the browser calls the payment service which calls the provider and on approval payment tells reservation and reservation tells inventory to convert the hold into a sale and then the fulfilment service issues the tickets and emails them and if payment fails the browser can retry within the eight minutes and after that the hold expires and inventory releases the seats and nobody tells the customer which is basically a real problem in that design right now the box office one the operator is on a terminal in the venue and there is no queue at all the operator asks inventory directly for a seat map and they get every seat because its one terminal and they can have the data and the operator picks specific seats with the customer standing there and calls reservation with those exact seat ids and reservation calls inventory which either confirms or tells them somebody else took one and thats a real race obviously and the operator just picks again so then payment is a card terminal in the room so the terminal talks to the provider itself and returns an approval code to the till and the till passes that code to the payment service which verifies it and tells reservation and then the tickets print locally from the terminal not from fulfilment and the fallback which the online path does not have is that if the network to inventory is down the box office can sell from a pre allocated block that inventory has already carved out for them and it reconciles when the link comes back and that is why the box office has an allocation concept at all yeah",
  },
  {
    id: "rep-chat-paste-laundry-mermaid",
    category: "swe",
    inputMode: "pasted",
    useCase: "chat",
    scenario:
      "pastes an existing diagram of a laundry plant and asks for a second one beside it",
    expectedType: "flowchart",
    expectedTypes: ["flowchart", "stateDiagram-v2"],
    multiFrom: "low",
    phenomena: [
      "multi-diagram",
      "mermaid-paste",
      "fence-in-input",
      "real-punctuation",
      "refinement",
      "fragile-chars",
      "long",
    ],
    notes:
      "Replaces multi-paste-mermaid-and-ask-second. `leave that exactly as it is` means the pasted diagram is part of the answer, so a correct response echoes it unchanged and adds one, and the added one is a different type. The pasted fence contains a quoted label with a slash in it, which a repair pass is likely to rewrite even though it is already correct.",
    text: 'Leave that exactly as it is, and add a second diagram next to it for the state of an individual cage.\n\n```mermaid\nflowchart LR\n  A[Goods in] --> B[Sort by client]\n  B --> C["Wash / disinfect"]\n  C --> D[Tunnel dryer]\n  D --> E[Press]\n  E --> F[Pack by cage]\n  F --> G[Dispatch]\n```\n\nCage states: At client, In transit inbound, Received, In process, Packed, In transit outbound, Delivered. Received goes back to In transit inbound if it fails the weight check. Delivered goes to At client.',
  },
  {
    id: "rep-teach-hotel-booking-repeat",
    category: "swe",
    inputMode: "dictated",
    useCase: "teaching",
    scenario:
      "class on a booking system: the reservation exchange, then the data behind it, with one fact stated twice",
    expectedType: "sequenceDiagram",
    expectedTypes: ["sequenceDiagram", "erDiagram"],
    multiFrom: "low",
    phenomena: [
      "multi-diagram",
      "no-punctuation",
      "run-on",
      "long",
      "self-correction",
    ],
    notes:
      "Replaces multi-repetition-across-halves. The same relationship, one guest to many stays, is asserted in the call half and again in the data half, and it belongs only in the ER diagram. Restating it is the trap: a model that treats the second mention as new content adds a lifeline for something that is not a party. The overbooking policy is mentioned in the first half and has no home in the second.",
    text: "right ok the booking system and im doing the conversation first and the data second so the conversation the guest is on the site and picks dates and the site asks the availability service for what is free for those dates and availability answers with room types not rooms and thats deliberate right you never sell a specific room online you sell a type then the guest picks a type and a rate and hits book and the site calls the reservation service and reservation calls availability again to decrement so this second call is the one that matters because the first was a read and could be stale and if availability says no because somebody got there first the guest gets sent back and thats a genuinely bad moment in the product so if availability says yes reservation writes the booking and calls the payment service to take a deposit and if the deposit fails reservation calls availability to put the room back and cancels the booking and if it succeeds reservation sends a confirmation to the messaging service which emails the guest and note that a guest can do all of this many times a year i mean many times a year so one guest ends up with many bookings which well come back to and separately the property management system at the hotel polls reservation every few minutes for new arrivals for tomorrow and thats basically how the front desk knows anything and on the night before the night audit runs and assigns actual room numbers to bookings and that is the first moment a physical room is involved at all and we deliberately overbook by about four percent well four is the number they gave us its probably higher on the assumption of no shows which is a policy not a diagram anyway right now the data side guests has a guest id a name an email a phone and a loyalty number and one guest has many bookings as i said properties has a property id a name an address and a star rating and room types has a type id a property id a name a capacity and a base rate and one property has many room types obviously and rooms has a room id a property id a type id and a floor and one room type has many rooms and a booking has a booking id a guest id a property id a type id a check in date a check out date a rate a status and a deposit reference and note the booking points at the type and not at a room and then theres a room assignment table with a booking id a room id and a date and its per date because a long stay can move rooms and rates has a rate id a type id a date and a price because the price is per night not per booking and one room type has many rates one per date and honestly thats the table that gets enormous",
  },
  {
    id: "rep-teach-reservoir-states-and-flow",
    category: "general",
    inputMode: "dictated",
    useCase: "teaching",
    scenario:
      "hydro scheme: the reservoir's operating states, and the path the water takes",
    expectedType: "stateDiagram-v2",
    expectedTypes: ["stateDiagram-v2", "flowchart"],
    multiFrom: "low",
    phenomena: [
      "multi-diagram",
      "no-punctuation",
      "run-on",
      "long",
      "self-correction",
    ],
    notes:
      "Replaces multi-water-cycle-states-and-flow. States of one thing plus the route something takes through equipment, same pairing, and the primary is the state machine because that is what is described first and in most detail. The pumped storage path reverses the direction of the second diagram and is stated once.",
    text: "right so the scheme has two things worth drawing and they are not the same thing the first is the reservoir level as a set of operating bands because thats how the operators think about it theres normal which is between the top water level and the compensation level sorry the drawdown limit theyre different things i mean the drawdown limit and in normal you generate on demand and nobody thinks about it if the level rises above top water you go into flood operation and in flood operation you are obliged to spill and generation becomes secondary and you come back to normal when the level drops if the level falls below the drawdown limit you go into conservation and in conservation you only generate at peak and you have a minimum release you must maintain for the river regardless and below that theres a statutory minimum and if you hit that you stop generating entirely and that state you can only leave by rain and separately from any of those theres an outage state when the turbines are down for maintenance and the level does whatever it does now the second thing is the water path itself which is the catchment feeds the reservoir through the inlet streams and there is a screen at the intake and from the intake the water goes down the pressure tunnel through the surge shaft into the penstock and then to the turbines and out through the draft tube into the tailrace and back into the river and the spillway is a separate route straight from the reservoir to the tailrace bypassing everything and thats what runs in flood operation and this scheme is pumped so at night the same machines run backwards and take water from the lower reservoir back up the penstock which means that arrow goes both ways",
  },
  {
    id: "rep-creator-bicycle-factory-overview-detail",
    category: "general",
    inputMode: "dictated",
    useCase: "creator",
    scenario:
      "factory tour video: the whole plant, then one station opened up in detail",
    expectedType: "flowchart",
    expectedTypes: ["flowchart", "flowchart"],
    multiFrom: "low",
    phenomena: [
      "multi-diagram",
      "no-punctuation",
      "run-on",
      "long",
      "self-correction",
      "trails-off",
    ],
    notes:
      "Replaces multi-slide-overview-and-detail. Overview then one box expanded, at thirty times the length, so the seam is a single sentence eight hundred words in rather than the halfway point. The overview has eleven stations and the detail has one of them with its own decision and rework loop, and a hurried answer merges them and produces one chart where the wheel steps sit at the same level as the paint shop. The tangent about the shop-floor apprenticeship and the closing bit about the merch are not diagram content.",
    text: "so this is the whole factory and were going to do it twice right first the big picture the way the frame moves through the building and then were going to stop at one station and open it right up because thats where all the interesting stuff is so it starts at goods in and goods in is tubing which arrives in bundles and components which arrive in boxes and those go to two different places obviously tubing goes to the tube shop and components go to the stores and stay there until they are called for the tube shop is cutting and mitring so a length of tube gets cut to length and then the ends get profiled so they fit against the tube theyre going to meet and thats done on a mitring machine now and it used to be by hand with a file and there is one bloke here right who can still do it by hand and it takes him nine minutes and the machine takes forty seconds and his is better which tells you something honestly out of the tube shop the cut set goes to the jig and the jig is basically where the frame becomes a frame the tubes are clamped in the fixture and tacked which means small welds just to hold the geometry and then it comes out of the jig and goes to the welding bench for the full welds because you cannot do the full welds in the jig the heat pulls everything out of alignment which is why the tacking exists at all obviously after welding it goes to the alignment table and gets checked and if its out you cold set it which means you physically bend it back and if its badly out it gets scrapped and yeah thats a real branch not a hypothetical then from alignment it goes to facing and reaming which is machining the bottom bracket shell and the head tube so the bearings sit true right and then to the finishing bay which is filing the welds if its going to be a polished finish and then to blasting and then paint and paint is its own building because of the extraction obviously and paint is prime bake colour bake clear bake and then decals and then a final clear on the top end frames and out of paint the frame goes to the build hall and the build hall is where the components come out of stores and get fitted so bearings headset bottom bracket cranks then the wheels go on then transmission then brakes then bars and saddle and then it goes to the test rig for a brake test and a torque audit and then to packing and packing is a box a set of pedals a manual and a bag of bolts and then to dispatch and thats eleven stations from goods in to dispatch and the whole thing takes about three weeks of which twelve days is paint waiting and honestly if we could fix paint we would double the output and everybody in this industry says the same thing about paint right now the station i want to open up is the wheel build because we still lace by hand and people do not believe that so wheel build starts with three things arriving from stores a rim a hub and a bag of spokes and the spokes are cut to length per build so the first thing is the builder checks the spoke length against the build card because if the spokes are two millimetres long you find out at the very end and it is a scrap then lacing and lacing is putting all thirty two spokes through the hub flanges and the rim in the right pattern and the pattern is three cross for most of what we do basically and lacing takes maybe six minutes for someone experienced and the thing to understand is right at the end of lacing the wheel is floppy it is not a wheel yet then tensioning and tensioning is done on a stand and it is iterative so you go round bringing every spoke up a little at a time and after every pass you check the lateral true which is side to side and the radial true which is up and down and the dish which is whether the rim is centred between the locknuts and those three fight each other constantly you fix the lateral and you have moved the dish so its round and round and round until all three are inside tolerance then stress relieving which is grabbing pairs of spokes and squeezing hard and this makes a horrible noise genuinely and it settles the spokes into the elbows and then you check true again and it will have moved and you correct it again and thats the loop and then the final tension check with a tensiometer on every single spoke and a reading goes on the build card and if the spread is too wide it goes back to tensioning and if its within spec it goes to the rim tape and then out to the build hall to be fitted ok and that whole station is one box on the first diagram and that is exactly why im doing two of these and honestly if anyone wants to learn to do this we take two apprentices a year and its a proper four year thing not a six week course and were always looking anyway theres a link below for the workshop tour and no i am not selling t shirts",
  },
  {
    id: "rep-meet-baggage-two-flows-direction",
    category: "swe",
    inputMode: "dictated",
    useCase: "meeting",
    scenario:
      "airport baggage: departures and arrivals flows, with one layout instruction covering both",
    expectedType: "flowchart",
    expectedTypes: ["flowchart", "flowchart"],
    multiFrom: "low",
    phenomena: [
      "multi-diagram",
      "direction-hint",
      "no-punctuation",
      "run-on",
      "long",
      "self-correction",
    ],
    notes:
      "Replaces multi-direction-on-both. The layout instruction is given once, at the start, and applies to both fences, which is the point: it has to be carried across the seam rather than attached to whichever diagram was being drawn when it was said. Longer than the original so there is real distance between the instruction and the second diagram. The transfer bags belong to both flows and are stated once, in the second.",
    text: "right can you do these left to right both of them because theyre going on a landscape slide so departures first the passenger checks in at a desk or at a bag drop and the bag gets a tag with a licence plate number and goes onto the input conveyor from there it goes to screening and screening is five levels but for this drawing its one box and out of screening a bag is either cleared or it goes to the search area well to level three first and then the search area but never mind that for a manual open and after a manual open its either cleared or its held and held means it does not fly cleared bags go to the sortation loop and the loop reads the tag and diverts the bag to the make up carousel for its flight and from the carousel the handlers load it into a container or onto a cart and it goes to the aircraft now arrivals and the layout instruction still applies the aircraft is unloaded onto carts and the carts come to the arrivals hall and the bags go onto the input for the reclaim belt and out onto the carousel the passenger takes it and goes through customs and anything not collected after an hour goes to the left baggage store and the transfer bags are the ones that make this messy because a transfer bag comes off the arriving aircraft and goes back into the departures sortation loop directly without ever reaching a reclaim belt so thats an arrow from the arrivals side into the middle of the departures side and no i dont want them merged into one picture theyre still two",
  },
];

const words = (t: Transcript) => t.text.trim().split(/\s+/).length;
const bucket = (n: number) =>
  n < 60
    ? "under-60"
    : n < 150
      ? "60-149"
      : n < 400
        ? "150-399"
        : n < 900
          ? "400-899"
          : "900-1500";

const tally = <T extends string>(keys: T[]) =>
  keys.reduce<Record<string, number>>((acc, k) => {
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});

export const REPLACEMENT_STATS = {
  count: REPLACEMENT_TRANSCRIPTS.length,
  buckets: tally(REPLACEMENT_TRANSCRIPTS.map((t) => bucket(words(t)))),
  byType: tally(REPLACEMENT_TRANSCRIPTS.map((t) => t.expectedType ?? "null")),
  byUseCase: tally(REPLACEMENT_TRANSCRIPTS.map((t) => t.useCase)),
  byInputMode: tally(REPLACEMENT_TRANSCRIPTS.map((t) => t.inputMode)),
  minWords: Math.min(...REPLACEMENT_TRANSCRIPTS.map(words)),
  medianWords: REPLACEMENT_TRANSCRIPTS.map(words).sort((a, b) => a - b)[
    Math.floor(REPLACEMENT_TRANSCRIPTS.length / 2)
  ],
  maxWords: Math.max(...REPLACEMENT_TRANSCRIPTS.map(words)),
  totalWords: REPLACEMENT_TRANSCRIPTS.map(words).reduce((a, b) => a + b, 0),
};
