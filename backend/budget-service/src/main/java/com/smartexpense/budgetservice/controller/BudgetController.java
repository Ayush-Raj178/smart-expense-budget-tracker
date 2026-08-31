package com.smartexpense.budgetservice.controller;

import com.smartexpense.budgetservice.dto.BudgetResponse;
import com.smartexpense.budgetservice.dto.CreateBudgetRequest;
import com.smartexpense.budgetservice.dto.SaveBudgetResponse;
import com.smartexpense.budgetservice.dto.UpdateBudgetRequest;
import com.smartexpense.budgetservice.security.SecurityUtils;
import com.smartexpense.budgetservice.service.BudgetService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/budgets")
@RequiredArgsConstructor
public class BudgetController {

    private final BudgetService budgetService;

    @PostMapping
    public ResponseEntity<SaveBudgetResponse> createOrUpdateBudget(
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization,
            @Valid @RequestBody CreateBudgetRequest request) {
        Long userId = SecurityUtils.getCurrentUserId();
        SaveBudgetResponse response = budgetService.createOrUpdateBudget(userId, authorization, request);
        return ResponseEntity.ok(response);
    }

    @GetMapping
    public ResponseEntity<List<BudgetResponse>> listBudgets(
            @RequestParam(required = false) String month) {
        Long userId = SecurityUtils.getCurrentUserId();
        List<BudgetResponse> budgets = budgetService.listBudgets(userId, month);
        return ResponseEntity.ok(budgets);
    }

    @GetMapping("/{id}")
    public ResponseEntity<BudgetResponse> getBudget(@PathVariable Long id) {
        Long userId = SecurityUtils.getCurrentUserId();
        BudgetResponse response = budgetService.getBudget(userId, id);
        return ResponseEntity.ok(response);
    }

    @PutMapping("/{id}")
    public ResponseEntity<BudgetResponse> updateBudget(
            @PathVariable Long id,
            @Valid @RequestBody UpdateBudgetRequest request) {
        Long userId = SecurityUtils.getCurrentUserId();
        BudgetResponse response = budgetService.updateBudget(userId, id, request);
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteBudget(@PathVariable Long id) {
        Long userId = SecurityUtils.getCurrentUserId();
        budgetService.deleteBudget(userId, id);
        return ResponseEntity.noContent().build();
    }
}
