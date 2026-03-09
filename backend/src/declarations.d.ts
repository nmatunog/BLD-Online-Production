/**
 * Declaration files for modules that may not have types in production build.
 * Ensures tsc succeeds when devDependencies (@types/*) are not installed.
 */
declare module 'bcryptjs';
declare module 'passport-jwt';
