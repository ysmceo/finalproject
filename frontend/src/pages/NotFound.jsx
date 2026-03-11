import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 text-center text-foreground">
      <div className="max-w-lg space-y-3">
        <h1 className="text-4xl font-display">Page not found</h1>
        <p className="text-muted-foreground">
          This page doesn’t exist. Return to the salon experience or head to the admin dashboard.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link className="shad-button" to="/">
          Go to Website
        </Link>
        <Link className="shad-button" to="/admin">
          Admin Dashboard
        </Link>
      </div>
    </div>
  );
}
