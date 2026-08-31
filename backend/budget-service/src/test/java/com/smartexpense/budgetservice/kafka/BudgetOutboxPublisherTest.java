package com.smartexpense.budgetservice.kafka;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.smartexpense.budgetservice.entity.OutboxEvent;
import com.smartexpense.budgetservice.entity.OutboxEventStatus;
import com.smartexpense.budgetservice.event.BudgetExceededEvent;
import com.smartexpense.budgetservice.repository.OutboxEventRepository;
import com.smartexpense.budgetservice.service.BudgetOutboxService;
import com.smartexpense.budgetservice.service.OutboxEventStateService;
import org.apache.kafka.common.KafkaException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.CompletableFuture;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BudgetOutboxPublisherTest {

    @Mock
    private OutboxEventRepository outboxEventRepository;

    @Mock
    private OutboxEventStateService outboxEventStateService;

    @Mock
    private KafkaTemplate<String, Object> kafkaTemplate;

    private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();
    private BudgetOutboxPublisher publisher;
    private OutboxEvent outboxEvent;

    @BeforeEach
    void setUp() throws Exception {
        publisher = new BudgetOutboxPublisher(
                outboxEventRepository,
                outboxEventStateService,
                kafkaTemplate,
                objectMapper);
        ReflectionTestUtils.setField(publisher, "budgetExceededTopic", "budget-exceeded");
        ReflectionTestUtils.setField(publisher, "batchSize", 50);
        ReflectionTestUtils.setField(publisher, "maxAttempts", 5);
        ReflectionTestUtils.setField(publisher, "publishTimeoutMs", 1000L);
        ReflectionTestUtils.setField(publisher, "claimLeaseMs", 3000L);
        ReflectionTestUtils.setField(publisher, "initialBackoffMs", 1000L);
        ReflectionTestUtils.setField(publisher, "maxBackoffMs", 60000L);

        BudgetExceededEvent event = BudgetExceededEvent.builder()
                .eventId("evt-budget-1")
                .userId(1L)
                .category("Food")
                .monthlyLimit(new BigDecimal("10000.00"))
                .currentSpent(new BigDecimal("8500.00"))
                .month("2026-07")
                .build();
        outboxEvent = OutboxEvent.builder()
                .id(21L)
                .aggregateId("1")
                .eventType(BudgetOutboxService.BUDGET_EXCEEDED)
                .payload(objectMapper.writeValueAsString(event))
                .status(OutboxEventStatus.PENDING)
                .attemptCount(0)
                .createdAt(LocalDateTime.now().minusSeconds(1))
                .nextAttemptAt(LocalDateTime.now().minusSeconds(1))
                .build();

        when(outboxEventRepository.findReadyEvents(
                eq(OutboxEventStatus.PENDING), any(LocalDateTime.class), any(Pageable.class)))
                .thenReturn(List.of(outboxEvent));
        when(outboxEventStateService.claim(
                eq(21L), any(LocalDateTime.class), any(LocalDateTime.class), eq(5)))
                .thenReturn(true);
    }

    @Test
    void publishPendingEvents_waitsForAcknowledgmentAndMarksPublished() {
        SendResult<String, Object> sendResult = org.mockito.Mockito.mock(SendResult.class);
        when(kafkaTemplate.send(eq("budget-exceeded"), eq("1"), any()))
                .thenReturn(CompletableFuture.completedFuture(sendResult));

        publisher.publishPendingEvents();

        verify(kafkaTemplate).send(eq("budget-exceeded"), eq("1"), any(BudgetExceededEvent.class));
        verify(outboxEventStateService).markPublished(eq(21L), any(LocalDateTime.class));
        verify(outboxEventStateService, never())
                .scheduleRetry(any(), any(LocalDateTime.class), any());
    }

    @Test
    void publishPendingEvents_onBrokerFailureKeepsPendingForRetry() {
        CompletableFuture<SendResult<String, Object>> failed = new CompletableFuture<>();
        failed.completeExceptionally(new KafkaException("broker unavailable"));
        when(kafkaTemplate.send(eq("budget-exceeded"), eq("1"), any())).thenReturn(failed);

        publisher.publishPendingEvents();

        verify(outboxEventStateService).scheduleRetry(
                eq(21L), any(LocalDateTime.class), org.mockito.ArgumentMatchers.contains("broker unavailable"));
        verify(outboxEventStateService, never()).markPublished(any(), any(LocalDateTime.class));
        verify(outboxEventStateService, never()).markFailed(any(), any());
    }
}
