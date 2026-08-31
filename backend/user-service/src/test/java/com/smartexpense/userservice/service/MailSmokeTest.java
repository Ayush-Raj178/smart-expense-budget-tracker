package com.smartexpense.userservice.service;

import jakarta.mail.Folder;
import jakarta.mail.Message;
import jakarta.mail.Session;
import jakarta.mail.Store;
import jakarta.mail.search.SubjectTerm;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSenderImpl;

import java.time.Instant;
import java.util.Properties;

import static org.assertj.core.api.Assertions.assertThat;

class MailSmokeTest {

    @Test
    @EnabledIfEnvironmentVariable(named = "MAIL_SMOKE_TEST", matches = "true")
    void sendsMessageThroughSmtpAndFindsItInGmailInbox() throws Exception {
        String host = requiredEnvironment("SMTP_HOST");
        int port = Integer.parseInt(requiredEnvironment("SMTP_PORT"));
        String username = requiredEnvironment("SMTP_USERNAME");
        String password = requiredEnvironment("SMTP_PASSWORD");
        String from = requiredEnvironment("MAIL_FROM");
        String recipient = requiredEnvironment("MAIL_SMOKE_TEST_RECIPIENT");
        String subject = "SmartBudget SMTP smoke test " + Instant.now().toEpochMilli();

        JavaMailSenderImpl sender = new JavaMailSenderImpl();
        sender.setHost(host);
        sender.setPort(port);
        sender.setUsername(username);
        sender.setPassword(password);
        Properties smtpProperties = sender.getJavaMailProperties();
        smtpProperties.put("mail.smtp.auth", "true");
        smtpProperties.put("mail.smtp.starttls.enable", "true");
        smtpProperties.put("mail.smtp.starttls.required", "true");

        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(from);
        message.setTo(recipient);
        message.setSubject(subject);
        message.setText("SmartBudget mail delivery smoke test. No action is required.");
        sender.send(message);

        Properties imapProperties = new Properties();
        imapProperties.put("mail.store.protocol", "imaps");
        Session session = Session.getInstance(imapProperties);
        try (Store store = session.getStore("imaps")) {
            store.connect("imap.gmail.com", username, password);
            try (Folder inbox = store.getFolder("INBOX")) {
                inbox.open(Folder.READ_ONLY);
                Message[] matches = new Message[0];
                for (int attempt = 0; attempt < 12 && matches.length == 0; attempt++) {
                    if (attempt > 0) {
                        Thread.sleep(2_500);
                    }
                    matches = inbox.search(new SubjectTerm(subject));
                }
                assertThat(matches)
                        .as("the SMTP smoke message should be present in the Gmail inbox")
                        .isNotEmpty();
            }
        }
    }

    private String requiredEnvironment(String name) {
        String value = System.getenv(name);
        assertThat(value).as(name + " must be configured").isNotBlank();
        return value;
    }
}
