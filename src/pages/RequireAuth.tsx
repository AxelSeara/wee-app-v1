import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import type { User } from "../lib/types";

interface RequireAuthProps {
  activeUser: User | null;
  children: ReactNode;
  redirectPath?: string;
}

export const RequireAuth = ({ activeUser, children, redirectPath = "/login" }: RequireAuthProps) => {
  if (!activeUser) {
    return <Navigate to={redirectPath} replace />;
  }
  return <>{children}</>;
};
