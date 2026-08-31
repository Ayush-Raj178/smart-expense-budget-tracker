package com.smartexpense.budgetservice.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Getter
@NoArgsConstructor
public class ExpenseSummaryResponse {

    private BigDecimal totalAmount;
}
