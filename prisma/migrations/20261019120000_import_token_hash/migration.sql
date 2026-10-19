-- Write-scoped agent import token (GitHub #38). Stores only the SHA-256 hex of the
-- token; null = no token / revoked. Additive and nullable.

ALTER TABLE "User" ADD COLUMN     "importTokenHash" TEXT;
