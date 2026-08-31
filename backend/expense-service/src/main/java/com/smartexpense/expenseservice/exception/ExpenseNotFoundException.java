package com.smartexpense.expenseservice.exception;

public class ExpenseNotFoundException extends RuntimeException {

    public ExpenseNotFoundException() {
        super("Expense not found");
    }
}
