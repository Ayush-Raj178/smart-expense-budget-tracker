package com.smartexpense.userservice.service;

import com.smartexpense.userservice.exception.MailDeliveryException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
public class EmailService {

    private final JavaMailSender mailSender;
    private final String fromAddress;

    public EmailService(JavaMailSender mailSender, @Value("${app.mail.from}") String fromAddress) {
        this.mailSender = mailSender;
        this.fromAddress = fromAddress;
    }

    public void sendSignupOtp(String recipient, String otp, long expiryMinutes) {
        sendOtp(
                recipient,
                "Verify your SmartBudget account",
                "Use this one-time code to finish creating your SmartBudget account: " + otp
                        + "\n\nThe code expires in " + expiryMinutes + " minutes."
                        + "\nIf you did not request this, you can ignore this email."
        );
    }

    public void sendEmailChangeOtp(String recipient, String otp, long expiryMinutes) {
        sendOtp(
                recipient,
                "Confirm your new SmartBudget email",
                "Use this one-time code to confirm this email address for your SmartBudget account: " + otp
                        + "\n\nThe code expires in " + expiryMinutes + " minutes."
                        + "\nIf you did not request this change, keep your existing email and ignore this message."
        );
    }

    public void sendPasswordResetOtp(String recipient, String otp, long expiryMinutes) {
        sendOtp(
                recipient,
                "Reset your SmartBudget password",
                "Use this one-time code to reset your SmartBudget password: " + otp
                        + "\n\nThe code expires in " + expiryMinutes + " minutes."
                        + "\nIf you did not request a password reset, you can ignore this email."
        );
    }

    private void sendOtp(String recipient, String subject, String body) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(fromAddress);
        message.setTo(recipient);
        message.setSubject(subject);
        message.setText(body);

        try {
            mailSender.send(message);
        } catch (MailException exception) {
            throw new MailDeliveryException(
                    "We couldn't send a verification code to this email address. Please check it and try again.",
                    exception
            );
        }
    }
}
