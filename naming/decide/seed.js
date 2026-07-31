window.SWIPE_SEED = [
  ["Concierge + platform", "A WordPress-first, visitor-facing service role", ["WP Concierge", "WordPress Concierge", "Concierge for WordPress", "Concierge WP", "WP Site Concierge", "WP Visitor Concierge", "WP Client Concierge", "Concierge Plugin", "WordPress Guide", "WP Guide", "WP Welcome", "WP Frontdesk", "WP Helpdesk", "WP Answer Desk", "WP Visitor Guide", "WP Site Guide", "WP Liaison", "WP Welcome Desk", "WP Reply", "WP Assist"]],
  ["Concierge + website", "A concierge rooted in the website experience", ["Site Concierge", "Web Concierge", "Visitor Concierge", "Client Concierge", "Onsite Concierge", "Digital Concierge", "Page Concierge", "Service Concierge", "Welcome Concierge", "Desk Concierge", "Website Concierge", "Visitor Desk", "Client Welcome", "Site Host", "Web Host", "Page Guide", "Site Guide", "Web Guide", "Visitor Guide", "Digital Host"]],
  ["Front of house", "A helpful first presence a visitor meets", ["Foyer", "Usher", "Host", "Steward", "Reception", "Frontdesk", "Welcome", "Greeter", "Attendant", "Doorway", "Portico", "Lobby", "Portal", "Threshold", "Waystation", "Entry", "Gateway", "Landing", "Arrival", "Frontline"]],
  ["Conversation + handoff", "A continuous exchange that can pass from AI to a human", ["Relay", "Bridge", "Thread", "Reply", "Echo", "Signal", "Prompt", "Handoff", "Link", "Continuum", "Chime", "Cadence", "Parley", "Rapport", "Chorus", "Phrase", "Riff", "Sayso", "Vox", "Coda"]],
  ["Guidance", "A calm, capable way to guide a visitor to the right answer", ["Sage", "Beacon", "Compass", "Pilot", "Guide", "Maven", "Clarity", "Path", "Wayfinder", "Counsel", "Navigate", "Northstar", "Landmark", "Atlas", "Mentor", "Truepoint", "Guidepost", "Pointer", "Bearing", "Horizon"]],
  ["Product titles", "A concise, ownable title for a customer-facing product", ["Ask Desk", "Answer Desk", "Client Desk", "Deal Desk", "First Reply", "Open Door", "Answer Line", "Client Line", "Help Point", "Welcome Desk", "Ask Point", "Reply Desk", "Help Line", "Client Guide", "Service Desk", "Visitor Line", "Answer Room", "Help Room", "Open Line", "Next Step"]],
  ["Myth + messenger", "A mythic figure associated with guidance, wisdom, welcome, or communication", ["Iris", "Maia", "Ariadne", "Mimir", "Janus", "Talaria", "Pallas", "Argus", "Hermes", "Mercury", "Orion", "Calliope", "Thalia", "Orpheus", "Vesta", "Themis", "Minerva", "Bragi", "Selene", "Aurora"]],
  ["WP-adjacent", "A compact name with WordPress or web-product energy", ["Warden", "Wicket", "Waypoint", "Wander", "Wordline", "Wordmark", "Wisp", "WarP", "Wordpath", "Webward", "Webway", "Wordwise", "Sitewise", "Pagewise", "Webtrail", "Wordgate", "Pagepilot", "Sitepath", "WP Atlas", "Webroot"]],
  ["Sales help", "A visitor-to-business bridge that helps the right next step happen", ["Advocate", "Liaison", "Advisor", "Partner", "Closer", "Intake", "Prospect", "Leadway", "Navigator", "Connect", "Qualify", "Nextmove", "Match", "Convert", "Pursuit", "Opportunity", "Introduce", "Momentum", "Followup", "Outreach"]],
  ["Compact helper", "A short, conversational helper name with a clear emotional signal", ["Aide", "Nudge", "Scout", "Lumen", "Nexus", "Orbit", "Query", "Ease", "Assist", "Harbor", "Verve", "Verse", "Accord", "Round", "Ping", "Mingle", "Dialog", "Converse", "Kindred", "Fluent"]]
].flatMap(([territory, idea, names]) => names.map((name, index) => ({
  id: `seed-${territory.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${index + 1}`,
  name,
  territory,
  description: `${idea}.`,
  source: "seed"
})));
