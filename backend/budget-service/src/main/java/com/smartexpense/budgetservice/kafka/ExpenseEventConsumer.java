package com.smartexpense.budgetservice.kafka;

import com.smartexpense.budgetservice.event.ExpenseAddedEvent;
import com.smartexpense.budgetservice.event.ExpenseDeletedEvent;
import com.smartexpense.budgetservice.event.ExpenseUpdatedEvent;
import com.smartexpense.budgetservice.service.BudgetService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class ExpenseEventConsumer {

    private final BudgetService budgetService;

    @KafkaListener(
            topics = "${app.kafka.expense-topic}",
            groupId = "${spring.kafka.consumer.group-id}")
    public void onExpenseEvent(ConsumerRecord<String, Object> record) {
        Object event = record.value();

        if (event instanceof ExpenseAddedEvent) {
            ExpenseAddedEvent addedEvent = (ExpenseAddedEvent) event;
            log.info("Received ExpenseAdded event expenseId={} userId={} category={}",
                    addedEvent.getExpenseId(), addedEvent.getUserId(), addedEvent.getCategory());
            budgetService.handleExpenseAdded(addedEvent);
        } else if (event instanceof ExpenseUpdatedEvent) {
            ExpenseUpdatedEvent updatedEvent = (ExpenseUpdatedEvent) event;
            log.info("Received ExpenseUpdated event expenseId={} userId={} oldAmount={} newAmount={}",
                    updatedEvent.getExpenseId(), updatedEvent.getUserId(), updatedEvent.getOldAmount(), updatedEvent.getNewAmount());
            budgetService.handleExpenseUpdated(updatedEvent);
        } else if (event instanceof ExpenseDeletedEvent) {
            ExpenseDeletedEvent deletedEvent = (ExpenseDeletedEvent) event;
            log.info("Received ExpenseDeleted event expenseId={} userId={} amount={}",
                    deletedEvent.getExpenseId(), deletedEvent.getUserId(), deletedEvent.getAmount());
            budgetService.handleExpenseDeleted(deletedEvent);
        } else {
            log.warn("Received unknown event type: {}", event != null ? event.getClass().getSimpleName() : "null");
        }
    }
}
