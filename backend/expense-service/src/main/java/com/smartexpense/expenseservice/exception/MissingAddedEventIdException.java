package com.smartexpense.expenseservice.exception;

public class MissingAddedEventIdException extends RuntimeException {

    public MissingAddedEventIdException() {
        super("This expense has no stored addedEventId; create a new expense to test idempotency republish");
    }
}
