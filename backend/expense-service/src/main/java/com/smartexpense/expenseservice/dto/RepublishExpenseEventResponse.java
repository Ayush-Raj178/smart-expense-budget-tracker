package com.smartexpense.expenseservice.dto;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class RepublishExpenseEventResponse {

    private String message;
    private Long expenseId;
    private String eventId;
}
