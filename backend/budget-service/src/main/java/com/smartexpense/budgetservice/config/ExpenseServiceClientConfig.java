package com.smartexpense.budgetservice.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

@Configuration
public class ExpenseServiceClientConfig {

    @Bean
    public RestClient expenseServiceRestClient(
            RestClient.Builder builder,
            @Value("${app.expense-service.base-url}") String baseUrl,
            @Value("${app.expense-service.connect-timeout-ms}") int connectTimeoutMs,
            @Value("${app.expense-service.read-timeout-ms}") int readTimeoutMs) {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(connectTimeoutMs);
        requestFactory.setReadTimeout(readTimeoutMs);

        return builder
                .baseUrl(baseUrl)
                .requestFactory(requestFactory)
                .build();
    }
}
