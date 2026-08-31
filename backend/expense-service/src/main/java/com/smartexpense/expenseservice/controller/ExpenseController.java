package com.smartexpense.expenseservice.controller;

import com.smartexpense.expenseservice.dto.CreateExpenseRequest;
import com.smartexpense.expenseservice.dto.CreateExpenseResponse;
import com.smartexpense.expenseservice.dto.ExpenseResponse;
import com.smartexpense.expenseservice.dto.ExpenseSummaryResponse;
import com.smartexpense.expenseservice.dto.MessageResponse;
import com.smartexpense.expenseservice.dto.UpdateExpenseRequest;
import com.smartexpense.expenseservice.security.SecurityUtils;
import com.smartexpense.expenseservice.service.ExpenseService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.validation.annotation.Validated;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/expenses")
@RequiredArgsConstructor
@Validated
public class ExpenseController {

    private final ExpenseService expenseService;

    @PostMapping
    public ResponseEntity<CreateExpenseResponse> createExpense(@Valid @RequestBody CreateExpenseRequest request) {
        Long userId = SecurityUtils.getCurrentUserId();
        CreateExpenseResponse response = expenseService.createExpense(userId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    public ResponseEntity<List<ExpenseResponse>> listExpenses(
            @RequestParam(required = false) String category,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {

        Long userId = SecurityUtils.getCurrentUserId();
        List<ExpenseResponse> expenses = expenseService.listExpenses(userId, category, startDate, endDate);
        return ResponseEntity.ok(expenses);
    }

    @GetMapping("/summary")
    public ResponseEntity<ExpenseSummaryResponse> summarizeExpenses(
            @RequestParam @NotBlank @Size(max = 100) String category,
            @RequestParam @Pattern(regexp = "^\\d{4}-(0[1-9]|1[0-2])$") String month) {
        Long userId = SecurityUtils.getCurrentUserId();
        BigDecimal total = expenseService.summarizeExpenses(userId, category, month);
        return ResponseEntity.ok(new ExpenseSummaryResponse(total));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ExpenseResponse> getExpense(@PathVariable Long id) {
        Long userId = SecurityUtils.getCurrentUserId();
        ExpenseResponse response = expenseService.getExpense(userId, id);
        return ResponseEntity.ok(response);
    }

    @PutMapping("/{id}")
    public ResponseEntity<ExpenseResponse> updateExpense(
            @PathVariable Long id,
            @Valid @RequestBody UpdateExpenseRequest request) {

        Long userId = SecurityUtils.getCurrentUserId();
        ExpenseResponse response = expenseService.updateExpense(userId, id, request);
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<MessageResponse> deleteExpense(@PathVariable Long id) {
        Long userId = SecurityUtils.getCurrentUserId();
        expenseService.deleteExpense(userId, id);
        return ResponseEntity.ok(new MessageResponse("Expense deleted successfully"));
    }
}
