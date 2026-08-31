package com.smartexpense.notificationservice.kafka;

import com.smartexpense.notificationservice.event.BudgetExceededEvent;
import com.smartexpense.notificationservice.service.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class BudgetExceededEventConsumer {

    private final NotificationService notificationService;

    @KafkaListener(
            topics = "${app.kafka.budget-exceeded-topic}",
            groupId = "${spring.kafka.consumer.group-id}")
    public void onBudgetExceeded(BudgetExceededEvent event) {
        log.info("Received BudgetExceeded event userId={} category={} month={}",
                event.getUserId(), event.getCategory(), event.getMonth());
        notificationService.handleBudgetExceeded(event);
    }
}
