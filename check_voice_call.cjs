const { execSync } = require('child_process');
const out = execSync(`gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=beautyvoice-bff" --limit=30 --format="json"`);
const logs = JSON.parse(out);
logs.forEach(l => {
  if (l.textPayload) console.log(l.timestamp, l.textPayload);
  if (l.jsonPayload) console.log(l.timestamp, l.jsonPayload);
});
