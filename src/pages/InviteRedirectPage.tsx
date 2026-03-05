import { Navigate, useParams } from "react-router-dom";

export const InviteRedirectPage = () => {
  const { token } = useParams<{ token: string }>();
  const safeToken = token ? encodeURIComponent(token) : "";
  return <Navigate to={safeToken ? `/join?invite=${safeToken}` : "/join"} replace />;
};
