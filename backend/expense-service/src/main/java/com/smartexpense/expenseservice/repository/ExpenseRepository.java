package com.smartexpense.expenseservice.repository;

import com.smartexpense.expenseservice.entity.Expense;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDate;

public interface ExpenseRepository extends JpaRepository<Expense, Long>, JpaSpecificationExecutor<Expense> {

    @Query("""
            select coalesce(sum(expense.amount), 0)
            from Expense expense
            where expense.userId = :userId
              and lower(expense.category) = lower(:category)
              and expense.date between :startDate and :endDate
            """)
    BigDecimal sumAmountByUserCategoryAndDateRange(
            @Param("userId") Long userId,
            @Param("category") String category,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);
}
