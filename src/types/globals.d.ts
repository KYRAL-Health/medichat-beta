export {}

declare global {
  interface CustomJwtSessionClaims {
    disclaimerAcceptedAt?: string
  }

  interface UserPublicMetadata {
    disclaimerAcceptedAt?: string
  }
}