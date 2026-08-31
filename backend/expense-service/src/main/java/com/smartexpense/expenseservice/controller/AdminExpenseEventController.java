package com.smartexpense.expenseservice.controller;

import com.smartexpense.expenseservice.dto.RepublishExpenseEventResponse;
import com.smartexpense.expenseservice.security.SecurityUtils;
import com.smartexpense.expenseservice.service.ExpenseService;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Dev/test-only endpoints for Kafka idempotency testing. Not part of the public API contract.
 * Disabled unless {@code app.admin.republish-events-enabled=true}.
 */
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@ConditionalOnProperty(name = "app.admin.republish-events-enabled", havingValue = "true")
public class AdminExpenseEventController {

    private final ExpenseService expenseService;

    @PostMapping("/republish-expense-event/{expenseId}")
    public ResponseEntity<RepublishExpenseEventResponse> republishExpenseAddedEvent(
            @PathVariable Long expenseId) {
        Long userId = SecurityUtils.getCurrentUserId();
        RepublishExpenseEventResponse response =
                expenseService.republishExpenseAddedEvent(userId, expenseId);
        return ResponseEntity.ok(response);
    }
}
