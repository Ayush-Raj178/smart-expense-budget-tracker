package com.smartexpense.budgetservice.repository;

import com.smartexpense.budgetservice.entity.Budget;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface BudgetRepository extends JpaRepository<Budget, Long> {

    Optional<Budget> findByUserIdAndCategoryAndMonth(Long userId, String category, String month);

    List<Budget> findByUserId(Long userId);

    List<Budget> findByUserIdAndMonth(Long userId, String month);
}
