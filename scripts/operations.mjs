// Maps every API-key operation in the OpenAPI document to an SDK method.
//
// Key: "<METHOD> <path>". Value: "<namespace path>.<method name>".
// The generator fails if an operation that accepts an API key is missing here,
// or if an entry here no longer exists in the document, so the SDK can't drift
// from the API.

export const operations = {
  // Calls
  "GET /v1/calls": "calls.list",
  "GET /v1/calls/{id}": "calls.retrieve",
  "GET /v1/analytics/calls": "calls.analytics",

  // Audit log
  "GET /v1/audit-events": "auditEvents.list",

  // Blocked callers
  "GET /v1/blocked-callers": "blockedCallers.list",
  "POST /v1/blocked-callers": "blockedCallers.create",
  "DELETE /v1/blocked-callers/{id}": "blockedCallers.delete",
  "GET /v1/blocked-callers/settings": "blockedCallers.retrieveSettings",
  "PUT /v1/blocked-callers/settings": "blockedCallers.updateSettings",

  // People
  "GET /v1/people": "people.list",
  "POST /v1/people": "people.create",
  "GET /v1/people/{id}": "people.retrieve",
  "PATCH /v1/people/{id}": "people.update",
  "DELETE /v1/people/{id}": "people.delete",

  // Webhooks
  "GET /v1/webhook-endpoints": "webhookEndpoints.list",
  "POST /v1/webhook-endpoints": "webhookEndpoints.create",
  "GET /v1/webhook-endpoints/{id}": "webhookEndpoints.retrieve",
  "PATCH /v1/webhook-endpoints/{id}": "webhookEndpoints.update",
  "DELETE /v1/webhook-endpoints/{id}": "webhookEndpoints.delete",
  "GET /v1/webhook-endpoints/{id}/deliveries": "webhookEndpoints.listDeliveries",
  "POST /v1/webhook-endpoints/{id}/test": "webhookEndpoints.sendTestEvent",
  "POST /v1/webhook-endpoints/{id}/rotate-secret": "webhookEndpoints.rotateSecret",
  "POST /v1/webhook-deliveries/{id}/redeliver": "webhookDeliveries.redeliver",
  "GET /v1/webhook-event-types": "webhookEventTypes.list",

  // Phone numbers
  "GET /v1/phone-numbers": "phoneNumbers.list",
  "POST /v1/phone-numbers": "phoneNumbers.purchase",
  "GET /v1/phone-numbers/available": "phoneNumbers.listAvailable",
  "PUT /v1/phone-numbers/{id}/agent": "phoneNumbers.assignAgent",
  "DELETE /v1/phone-numbers/{id}": "phoneNumbers.release",

  // Billing
  "GET /v1/billing": "billing.retrieve",
  "POST /v1/billing/checkout": "billing.createCheckout",
  "POST /v1/billing/cancel": "billing.cancel",
  "POST /v1/billing/resume": "billing.resume",
  "POST /v1/billing/portal": "billing.createPortalSession",

  // Agents
  "GET /v1/agents": "agents.list",
  "POST /v1/agents": "agents.create",
  "GET /v1/agents/{id}": "agents.retrieve",
  "PATCH /v1/agents/{id}": "agents.update",
  "DELETE /v1/agents/{id}": "agents.delete",
  "POST /v1/agents/{id}/publish": "agents.publish",
  "PUT /v1/agents/{id}/notifications": "agents.updateNotifications",
  "PUT /v1/agents/{id}/success-criteria": "agents.updateSuccessCriteria",
  "PATCH /v1/agents/{id}/variables": "agents.updateVariables",
  "PUT /v1/agents/{id}/pre-call-webhook": "agents.updatePreCallWebhook",
  "POST /v1/agents/{id}/pre-call-webhook/rotate-secret": "agents.rotatePreCallWebhookSecret",
  "POST /v1/agents/{id}/assist": "agents.assist",
  "POST /v1/agents/{id}/build": "agents.startBuild",
  "GET /v1/agents/{id}/build": "agents.retrieveBuild",

  // Agent custom tools
  "GET /v1/agents/{id}/tools": "agents.tools.list",
  "POST /v1/agents/{id}/tools": "agents.tools.create",
  "PATCH /v1/agents/{id}/tools/{tool_id}": "agents.tools.update",
  "DELETE /v1/agents/{id}/tools/{tool_id}": "agents.tools.delete",

  // Agent tests
  "GET /v1/agents/{id}/tests": "agents.tests.list",
  "POST /v1/agents/{id}/tests": "agents.tests.create",
  "POST /v1/agents/{id}/tests/suggest": "agents.tests.suggest",
  "PATCH /v1/agents/{id}/tests/{test_id}": "agents.tests.update",
  "DELETE /v1/agents/{id}/tests/{test_id}": "agents.tests.delete",
  "POST /v1/calls/{id}/test": "agents.tests.createFromCall",
  "GET /v1/agents/{id}/tests/runs": "agents.tests.listRuns",
  "POST /v1/agents/{id}/tests/runs": "agents.tests.createRun",
  "GET /v1/agents/{id}/tests/runs/{run_id}": "agents.tests.retrieveRun",
  "POST /v1/agents/{id}/tests/runs/{run_id}/cancel": "agents.tests.cancelRun",
  "POST /v1/agents/{id}/tests/publish-check": "agents.tests.publishCheck",
  "GET /v1/agents/{id}/tests/settings": "agents.tests.retrieveSettings",
  "PUT /v1/agents/{id}/tests/settings": "agents.tests.updateSettings",

  // Agent guardrails
  "GET /v1/agents/{id}/guardrails": "agents.guardrails.list",
  "PUT /v1/agents/{id}/guardrails": "agents.guardrails.update",

  // Agent workflows
  "GET /v1/agents/{id}/workflow/draft": "agents.workflow.retrieveDraft",
  "PUT /v1/agents/{id}/workflow/draft": "agents.workflow.updateDraft",
  "POST /v1/agents/{id}/workflow/validate": "agents.workflow.validate",
  "POST /v1/agents/{id}/workflow/draft/publish": "agents.workflow.publishDraft",
  "GET /v1/agents/{id}/workflow/published": "agents.workflow.retrievePublished",
  "GET /v1/agents/{id}/workflow/export": "agents.workflow.export",
  "POST /v1/agents/{id}/workflow/import": "agents.workflow.import",
  "POST /v1/agents/{id}/workflow/assist": "agents.workflow.assist",
  "POST /v1/agents/{id}/workflow/assist-runs": "agents.workflow.startAssistRun",
  "GET /v1/agents/{id}/workflow/assist-runs": "agents.workflow.listAssistRuns",
  "POST /v1/agents/{id}/workflow/assist-runs/{runId}/applied": "agents.workflow.markAssistRunApplied",
  "POST /v1/agents/{id}/workflow/assist-runs/{runId}/undo-settings": "agents.workflow.undoAssistRunSettings",
  "POST /v1/agents/{id}/workflow/code/test": "agents.workflow.testCode",

  // Agent versions
  "GET /v1/agents/{id}/versions": "agents.versions.list",
  "GET /v1/agents/{id}/versions/{v}": "agents.versions.retrieve",
  "GET /v1/agents/{id}/versions/{a}/diff/{b}": "agents.versions.diff",
  "POST /v1/agents/{id}/versions/{v}/restore": "agents.versions.restore",

  // Agent knowledge bases and scripts
  "GET /v1/agents/{id}/knowledge-bases": "agents.knowledgeBases.list",
  "PUT /v1/agents/{id}/knowledge-bases": "agents.knowledgeBases.set",
  "GET /v1/agents/{id}/scripts": "agents.scripts.list",
  "PUT /v1/agents/{id}/scripts": "agents.scripts.set",

  // Chat widgets
  "GET /v1/chat-widgets": "chatWidgets.list",
  "POST /v1/chat-widgets": "chatWidgets.create",
  "GET /v1/chat-widgets/{id}": "chatWidgets.retrieve",
  "PATCH /v1/chat-widgets/{id}": "chatWidgets.update",
  "DELETE /v1/chat-widgets/{id}": "chatWidgets.delete",

  // Knowledge
  "GET /v1/knowledge-bases": "knowledgeBases.list",
  "POST /v1/knowledge-bases": "knowledgeBases.create",
  "GET /v1/knowledge-bases/{id}": "knowledgeBases.retrieve",
  "PATCH /v1/knowledge-bases/{id}": "knowledgeBases.update",
  "DELETE /v1/knowledge-bases/{id}": "knowledgeBases.delete",
  "POST /v1/knowledge-bases/{id}/search": "knowledgeBases.search",
  "POST /v1/knowledge-bases/{id}/answers": "knowledgeBases.addAnswer",
  "POST /v1/knowledge-bases/{id}/files": "knowledgeBases.uploadFile",
  "POST /v1/knowledge-bases/{id}/sources": "knowledgeBases.sources.create",
  "GET /v1/knowledge-bases/{id}/sources/{source_id}": "knowledgeBases.sources.retrieve",
  "PATCH /v1/knowledge-bases/{id}/sources/{source_id}": "knowledgeBases.sources.update",
  "DELETE /v1/knowledge-bases/{id}/sources/{source_id}": "knowledgeBases.sources.delete",
  "POST /v1/knowledge-bases/{id}/sources/{source_id}/refresh": "knowledgeBases.sources.refresh",
  "GET /v1/knowledge-bases/{id}/sources/{source_id}/documents/{document_id}": "knowledgeBases.sources.retrieveDocument",

  // Scripts
  "GET /v1/scripts": "scripts.list",
  "POST /v1/scripts": "scripts.create",
  "POST /v1/scripts/files": "scripts.upload",
  "GET /v1/scripts/{id}": "scripts.retrieve",
  "PATCH /v1/scripts/{id}": "scripts.update",
  "DELETE /v1/scripts/{id}": "scripts.delete",
  "POST /v1/scripts/{id}/generate-workflow": "scripts.generateWorkflow",

  // Members, invitations and teams
  "GET /v1/members": "members.list",
  "POST /v1/members": "members.create",
  "PATCH /v1/members/{user_id}": "members.update",
  "DELETE /v1/members/{user_id}": "members.delete",
  "GET /v1/invitations": "invitations.list",
  "POST /v1/invitations": "invitations.create",
  "POST /v1/invitations/{id}/resend": "invitations.resend",
  "DELETE /v1/invitations/{id}": "invitations.delete",
  "GET /v1/teams": "teams.list",
  "POST /v1/teams": "teams.create",
  "PATCH /v1/teams/{id}": "teams.update",
  "DELETE /v1/teams/{id}": "teams.delete",
  "POST /v1/teams/{id}/members": "teams.addMember",
  "DELETE /v1/teams/{id}/members/{user_id}": "teams.removeMember",
  "PUT /v1/teams/{id}/on-call": "teams.updateOnCall",

  // Workspace
  "GET /v1/workspace": "workspace.retrieve",
  "PATCH /v1/workspace": "workspace.update",
  "POST /v1/workspace/delete": "workspace.delete",
  "GET /v1/attention": "workspace.listAttention",

  // Agencies: client workspaces, billing and white-label
  "GET /v1/clients": "clients.list",
  "POST /v1/clients": "clients.create",
  "GET /v1/clients/usage": "clients.usage",
  "PATCH /v1/clients/{id}": "clients.update",
  "PUT /v1/clients/{id}/billing": "clients.updateBilling",
  "DELETE /v1/clients/{id}/billing": "clients.stopBilling",
  "GET /v1/agency/stripe": "agencyStripe.retrieve",
  "DELETE /v1/agency/stripe": "agencyStripe.disconnect",
  "POST /v1/agency/stripe/authorize": "agencyStripe.authorize",
  "POST /v1/agency/stripe/callback": "agencyStripe.completeAuthorization",
  "GET /v1/brand": "brand.retrieve",
  "PATCH /v1/brand": "brand.update",
  "PUT /v1/brand/logos/{variant}": "brand.uploadLogo",
  "DELETE /v1/brand/logos/{variant}": "brand.deleteLogo",
  "PUT /v1/brand/mail-domain": "brand.setMailDomain",
  "DELETE /v1/brand/mail-domain": "brand.deleteMailDomain",
  "POST /v1/brand/mail-domain/verify": "brand.verifyMailDomain",

  // API keys
  "GET /v1/api-keys": "apiKeys.list",
  "POST /v1/api-keys": "apiKeys.create",
  "DELETE /v1/api-keys/{id}": "apiKeys.revoke",

  // Testing
  "POST /v1/test-sessions": "testSessions.create",
  "DELETE /v1/test-sessions/{room_name}": "testSessions.delete",

  // Voices
  "GET /v1/voices": "voices.list",
  "GET /v1/voices/{id}": "voices.retrieve",
  "POST /v1/voices/{id}/speech": "voices.speech",

  // Integrations: CRM
  "GET /v1/integrations/crm": "integrations.crm.retrieve",
  "PATCH /v1/integrations/crm": "integrations.crm.update",
  "DELETE /v1/integrations/crm": "integrations.crm.disconnect",
  "POST /v1/integrations/crm/ghl/authorize": "integrations.crm.authorize",
  "POST /v1/integrations/crm/ghl/callback": "integrations.crm.completeAuthorization",
  "GET /v1/integrations/crm/options": "integrations.crm.options",
  "GET /v1/integrations/crm/people-import": "integrations.crm.previewPeopleImport",
  "POST /v1/integrations/crm/people-import": "integrations.crm.startPeopleImport",

  // Integrations: calendars
  "GET /v1/integrations/calendar": "integrations.calendar.retrieve",
  "PATCH /v1/integrations/calendar": "integrations.calendar.update",
  "DELETE /v1/integrations/calendar": "integrations.calendar.disconnect",
  "POST /v1/integrations/calendar/{provider}/authorize": "integrations.calendar.authorize",
  "POST /v1/integrations/calendar/callback": "integrations.calendar.completeAuthorization",
  "GET /v1/integrations/calendar/options": "integrations.calendar.options",
  "POST /v1/integrations/calendar/ics": "integrations.calendar.connectIcs",
  "POST /v1/integrations/calendar/feed/reset": "integrations.calendar.resetFeed",
  "GET /v1/integrations/calendars/{id}/options": "integrations.calendar.connectionOptions",
  "PATCH /v1/integrations/calendars/{id}": "integrations.calendar.updateConnection",
  "DELETE /v1/integrations/calendars/{id}": "integrations.calendar.disconnectConnection",
  "POST /v1/integrations/calendars/{id}/feed/reset": "integrations.calendar.resetConnectionFeed",
  "GET /v1/integrations/booking-calendars": "integrations.calendar.listBookingCalendars",

  // Calendar
  "GET /v1/calendar/bookings": "calendar.bookings.list",
  "POST /v1/calendar/bookings/{id}/cancel": "calendar.bookings.cancel",
  "GET /v1/calendar/calls/{call_id}/bookings": "calendar.bookings.listForCall",
  "GET /v1/calendar/busy": "calendar.busy",
  "GET /v1/calendar/confirmations": "calendar.confirmations.retrieve",
  "PATCH /v1/calendar/confirmations": "calendar.confirmations.update",
  "POST /v1/calendar/confirmations/test": "calendar.confirmations.sendTest",
};

// Operations under /v1 that the SDK leaves out on purpose, with the reason.
export const skipped = {
  "POST /v1/integration-requests":
    "No security requirement in the document; it's the dashboard's 'request an integration' form.",
};
