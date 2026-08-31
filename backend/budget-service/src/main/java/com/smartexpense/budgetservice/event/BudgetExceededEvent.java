package com.smartexpense.budgetservice.event;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.UUID;

@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BudgetExceededEvent {

    @Builder.Default
    private String eventId = UUID.randomUUID().toString();
    private Long userId;
    private String category;
    private BigDecimal monthlyLimit;
    private BigDecimal currentSpent;
    private String month;
}
