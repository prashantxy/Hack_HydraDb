import {
  getBlastRadius,
  type BlastRadiusService,
} from "./blast-radius";

export type RiskSeverity =
  | "CRITICAL"
  | "HIGH"
  | "MEDIUM"
  | "LOW";

export interface ServiceRisk {
  serviceId: number;
  name: string;
  environment: string | null;
  hops: number;

  score: number;
  severity: RiskSeverity;

  reasons: string[];
}

export interface PackageRisk {
  version: string;

  score: number;
  severity: RiskSeverity;

  affectedServices: number;
  productionServices: number;

  services: ServiceRisk[];
}

function calculateServiceRisk(
  service: BlastRadiusService,
): ServiceRisk {
  let score = 0;
  const reasons: string[] = [];

  /*
   * Production is the biggest signal.
   */
  if (
    service.environment?.toLowerCase() ===
    "production"
  ) {
    score += 60;

    reasons.push(
      "Affected production service",
    );
  } else if (
    service.environment?.toLowerCase() ===
    "staging"
  ) {
    score += 30;

    reasons.push(
      "Affected staging service",
    );
  } else {
    score += 10;

    reasons.push(
      "Non-production service affected",
    );
  }

  /*
   * Direct dependency is more dangerous
   * than a deep transitive dependency.
   */
  if (service.hops === 0) {
    score += 30;

    reasons.push(
      "Direct dependency",
    );
  } else if (service.hops === 1) {
    score += 20;

    reasons.push(
      "One-hop transitive dependency",
    );
  } else if (service.hops <= 3) {
    score += 10;

    reasons.push(
      `${service.hops}-hop transitive dependency`,
    );
  }

  /*
   * Keep service score bounded.
   */
  score = Math.min(score, 100);

  let severity: RiskSeverity;

  if (score >= 80) {
    severity = "CRITICAL";
  } else if (score >= 60) {
    severity = "HIGH";
  } else if (score >= 30) {
    severity = "MEDIUM";
  } else {
    severity = "LOW";
  }

  return {
    serviceId: service.id,
    name: service.name,
    environment: service.environment,
    hops: service.hops,
    score,
    severity,
    reasons,
  };
}

export async function getPackageRisk(
  versionKey: string,
  maxDepth = 5,
): Promise<PackageRisk> {
  const services =
    await getBlastRadius(
      versionKey,
      maxDepth,
    );

  const serviceRisks =
    services.map(
      calculateServiceRisk,
    );

  const productionServices =
    serviceRisks.filter(
      (service) =>
        service.environment
          ?.toLowerCase() ===
        "production",
    ).length;

  /*
   * Package-level score:
   *
   * Start with the most dangerous service.
   * Then increase risk for additional affected
   * production services.
   */
  let score =
    serviceRisks.length > 0
      ? Math.max(
          ...serviceRisks.map(
            (service) =>
              service.score,
          ),
        )
      : 0;

  if (productionServices >= 2) {
    score += 10;
  }

  if (productionServices >= 5) {
    score += 10;
  }

  score = Math.min(score, 100);

  let severity: RiskSeverity;

  if (score >= 80) {
    severity = "CRITICAL";
  } else if (score >= 60) {
    severity = "HIGH";
  } else if (score >= 30) {
    severity = "MEDIUM";
  } else {
    severity = "LOW";
  }

  return {
    version: versionKey,
    score,
    severity,
    affectedServices:
      services.length,
    productionServices,
    services: serviceRisks,
  };
}