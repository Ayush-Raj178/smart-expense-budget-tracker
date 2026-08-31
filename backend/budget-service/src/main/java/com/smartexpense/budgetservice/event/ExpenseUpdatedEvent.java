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
public class ExpenseUpdatedEvent {

    @Builder.Default
    private String eventId = UUID.randomUUID().toString();
    private Long expenseId;
    private Long userId;
    private BigDecimal oldAmount;
    private String oldCategory;
    private LocalDate oldDate;
    private BigDecimal newAmount;
    private String newCategory;
    private LocalDate newDate;
}
