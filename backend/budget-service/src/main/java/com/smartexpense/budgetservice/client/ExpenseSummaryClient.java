package com.smartexpense.budgetservice.client;

import com.smartexpense.budgetservice.dto.ExpenseSummaryResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.math.BigDecimal;

@Component
@RequiredArgsConstructor
@Slf4j
public class ExpenseSummaryClient {

    private static final int MAX_ATTEMPTS = 2;

    private final RestClient expenseServiceRestClient;

    public BigDecimal getExistingExpenseTotal(String authorization, String category, String month) {
        for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            try {
                ExpenseSummaryResponse response = expenseServiceRestClient.get()
                        .uri(uriBuilder -> uriBuilder
                                .path("/api/expenses/summary")
                                .queryParam("category", category)
                                .queryParam("month", month)
                                .build())
                        .header(HttpHeaders.AUTHORIZATION, authorization)
                        .retrieve()
                        .body(ExpenseSummaryResponse.class);

                return response == null || response.getTotalAmount() == null
                        ? BigDecimal.ZERO
                        : response.getTotalAmount();
            } catch (RestClientException exception) {
                if (attempt == MAX_ATTEMPTS) {
                    log.warn(
                            "Expense backfill failed after {} attempts for category '{}' and month '{}'; "
                                    + "creating budget with currentSpent=0",
                            MAX_ATTEMPTS,
                            category,
                            month,
                            exception);
                }
            }
        }

        return BigDecimal.ZERO;
    }
}
