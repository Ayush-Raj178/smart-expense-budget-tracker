package com.smartexpense.userservice.service;

import com.smartexpense.userservice.dto.EmailAddressRequest;
import com.smartexpense.userservice.dto.EmailChangeRequest;
import com.smartexpense.userservice.dto.EmailChangeVerificationRequest;
import com.smartexpense.userservice.dto.LoginResponse;
import com.smartexpense.userservice.dto.MessageResponse;
import com.smartexpense.userservice.dto.OtpDispatchResponse;
import com.smartexpense.userservice.dto.OtpVerificationRequest;
import com.smartexpense.userservice.dto.PasswordResetRequest;
import com.smartexpense.userservice.dto.SignupRequest;
import com.smartexpense.userservice.dto.UserResponse;
import com.smartexpense.userservice.entity.EmailOtpChallenge;
import com.smartexpense.userservice.entity.OtpPurpose;
import com.smartexpense.userservice.entity.User;
import com.smartexpense.userservice.exception.DuplicateEmailException;
import com.smartexpense.userservice.exception.InvalidProfileUpdateException;
import com.smartexpense.userservice.exception.MailDeliveryException;
import com.smartexpense.userservice.exception.OtpException;
import com.smartexpense.userservice.exception.OtpRateLimitException;
import com.smartexpense.userservice.exception.UndeliverableEmailDomainException;
import com.smartexpense.userservice.exception.UserNotFoundException;
import com.smartexpense.userservice.repository.EmailOtpChallengeRepository;
import com.smartexpense.userservice.repository.UserRepository;
import com.smartexpense.userservice.security.JwtTokenProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Locale;

@Service
public class AccountVerificationService {

    private static final String SIGNUP_KEY_PREFIX = "signup:";
    private static final String EMAIL_CHANGE_KEY_PREFIX = "email-change:";
    private static final String PASSWORD_RESET_KEY_PREFIX = "password-reset:";
    private static final String PASSWORD_RESET_DISPATCH_MESSAGE =
            "If this email is registered, a code has been sent";
    private static final Logger LOGGER = LoggerFactory.getLogger(AccountVerificationService.class);

    private final UserRepository userRepository;
    private final EmailOtpChallengeRepository challengeRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final EmailService emailService;
    private final EmailDomainValidationService emailDomainValidationService;
    private final SecureRandom secureRandom = new SecureRandom();
    private final long expiryMinutes;
    private final long resendCooldownSeconds;
    private final int maxAttempts;

    public AccountVerificationService(
            UserRepository userRepository,
            EmailOtpChallengeRepository challengeRepository,
            PasswordEncoder passwordEncoder,
            JwtTokenProvider jwtTokenProvider,
            EmailService emailService,
            EmailDomainValidationService emailDomainValidationService,
            @Value("${app.otp.expiry-minutes}") long expiryMinutes,
            @Value("${app.otp.resend-cooldown-seconds}") long resendCooldownSeconds,
            @Value("${app.otp.max-attempts}") int maxAttempts) {
        this.userRepository = userRepository;
        this.challengeRepository = challengeRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokenProvider = jwtTokenProvider;
        this.emailService = emailService;
        this.emailDomainValidationService = emailDomainValidationService;
        this.expiryMinutes = expiryMinutes;
        this.resendCooldownSeconds = resendCooldownSeconds;
        this.maxAttempts = maxAttempts;
    }

    @Transactional
    public OtpDispatchResponse requestSignupOtp(SignupRequest request) {
        String email = normalizeEmail(request.getEmail());
        rejectRegisteredEmail(email);
        emailDomainValidationService.requireMailAcceptingDomain(email);

        String challengeKey = SIGNUP_KEY_PREFIX + email;
        EmailOtpChallenge challenge = challengeRepository.findByChallengeKey(challengeKey)
                .orElseGet(EmailOtpChallenge::new);
        enforceCooldown(challenge);

        String otp = generateOtp();
        LocalDateTime now = LocalDateTime.now();
        challenge.setChallengeKey(challengeKey);
        challenge.setEmail(email);
        challenge.setPurpose(OtpPurpose.SIGNUP);
        challenge.setUserId(null);
        challenge.setOtpHash(passwordEncoder.encode(otp));
        challenge.setPendingName(request.getName().trim());
        challenge.setPendingPasswordHash(passwordEncoder.encode(request.getPassword()));
        challenge.setExpiresAt(now.plusMinutes(expiryMinutes));
        challenge.setResendAvailableAt(now.plusSeconds(resendCooldownSeconds));
        challenge.setAttemptCount(0);
        challengeRepository.save(challenge);

        emailService.sendSignupOtp(email, otp, expiryMinutes);
        return dispatchResponse(email, "Verification code sent");
    }

    @Transactional
    public OtpDispatchResponse resendSignupOtp(EmailAddressRequest request) {
        String email = normalizeEmail(request.getEmail());
        rejectRegisteredEmail(email);
        String challengeKey = SIGNUP_KEY_PREFIX + email;
        EmailOtpChallenge challenge = challengeRepository.findByChallengeKey(challengeKey)
                .orElseThrow(() -> new OtpException("Start signup before requesting another code"));
        enforceCooldown(challenge);
        emailDomainValidationService.requireMailAcceptingDomain(email);

        String otp = generateOtp();
        LocalDateTime now = LocalDateTime.now();
        challenge.setOtpHash(passwordEncoder.encode(otp));
        challenge.setExpiresAt(now.plusMinutes(expiryMinutes));
        challenge.setResendAvailableAt(now.plusSeconds(resendCooldownSeconds));
        challenge.setAttemptCount(0);
        challengeRepository.save(challenge);

        emailService.sendSignupOtp(email, otp, expiryMinutes);
        return dispatchResponse(email, "A new verification code was sent");
    }

    @Transactional(noRollbackFor = OtpException.class)
    public LoginResponse verifySignupOtp(OtpVerificationRequest request) {
        String email = normalizeEmail(request.getEmail());
        EmailOtpChallenge challenge = challengeRepository.findByChallengeKey(SIGNUP_KEY_PREFIX + email)
                .orElseThrow(() -> new OtpException("Verification request not found. Start signup again."));
        verifyChallenge(challenge, request.getOtp());
        rejectRegisteredEmail(email);

        User user = User.builder()
                .name(challenge.getPendingName())
                .email(email)
                .password(challenge.getPendingPasswordHash())
                .build();
        User saved = userRepository.saveAndFlush(user);
        challengeRepository.delete(challenge);

        String token = jwtTokenProvider.generateToken(saved.getId(), saved.getEmail());
        return LoginResponse.builder()
                .message("Account verified and created")
                .token(token)
                .user(toUserResponse(saved))
                .build();
    }

    @Transactional
    public OtpDispatchResponse requestPasswordResetOtp(EmailAddressRequest request) {
        String email = normalizeEmail(request.getEmail());
        OtpDispatchResponse genericResponse = dispatchResponse(email, PASSWORD_RESET_DISPATCH_MESSAGE);

        try {
            emailDomainValidationService.requireMailAcceptingDomain(email);
        } catch (UndeliverableEmailDomainException exception) {
            return genericResponse;
        }

        User user = userRepository.findByEmail(email).orElse(null);
        if (user == null) {
            return genericResponse;
        }

        String challengeKey = PASSWORD_RESET_KEY_PREFIX + user.getId();
        EmailOtpChallenge challenge = challengeRepository.findByChallengeKey(challengeKey)
                .orElseGet(EmailOtpChallenge::new);
        if (isCooldownActive(challenge)) {
            return genericResponse;
        }

        String otp = generateOtp();
        LocalDateTime now = LocalDateTime.now();
        challenge.setChallengeKey(challengeKey);
        challenge.setEmail(email);
        challenge.setPurpose(OtpPurpose.PASSWORD_RESET);
        challenge.setUserId(user.getId());
        challenge.setOtpHash(passwordEncoder.encode(otp));
        challenge.setPendingName(null);
        challenge.setPendingPasswordHash(null);
        challenge.setExpiresAt(now.plusMinutes(expiryMinutes));
        challenge.setResendAvailableAt(now.plusSeconds(resendCooldownSeconds));
        challenge.setAttemptCount(0);
        challengeRepository.save(challenge);

        try {
            emailService.sendPasswordResetOtp(email, otp, expiryMinutes);
        } catch (MailDeliveryException exception) {
            challengeRepository.delete(challenge);
            LOGGER.warn("Password-reset email delivery failed for user id {}", user.getId());
        }
        return genericResponse;
    }

    @Transactional(noRollbackFor = OtpException.class)
    public MessageResponse verifyPasswordResetOtp(OtpVerificationRequest request) {
        PasswordResetChallenge passwordReset = findPasswordResetChallenge(request.getEmail());
        verifyChallenge(passwordReset.challenge(), request.getOtp());
        return new MessageResponse("Verification code confirmed");
    }

    @Transactional(noRollbackFor = OtpException.class)
    public MessageResponse resetPassword(PasswordResetRequest request) {
        PasswordResetChallenge passwordReset = findPasswordResetChallenge(request.getEmail());
        verifyChallenge(passwordReset.challenge(), request.getOtp());
        passwordReset.user().setPassword(passwordEncoder.encode(request.getNewPassword()));
        userRepository.saveAndFlush(passwordReset.user());
        challengeRepository.delete(passwordReset.challenge());
        return new MessageResponse(
                "Password reset successfully. You can now sign in."
        );
    }

    @Transactional
    public OtpDispatchResponse requestEmailChange(Long userId, EmailChangeRequest request) {
        User user = findUser(userId);
        String newEmail = normalizeEmail(request.getNewEmail());
        if (user.getEmail().equalsIgnoreCase(newEmail)) {
            throw new InvalidProfileUpdateException("That is already your account email");
        }
        if (userRepository.existsByEmailAndIdNot(newEmail, userId)) {
            throw new DuplicateEmailException();
        }

        String challengeKey = EMAIL_CHANGE_KEY_PREFIX + userId;
        EmailOtpChallenge challenge = challengeRepository.findByChallengeKey(challengeKey)
                .orElseGet(EmailOtpChallenge::new);
        enforceCooldown(challenge);
        emailDomainValidationService.requireMailAcceptingDomain(newEmail);

        String otp = generateOtp();
        LocalDateTime now = LocalDateTime.now();
        challenge.setChallengeKey(challengeKey);
        challenge.setEmail(newEmail);
        challenge.setPurpose(OtpPurpose.EMAIL_CHANGE);
        challenge.setUserId(userId);
        challenge.setOtpHash(passwordEncoder.encode(otp));
        challenge.setPendingName(null);
        challenge.setPendingPasswordHash(null);
        challenge.setExpiresAt(now.plusMinutes(expiryMinutes));
        challenge.setResendAvailableAt(now.plusSeconds(resendCooldownSeconds));
        challenge.setAttemptCount(0);
        challengeRepository.save(challenge);

        emailService.sendEmailChangeOtp(newEmail, otp, expiryMinutes);
        return dispatchResponse(newEmail, "Verification code sent to your new email");
    }

    @Transactional(noRollbackFor = OtpException.class)
    public LoginResponse verifyEmailChange(Long userId, EmailChangeVerificationRequest request) {
        User user = findUser(userId);
        String newEmail = normalizeEmail(request.getNewEmail());
        EmailOtpChallenge challenge = challengeRepository
                .findByChallengeKey(EMAIL_CHANGE_KEY_PREFIX + userId)
                .orElseThrow(() -> new OtpException("Email change request not found"));
        if (!challenge.getEmail().equals(newEmail)) {
            throw new OtpException("The code was issued for a different email address");
        }
        verifyChallenge(challenge, request.getOtp());
        if (userRepository.existsByEmailAndIdNot(newEmail, userId)) {
            throw new DuplicateEmailException();
        }

        user.setEmail(newEmail);
        User saved = userRepository.saveAndFlush(user);
        challengeRepository.delete(challenge);
        String token = jwtTokenProvider.generateToken(saved.getId(), saved.getEmail());
        return LoginResponse.builder()
                .message("Email updated successfully")
                .token(token)
                .user(toUserResponse(saved))
                .build();
    }

    private void verifyChallenge(EmailOtpChallenge challenge, String otp) {
        LocalDateTime now = LocalDateTime.now();
        if (now.isAfter(challenge.getExpiresAt())) {
            throw new OtpException("Verification code has expired. Request a new code.");
        }
        if (challenge.getAttemptCount() >= maxAttempts) {
            throw new OtpException("Too many invalid attempts. Request a new code.");
        }
        if (!passwordEncoder.matches(otp, challenge.getOtpHash())) {
            challenge.setAttemptCount(challenge.getAttemptCount() + 1);
            challengeRepository.save(challenge);
            int remaining = Math.max(0, maxAttempts - challenge.getAttemptCount());
            throw new OtpException(remaining == 0
                    ? "Too many invalid attempts. Request a new code."
                    : "Verification code is incorrect. " + remaining + " attempts remaining.");
        }
    }

    private void enforceCooldown(EmailOtpChallenge challenge) {
        if (challenge.getId() == null || challenge.getResendAvailableAt() == null) {
            return;
        }
        LocalDateTime now = LocalDateTime.now();
        if (now.isBefore(challenge.getResendAvailableAt())) {
            long seconds = Math.max(1, Duration.between(now, challenge.getResendAvailableAt()).getSeconds() + 1);
            throw new OtpRateLimitException(seconds);
        }
    }

    private boolean isCooldownActive(EmailOtpChallenge challenge) {
        return challenge.getId() != null
                && challenge.getResendAvailableAt() != null
                && LocalDateTime.now().isBefore(challenge.getResendAvailableAt());
    }

    private PasswordResetChallenge findPasswordResetChallenge(String requestedEmail) {
        String email = normalizeEmail(requestedEmail);
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new OtpException("Verification code is invalid or expired."));
        EmailOtpChallenge challenge = challengeRepository
                .findByChallengeKey(PASSWORD_RESET_KEY_PREFIX + user.getId())
                .orElseThrow(() -> new OtpException("Verification code is invalid or expired."));
        if (challenge.getPurpose() != OtpPurpose.PASSWORD_RESET
                || !challenge.getEmail().equalsIgnoreCase(email)
                || !user.getId().equals(challenge.getUserId())) {
            throw new OtpException("Verification code is invalid or expired.");
        }
        return new PasswordResetChallenge(user, challenge);
    }

    private OtpDispatchResponse dispatchResponse(String email, String message) {
        return OtpDispatchResponse.builder()
                .message(message)
                .email(email)
                .expiresInSeconds(expiryMinutes * 60)
                .resendAvailableInSeconds(resendCooldownSeconds)
                .build();
    }

    private void rejectRegisteredEmail(String email) {
        if (userRepository.existsByEmail(email)) {
            throw new DuplicateEmailException();
        }
    }

    private User findUser(Long userId) {
        return userRepository.findById(userId).orElseThrow(UserNotFoundException::new);
    }

    private String generateOtp() {
        return String.format(Locale.ROOT, "%06d", secureRandom.nextInt(1_000_000));
    }

    private String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    private UserResponse toUserResponse(User user) {
        return UserResponse.builder()
                .id(user.getId())
                .name(user.getName())
                .email(user.getEmail())
                .phoneNumber(user.getPhoneNumber())
                .build();
    }

    private record PasswordResetChallenge(User user, EmailOtpChallenge challenge) {
    }
}
