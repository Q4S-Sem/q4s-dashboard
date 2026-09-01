const DEV_SECRET = "q4s-dev-secret-change-in-production";

type AuthEnvironment = {
  NODE_ENV?: string;
  AUTH_REQUIRED?: string;
  AUTH_SECRET?: string;
};

export function isAuthRequired(env: AuthEnvironment = process.env): boolean {
  return env.NODE_ENV === "production" || env.AUTH_REQUIRED === "true";
}

export function isAdminRole(role: string | null | undefined): boolean {
  return role === "ADMIN";
}

export function productionAuthError(env: AuthEnvironment = process.env): string | null {
  if (env.NODE_ENV !== "production") return null;

  const secret = env.AUTH_SECRET?.trim();
  if (!secret || secret === DEV_SECRET) {
    return "AUTH_SECRET ontbreekt of gebruikt de onveilige ontwikkelwaarde.";
  }

  return null;
}

export function sessionSigningSecret(env: AuthEnvironment = process.env): string | null {
  if (productionAuthError(env)) return null;
  return env.AUTH_SECRET?.trim() || DEV_SECRET;
}
