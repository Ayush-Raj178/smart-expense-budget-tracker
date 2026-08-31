package com.smartexpense.expenseservice.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.math.BigDecimal;

@Getter
@AllArgsConstructor
public class ExpenseSummaryResponse {

    private BigDecimal totalAmount;
}
