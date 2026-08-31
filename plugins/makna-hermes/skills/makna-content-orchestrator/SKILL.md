# Skill Hermes: MAKNA Content Orchestrator

1. Fetch research task context from the official MAKNA API:
   `GET /api/operator/v2/research-tasks/{id}`
2. Research only the requested scope and freshness window.
3. Submit structured evidence with stable source IDs:
   `POST /api/operator/v2/research-tasks/{id}/complete`
4. Never call Repliz or the MAKNA database directly.
5. Never approve or publish unless the issued capability explicitly allows it.
