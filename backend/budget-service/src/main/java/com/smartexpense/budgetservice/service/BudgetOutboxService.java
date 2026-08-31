package com.smartexpense.budgetservice.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.smartexpense.budgetservice.entity.OutboxEvent;
import com.smartexpense.budgetservice.event.BudgetExceededEvent;
import com.smartexpense.budgetservice.repository.OutboxEventRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class BudgetOutboxService {

    public static final String BUDGET_EXCEEDED = "BudgetExceeded";

    private final OutboxEventRepository outboxEventRepository;
    private final ObjectMapper objectMapper;

    @Transactional(propagation = Propagation.MANDATORY)
    public void enqueueBudgetExceeded(Long budgetId, BudgetExceededEvent event) {
        try {
            outboxEventRepository.save(OutboxEvent.builder()
                    .aggregateId(String.valueOf(budgetId))
                    .eventType(BUDGET_EXCEEDED)
                    .payload(objectMapper.writeValueAsString(event))
                    .build());
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Could not serialize BudgetExceeded for the outbox", exception);
        }
    }
}
