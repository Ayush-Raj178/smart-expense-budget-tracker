package com.smartexpense.expenseservice.service;

import com.smartexpense.expenseservice.dto.CreateExpenseRequest;
import com.smartexpense.expenseservice.dto.CreateExpenseResponse;
import com.smartexpense.expenseservice.dto.ExpenseResponse;
import com.smartexpense.expenseservice.dto.UpdateExpenseRequest;
import com.smartexpense.expenseservice.entity.Expense;
import com.smartexpense.expenseservice.event.ExpenseAddedEvent;
import com.smartexpense.expenseservice.event.ExpenseDeletedEvent;
import com.smartexpense.expenseservice.event.ExpenseUpdatedEvent;
import com.smartexpense.expenseservice.dto.RepublishExpenseEventResponse;
import com.smartexpense.expenseservice.exception.ExpenseNotFoundException;
import com.smartexpense.expenseservice.exception.MissingAddedEventIdException;
import com.smartexpense.expenseservice.repository.ExpenseRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ExpenseServiceTest {

    @Mock
    private ExpenseRepository expenseRepository;

    @Mock
    private ExpenseOutboxService expenseOutboxService;

    @InjectMocks
    private ExpenseService expenseService;

    private CreateExpenseRequest createRequest;
    private UpdateExpenseRequest updateRequest;
    private Expense expense;

    @BeforeEach
    void setUp() {
        createRequest = new CreateExpenseRequest(
                new BigDecimal("1200.00"),
                "Food",
                "Dinner",
                LocalDate.of(2026, 7, 5));

        updateRequest = new UpdateExpenseRequest(
                new BigDecimal("1500.00"),
                "Travel",
                "Taxi",
                LocalDate.of(2026, 7, 6));

        expense = Expense.builder()
                .id(101L)
                .userId(1L)
                .amount(new BigDecimal("1200.00"))
                .category("Food")
                .description("Dinner")
                .date(LocalDate.of(2026, 7, 5))
                .build();
    }

    @Test
    void createExpense_savesExpenseAndCreatesOutboxEvent() {
        when(expenseRepository.save(any(Expense.class))).thenAnswer(invocation -> {
            Expense saved = invocation.getArgument(0);
            saved.setId(101L);
            return saved;
        });

        CreateExpenseResponse response = expenseService.createExpense(1L, createRequest);

        ArgumentCaptor<Expense> expenseCaptor = ArgumentCaptor.forClass(Expense.class);
        verify(expenseRepository).save(expenseCaptor.capture());

        Expense savedExpense = expenseCaptor.getValue();
        assertThat(savedExpense.getUserId()).isEqualTo(1L);
        assertThat(savedExpense.getAmount()).isEqualByComparingTo("1200.00");
        assertThat(savedExpense.getCategory()).isEqualTo("Food");
        assertThat(savedExpense.getDescription()).isEqualTo("Dinner");
        assertThat(savedExpense.getDate()).isEqualTo(LocalDate.of(2026, 7, 5));
        assertThat(savedExpense.getAddedEventId()).isNotBlank();

        ArgumentCaptor<ExpenseAddedEvent> eventCaptor = ArgumentCaptor.forClass(ExpenseAddedEvent.class);
        verify(expenseOutboxService).enqueueExpenseAdded(eventCaptor.capture());

        ExpenseAddedEvent event = eventCaptor.getValue();
        assertThat(event.getEventId()).isNotBlank();
        assertThat(event.getEventId()).isEqualTo(savedExpense.getAddedEventId());
        assertThat(event.getExpenseId()).isEqualTo(101L);
        assertThat(event.getUserId()).isEqualTo(1L);
        assertThat(event.getAmount()).isEqualByComparingTo("1200.00");
        assertThat(event.getCategory()).isEqualTo("Food");
        assertThat(event.getDate()).isEqualTo(LocalDate.of(2026, 7, 5));

        assertThat(response.getMessage()).isEqualTo("Expense added successfully");
        assertThat(response.getExpenseId()).isEqualTo(101L);
    }

    @Test
    void listExpenses_returnsExpensesForAuthenticatedUser() {
        when(expenseRepository.findAll(any(Specification.class), any(Sort.class)))
                .thenReturn(List.of(expense));

        List<ExpenseResponse> responses = expenseService.listExpenses(
                1L, "Food", LocalDate.of(2026, 7, 1), LocalDate.of(2026, 7, 31));

        assertThat(responses).hasSize(1);
        assertThat(responses.get(0).getId()).isEqualTo(101L);
        assertThat(responses.get(0).getUserId()).isEqualTo(1L);
        assertThat(responses.get(0).getCategory()).isEqualTo("Food");
    }

    @Test
    void summarizeExpenses_returnsTotalForAuthenticatedUserCategoryAndMonth() {
        when(expenseRepository.sumAmountByUserCategoryAndDateRange(
                1L,
                "Food",
                LocalDate.of(2026, 7, 1),
                LocalDate.of(2026, 7, 31)))
                .thenReturn(new BigDecimal("3250.50"));

        BigDecimal total = expenseService.summarizeExpenses(1L, "Food", "2026-07");

        assertThat(total).isEqualByComparingTo("3250.50");
    }

    @Test
    void getExpense_returnsExpenseWhenOwnedByUser() {
        when(expenseRepository.findById(101L)).thenReturn(Optional.of(expense));

        ExpenseResponse response = expenseService.getExpense(1L, 101L);

        assertThat(response.getId()).isEqualTo(101L);
        assertThat(response.getUserId()).isEqualTo(1L);
        assertThat(response.getAmount()).isEqualByComparingTo("1200.00");
    }

    @Test
    void getExpense_throwsWhenExpenseNotFound() {
        when(expenseRepository.findById(101L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> expenseService.getExpense(1L, 101L))
                .isInstanceOf(ExpenseNotFoundException.class)
                .hasMessage("Expense not found");
    }

    @Test
    void getExpense_throwsWhenExpenseBelongsToAnotherUser() {
        when(expenseRepository.findById(101L)).thenReturn(Optional.of(expense));

        assertThatThrownBy(() -> expenseService.getExpense(99L, 101L))
                .isInstanceOf(ExpenseNotFoundException.class)
                .hasMessage("Expense not found");
    }

    @Test
    void updateExpense_updatesOwnedExpense() {
        when(expenseRepository.findById(101L)).thenReturn(Optional.of(expense));
        when(expenseRepository.save(expense)).thenReturn(expense);

        ExpenseResponse response = expenseService.updateExpense(1L, 101L, updateRequest);

        assertThat(expense.getAmount()).isEqualByComparingTo("1500.00");
        assertThat(expense.getCategory()).isEqualTo("Travel");
        assertThat(expense.getDescription()).isEqualTo("Taxi");
        assertThat(expense.getDate()).isEqualTo(LocalDate.of(2026, 7, 6));
        assertThat(response.getCategory()).isEqualTo("Travel");
        ArgumentCaptor<ExpenseUpdatedEvent> eventCaptor = ArgumentCaptor.forClass(ExpenseUpdatedEvent.class);
        verify(expenseOutboxService).enqueueExpenseUpdated(eventCaptor.capture());

        ExpenseUpdatedEvent event = eventCaptor.getValue();
        assertThat(event.getOldAmount()).isEqualByComparingTo("1200.00");
        assertThat(event.getOldCategory()).isEqualTo("Food");
        assertThat(event.getOldDate()).isEqualTo(LocalDate.of(2026, 7, 5));
        assertThat(event.getNewAmount()).isEqualByComparingTo("1500.00");
        assertThat(event.getNewCategory()).isEqualTo("Travel");
        assertThat(event.getNewDate()).isEqualTo(LocalDate.of(2026, 7, 6));
        verify(expenseOutboxService, never()).enqueueExpenseAdded(any());
    }

    @Test
    void deleteExpense_deletesOwnedExpense() {
        when(expenseRepository.findById(101L)).thenReturn(Optional.of(expense));

        expenseService.deleteExpense(1L, 101L);

        verify(expenseRepository).delete(expense);
        ArgumentCaptor<ExpenseDeletedEvent> eventCaptor = ArgumentCaptor.forClass(ExpenseDeletedEvent.class);
        verify(expenseOutboxService).enqueueExpenseDeleted(eventCaptor.capture());
        assertThat(eventCaptor.getValue().getExpenseId()).isEqualTo(101L);
        assertThat(eventCaptor.getValue().getUserId()).isEqualTo(1L);
        assertThat(eventCaptor.getValue().getEventId()).isNotBlank();
    }

    @Test
    void republishExpenseAddedEvent_reusesStoredEventId() {
        expense.setAddedEventId("evt-original-101");
        when(expenseRepository.findById(101L)).thenReturn(Optional.of(expense));

        RepublishExpenseEventResponse response = expenseService.republishExpenseAddedEvent(1L, 101L);

        ArgumentCaptor<ExpenseAddedEvent> eventCaptor = ArgumentCaptor.forClass(ExpenseAddedEvent.class);
        verify(expenseOutboxService).enqueueExpenseAdded(eventCaptor.capture());

        ExpenseAddedEvent event = eventCaptor.getValue();
        assertThat(event.getEventId()).isEqualTo("evt-original-101");
        assertThat(event.getExpenseId()).isEqualTo(101L);
        assertThat(response.getEventId()).isEqualTo("evt-original-101");
        assertThat(response.getExpenseId()).isEqualTo(101L);
    }

    @Test
    void republishExpenseAddedEvent_throwsWhenAddedEventIdMissing() {
        when(expenseRepository.findById(101L)).thenReturn(Optional.of(expense));

        assertThatThrownBy(() -> expenseService.republishExpenseAddedEvent(1L, 101L))
                .isInstanceOf(MissingAddedEventIdException.class);
        verify(expenseOutboxService, never()).enqueueExpenseAdded(any());
    }
}
