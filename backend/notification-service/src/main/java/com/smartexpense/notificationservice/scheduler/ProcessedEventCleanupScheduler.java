package com.smartexpense.notificationservice.scheduler;

import com.smartexpense.notificationservice.repository.ProcessedEventRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Component
@RequiredArgsConstructor
@Slf4j
public class ProcessedEventCleanupScheduler {

    private final ProcessedEventRepository processedEventRepository;

    @Value("${app.processed-events.retention-days:7}")
    private int retentionDays;

    @Scheduled(cron = "${app.processed-events.cleanup-cron:0 0 2 * * *}")
    @Transactional
    public void cleanupOldProcessedEvents() {
        LocalDateTime cutoff = LocalDateTime.now().minusDays(retentionDays);
        int deleted = processedEventRepository.deleteByProcessedAtBefore(cutoff);
        log.info("Deleted {} processed event records older than {}", deleted, cutoff);
    }
}
