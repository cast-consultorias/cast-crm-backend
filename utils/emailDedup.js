// Shared in-memory dedup set for booking invitation emails.
// Prevents double-sends when simultaneous PATCH requests race before Sheets commits,
// and is shared between leads.routes.js and webhooks.routes.js so Cal.com can clear it.
const bookingEmailSentLeads = new Set();

module.exports = { bookingEmailSentLeads };
