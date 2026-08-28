const { execSync } = require('child_process');
const out = execSync(`gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=beautyvoice-bff" --limit=20 --format="json"`);
const logs = JSON.parse(out);
logs.forEach(l => console.log(l.textPayload || l.jsonPayload));
