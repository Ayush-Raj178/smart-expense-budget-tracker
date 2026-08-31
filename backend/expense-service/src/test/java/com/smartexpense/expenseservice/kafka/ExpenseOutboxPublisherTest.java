package com.smartexpense.expenseservice.kafka;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.smartexpense.expenseservice.entity.OutboxEvent;
import com.smartexpense.expenseservice.entity.OutboxEventStatus;
import com.smartexpense.expenseservice.event.ExpenseAddedEvent;
import com.smartexpense.expenseservice.repository.OutboxEventRepository;
import com.smartexpense.expenseservice.service.ExpenseOutboxService;
import com.smartexpense.expenseservice.service.OutboxEventStateService;
import org.apache.kafka.common.KafkaException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.CompletableFuture;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ExpenseOutboxPublisherTest {

    @Mock
    private OutboxEventRepository outboxEventRepository;

    @Mock
    private OutboxEventStateService outboxEventStateService;

    @Mock
    private KafkaTemplate<String, Object> kafkaTemplate;

    private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();
    private ExpenseOutboxPublisher publisher;
    private OutboxEvent outboxEvent;

    @BeforeEach
    void setUp() throws Exception {
        publisher = new ExpenseOutboxPublisher(
                outboxEventRepository,
                outboxEventStateService,
                kafkaTemplate,
                objectMapper);
        ReflectionTestUtils.setField(publisher, "expenseTopic", "expense-events");
        ReflectionTestUtils.setField(publisher, "batchSize", 50);
        ReflectionTestUtils.setField(publisher, "maxAttempts", 5);
        ReflectionTestUtils.setField(publisher, "publishTimeoutMs", 1000L);
        ReflectionTestUtils.setField(publisher, "claimLeaseMs", 3000L);
        ReflectionTestUtils.setField(publisher, "initialBackoffMs", 1000L);
        ReflectionTestUtils.setField(publisher, "maxBackoffMs", 60000L);

        ExpenseAddedEvent event = ExpenseAddedEvent.builder()
                .eventId("evt-101")
                .expenseId(101L)
                .userId(1L)
                .amount(new BigDecimal("1200.00"))
                .category("Food")
                .date(LocalDate.of(2026, 7, 5))
                .build();
        outboxEvent = OutboxEvent.builder()
                .id(11L)
                .aggregateId("101")
                .eventType(ExpenseOutboxService.EXPENSE_ADDED)
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
                eq(11L), any(LocalDateTime.class), any(LocalDateTime.class), eq(5)))
                .thenReturn(true);
    }

    @Test
    void publishPendingEvents_waitsForAcknowledgmentAndMarksPublished() throws Exception {
        SendResult<String, Object> sendResult = org.mockito.Mockito.mock(SendResult.class);
        when(kafkaTemplate.send(eq("expense-events"), eq("1"), any()))
                .thenReturn(CompletableFuture.completedFuture(sendResult));

        publisher.publishPendingEvents();

        ArgumentCaptor<Object> payloadCaptor = ArgumentCaptor.forClass(Object.class);
        verify(kafkaTemplate).send(eq("expense-events"), eq("1"), payloadCaptor.capture());
        assertThat(payloadCaptor.getValue()).isInstanceOf(ExpenseAddedEvent.class);
        verify(outboxEventStateService).markPublished(eq(11L), any(LocalDateTime.class));
        verify(outboxEventStateService, never())
                .scheduleRetry(any(), any(LocalDateTime.class), any());
    }

    @Test
    void publishPendingEvents_onBrokerFailureKeepsPendingForRetry() {
        CompletableFuture<SendResult<String, Object>> failed = new CompletableFuture<>();
        failed.completeExceptionally(new KafkaException("broker unavailable"));
        when(kafkaTemplate.send(eq("expense-events"), eq("1"), any())).thenReturn(failed);

        publisher.publishPendingEvents();

        verify(outboxEventStateService).scheduleRetry(
                eq(11L), any(LocalDateTime.class), org.mockito.ArgumentMatchers.contains("broker unavailable"));
        verify(outboxEventStateService, never()).markPublished(any(), any(LocalDateTime.class));
        verify(outboxEventStateService, never()).markFailed(any(), any());
    }
}
