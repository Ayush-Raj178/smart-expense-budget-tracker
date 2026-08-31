package com.smartexpense.budgetservice.service;

import com.smartexpense.budgetservice.repository.OutboxEventRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class OutboxEventStateService {

    private final OutboxEventRepository outboxEventRepository;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean claim(Long id, LocalDateTime now, LocalDateTime leaseUntil, int maxAttempts) {
        return outboxEventRepository.claimForPublishing(id, now, leaseUntil, maxAttempts) == 1;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void markPublished(Long id, LocalDateTime publishedAt) {
        outboxEventRepository.markPublished(id, publishedAt);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void scheduleRetry(Long id, LocalDateTime nextAttemptAt, String lastError) {
        outboxEventRepository.scheduleRetry(id, nextAttemptAt, lastError);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void markFailed(Long id, String lastError) {
        outboxEventRepository.markFailed(id, lastError);
    }
}
