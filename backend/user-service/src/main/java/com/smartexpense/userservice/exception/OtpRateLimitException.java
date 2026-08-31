package com.smartexpense.userservice.exception;

public class OtpRateLimitException extends RuntimeException {
    private final long retryAfterSeconds;

    public OtpRateLimitException(long retryAfterSeconds) {
        super("Please wait " + retryAfterSeconds + " seconds before requesting another code");
        this.retryAfterSeconds = retryAfterSeconds;
    }

    public long getRetryAfterSeconds() {
        return retryAfterSeconds;
    }
}
