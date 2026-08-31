package com.smartexpense.budgetservice.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BudgetResponse {

    private Long id;
    private Long userId;
    private String category;
    private BigDecimal monthlyLimit;
    private BigDecimal currentSpent;
    private String month;
}
