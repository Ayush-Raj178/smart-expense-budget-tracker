package com.smartexpense.budgetservice.service;

import com.smartexpense.budgetservice.client.ExpenseSummaryClient;
import com.smartexpense.budgetservice.dto.BudgetResponse;
import com.smartexpense.budgetservice.dto.CreateBudgetRequest;
import com.smartexpense.budgetservice.dto.SaveBudgetResponse;
import com.smartexpense.budgetservice.dto.UpdateBudgetRequest;
import com.smartexpense.budgetservice.entity.Budget;
import com.smartexpense.budgetservice.event.BudgetExceededEvent;
import com.smartexpense.budgetservice.event.ExpenseAddedEvent;
import com.smartexpense.budgetservice.event.ExpenseDeletedEvent;
import com.smartexpense.budgetservice.event.ExpenseUpdatedEvent;
import com.smartexpense.budgetservice.exception.BudgetNotFoundException;
import com.smartexpense.budgetservice.repository.BudgetRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class BudgetService {

    private static final DateTimeFormatter MONTH_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM");

    private final BudgetRepository budgetRepository;
    private final BudgetOutboxService budgetOutboxService;
    private final ProcessedEventService processedEventService;
    private final ExpenseSummaryClient expenseSummaryClient;

    @Value("${app.budget.alert-threshold-percent}")
    private int alertThresholdPercent;

    @Transactional
    public SaveBudgetResponse createOrUpdateBudget(
            Long userId,
            String authorization,
            CreateBudgetRequest request) {
        Optional<Budget> existingBudget = budgetRepository
                .findByUserIdAndCategoryAndMonth(userId, request.getCategory(), request.getMonth());
        boolean created = existingBudget.isEmpty();

        Budget budget = existingBudget.orElseGet(() -> {
            BigDecimal existingExpenseTotal = expenseSummaryClient.getExistingExpenseTotal(
                    authorization,
                    request.getCategory(),
                    request.getMonth());
            return Budget.builder()
                        .userId(userId)
                        .category(request.getCategory())
                        .month(request.getMonth())
                        .currentSpent(existingExpenseTotal)
                        .build();
        });

        BigDecimal resultingLimit = created
                ? request.getMonthlyLimit()
                : budget.getMonthlyLimit().add(request.getMonthlyLimit());
        budget.setMonthlyLimit(resultingLimit);

        Budget saved = budgetRepository.save(budget);

        return SaveBudgetResponse.builder()
                .message(created
                        ? "Budget created"
                        : "Budget limit increased to ₹" + formatAmount(saved.getMonthlyLimit()))
                .budgetId(saved.getId())
                .created(created)
                .budget(toResponse(saved))
                .build();
    }

    @Transactional(readOnly = true)
    public List<BudgetResponse> listBudgets(Long userId, String month) {
        List<Budget> budgets = (month == null || month.isBlank())
                ? budgetRepository.findByUserId(userId)
                : budgetRepository.findByUserIdAndMonth(userId, month);

        return budgets.stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public BudgetResponse getBudget(Long userId, Long budgetId) {
        Budget budget = findOwnedBudget(userId, budgetId);
        return toResponse(budget);
    }

    @Transactional
    public BudgetResponse updateBudget(Long userId, Long budgetId, UpdateBudgetRequest request) {
        Budget budget = findOwnedBudget(userId, budgetId);
        budget.setMonthlyLimit(request.getMonthlyLimit());
        Budget updated = budgetRepository.save(budget);
        return toResponse(updated);
    }

    @Transactional
    public void deleteBudget(Long userId, Long budgetId) {
        Budget budget = findOwnedBudget(userId, budgetId);
        budgetRepository.delete(budget);
    }

    @Transactional
    public void handleExpenseAdded(ExpenseAddedEvent event) {
        processedEventService.processIdempotently(
                event.getEventId(),
                "ExpenseAdded",
                () -> applyExpenseAdded(event));
    }

    @Transactional
    public void handleExpenseUpdated(ExpenseUpdatedEvent event) {
        processedEventService.processIdempotently(
                event.getEventId(),
                "ExpenseUpdated",
                () -> applyExpenseUpdated(event));
    }

    @Transactional
    public void handleExpenseDeleted(ExpenseDeletedEvent event) {
        processedEventService.processIdempotently(
                event.getEventId(),
                "ExpenseDeleted",
                () -> applyExpenseDeleted(event));
    }

    private void applyExpenseAdded(ExpenseAddedEvent event) {
        if (event.getUserId() == null || event.getCategory() == null
                || event.getAmount() == null || event.getDate() == null) {
            return;
        }

        String month = event.getDate().format(MONTH_FORMAT);

        Budget budget = budgetRepository
                .findByUserIdAndCategoryAndMonth(event.getUserId(), event.getCategory(), month)
                .orElse(null);

        if (budget == null) {
            return;
        }

        BigDecimal usageBefore = usageRatio(budget);
        budget.setCurrentSpent(budget.getCurrentSpent().add(event.getAmount()));
        Budget saved = budgetRepository.save(budget);
        BigDecimal usageAfter = usageRatio(saved);

        if (isBelowThreshold(usageBefore) && isAtOrAboveThreshold(usageAfter)) {
            budgetOutboxService.enqueueBudgetExceeded(saved.getId(), BudgetExceededEvent.builder()
                    .eventId(UUID.randomUUID().toString())
                    .userId(saved.getUserId())
                    .category(saved.getCategory())
                    .monthlyLimit(saved.getMonthlyLimit())
                    .currentSpent(saved.getCurrentSpent())
                    .month(saved.getMonth())
                    .build());
        }
    }

    private void applyExpenseUpdated(ExpenseUpdatedEvent event) {
        if (event.getUserId() == null || event.getOldCategory() == null || event.getOldDate() == null
                || event.getOldAmount() == null || event.getNewCategory() == null
                || event.getNewDate() == null || event.getNewAmount() == null) {
            return;
        }

        String oldMonth = event.getOldDate().format(MONTH_FORMAT);
        String newMonth = event.getNewDate().format(MONTH_FORMAT);
        boolean sameBudget = event.getOldCategory().equals(event.getNewCategory())
                && oldMonth.equals(newMonth);

        if (sameBudget) {
            updateBudgetSpent(event.getUserId(), event.getNewCategory(), newMonth,
                    event.getNewAmount().subtract(event.getOldAmount()), true);
            return;
        }

        updateBudgetSpent(event.getUserId(), event.getOldCategory(), oldMonth,
                event.getOldAmount().negate(), false);
        updateBudgetSpent(event.getUserId(), event.getNewCategory(), newMonth,
                event.getNewAmount(), true);
    }

    private void updateBudgetSpent(Long userId, String category, String month,
                                   BigDecimal amountChange, boolean publishThresholdCrossing) {
        Budget budget = budgetRepository
                .findByUserIdAndCategoryAndMonth(userId, category, month)
                .orElse(null);

        if (budget == null) {
            return;
        }

        BigDecimal usageBefore = usageRatio(budget);
        budget.setCurrentSpent(budget.getCurrentSpent().add(amountChange));
        // Ensure currentSpent never goes negative
        if (budget.getCurrentSpent().compareTo(BigDecimal.ZERO) < 0) {
            budget.setCurrentSpent(BigDecimal.ZERO);
        }

        Budget saved = budgetRepository.save(budget);
        BigDecimal usageAfter = usageRatio(saved);

        if (publishThresholdCrossing
                && isBelowThreshold(usageBefore) && isAtOrAboveThreshold(usageAfter)) {
            budgetOutboxService.enqueueBudgetExceeded(saved.getId(), BudgetExceededEvent.builder()
                    .eventId(UUID.randomUUID().toString())
                    .userId(saved.getUserId())
                    .category(saved.getCategory())
                    .monthlyLimit(saved.getMonthlyLimit())
                    .currentSpent(saved.getCurrentSpent())
                    .month(saved.getMonth())
                    .build());
        }
    }

    private void applyExpenseDeleted(ExpenseDeletedEvent event) {
        if (event.getUserId() == null || event.getCategory() == null
                || event.getAmount() == null || event.getDate() == null) {
            return;
        }

        String month = event.getDate().format(MONTH_FORMAT);

        Budget budget = budgetRepository
                .findByUserIdAndCategoryAndMonth(event.getUserId(), event.getCategory(), month)
                .orElse(null);

        if (budget == null) {
            return;
        }

        budget.setCurrentSpent(budget.getCurrentSpent().subtract(event.getAmount()));
        // Ensure currentSpent never goes negative
        if (budget.getCurrentSpent().compareTo(BigDecimal.ZERO) < 0) {
            budget.setCurrentSpent(BigDecimal.ZERO);
        }

        budgetRepository.save(budget);
        // Note: We don't publish BudgetExceeded on delete since spending is going down
    }

    private Budget findOwnedBudget(Long userId, Long budgetId) {
        return budgetRepository.findById(budgetId)
                .filter(budget -> budget.getUserId().equals(userId))
                .orElseThrow(BudgetNotFoundException::new);
    }

    private BudgetResponse toResponse(Budget budget) {
        return BudgetResponse.builder()
                .id(budget.getId())
                .userId(budget.getUserId())
                .category(budget.getCategory())
                .monthlyLimit(budget.getMonthlyLimit())
                .currentSpent(budget.getCurrentSpent())
                .month(budget.getMonth())
                .build();
    }

    private BigDecimal usageRatio(Budget budget) {
        if (budget.getMonthlyLimit().compareTo(BigDecimal.ZERO) <= 0) {
            return BigDecimal.ZERO;
        }
        return budget.getCurrentSpent()
                .divide(budget.getMonthlyLimit(), 4, RoundingMode.HALF_UP);
    }

    private String formatAmount(BigDecimal amount) {
        return amount.stripTrailingZeros().toPlainString();
    }

    private BigDecimal thresholdRatio() {
        return BigDecimal.valueOf(alertThresholdPercent)
                .divide(BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP);
    }

    private boolean isBelowThreshold(BigDecimal usageRatio) {
        return usageRatio.compareTo(thresholdRatio()) < 0;
    }

    private boolean isAtOrAboveThreshold(BigDecimal usageRatio) {
        return usageRatio.compareTo(thresholdRatio()) >= 0;
    }
}
