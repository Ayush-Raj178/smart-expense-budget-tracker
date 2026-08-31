package com.smartexpense.budgetservice.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.smartexpense.budgetservice.entity.OutboxEvent;
import com.smartexpense.budgetservice.entity.OutboxEventStatus;
import com.smartexpense.budgetservice.event.BudgetExceededEvent;
import com.smartexpense.budgetservice.repository.OutboxEventRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class BudgetOutboxServiceTest {

    @Mock
    private OutboxEventRepository outboxEventRepository;

    private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();

    private BudgetOutboxService budgetOutboxService;

    @BeforeEach
    void setUp() {
        budgetOutboxService = new BudgetOutboxService(outboxEventRepository, objectMapper);
    }

    @Test
    void enqueueBudgetExceeded_createsPendingOutboxRow() throws Exception {
        BudgetExceededEvent event = BudgetExceededEvent.builder()
                .eventId("evt-budget-1")
                .userId(1L)
                .category("Food")
                .monthlyLimit(new BigDecimal("10000.00"))
                .currentSpent(new BigDecimal("8500.00"))
                .month("2026-07")
                .build();

        budgetOutboxService.enqueueBudgetExceeded(1L, event);

        ArgumentCaptor<OutboxEvent> captor = ArgumentCaptor.forClass(OutboxEvent.class);
        verify(outboxEventRepository).save(captor.capture());
        OutboxEvent outboxEvent = captor.getValue();
        assertThat(outboxEvent.getAggregateId()).isEqualTo("1");
        assertThat(outboxEvent.getEventType()).isEqualTo(BudgetOutboxService.BUDGET_EXCEEDED);
        assertThat(outboxEvent.getStatus()).isEqualTo(OutboxEventStatus.PENDING);
        assertThat(outboxEvent.getAttemptCount()).isZero();
        assertThat(objectMapper.readValue(outboxEvent.getPayload(), BudgetExceededEvent.class).getEventId())
                .isEqualTo("evt-budget-1");
    }
}
