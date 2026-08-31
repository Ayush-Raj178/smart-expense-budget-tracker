package com.smartexpense.userservice.exception;

public class UndeliverableEmailDomainException extends RuntimeException {

    public UndeliverableEmailDomainException() {
        super("This email domain doesn't appear to accept mail. Please check the address.");
    }
}
