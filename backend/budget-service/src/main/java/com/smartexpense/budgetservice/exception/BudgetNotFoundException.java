package com.smartexpense.budgetservice.exception;

public class BudgetNotFoundException extends RuntimeException {

    public BudgetNotFoundException() {
        super("Budget not found");
    }
}
