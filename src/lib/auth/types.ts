export interface SessionUser {
  id: string;
  email: string;
  emailVerifiedAt: Date | null;
  name: { firstName: string; lastName: string } | null;
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
