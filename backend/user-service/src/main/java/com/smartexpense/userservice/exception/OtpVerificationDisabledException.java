package com.smartexpense.userservice.exception;

public class OtpVerificationDisabledException extends RuntimeException {

    public OtpVerificationDisabledException(String message) {
        super(message);
    }
}
