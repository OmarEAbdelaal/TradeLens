declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    TRADELENS_ENCRYPTION_KEY?: string;
    BUCKET?: R2Bucket;
  }
}
