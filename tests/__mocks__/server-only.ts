// Stub for "server-only" package in Jest tests.
// In production, this package causes a build error when imported from
// Client Components. In Jest (Node.js), we stub it out so server-side
// modules can be unit-tested without triggering the browser guard.
export {};
