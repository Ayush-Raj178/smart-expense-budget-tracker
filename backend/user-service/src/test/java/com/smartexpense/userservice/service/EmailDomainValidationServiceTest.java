package com.smartexpense.userservice.service;

import com.smartexpense.userservice.exception.EmailDomainValidationUnavailableException;
import com.smartexpense.userservice.exception.UndeliverableEmailDomainException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import javax.naming.CommunicationException;
import javax.naming.NameNotFoundException;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class EmailDomainValidationServiceTest {

    @Mock private MxRecordResolver mxRecordResolver;

    private EmailDomainValidationService service;

    @BeforeEach
    void setUp() {
        service = new EmailDomainValidationService(mxRecordResolver);
    }

    @Test
    void acceptsDomainWithUsableMxRecord() throws Exception {
        when(mxRecordResolver.resolve("gmail.com")).thenReturn(List.of("gmail-smtp-in.l.google.com."));

        assertThatCode(() -> service.requireMailAcceptingDomain("person@gmail.com"))
                .doesNotThrowAnyException();
    }

    @Test
    void rejectsDomainWithNoMxRecords() throws Exception {
        when(mxRecordResolver.resolve("no-mail.invalid")).thenReturn(List.of());

        assertThatThrownBy(() -> service.requireMailAcceptingDomain("person@no-mail.invalid"))
                .isInstanceOf(UndeliverableEmailDomainException.class)
                .hasMessageContaining("doesn't appear to accept mail");
    }

    @Test
    void rejectsRfcNullMxDomain() throws Exception {
        when(mxRecordResolver.resolve("example.com")).thenReturn(List.of("."));

        assertThatThrownBy(() -> service.requireMailAcceptingDomain("oeeggyy@example.com"))
                .isInstanceOf(UndeliverableEmailDomainException.class);
    }

    @Test
    void rejectsNonexistentDomain() throws Exception {
        when(mxRecordResolver.resolve("missing.invalid"))
                .thenThrow(new NameNotFoundException("missing.invalid"));

        assertThatThrownBy(() -> service.requireMailAcceptingDomain("person@missing.invalid"))
                .isInstanceOf(UndeliverableEmailDomainException.class);
    }

    @Test
    void reportsTemporaryDnsFailureWithoutClaimingDomainIsInvalid() throws Exception {
        when(mxRecordResolver.resolve("gmail.com"))
                .thenThrow(new CommunicationException("DNS timeout"));

        assertThatThrownBy(() -> service.requireMailAcceptingDomain("person@gmail.com"))
                .isInstanceOf(EmailDomainValidationUnavailableException.class)
                .hasMessageContaining("right now");
    }
}
