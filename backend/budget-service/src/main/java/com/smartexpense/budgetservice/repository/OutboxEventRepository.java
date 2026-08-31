package com.smartexpense.budgetservice.repository;

import com.smartexpense.budgetservice.entity.OutboxEvent;
import com.smartexpense.budgetservice.entity.OutboxEventStatus;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface OutboxEventRepository extends JpaRepository<OutboxEvent, Long> {

    @Query("""
            select event from OutboxEvent event
            where event.status = :status
              and event.nextAttemptAt <= :now
            order by event.createdAt, event.id
            """)
    List<OutboxEvent> findReadyEvents(
            @Param("status") OutboxEventStatus status,
            @Param("now") LocalDateTime now,
            Pageable pageable);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            update OutboxEvent event
            set event.attemptCount = event.attemptCount + 1,
                event.nextAttemptAt = :leaseUntil
            where event.id = :id
              and event.status = com.smartexpense.budgetservice.entity.OutboxEventStatus.PENDING
              and event.nextAttemptAt <= :now
              and event.attemptCount < :maxAttempts
            """)
    int claimForPublishing(
            @Param("id") Long id,
            @Param("now") LocalDateTime now,
            @Param("leaseUntil") LocalDateTime leaseUntil,
            @Param("maxAttempts") int maxAttempts);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            update OutboxEvent event
            set event.status = com.smartexpense.budgetservice.entity.OutboxEventStatus.PUBLISHED,
                event.publishedAt = :publishedAt,
                event.lastError = null
            where event.id = :id
              and event.status = com.smartexpense.budgetservice.entity.OutboxEventStatus.PENDING
            """)
    int markPublished(@Param("id") Long id, @Param("publishedAt") LocalDateTime publishedAt);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            update OutboxEvent event
            set event.nextAttemptAt = :nextAttemptAt,
                event.lastError = :lastError
            where event.id = :id
              and event.status = com.smartexpense.budgetservice.entity.OutboxEventStatus.PENDING
            """)
    int scheduleRetry(
            @Param("id") Long id,
            @Param("nextAttemptAt") LocalDateTime nextAttemptAt,
            @Param("lastError") String lastError);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            update OutboxEvent event
            set event.status = com.smartexpense.budgetservice.entity.OutboxEventStatus.FAILED,
                event.lastError = :lastError
            where event.id = :id
              and event.status = com.smartexpense.budgetservice.entity.OutboxEventStatus.PENDING
            """)
    int markFailed(@Param("id") Long id, @Param("lastError") String lastError);
}
