package com.smartexpense.budgetservice.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SaveBudgetResponse {

    private String message;
    private Long budgetId;
    private boolean created;
    private BudgetResponse budget;
}
