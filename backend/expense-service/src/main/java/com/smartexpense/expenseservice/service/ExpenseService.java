package com.smartexpense.expenseservice.service;

import com.smartexpense.expenseservice.dto.CreateExpenseRequest;
import com.smartexpense.expenseservice.dto.CreateExpenseResponse;
import com.smartexpense.expenseservice.dto.ExpenseResponse;
import com.smartexpense.expenseservice.dto.RepublishExpenseEventResponse;
import com.smartexpense.expenseservice.dto.UpdateExpenseRequest;
import com.smartexpense.expenseservice.entity.Expense;
import com.smartexpense.expenseservice.event.ExpenseAddedEvent;
import com.smartexpense.expenseservice.event.ExpenseDeletedEvent;
import com.smartexpense.expenseservice.event.ExpenseUpdatedEvent;
import com.smartexpense.expenseservice.exception.ExpenseNotFoundException;
import com.smartexpense.expenseservice.exception.MissingAddedEventIdException;
import com.smartexpense.expenseservice.repository.ExpenseRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ExpenseService {

    private final ExpenseRepository expenseRepository;
    private final ExpenseOutboxService expenseOutboxService;

    @Transactional
    public CreateExpenseResponse createExpense(Long userId, CreateExpenseRequest request) {
        String eventId = UUID.randomUUID().toString();

        Expense expense = Expense.builder()
                .userId(userId)
                .amount(request.getAmount())
                .category(request.getCategory())
                .description(request.getDescription())
                .date(request.getDate())
                .addedEventId(eventId)
                .build();

        Expense saved = expenseRepository.save(expense);

        expenseOutboxService.enqueueExpenseAdded(ExpenseAddedEvent.builder()
                .eventId(eventId)
                .expenseId(saved.getId())
                .userId(saved.getUserId())
                .amount(saved.getAmount())
                .category(saved.getCategory())
                .date(saved.getDate())
                .build());

        return CreateExpenseResponse.builder()
                .message("Expense added successfully")
                .expenseId(saved.getId())
                .build();
    }

    @Transactional(readOnly = true)
    public List<ExpenseResponse> listExpenses(
            Long userId,
            String category,
            LocalDate startDate,
            LocalDate endDate) {

        Specification<Expense> specification = Specification.where(belongsToUser(userId));

        if (category != null && !category.isBlank()) {
            specification = specification.and(hasCategory(category));
        }
        if (startDate != null) {
            specification = specification.and(dateOnOrAfter(startDate));
        }
        if (endDate != null) {
            specification = specification.and(dateOnOrBefore(endDate));
        }

        return expenseRepository.findAll(specification, Sort.by(Sort.Direction.DESC, "date", "id"))
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public BigDecimal summarizeExpenses(Long userId, String category, String month) {
        YearMonth requestedMonth = YearMonth.parse(month);
        BigDecimal total = expenseRepository.sumAmountByUserCategoryAndDateRange(
                userId,
                category,
                requestedMonth.atDay(1),
                requestedMonth.atEndOfMonth());
        return total == null ? BigDecimal.ZERO : total;
    }

    @Transactional(readOnly = true)
    public ExpenseResponse getExpense(Long userId, Long expenseId) {
        Expense expense = findOwnedExpense(userId, expenseId);
        return toResponse(expense);
    }

    @Transactional
    public ExpenseResponse updateExpense(Long userId, Long expenseId, UpdateExpenseRequest request) {
        Expense expense = findOwnedExpense(userId, expenseId);
        BigDecimal oldAmount = expense.getAmount();
        String oldCategory = expense.getCategory();
        LocalDate oldDate = expense.getDate();

        expense.setAmount(request.getAmount());
        expense.setCategory(request.getCategory());
        expense.setDescription(request.getDescription());
        expense.setDate(request.getDate());

        Expense updated = expenseRepository.save(expense);

        expenseOutboxService.enqueueExpenseUpdated(ExpenseUpdatedEvent.builder()
                .eventId(UUID.randomUUID().toString())
                .expenseId(updated.getId())
                .userId(updated.getUserId())
                .oldAmount(oldAmount)
                .oldCategory(oldCategory)
                .oldDate(oldDate)
                .newAmount(updated.getAmount())
                .newCategory(updated.getCategory())
                .newDate(updated.getDate())
                .build());

        return toResponse(updated);
    }

    @Transactional
    public void deleteExpense(Long userId, Long expenseId) {
        Expense expense = findOwnedExpense(userId, expenseId);

        expenseOutboxService.enqueueExpenseDeleted(ExpenseDeletedEvent.builder()
                .eventId(UUID.randomUUID().toString())
                .expenseId(expense.getId())
                .userId(expense.getUserId())
                .amount(expense.getAmount())
                .category(expense.getCategory())
                .date(expense.getDate())
                .build());

        expenseRepository.delete(expense);
    }

    /**
     * Re-publishes the original ExpenseAdded event for idempotency testing.
     * Uses the stored {@code addedEventId} so budget-service sees a duplicate delivery.
     */
    @Transactional
    public RepublishExpenseEventResponse republishExpenseAddedEvent(Long userId, Long expenseId) {
        Expense expense = findOwnedExpense(userId, expenseId);

        if (expense.getAddedEventId() == null || expense.getAddedEventId().isBlank()) {
            throw new MissingAddedEventIdException();
        }

        expenseOutboxService.enqueueExpenseAdded(ExpenseAddedEvent.builder()
                .eventId(expense.getAddedEventId())
                .expenseId(expense.getId())
                .userId(expense.getUserId())
                .amount(expense.getAmount())
                .category(expense.getCategory())
                .date(expense.getDate())
                .build());

        return RepublishExpenseEventResponse.builder()
                .message("ExpenseAdded event republished for idempotency testing")
                .expenseId(expense.getId())
                .eventId(expense.getAddedEventId())
                .build();
    }

    private Expense findOwnedExpense(Long userId, Long expenseId) {
        return expenseRepository.findById(expenseId)
                .filter(expense -> expense.getUserId().equals(userId))
                .orElseThrow(ExpenseNotFoundException::new);
    }

    private ExpenseResponse toResponse(Expense expense) {
        return ExpenseResponse.builder()
                .id(expense.getId())
                .userId(expense.getUserId())
                .amount(expense.getAmount())
                .category(expense.getCategory())
                .description(expense.getDescription())
                .date(expense.getDate())
                .build();
    }

    private Specification<Expense> belongsToUser(Long userId) {
        return (root, query, criteriaBuilder) -> criteriaBuilder.equal(root.get("userId"), userId);
    }

    private Specification<Expense> hasCategory(String category) {
        return (root, query, criteriaBuilder) ->
                criteriaBuilder.equal(criteriaBuilder.lower(root.get("category")), category.toLowerCase());
    }

    private Specification<Expense> dateOnOrAfter(LocalDate startDate) {
        return (root, query, criteriaBuilder) ->
                criteriaBuilder.greaterThanOrEqualTo(root.get("date"), startDate);
    }

    private Specification<Expense> dateOnOrBefore(LocalDate endDate) {
        return (root, query, criteriaBuilder) ->
                criteriaBuilder.lessThanOrEqualTo(root.get("date"), endDate);
    }
}
