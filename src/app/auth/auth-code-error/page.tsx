"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function AuthCodeErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  const getErrorMessage = () => {
    switch (error) {
      case "access_denied":
        return "You denied access to the application.";
      case "exchange_failed":
        return "Failed to exchange authorization code for session.";
      case "no_code":
        return "No authorization code was provided.";
      case "unknown":
        return "An unknown error occurred during authentication.";
      default:
        return "An authentication error occurred.";
    }
  };

  return (
    <div className="container">
      <h1>Authentication Error</h1>

      <div style={{ marginBottom: "2rem" }}>
        <p>
          <strong>Error:</strong> {getErrorMessage()}
        </p>
        {errorDescription && (
          <p>
            <strong>Details:</strong> {errorDescription}
          </p>
        )}
        {error && (
          <p>
            <strong>Error Code:</strong> {error}
          </p>
        )}
      </div>

      <p>This could be because:</p>
      <ul>
        <li>You cancelled the authentication process</li>
        <li>The authentication link has expired</li>
        <li>The authentication link has already been used</li>
        <li>There was a technical issue with the provider</li>
      </ul>

      <div style={{ marginTop: "2rem" }}>
        <Link
          href="/auth/login"
          className="nav-link"
          style={{ marginRight: "1rem" }}
        >
          Try Again
        </Link>
        <Link href="/" className="nav-link">
          Back to Home
        </Link>
      </div>
    </div>
  );
}

export default function AuthCodeError() {
  return (
    <Suspense fallback={<div className="container"><p>Loading...</p></div>}>
      <AuthCodeErrorContent />
    </Suspense>
  );
}
