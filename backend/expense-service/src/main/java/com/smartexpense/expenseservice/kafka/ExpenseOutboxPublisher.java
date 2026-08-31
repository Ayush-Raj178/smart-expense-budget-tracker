package com.smartexpense.expenseservice.kafka;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.smartexpense.expenseservice.entity.OutboxEvent;
import com.smartexpense.expenseservice.entity.OutboxEventStatus;
import com.smartexpense.expenseservice.event.ExpenseAddedEvent;
import com.smartexpense.expenseservice.event.ExpenseDeletedEvent;
import com.smartexpense.expenseservice.event.ExpenseUpdatedEvent;
import com.smartexpense.expenseservice.repository.OutboxEventRepository;
import com.smartexpense.expenseservice.service.ExpenseOutboxService;
import com.smartexpense.expenseservice.service.OutboxEventStateService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.TimeUnit;

@Component
@RequiredArgsConstructor
@Slf4j
public class ExpenseOutboxPublisher {

    private static final int MAX_ERROR_LENGTH = 2000;

    private final OutboxEventRepository outboxEventRepository;
    private final OutboxEventStateService outboxEventStateService;
    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final ObjectMapper objectMapper;

    @Value("${app.kafka.expense-topic}")
    private String expenseTopic;

    @Value("${app.outbox.batch-size:50}")
    private int batchSize;

    @Value("${app.outbox.max-attempts:5}")
    private int maxAttempts;

    @Value("${app.outbox.publish-timeout-ms:10000}")
    private long publishTimeoutMs;

    @Value("${app.outbox.claim-lease-ms:30000}")
    private long claimLeaseMs;

    @Value("${app.outbox.initial-backoff-ms:1000}")
    private long initialBackoffMs;

    @Value("${app.outbox.max-backoff-ms:60000}")
    private long maxBackoffMs;

    @Scheduled(fixedDelayString = "${app.outbox.poll-interval-ms:2000}")
    public void publishPendingEvents() {
        LocalDateTime now = LocalDateTime.now();
        List<OutboxEvent> events = outboxEventRepository.findReadyEvents(
                OutboxEventStatus.PENDING,
                now,
                PageRequest.of(0, batchSize));

        for (OutboxEvent event : events) {
            publish(event);
        }
    }

    private void publish(OutboxEvent event) {
        if (event.getAttemptCount() >= maxAttempts) {
            String message = "Retry limit reached before the event could be published";
            outboxEventStateService.markFailed(event.getId(), message);
            log.error("Outbox event permanently failed: id={} aggregateId={} eventType={} attempts={}",
                    event.getId(), event.getAggregateId(), event.getEventType(), event.getAttemptCount());
            return;
        }

        LocalDateTime claimTime = LocalDateTime.now();
        long effectiveLeaseMs = Math.max(claimLeaseMs, publishTimeoutMs + 1000);
        LocalDateTime leaseUntil = claimTime.plusNanos(TimeUnit.MILLISECONDS.toNanos(effectiveLeaseMs));
        if (!outboxEventStateService.claim(event.getId(), claimTime, leaseUntil, maxAttempts)) {
            return;
        }

        int attemptNumber = event.getAttemptCount() + 1;
        try {
            KafkaPayload payload = deserialize(event);
            kafkaTemplate.send(expenseTopic, payload.key(), payload.value())
                    .get(publishTimeoutMs, TimeUnit.MILLISECONDS);
            outboxEventStateService.markPublished(event.getId(), LocalDateTime.now());
            log.info("Published outbox event: id={} aggregateId={} eventType={} attempt={}",
                    event.getId(), event.getAggregateId(), event.getEventType(), attemptNumber);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            handleFailure(event, attemptNumber, exception);
        } catch (Exception exception) {
            handleFailure(event, attemptNumber, exception);
        }
    }

    private KafkaPayload deserialize(OutboxEvent event) throws JsonProcessingException {
        return switch (event.getEventType()) {
            case ExpenseOutboxService.EXPENSE_ADDED -> payload(
                    objectMapper.readValue(event.getPayload(), ExpenseAddedEvent.class));
            case ExpenseOutboxService.EXPENSE_UPDATED -> payload(
                    objectMapper.readValue(event.getPayload(), ExpenseUpdatedEvent.class));
            case ExpenseOutboxService.EXPENSE_DELETED -> payload(
                    objectMapper.readValue(event.getPayload(), ExpenseDeletedEvent.class));
            default -> throw new IllegalArgumentException("Unsupported outbox event type: " + event.getEventType());
        };
    }

    private KafkaPayload payload(ExpenseAddedEvent event) {
        return new KafkaPayload(String.valueOf(event.getUserId()), event);
    }

    private KafkaPayload payload(ExpenseUpdatedEvent event) {
        return new KafkaPayload(String.valueOf(event.getUserId()), event);
    }

    private KafkaPayload payload(ExpenseDeletedEvent event) {
        return new KafkaPayload(String.valueOf(event.getUserId()), event);
    }

    private void handleFailure(OutboxEvent event, int attemptNumber, Exception exception) {
        Throwable cause = exception.getCause() == null ? exception : exception.getCause();
        String error = truncate(cause.getClass().getSimpleName() + ": " + cause.getMessage());

        if (attemptNumber >= maxAttempts) {
            outboxEventStateService.markFailed(event.getId(), error);
            log.error("Outbox event permanently failed: id={} aggregateId={} eventType={} attempts={} error={}",
                    event.getId(), event.getAggregateId(), event.getEventType(), attemptNumber, error, cause);
            return;
        }

        long backoffMs = calculateBackoff(attemptNumber);
        LocalDateTime nextAttemptAt = LocalDateTime.now()
                .plusNanos(TimeUnit.MILLISECONDS.toNanos(backoffMs));
        outboxEventStateService.scheduleRetry(event.getId(), nextAttemptAt, error);
        log.warn("Outbox publish failed; scheduled retry: id={} aggregateId={} eventType={} attempt={}/{} backoffMs={} error={}",
                event.getId(), event.getAggregateId(), event.getEventType(),
                attemptNumber, maxAttempts, backoffMs, error);
    }

    private long calculateBackoff(int attemptNumber) {
        int exponent = Math.min(Math.max(attemptNumber - 1, 0), 20);
        long multiplier = 1L << exponent;
        if (initialBackoffMs > maxBackoffMs / multiplier) {
            return maxBackoffMs;
        }
        return Math.min(initialBackoffMs * multiplier, maxBackoffMs);
    }

    private String truncate(String value) {
        if (value == null) {
            return "Unknown Kafka publish failure";
        }
        return value.length() <= MAX_ERROR_LENGTH ? value : value.substring(0, MAX_ERROR_LENGTH);
    }

    private record KafkaPayload(String key, Object value) {
    }
}
