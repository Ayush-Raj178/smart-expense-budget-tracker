package com.smartexpense.expenseservice.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.smartexpense.expenseservice.entity.OutboxEvent;
import com.smartexpense.expenseservice.event.ExpenseAddedEvent;
import com.smartexpense.expenseservice.event.ExpenseDeletedEvent;
import com.smartexpense.expenseservice.event.ExpenseUpdatedEvent;
import com.smartexpense.expenseservice.repository.OutboxEventRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ExpenseOutboxService {

    public static final String EXPENSE_ADDED = "ExpenseAdded";
    public static final String EXPENSE_UPDATED = "ExpenseUpdated";
    public static final String EXPENSE_DELETED = "ExpenseDeleted";

    private final OutboxEventRepository outboxEventRepository;
    private final ObjectMapper objectMapper;

    @Transactional(propagation = Propagation.MANDATORY)
    public void enqueueExpenseAdded(ExpenseAddedEvent event) {
        enqueue(String.valueOf(event.getExpenseId()), EXPENSE_ADDED, event);
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void enqueueExpenseUpdated(ExpenseUpdatedEvent event) {
        enqueue(String.valueOf(event.getExpenseId()), EXPENSE_UPDATED, event);
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void enqueueExpenseDeleted(ExpenseDeletedEvent event) {
        enqueue(String.valueOf(event.getExpenseId()), EXPENSE_DELETED, event);
    }

    private void enqueue(String aggregateId, String eventType, Object event) {
        try {
            outboxEventRepository.save(OutboxEvent.builder()
                    .aggregateId(aggregateId)
                    .eventType(eventType)
                    .payload(objectMapper.writeValueAsString(event))
                    .build());
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Could not serialize " + eventType + " for the outbox", exception);
        }
    }
}
