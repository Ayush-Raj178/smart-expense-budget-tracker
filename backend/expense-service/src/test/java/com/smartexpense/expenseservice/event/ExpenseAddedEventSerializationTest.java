package com.smartexpense.expenseservice.event;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.Test;
import org.springframework.kafka.support.serializer.JsonSerializer;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class ExpenseAddedEventSerializationTest {

    @Test
    void jacksonObjectMapper_includesEventIdInJson() throws Exception {
        ObjectMapper mapper = new ObjectMapper().registerModule(new JavaTimeModule());
        ExpenseAddedEvent event = ExpenseAddedEvent.builder()
                .eventId(UUID.randomUUID().toString())
                .expenseId(50L)
                .userId(7L)
                .amount(new BigDecimal("100"))
                .category("Transport")
                .date(LocalDate.of(2026, 8, 14))
                .build();

        String json = mapper.writeValueAsString(event);

        assertThat(json).contains("\"eventId\"");
        assertThat(event.getEventId()).isNotBlank();
    }

    @Test
    void springKafkaJsonSerializer_includesEventIdInJson() {
        JsonSerializer<ExpenseAddedEvent> serializer = new JsonSerializer<>();
        ExpenseAddedEvent event = ExpenseAddedEvent.builder()
                .eventId(UUID.randomUUID().toString())
                .expenseId(50L)
                .userId(7L)
                .amount(new BigDecimal("100"))
                .category("Transport")
                .date(LocalDate.of(2026, 8, 14))
                .build();

        byte[] bytes = serializer.serialize("expense-events", event);
        String json = new String(bytes);

        assertThat(json).contains("\"eventId\"");
    }
}
