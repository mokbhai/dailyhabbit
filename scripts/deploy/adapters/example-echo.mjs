// Reference deploy adapter — dry run only.
//
// Copy this file to scripts/deploy/adapters/<your-target>.mjs, set
// DEPLOY_TARGET=<your-target>, and replace the body with the commands that
// roll your images out to your host. Common shapes:
//
//   - VPS:        ssh host 'cd /srv/app && docker compose pull && docker compose up -d'
//   - Cloud Run:  for each image -> gcloud run deploy <svc> --image <ref>
//   - Kubernetes: for each image -> kubectl set image deploy/<svc> <svc>=<ref>
//
// The dispatcher (scripts/deploy/run.mjs) passes the context documented in
// docs/guides/deployment.md. This adapter only logs what it would do.

export default async function deploy(context) {
  const { target, sha, registry, images } = context;

  console.log(`[${target}] dry run — would deploy these images:`);
  console.log(`  git sha:  ${sha ?? '(unknown)'}`);
  console.log(`  registry: ${registry ?? '(unset)'}`);

  for (const [app, imageRef] of Object.entries(images)) {
    console.log(`  - ${app}: ${imageRef}`);
  }

  if (Object.keys(images).length === 0) {
    console.log('  (no images in DEPLOY_IMAGES)');
  }
}
