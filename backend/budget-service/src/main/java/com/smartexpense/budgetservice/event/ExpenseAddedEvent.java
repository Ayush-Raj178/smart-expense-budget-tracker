package com.smartexpense.budgetservice.event;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ExpenseAddedEvent {

    @Builder.Default
    private String eventId = UUID.randomUUID().toString();
    private Long expenseId;
    private Long userId;
    private BigDecimal amount;
    private String category;
    private LocalDate date;
}
