package com.smartexpense.userservice.exception;

public class EmailDomainValidationUnavailableException extends RuntimeException {

    public EmailDomainValidationUnavailableException(Throwable cause) {
        super("We couldn't validate this email domain right now. Please try again.", cause);
    }
}
