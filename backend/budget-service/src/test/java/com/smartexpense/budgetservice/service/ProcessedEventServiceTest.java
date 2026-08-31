package com.smartexpense.budgetservice.service;

import com.smartexpense.budgetservice.entity.ProcessedEvent;
import com.smartexpense.budgetservice.repository.ProcessedEventRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProcessedEventServiceTest {

    @Mock
    private ProcessedEventRepository processedEventRepository;

    @InjectMocks
    private ProcessedEventService processedEventService;

    @Test
    void processIdempotently_runsActionAndRecordsEvent() {
        when(processedEventRepository.existsById("evt-1")).thenReturn(false);

        final boolean[] executed = {false};
        processedEventService.processIdempotently("evt-1", "ExpenseAdded", () -> executed[0] = true);

        assertThat(executed[0]).isTrue();

        ArgumentCaptor<ProcessedEvent> captor = ArgumentCaptor.forClass(ProcessedEvent.class);
        verify(processedEventRepository).save(captor.capture());
        assertThat(captor.getValue().getEventId()).isEqualTo("evt-1");
        assertThat(captor.getValue().getEventType()).isEqualTo("ExpenseAdded");
    }

    @Test
    void processIdempotently_skipsDuplicateEvent() {
        when(processedEventRepository.existsById("evt-1")).thenReturn(true);

        processedEventService.processIdempotently("evt-1", "ExpenseAdded", () -> {
            throw new AssertionError("Should not process duplicate event");
        });

        verify(processedEventRepository, never()).save(any());
    }

    @Test
    void processIdempotently_skipsWhenEventIdMissing() {
        processedEventService.processIdempotently(null, "ExpenseAdded", () -> {
            throw new AssertionError("Should not process event without id");
        });

        verify(processedEventRepository, never()).existsById(any());
        verify(processedEventRepository, never()).save(any());
    }
}
