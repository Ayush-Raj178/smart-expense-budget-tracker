package com.smartexpense.notificationservice.service;

import com.smartexpense.notificationservice.dto.NotificationResponse;
import com.smartexpense.notificationservice.entity.Notification;
import com.smartexpense.notificationservice.event.BudgetExceededEvent;
import com.smartexpense.notificationservice.exception.NotificationNotFoundException;
import com.smartexpense.notificationservice.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Month;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private static final DateTimeFormatter MONTH_INPUT = DateTimeFormatter.ofPattern("yyyy-MM");

    private final NotificationRepository notificationRepository;
    private final ProcessedEventService processedEventService;

    @Value("${app.notification.alert-threshold-percent}")
    private int alertThresholdPercent;

    @Transactional
    public void handleBudgetExceeded(BudgetExceededEvent event) {
        processedEventService.processIdempotently(
                event.getEventId(),
                "BudgetExceeded",
                () -> createBudgetExceededNotification(event));
    }

    private void createBudgetExceededNotification(BudgetExceededEvent event) {
        if (event.getUserId() == null || event.getCategory() == null || event.getMonth() == null
                || event.getCurrentSpent() == null || event.getMonthlyLimit() == null) {
            return;
        }

        Notification notification = Notification.builder()
                .userId(event.getUserId())
                .category(event.getCategory())
                .month(event.getMonth())
                .message(buildMessage(event))
                .isRead(false)
                .build();

        notificationRepository.save(notification);
    }

    @Transactional(readOnly = true)
    public List<NotificationResponse> listNotifications(Long userId) {
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(userId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public NotificationResponse markAsRead(Long userId, Long notificationId) {
        Notification notification = findOwnedNotification(userId, notificationId);
        notification.setRead(true);
        Notification updated = notificationRepository.save(notification);
        return toResponse(updated);
    }

    @Transactional
    public void deleteNotification(Long userId, Long notificationId) {
        Notification notification = findOwnedNotification(userId, notificationId);
        notificationRepository.delete(notification);
    }

    private Notification findOwnedNotification(Long userId, Long notificationId) {
        return notificationRepository.findByIdAndUserId(notificationId, userId)
                .orElseThrow(NotificationNotFoundException::new);
    }

    private String buildMessage(BudgetExceededEvent event) {
        String monthLabel = formatMonthLabel(event.getMonth());
        return String.format(
                "You've exceeded %d%% of your %s budget for %s (₹%s/₹%s)",
                alertThresholdPercent,
                event.getCategory(),
                monthLabel,
                formatAmount(event.getCurrentSpent()),
                formatAmount(event.getMonthlyLimit()));
    }

    private String formatMonthLabel(String month) {
        try {
            YearMonth yearMonth = YearMonth.parse(month, MONTH_INPUT);
            Month monthEnum = yearMonth.getMonth();
            return monthEnum.getDisplayName(java.time.format.TextStyle.FULL, Locale.ENGLISH)
                    + " " + yearMonth.getYear();
        } catch (DateTimeParseException ex) {
            return month;
        }
    }

    private String formatAmount(BigDecimal amount) {
        BigDecimal normalized = amount.stripTrailingZeros();
        if (normalized.scale() <= 0) {
            return normalized.toPlainString();
        }
        return normalized.toPlainString();
    }

    private NotificationResponse toResponse(Notification notification) {
        return NotificationResponse.builder()
                .id(notification.getId())
                .userId(notification.getUserId())
                .category(notification.getCategory())
                .message(notification.getMessage())
                .month(notification.getMonth())
                .isRead(notification.isRead())
                .createdAt(notification.getCreatedAt())
                .build();
    }
}
