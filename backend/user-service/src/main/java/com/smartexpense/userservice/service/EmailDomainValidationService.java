package com.smartexpense.userservice.service;

import com.smartexpense.userservice.exception.EmailDomainValidationUnavailableException;
import com.smartexpense.userservice.exception.UndeliverableEmailDomainException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import javax.naming.NameNotFoundException;
import javax.naming.NamingException;
import java.net.IDN;
import java.util.List;

@Service
@RequiredArgsConstructor
public class EmailDomainValidationService {

    private final MxRecordResolver mxRecordResolver;

    public void requireMailAcceptingDomain(String email) {
        String domain = extractDomain(email);
        try {
            List<String> exchanges = mxRecordResolver.resolve(domain);
            boolean hasUsableMx = exchanges.stream()
                    .map(String::trim)
                    .anyMatch(exchange -> !exchange.isEmpty() && !exchange.equals("."));
            if (!hasUsableMx) {
                throw new UndeliverableEmailDomainException();
            }
        } catch (NameNotFoundException exception) {
            throw new UndeliverableEmailDomainException();
        } catch (NamingException exception) {
            throw new EmailDomainValidationUnavailableException(exception);
        }
    }

    private String extractDomain(String email) {
        int separator = email == null ? -1 : email.lastIndexOf('@');
        if (separator < 1 || separator == email.length() - 1) {
            throw new UndeliverableEmailDomainException();
        }
        try {
            return IDN.toASCII(email.substring(separator + 1).trim());
        } catch (IllegalArgumentException exception) {
            throw new UndeliverableEmailDomainException();
        }
    }
}
