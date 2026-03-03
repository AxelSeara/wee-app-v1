import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import type { User } from "../lib/types";

interface RequireAuthProps {
  activeUser: User | null;
  children: ReactNode;
}

export const RequireAuth = ({ activeUser, children }: RequireAuthProps) => {
  if (!activeUser) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};
