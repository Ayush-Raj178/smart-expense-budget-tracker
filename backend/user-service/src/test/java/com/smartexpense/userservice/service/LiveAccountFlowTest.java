package com.smartexpense.userservice.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.mail.Address;
import jakarta.mail.BodyPart;
import jakarta.mail.Folder;
import jakarta.mail.Message;
import jakarta.mail.Multipart;
import jakarta.mail.Session;
import jakarta.mail.Store;
import jakarta.mail.search.SubjectTerm;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.time.Instant;
import java.util.Arrays;
import java.util.HexFormat;
import java.util.Properties;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

class LiveAccountFlowTest {

    private static final Pattern OTP_PATTERN = Pattern.compile("\\b(\\d{6})\\b");
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final HttpClient HTTP = HttpClient.newHttpClient();

    @Test
    @EnabledIfEnvironmentVariable(named = "LIVE_ACCOUNT_FLOW_TEST", matches = "true")
    void signupProfileAndEmailChangeWorkAgainstRunningServiceAndGmail() throws Exception {
        String mailbox = requiredEnvironment("SMTP_USERNAME");
        String mailboxPassword = requiredEnvironment("SMTP_PASSWORD");
        String suffix = "codex-" + Instant.now().toEpochMilli();
        String signupEmail = gmailAlias(mailbox, suffix);
        String changedEmail = gmailAlias(mailbox, suffix + "-changed");
        String unknownEmail = gmailAlias(mailbox, suffix + "-unknown");
        String password = "LiveFlow-" + UUID.randomUUID() + "!";
        String resetPassword = "ResetFlow-" + UUID.randomUUID() + "!";
        String baseUrl = environmentOrDefault("LIVE_USER_SERVICE_URL", "http://localhost:8081");

        try {
            HttpResponse<String> malformedEmail = jsonRequest(baseUrl + "/api/auth/signup", "POST", null,
                    JSON.createObjectNode().put("name", "Invalid Email").put("email", "not-an-email").put("password", password).toString());
            assertThat(malformedEmail.statusCode()).isEqualTo(400);

            Instant signupStarted = Instant.now();
            String signupBody = JSON.createObjectNode().put("name", "Live OTP Test").put("email", signupEmail).put("password", password).toString();
            HttpResponse<String> signup = jsonRequest(baseUrl + "/api/auth/signup", "POST", null, signupBody);
            assertThat(signup.statusCode()).isEqualTo(202);

            HttpResponse<String> rateLimited = jsonRequest(baseUrl + "/api/auth/signup", "POST", null, signupBody);
            assertThat(rateLimited.statusCode()).isEqualTo(429);
            assertThat(rateLimited.headers().firstValue("Retry-After")).isPresent();

            HttpResponse<String> beforeVerification = jsonRequest(baseUrl + "/api/auth/login", "POST", null,
                    JSON.createObjectNode().put("email", signupEmail).put("password", password).toString());
            assertThat(beforeVerification.statusCode())
                    .as("the account must not exist before OTP verification")
                    .isEqualTo(401);

            String signupOtp = waitForOtp(mailbox, mailboxPassword, signupEmail,
                    "Verify your SmartBudget account", signupStarted);
            String incorrectOtp = signupOtp.equals("000000") ? "999999" : "000000";
            HttpResponse<String> incorrectVerification = jsonRequest(baseUrl + "/api/auth/signup/verify", "POST", null,
                    JSON.createObjectNode().put("email", signupEmail).put("otp", incorrectOtp).toString());
            assertThat(incorrectVerification.statusCode()).isEqualTo(400);
            assertThat(incorrectVerification.body()).contains("4 attempts remaining");
            HttpResponse<String> verification = jsonRequest(baseUrl + "/api/auth/signup/verify", "POST", null,
                    JSON.createObjectNode().put("email", signupEmail).put("otp", signupOtp).toString());
            assertThat(verification.statusCode()).isEqualTo(201);
            JsonNode verifiedBody = JSON.readTree(verification.body());
            String token = verifiedBody.path("token").asText();
            assertThat(token).isNotBlank();
            assertThat(verifiedBody.path("user").path("email").asText()).isEqualTo(signupEmail);

            HttpResponse<String> login = jsonRequest(baseUrl + "/api/auth/login", "POST", null,
                    JSON.createObjectNode().put("email", signupEmail).put("password", password).toString());
            assertThat(login.statusCode()).isEqualTo(200);

            HttpResponse<String> profile = jsonRequest(baseUrl + "/api/users/me", "PUT", token,
                    JSON.createObjectNode().put("name", "Live OTP Verified").put("phoneNumber", "+91 98765 43210").toString());
            assertThat(profile.statusCode()).isEqualTo(200);
            assertThat(JSON.readTree(profile.body()).path("phoneNumber").asText()).isEqualTo("+91 98765 43210");

            Instant emailChangeStarted = Instant.now();
            HttpResponse<String> emailRequest = jsonRequest(baseUrl + "/api/users/me/email/request", "POST", token,
                    JSON.createObjectNode().put("newEmail", changedEmail).toString());
            assertThat(emailRequest.statusCode()).isEqualTo(202);
            String emailChangeOtp = waitForOtp(mailbox, mailboxPassword, changedEmail,
                    "Confirm your new SmartBudget email", emailChangeStarted);

            HttpResponse<String> emailVerification = jsonRequest(baseUrl + "/api/users/me/email/verify", "POST", token,
                    JSON.createObjectNode().put("newEmail", changedEmail).put("otp", emailChangeOtp).toString());
            assertThat(emailVerification.statusCode()).isEqualTo(200);
            JsonNode emailBody = JSON.readTree(emailVerification.body());
            String replacementToken = emailBody.path("token").asText();
            assertThat(replacementToken).isNotBlank().isNotEqualTo(token);
            assertThat(emailBody.path("user").path("email").asText()).isEqualTo(changedEmail);
            assertThat(emailBody.path("user").path("phoneNumber").asText()).isEqualTo("+91 98765 43210");

            HttpResponse<String> oldEmailLogin = jsonRequest(baseUrl + "/api/auth/login", "POST", null,
                    JSON.createObjectNode().put("email", signupEmail).put("password", password).toString());
            assertThat(oldEmailLogin.statusCode()).isEqualTo(401);
            HttpResponse<String> newEmailLogin = jsonRequest(baseUrl + "/api/auth/login", "POST", null,
                    JSON.createObjectNode().put("email", changedEmail).put("password", password).toString());
            assertThat(newEmailLogin.statusCode()).isEqualTo(200);

            Instant resetStarted = Instant.now();
            HttpResponse<String> forgotPassword = jsonRequest(baseUrl + "/api/auth/forgot-password", "POST", null,
                    JSON.createObjectNode().put("email", changedEmail).toString());
            assertThat(forgotPassword.statusCode()).isEqualTo(202);
            assertThat(JSON.readTree(forgotPassword.body()).path("message").asText())
                    .isEqualTo("If this email is registered, a code has been sent");
            String resetOtp = waitForOtp(mailbox, mailboxPassword, changedEmail,
                    "Reset your SmartBudget password", resetStarted);

            String hashBeforePreverification = readStoredPasswordHash(changedEmail);
            HttpResponse<String> preverification = jsonRequest(
                    baseUrl + "/api/auth/forgot-password/verify", "POST", null,
                    JSON.createObjectNode()
                            .put("email", changedEmail)
                            .put("otp", resetOtp)
                            .toString());
            assertThat(preverification.statusCode()).isEqualTo(200);
            assertThat(JSON.readTree(preverification.body()).path("message").asText())
                    .isEqualTo("Verification code confirmed");
            assertThat(readStoredPasswordHash(changedEmail)).isEqualTo(hashBeforePreverification);

            HttpResponse<String> reset = jsonRequest(baseUrl + "/api/auth/reset-password", "POST", null,
                    JSON.createObjectNode()
                            .put("email", changedEmail)
                            .put("otp", resetOtp)
                            .put("newPassword", resetPassword)
                            .toString());
            System.out.printf("EVIDENCE A reset-response: HTTP %d %s%n", reset.statusCode(), reset.body());
            assertThat(reset.statusCode()).isEqualTo(200);

            String storedPasswordHash = readStoredPasswordHash(changedEmail);
            BCryptPasswordEncoder deployedEncoderEquivalent = new BCryptPasswordEncoder();
            System.out.printf(
                    "EVIDENCE B database-hash: beforeFingerprint=%s afterFingerprint=%s changed=%s prefix=%s length=%d newMatches=%s oldMatches=%s%n",
                    hashFingerprint(hashBeforePreverification),
                    hashFingerprint(storedPasswordHash),
                    !storedPasswordHash.equals(hashBeforePreverification),
                    storedPasswordHash.substring(0, 7),
                    storedPasswordHash.length(),
                    deployedEncoderEquivalent.matches(resetPassword, storedPasswordHash),
                    deployedEncoderEquivalent.matches(password, storedPasswordHash));
            assertThat(storedPasswordHash).startsWith("$2a$10$").hasSize(60);
            assertThat(deployedEncoderEquivalent.matches(resetPassword, storedPasswordHash)).isTrue();
            assertThat(deployedEncoderEquivalent.matches(password, storedPasswordHash)).isFalse();

            HttpResponse<String> newPasswordAfterReset = jsonRequest(baseUrl + "/api/auth/login", "POST", null,
                    JSON.createObjectNode().put("email", changedEmail).put("password", resetPassword).toString());
            System.out.printf(
                    "EVIDENCE C direct-login: HTTP %d %s%n",
                    newPasswordAfterReset.statusCode(),
                    redactLoginResponse(newPasswordAfterReset.body()));
            assertThat(newPasswordAfterReset.statusCode()).isEqualTo(200);

            HttpResponse<String> reusedOtp = jsonRequest(baseUrl + "/api/auth/reset-password", "POST", null,
                    JSON.createObjectNode()
                            .put("email", changedEmail)
                            .put("otp", resetOtp)
                            .put("newPassword", password)
                            .toString());
            assertThat(reusedOtp.statusCode()).isEqualTo(400);

            HttpResponse<String> oldPasswordAfterReset = jsonRequest(baseUrl + "/api/auth/login", "POST", null,
                    JSON.createObjectNode().put("email", changedEmail).put("password", password).toString());
            assertThat(oldPasswordAfterReset.statusCode()).isEqualTo(401);

            Instant unknownRequestStarted = Instant.now();
            HttpResponse<String> unknownForgotPassword = jsonRequest(baseUrl + "/api/auth/forgot-password", "POST", null,
                    JSON.createObjectNode().put("email", unknownEmail).toString());
            assertThat(unknownForgotPassword.statusCode()).isEqualTo(202);
            assertThat(JSON.readTree(unknownForgotPassword.body()).path("message").asText())
                    .isEqualTo(JSON.readTree(forgotPassword.body()).path("message").asText());
            assertNoEmail(mailbox, mailboxPassword, unknownEmail,
                    "Reset your SmartBudget password", unknownRequestStarted);
        } finally {
            deleteLiveTestData(signupEmail, changedEmail);
        }
    }

    private HttpResponse<String> jsonRequest(String url, String method, String token, String body) throws Exception {
        HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create(url))
                .header("Content-Type", "application/json")
                .method(method, HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8));
        if (token != null) {
            builder.header("Authorization", "Bearer " + token);
        }
        return HTTP.send(builder.build(), HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
    }

    private String waitForOtp(
            String username,
            String password,
            String recipient,
            String subject,
            Instant notBefore) throws Exception {
        Properties properties = new Properties();
        properties.put("mail.store.protocol", "imaps");
        Session session = Session.getInstance(properties);
        try (Store store = session.getStore("imaps")) {
            store.connect("imap.gmail.com", username, password);
            for (int attempt = 0; attempt < 18; attempt++) {
                if (attempt > 0) Thread.sleep(2_500);
                try (Folder inbox = store.getFolder("INBOX")) {
                    inbox.open(Folder.READ_ONLY);
                    Message[] messages = inbox.search(new SubjectTerm(subject));
                    for (int index = messages.length - 1; index >= 0; index--) {
                        Message message = messages[index];
                        if (message.getReceivedDate() == null
                                || message.getReceivedDate().toInstant().isBefore(notBefore.minusSeconds(5))
                                || !hasRecipient(message, recipient)) {
                            continue;
                        }
                        Matcher matcher = OTP_PATTERN.matcher(readText(message));
                        if (matcher.find()) return matcher.group(1);
                    }
                }
            }
        }
        throw new AssertionError("Timed out waiting for the verification email in Gmail");
    }

    private boolean hasRecipient(Message message, String expected) throws Exception {
        Address[] recipients = message.getAllRecipients();
        return recipients != null && Arrays.stream(recipients)
                .anyMatch(address -> address.toString().toLowerCase().contains(expected.toLowerCase()));
    }

    private void assertNoEmail(
            String username,
            String password,
            String recipient,
            String subject,
            Instant notBefore) throws Exception {
        Properties properties = new Properties();
        properties.put("mail.store.protocol", "imaps");
        Session session = Session.getInstance(properties);
        try (Store store = session.getStore("imaps")) {
            store.connect("imap.gmail.com", username, password);
            for (int attempt = 0; attempt < 4; attempt++) {
                if (attempt > 0) Thread.sleep(2_000);
                try (Folder inbox = store.getFolder("INBOX")) {
                    inbox.open(Folder.READ_ONLY);
                    Message[] messages = inbox.search(new SubjectTerm(subject));
                    for (int index = messages.length - 1; index >= 0; index--) {
                        Message message = messages[index];
                        if (message.getReceivedDate() != null
                                && !message.getReceivedDate().toInstant().isBefore(notBefore.minusSeconds(5))
                                && hasRecipient(message, recipient)) {
                            throw new AssertionError("A password-reset email was sent for an unregistered address");
                        }
                    }
                }
            }
        }
    }

    private String readText(Object part) throws Exception {
        Object content;
        if (part instanceof Message message) content = message.getContent();
        else if (part instanceof BodyPart bodyPart) content = bodyPart.getContent();
        else content = part;
        if (content instanceof String value) return value;
        if (content instanceof Multipart multipart) {
            StringBuilder text = new StringBuilder();
            for (int index = 0; index < multipart.getCount(); index++) {
                text.append(readText(multipart.getBodyPart(index)));
            }
            return text.toString();
        }
        return "";
    }

    private String gmailAlias(String mailbox, String suffix) {
        int at = mailbox.indexOf('@');
        return mailbox.substring(0, at) + "+" + suffix + mailbox.substring(at);
    }

    private void deleteLiveTestData(String firstEmail, String secondEmail) throws Exception {
        String databaseUrl = environmentOrDefault("LIVE_USER_DB_URL", "jdbc:mysql://localhost:3307/sebt_user_db");
        String databaseUser = environmentOrDefault("LIVE_USER_DB_USERNAME", "root");
        String databasePassword = requiredEnvironment("LIVE_USER_DB_PASSWORD");
        try (Connection connection = DriverManager.getConnection(databaseUrl, databaseUser, databasePassword)) {
            try (PreparedStatement challenges = connection.prepareStatement(
                    "DELETE FROM email_otp_challenges WHERE email IN (?, ?)")) {
                challenges.setString(1, firstEmail);
                challenges.setString(2, secondEmail);
                challenges.executeUpdate();
            }
            try (PreparedStatement users = connection.prepareStatement("DELETE FROM users WHERE email IN (?, ?)")) {
                users.setString(1, firstEmail);
                users.setString(2, secondEmail);
                users.executeUpdate();
            }
        }
    }

    private String readStoredPasswordHash(String email) throws Exception {
        String databaseUrl = environmentOrDefault("LIVE_USER_DB_URL", "jdbc:mysql://localhost:3307/sebt_user_db");
        String databaseUser = environmentOrDefault("LIVE_USER_DB_USERNAME", "root");
        String databasePassword = requiredEnvironment("LIVE_USER_DB_PASSWORD");
        try (Connection connection = DriverManager.getConnection(databaseUrl, databaseUser, databasePassword);
             PreparedStatement query = connection.prepareStatement("SELECT password FROM users WHERE email = ?")) {
            query.setString(1, email);
            try (ResultSet result = query.executeQuery()) {
                assertThat(result.next()).as("the reset must update the intended user row").isTrue();
                return result.getString(1);
            }
        }
    }

    private String hashFingerprint(String passwordHash) throws Exception {
        byte[] digest = MessageDigest.getInstance("SHA-256")
                .digest(passwordHash.getBytes(StandardCharsets.UTF_8));
        return HexFormat.of().formatHex(digest).substring(0, 16);
    }

    private String redactLoginResponse(String body) throws Exception {
        JsonNode response = JSON.readTree(body);
        if (response.isObject()) {
            ((com.fasterxml.jackson.databind.node.ObjectNode) response).put("token", "[REDACTED]");
            JsonNode user = response.path("user");
            if (user.isObject()) {
                ((com.fasterxml.jackson.databind.node.ObjectNode) user).put("email", "[TEST EMAIL REDACTED]");
            }
        }
        return JSON.writeValueAsString(response);
    }

    private String requiredEnvironment(String name) {
        String value = System.getenv(name);
        assertThat(value).as(name + " must be configured").isNotBlank();
        return value;
    }

    private String environmentOrDefault(String name, String fallback) {
        String value = System.getenv(name);
        return value == null || value.isBlank() ? fallback : value;
    }
}
