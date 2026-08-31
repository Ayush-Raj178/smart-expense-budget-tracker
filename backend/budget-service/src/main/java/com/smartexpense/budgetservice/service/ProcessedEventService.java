package com.smartexpense.budgetservice.service;

import com.smartexpense.budgetservice.entity.ProcessedEvent;
import com.smartexpense.budgetservice.repository.ProcessedEventRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
@Slf4j
public class ProcessedEventService {

    private final ProcessedEventRepository processedEventRepository;

    @Transactional
    public void processIdempotently(String eventId, String eventType, Runnable action) {
        if (eventId == null || eventId.isBlank()) {
            log.warn("Missing eventId for event type {}, skipping", eventType);
            return;
        }

        if (processedEventRepository.existsById(eventId)) {
            log.info("Duplicate event skipped: eventId={} eventType={}", eventId, eventType);
            return;
        }

        action.run();

        processedEventRepository.save(ProcessedEvent.builder()
                .eventId(eventId)
                .eventType(eventType)
                .processedAt(LocalDateTime.now())
                .build());
    }
}
