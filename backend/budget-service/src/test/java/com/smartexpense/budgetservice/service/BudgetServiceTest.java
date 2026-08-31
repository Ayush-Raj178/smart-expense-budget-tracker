package com.smartexpense.budgetservice.service;

import com.smartexpense.budgetservice.client.ExpenseSummaryClient;

import com.smartexpense.budgetservice.dto.BudgetResponse;
import com.smartexpense.budgetservice.dto.CreateBudgetRequest;
import com.smartexpense.budgetservice.dto.SaveBudgetResponse;
import com.smartexpense.budgetservice.dto.UpdateBudgetRequest;
import com.smartexpense.budgetservice.entity.Budget;
import com.smartexpense.budgetservice.event.BudgetExceededEvent;
import com.smartexpense.budgetservice.event.ExpenseAddedEvent;
import com.smartexpense.budgetservice.event.ExpenseUpdatedEvent;
import com.smartexpense.budgetservice.exception.BudgetNotFoundException;
import com.smartexpense.budgetservice.repository.BudgetRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BudgetServiceTest {

    @Mock
    private BudgetRepository budgetRepository;

    @Mock
    private BudgetOutboxService budgetOutboxService;

    @Mock
    private ProcessedEventService processedEventService;

    @Mock
    private ExpenseSummaryClient expenseSummaryClient;

    @InjectMocks
    private BudgetService budgetService;

    private CreateBudgetRequest createRequest;
    private Budget budget;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(budgetService, "alertThresholdPercent", 80);

        lenient().doAnswer(invocation -> {
            Runnable action = invocation.getArgument(2);
            action.run();
            return null;
        }).when(processedEventService).processIdempotently(anyString(), anyString(), any(Runnable.class));

        createRequest = new CreateBudgetRequest("Food", new BigDecimal("10000.00"), "2026-07");

        budget = Budget.builder()
                .id(1L)
                .userId(1L)
                .category("Food")
                .monthlyLimit(new BigDecimal("10000.00"))
                .currentSpent(new BigDecimal("7000.00"))
                .month("2026-07")
                .build();
    }

    @Test
    void createOrUpdateBudget_createsNewBudget() {
        when(budgetRepository.findByUserIdAndCategoryAndMonth(1L, "Food", "2026-07"))
                .thenReturn(Optional.empty());
        when(expenseSummaryClient.getExistingExpenseTotal("Bearer token", "Food", "2026-07"))
                .thenReturn(BigDecimal.ZERO);
        when(budgetRepository.save(any(Budget.class))).thenAnswer(invocation -> {
            Budget saved = invocation.getArgument(0);
            saved.setId(1L);
            return saved;
        });

        SaveBudgetResponse response = budgetService.createOrUpdateBudget(1L, "Bearer token", createRequest);

        ArgumentCaptor<Budget> budgetCaptor = ArgumentCaptor.forClass(Budget.class);
        verify(budgetRepository).save(budgetCaptor.capture());

        Budget savedBudget = budgetCaptor.getValue();
        assertThat(savedBudget.getUserId()).isEqualTo(1L);
        assertThat(savedBudget.getCategory()).isEqualTo("Food");
        assertThat(savedBudget.getMonthlyLimit()).isEqualByComparingTo("10000.00");
        assertThat(savedBudget.getMonth()).isEqualTo("2026-07");
        assertThat(savedBudget.getCurrentSpent()).isEqualByComparingTo("0.00");

        assertThat(response.getMessage()).isEqualTo("Budget created");
        assertThat(response.getBudgetId()).isEqualTo(1L);
        assertThat(response.isCreated()).isTrue();
        assertThat(response.getBudget().getMonthlyLimit()).isEqualByComparingTo("10000.00");
    }

    @Test
    void createOrUpdateBudget_backfillsExistingExpensesForNewBudget() {
        when(budgetRepository.findByUserIdAndCategoryAndMonth(1L, "Food", "2026-07"))
                .thenReturn(Optional.empty());
        when(expenseSummaryClient.getExistingExpenseTotal("Bearer token", "Food", "2026-07"))
                .thenReturn(new BigDecimal("3250.50"));
        when(budgetRepository.save(any(Budget.class))).thenAnswer(invocation -> {
            Budget saved = invocation.getArgument(0);
            saved.setId(1L);
            return saved;
        });

        SaveBudgetResponse response = budgetService.createOrUpdateBudget(
                1L, "Bearer token", createRequest);

        assertThat(response.getBudget().getCurrentSpent()).isEqualByComparingTo("3250.50");
        verify(expenseSummaryClient).getExistingExpenseTotal("Bearer token", "Food", "2026-07");
    }

    @Test
    void createOrUpdateBudget_addsToExistingBudgetLimitWithoutChangingCurrentSpent() {
        when(budgetRepository.findByUserIdAndCategoryAndMonth(1L, "Food", "2026-07"))
                .thenReturn(Optional.of(budget));
        when(budgetRepository.save(budget)).thenReturn(budget);

        createRequest.setMonthlyLimit(new BigDecimal("12000.00"));
        SaveBudgetResponse response = budgetService.createOrUpdateBudget(1L, "Bearer token", createRequest);

        assertThat(budget.getMonthlyLimit()).isEqualByComparingTo("22000.00");
        assertThat(budget.getCurrentSpent()).isEqualByComparingTo("7000.00");
        assertThat(response.getMessage()).isEqualTo("Budget limit increased to ₹22000");
        assertThat(response.isCreated()).isFalse();
        assertThat(response.getBudgetId()).isEqualTo(1L);
        assertThat(response.getBudget().getMonthlyLimit()).isEqualByComparingTo("22000.00");
        assertThat(response.getBudget().getCurrentSpent()).isEqualByComparingTo("7000.00");
        verify(expenseSummaryClient, never()).getExistingExpenseTotal(anyString(), anyString(), anyString());
    }

    @Test
    void createOrUpdateBudget_repeatCreationAddsLimitWithoutRepeatingBackfill() {
        when(budgetRepository.findByUserIdAndCategoryAndMonth(1L, "Food", "2026-07"))
                .thenReturn(Optional.empty())
                .thenAnswer(invocation -> Optional.of(budget));
        when(expenseSummaryClient.getExistingExpenseTotal("Bearer token", "Food", "2026-07"))
                .thenReturn(new BigDecimal("3250.50"));
        when(budgetRepository.save(any(Budget.class))).thenAnswer(invocation -> {
            Budget saved = invocation.getArgument(0);
            saved.setId(1L);
            budget = saved;
            return saved;
        });

        SaveBudgetResponse created = budgetService.createOrUpdateBudget(
                1L, "Bearer token", createRequest);
        createRequest.setMonthlyLimit(new BigDecimal("2000.00"));
        SaveBudgetResponse repeated = budgetService.createOrUpdateBudget(
                1L, "Bearer token", createRequest);

        assertThat(created.getBudget().getCurrentSpent()).isEqualByComparingTo("3250.50");
        assertThat(repeated.isCreated()).isFalse();
        assertThat(repeated.getBudget().getMonthlyLimit()).isEqualByComparingTo("12000.00");
        assertThat(repeated.getBudget().getCurrentSpent()).isEqualByComparingTo("3250.50");
        verify(expenseSummaryClient, times(1))
                .getExistingExpenseTotal("Bearer token", "Food", "2026-07");
    }

    @Test
    void listBudgets_returnsBudgetsForUser() {
        when(budgetRepository.findByUserIdAndMonth(1L, "2026-07")).thenReturn(List.of(budget));

        List<BudgetResponse> responses = budgetService.listBudgets(1L, "2026-07");

        assertThat(responses).hasSize(1);
        assertThat(responses.get(0).getCategory()).isEqualTo("Food");
        assertThat(responses.get(0).getCurrentSpent()).isEqualByComparingTo("7000.00");
    }

    @Test
    void getBudget_throwsWhenBudgetNotFound() {
        when(budgetRepository.findById(1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> budgetService.getBudget(1L, 1L))
                .isInstanceOf(BudgetNotFoundException.class)
                .hasMessage("Budget not found");
    }

    @Test
    void updateBudget_updatesMonthlyLimit() {
        when(budgetRepository.findById(1L)).thenReturn(Optional.of(budget));
        when(budgetRepository.save(budget)).thenReturn(budget);

        UpdateBudgetRequest updateRequest = new UpdateBudgetRequest(new BigDecimal("15000.00"));
        BudgetResponse response = budgetService.updateBudget(1L, 1L, updateRequest);

        assertThat(budget.getMonthlyLimit()).isEqualByComparingTo("15000.00");
        assertThat(response.getMonthlyLimit()).isEqualByComparingTo("15000.00");
    }

    @Test
    void handleExpenseAdded_incrementsCurrentSpentWhenBudgetExists() {
        ExpenseAddedEvent event = ExpenseAddedEvent.builder()
                .eventId("evt-added-101")
                .expenseId(101L)
                .userId(1L)
                .amount(new BigDecimal("500.00"))
                .category("Food")
                .date(LocalDate.of(2026, 7, 5))
                .build();

        when(budgetRepository.findByUserIdAndCategoryAndMonth(1L, "Food", "2026-07"))
                .thenReturn(Optional.of(budget));
        when(budgetRepository.save(budget)).thenReturn(budget);

        budgetService.handleExpenseAdded(event);

        assertThat(budget.getCurrentSpent()).isEqualByComparingTo("7500.00");
        verify(budgetOutboxService, never()).enqueueBudgetExceeded(any(), any());
    }

    @Test
    void handleExpenseAdded_doesNothingWhenNoMatchingBudget() {
        ExpenseAddedEvent event = ExpenseAddedEvent.builder()
                .eventId("evt-added-101")
                .expenseId(101L)
                .userId(1L)
                .amount(new BigDecimal("500.00"))
                .category("Travel")
                .date(LocalDate.of(2026, 7, 5))
                .build();

        when(budgetRepository.findByUserIdAndCategoryAndMonth(1L, "Travel", "2026-07"))
                .thenReturn(Optional.empty());

        budgetService.handleExpenseAdded(event);

        verify(budgetRepository, never()).save(any());
        verify(budgetOutboxService, never()).enqueueBudgetExceeded(any(), any());
    }

    @Test
    void handleExpenseAdded_publishesBudgetExceededWhenThresholdCrossed() {
        budget.setMonthlyLimit(new BigDecimal("100.00"));
        budget.setCurrentSpent(new BigDecimal("70.00"));

        ExpenseAddedEvent event = ExpenseAddedEvent.builder()
                .eventId("evt-added-101")
                .expenseId(101L)
                .userId(1L)
                .amount(new BigDecimal("15.00"))
                .category("Food")
                .date(LocalDate.of(2026, 7, 5))
                .build();

        when(budgetRepository.findByUserIdAndCategoryAndMonth(1L, "Food", "2026-07"))
                .thenReturn(Optional.of(budget));
        when(budgetRepository.save(budget)).thenReturn(budget);

        budgetService.handleExpenseAdded(event);

        assertThat(budget.getCurrentSpent()).isEqualByComparingTo("85.00");

        ArgumentCaptor<BudgetExceededEvent> eventCaptor = ArgumentCaptor.forClass(BudgetExceededEvent.class);
        verify(budgetOutboxService).enqueueBudgetExceeded(
                org.mockito.ArgumentMatchers.eq(1L), eventCaptor.capture());

        BudgetExceededEvent published = eventCaptor.getValue();
        assertThat(published.getUserId()).isEqualTo(1L);
        assertThat(published.getCategory()).isEqualTo("Food");
        assertThat(published.getMonth()).isEqualTo("2026-07");
        assertThat(published.getMonthlyLimit()).isEqualByComparingTo("100.00");
        assertThat(published.getCurrentSpent()).isEqualByComparingTo("85.00");
        assertThat(published.getEventId()).isNotBlank();
    }

    @Test
    void handleExpenseAdded_doesNotRepublishWhenAlreadyAboveThreshold() {
        budget.setMonthlyLimit(new BigDecimal("100.00"));
        budget.setCurrentSpent(new BigDecimal("85.00"));

        ExpenseAddedEvent event = ExpenseAddedEvent.builder()
                .eventId("evt-added-102")
                .expenseId(102L)
                .userId(1L)
                .amount(new BigDecimal("5.00"))
                .category("Food")
                .date(LocalDate.of(2026, 7, 6))
                .build();

        when(budgetRepository.findByUserIdAndCategoryAndMonth(1L, "Food", "2026-07"))
                .thenReturn(Optional.of(budget));
        when(budgetRepository.save(budget)).thenReturn(budget);

        budgetService.handleExpenseAdded(event);

        assertThat(budget.getCurrentSpent()).isEqualByComparingTo("90.00");
        verify(budgetOutboxService, never()).enqueueBudgetExceeded(any(), any());
    }

    @Test
    void handleExpenseUpdated_changesAmountOnSameBudget() {
        ExpenseUpdatedEvent event = updatedEvent("500.00", "Food", LocalDate.of(2026, 7, 5),
                "800.00", "Food", LocalDate.of(2026, 7, 20));
        when(budgetRepository.findByUserIdAndCategoryAndMonth(1L, "Food", "2026-07"))
                .thenReturn(Optional.of(budget));
        when(budgetRepository.save(budget)).thenReturn(budget);

        budgetService.handleExpenseUpdated(event);

        assertThat(budget.getCurrentSpent()).isEqualByComparingTo("7300.00");
        verify(budgetRepository).save(budget);
    }

    @Test
    void handleExpenseUpdated_movesSpendingWhenCategoryChanges() {
        Budget transport = budget("Transport", "2026-07", "1000.00");
        ExpenseUpdatedEvent event = updatedEvent("500.00", "Food", LocalDate.of(2026, 7, 5),
                "650.00", "Transport", LocalDate.of(2026, 7, 5));
        stubBudget("Food", "2026-07", budget);
        stubBudget("Transport", "2026-07", transport);

        budgetService.handleExpenseUpdated(event);

        assertThat(budget.getCurrentSpent()).isEqualByComparingTo("6500.00");
        assertThat(transport.getCurrentSpent()).isEqualByComparingTo("1650.00");
    }

    @Test
    void handleExpenseUpdated_movesSpendingWhenMonthChanges() {
        Budget august = budget("Food", "2026-08", "200.00");
        ExpenseUpdatedEvent event = updatedEvent("500.00", "Food", LocalDate.of(2026, 7, 5),
                "550.00", "Food", LocalDate.of(2026, 8, 5));
        stubBudget("Food", "2026-07", budget);
        stubBudget("Food", "2026-08", august);

        budgetService.handleExpenseUpdated(event);

        assertThat(budget.getCurrentSpent()).isEqualByComparingTo("6500.00");
        assertThat(august.getCurrentSpent()).isEqualByComparingTo("750.00");
    }

    @Test
    void handleExpenseUpdated_movesSpendingWhenCategoryAndMonthChange() {
        Budget augustTransport = budget("Transport", "2026-08", "300.00");
        ExpenseUpdatedEvent event = updatedEvent("500.00", "Food", LocalDate.of(2026, 7, 5),
                "700.00", "Transport", LocalDate.of(2026, 8, 5));
        stubBudget("Food", "2026-07", budget);
        stubBudget("Transport", "2026-08", augustTransport);

        budgetService.handleExpenseUpdated(event);

        assertThat(budget.getCurrentSpent()).isEqualByComparingTo("6500.00");
        assertThat(augustTransport.getCurrentSpent()).isEqualByComparingTo("1000.00");
    }

    @Test
    void handleExpenseUpdated_skipsMissingBudgetOnEitherSide() {
        ExpenseUpdatedEvent event = updatedEvent("500.00", "Food", LocalDate.of(2026, 7, 5),
                "700.00", "Transport", LocalDate.of(2026, 8, 5));
        when(budgetRepository.findByUserIdAndCategoryAndMonth(1L, "Food", "2026-07"))
                .thenReturn(Optional.of(budget));
        when(budgetRepository.findByUserIdAndCategoryAndMonth(1L, "Transport", "2026-08"))
                .thenReturn(Optional.empty());
        when(budgetRepository.save(budget)).thenReturn(budget);

        budgetService.handleExpenseUpdated(event);

        assertThat(budget.getCurrentSpent()).isEqualByComparingTo("6500.00");
        verify(budgetRepository).save(budget);
    }

    private ExpenseUpdatedEvent updatedEvent(String oldAmount, String oldCategory, LocalDate oldDate,
                                             String newAmount, String newCategory, LocalDate newDate) {
        return ExpenseUpdatedEvent.builder()
                .eventId("evt-updated-101")
                .expenseId(101L)
                .userId(1L)
                .oldAmount(new BigDecimal(oldAmount))
                .oldCategory(oldCategory)
                .oldDate(oldDate)
                .newAmount(new BigDecimal(newAmount))
                .newCategory(newCategory)
                .newDate(newDate)
                .build();
    }

    private Budget budget(String category, String month, String currentSpent) {
        return Budget.builder()
                .id(2L)
                .userId(1L)
                .category(category)
                .monthlyLimit(new BigDecimal("10000.00"))
                .currentSpent(new BigDecimal(currentSpent))
                .month(month)
                .build();
    }

    private void stubBudget(String category, String month, Budget matchingBudget) {
        when(budgetRepository.findByUserIdAndCategoryAndMonth(1L, category, month))
                .thenReturn(Optional.of(matchingBudget));
        when(budgetRepository.save(matchingBudget)).thenReturn(matchingBudget);
    }
}
