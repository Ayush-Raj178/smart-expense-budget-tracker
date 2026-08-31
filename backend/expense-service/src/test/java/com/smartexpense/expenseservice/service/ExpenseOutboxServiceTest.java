package com.smartexpense.expenseservice.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.smartexpense.expenseservice.entity.OutboxEvent;
import com.smartexpense.expenseservice.entity.OutboxEventStatus;
import com.smartexpense.expenseservice.event.ExpenseAddedEvent;
import com.smartexpense.expenseservice.repository.OutboxEventRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class ExpenseOutboxServiceTest {

    @Mock
    private OutboxEventRepository outboxEventRepository;

    private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();

    private ExpenseOutboxService expenseOutboxService;

    @BeforeEach
    void setUp() {
        expenseOutboxService = new ExpenseOutboxService(outboxEventRepository, objectMapper);
    }

    @Test
    void enqueueExpenseAdded_createsPendingOutboxRow() throws Exception {
        ExpenseAddedEvent event = ExpenseAddedEvent.builder()
                .eventId("evt-101")
                .expenseId(101L)
                .userId(1L)
                .amount(new BigDecimal("1200.00"))
                .category("Food")
                .date(LocalDate.of(2026, 7, 5))
                .build();

        expenseOutboxService.enqueueExpenseAdded(event);

        ArgumentCaptor<OutboxEvent> captor = ArgumentCaptor.forClass(OutboxEvent.class);
        verify(outboxEventRepository).save(captor.capture());
        OutboxEvent outboxEvent = captor.getValue();
        assertThat(outboxEvent.getAggregateId()).isEqualTo("101");
        assertThat(outboxEvent.getEventType()).isEqualTo(ExpenseOutboxService.EXPENSE_ADDED);
        assertThat(outboxEvent.getStatus()).isEqualTo(OutboxEventStatus.PENDING);
        assertThat(outboxEvent.getAttemptCount()).isZero();
        assertThat(objectMapper.readValue(outboxEvent.getPayload(), ExpenseAddedEvent.class).getEventId())
                .isEqualTo("evt-101");
    }
}
