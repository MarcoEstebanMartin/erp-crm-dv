import { defineRailway, project, service } from "railway/iac";
// This repository manages only its own resources in the environment. Other
// repositories export their own partial name.
// See https://docs.railway.com/infrastructure-as-code#multi-repo-projects
export const partial = "erp-dv-prueba";
export default defineRailway(() => {
  const erpDvPrueba = service("erp-dv-prueba", {
    build: { buildEnvironment: "V3", builder: "DOCKERFILE", dockerfilePath: "Dockerfile" },
    healthcheck: "/api/health",
    healthcheckTimeout: 30,
    replicas: { "us-east4-eqdc4a": 1 },
    domains: [{ domain: "erp.donvenancio.com.ar", port: 5000 }],
  });

  return project("don-venancio", {
    variables: { managed: false },
    resources: [erpDvPrueba],
  });
});
