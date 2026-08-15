-- Facebook Page posting is a separate PlatformAccount/adapter from META
-- (which publishes to a Page's linked Instagram account), but reuses the
-- same registered Meta App credentials at the application layer.
ALTER TYPE "Platform" ADD VALUE 'FACEBOOK';
