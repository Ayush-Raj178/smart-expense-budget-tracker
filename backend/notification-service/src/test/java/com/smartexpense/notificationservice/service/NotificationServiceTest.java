package com.smartexpense.notificationservice.service;

import com.smartexpense.notificationservice.dto.NotificationResponse;
import com.smartexpense.notificationservice.entity.Notification;
import com.smartexpense.notificationservice.event.BudgetExceededEvent;
import com.smartexpense.notificationservice.exception.NotificationNotFoundException;
import com.smartexpense.notificationservice.repository.NotificationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NotificationServiceTest {

    @Mock
    private NotificationRepository notificationRepository;

    @Mock
    private ProcessedEventService processedEventService;

    @InjectMocks
    private NotificationService notificationService;

    private BudgetExceededEvent budgetExceededEvent;
    private Notification notification;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(notificationService, "alertThresholdPercent", 80);

        budgetExceededEvent = BudgetExceededEvent.builder()
                .eventId("evt-budget-exceeded-1")
                .userId(1L)
                .category("Food")
                .monthlyLimit(new BigDecimal("1500.00"))
                .currentSpent(new BigDecimal("1300.00"))
                .month("2026-07")
                .build();

        notification = Notification.builder()
                .id(1L)
                .userId(1L)
                .category("Food")
                .message("You've exceeded 80% of your Food budget for July 2026 (₹1300/₹1500)")
                .month("2026-07")
                .isRead(false)
                .createdAt(LocalDateTime.of(2026, 7, 5, 10, 30))
                .build();
    }

    @Test
    void handleBudgetExceeded_createsNotificationWithFormattedMessage() {
        executeIdempotentAction();
        when(notificationRepository.save(any(Notification.class))).thenAnswer(invocation -> {
            Notification saved = invocation.getArgument(0);
            saved.setId(1L);
            return saved;
        });

        notificationService.handleBudgetExceeded(budgetExceededEvent);

        ArgumentCaptor<Notification> notificationCaptor = ArgumentCaptor.forClass(Notification.class);
        verify(notificationRepository).save(notificationCaptor.capture());

        Notification saved = notificationCaptor.getValue();
        assertThat(saved.getUserId()).isEqualTo(1L);
        assertThat(saved.getCategory()).isEqualTo("Food");
        assertThat(saved.getMonth()).isEqualTo("2026-07");
        assertThat(saved.isRead()).isFalse();
        assertThat(saved.getMessage())
                .isEqualTo("You've exceeded 80% of your Food budget for July 2026 (₹1300/₹1500)");
    }

    @Test
    void handleBudgetExceeded_doesNothingWhenEventIsIncomplete() {
        executeIdempotentAction();
        BudgetExceededEvent incompleteEvent = BudgetExceededEvent.builder()
                .userId(1L)
                .category("Food")
                .build();

        notificationService.handleBudgetExceeded(incompleteEvent);

        verify(notificationRepository, never()).save(any());
    }

    @Test
    void listNotifications_returnsNotificationsForUser() {
        when(notificationRepository.findByUserIdOrderByCreatedAtDesc(1L))
                .thenReturn(List.of(notification));

        List<NotificationResponse> responses = notificationService.listNotifications(1L);

        assertThat(responses).hasSize(1);
        assertThat(responses.get(0).getId()).isEqualTo(1L);
        assertThat(responses.get(0).getCategory()).isEqualTo("Food");
        assertThat(responses.get(0).isRead()).isFalse();
    }

    @Test
    void markAsRead_marksOwnedNotificationAsRead() {
        when(notificationRepository.findByIdAndUserId(1L, 1L)).thenReturn(Optional.of(notification));
        when(notificationRepository.save(notification)).thenReturn(notification);

        NotificationResponse response = notificationService.markAsRead(1L, 1L);

        assertThat(notification.isRead()).isTrue();
        assertThat(response.isRead()).isTrue();
    }

    @Test
    void markAsRead_throwsWhenNotificationNotFound() {
        when(notificationRepository.findByIdAndUserId(1L, 1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> notificationService.markAsRead(1L, 1L))
                .isInstanceOf(NotificationNotFoundException.class)
                .hasMessage("Notification not found");
    }

    @Test
    void deleteNotification_deletesOwnedNotification() {
        when(notificationRepository.findByIdAndUserId(1L, 1L)).thenReturn(Optional.of(notification));

        notificationService.deleteNotification(1L, 1L);

        verify(notificationRepository).delete(notification);
    }

    @Test
    void deleteNotification_throwsWhenNotificationNotFound() {
        when(notificationRepository.findByIdAndUserId(1L, 1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> notificationService.deleteNotification(1L, 1L))
                .isInstanceOf(NotificationNotFoundException.class)
                .hasMessage("Notification not found");
    }

    private void executeIdempotentAction() {
        doAnswer(invocation -> {
            Runnable action = invocation.getArgument(2);
            action.run();
            return null;
        }).when(processedEventService).processIdempotently(anyString(), anyString(), any(Runnable.class));
    }
}
