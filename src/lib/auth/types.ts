export interface SessionUser {
  id: string;
  email: string;
  emailVerifiedAt: Date | null;
  role: {
    id: string;
    name: string;
    scopeType: "UNLIMITED" | "CLIENT" | "SELF";
  };
  permissions: string[];
  session: {
    id: string;
  };
}
