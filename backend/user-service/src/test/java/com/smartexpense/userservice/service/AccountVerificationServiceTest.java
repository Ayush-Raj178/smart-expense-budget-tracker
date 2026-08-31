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
import com.smartexpense.userservice.entity.EmailOtpChallenge;
import com.smartexpense.userservice.entity.OtpPurpose;
import com.smartexpense.userservice.entity.User;
import com.smartexpense.userservice.exception.MailDeliveryException;
import com.smartexpense.userservice.exception.OtpException;
import com.smartexpense.userservice.exception.OtpRateLimitException;
import com.smartexpense.userservice.exception.UndeliverableEmailDomainException;
import com.smartexpense.userservice.repository.EmailOtpChallengeRepository;
import com.smartexpense.userservice.repository.UserRepository;
import com.smartexpense.userservice.security.JwtTokenProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AccountVerificationServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private EmailOtpChallengeRepository challengeRepository;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private JwtTokenProvider jwtTokenProvider;
    @Mock private EmailService emailService;
    @Mock private EmailDomainValidationService emailDomainValidationService;

    private AccountVerificationService service;

    @BeforeEach
    void setUp() {
        service = new AccountVerificationService(
                userRepository, challengeRepository, passwordEncoder, jwtTokenProvider, emailService,
                emailDomainValidationService,
                10, 60, 5
        );
    }

    @Test
    void signupRequestStoresOnlyHashesAndDoesNotCreateUser() {
        when(userRepository.existsByEmail("new@example.com")).thenReturn(false);
        when(challengeRepository.findByChallengeKey("signup:new@example.com")).thenReturn(Optional.empty());
        when(passwordEncoder.encode(anyString())).thenAnswer(invocation -> "hash:" + invocation.getArgument(0));

        OtpDispatchResponse response = service.requestSignupOtp(
                new SignupRequest(" New User ", "NEW@example.com", "secret123")
        );

        ArgumentCaptor<EmailOtpChallenge> challengeCaptor = ArgumentCaptor.forClass(EmailOtpChallenge.class);
        ArgumentCaptor<String> otpCaptor = ArgumentCaptor.forClass(String.class);
        verify(challengeRepository).save(challengeCaptor.capture());
        verify(emailDomainValidationService).requireMailAcceptingDomain("new@example.com");
        verify(emailService).sendSignupOtp(org.mockito.ArgumentMatchers.eq("new@example.com"), otpCaptor.capture(), org.mockito.ArgumentMatchers.eq(10L));
        EmailOtpChallenge challenge = challengeCaptor.getValue();
        assertThat(otpCaptor.getValue()).matches("\\d{6}");
        assertThat(challenge.getOtpHash()).isEqualTo("hash:" + otpCaptor.getValue());
        assertThat(challenge.getPendingPasswordHash()).isEqualTo("hash:secret123");
        assertThat(challenge.getPendingName()).isEqualTo("New User");
        assertThat(response.getExpiresInSeconds()).isEqualTo(600);
        verify(userRepository, never()).saveAndFlush(any(User.class));
    }

    @Test
    void validSignupOtpCreatesAccountAndReturnsJwt() {
        EmailOtpChallenge challenge = signupChallenge();
        when(challengeRepository.findByChallengeKey("signup:new@example.com")).thenReturn(Optional.of(challenge));
        when(passwordEncoder.matches("123456", "otp-hash")).thenReturn(true);
        when(userRepository.existsByEmail("new@example.com")).thenReturn(false);
        when(userRepository.saveAndFlush(any(User.class))).thenAnswer(invocation -> {
            User user = invocation.getArgument(0);
            user.setId(9L);
            return user;
        });
        when(jwtTokenProvider.generateToken(9L, "new@example.com")).thenReturn("jwt-token");

        LoginResponse response = service.verifySignupOtp(new OtpVerificationRequest("new@example.com", "123456"));

        assertThat(response.getToken()).isEqualTo("jwt-token");
        assertThat(response.getUser().getEmail()).isEqualTo("new@example.com");
        assertThat(response.getUser().getName()).isEqualTo("New User");
        verify(challengeRepository).delete(challenge);
    }

    @Test
    void invalidOtpIncrementsAttemptsWithoutCreatingAccount() {
        EmailOtpChallenge challenge = signupChallenge();
        when(challengeRepository.findByChallengeKey("signup:new@example.com")).thenReturn(Optional.of(challenge));
        when(passwordEncoder.matches("000000", "otp-hash")).thenReturn(false);

        assertThatThrownBy(() -> service.verifySignupOtp(new OtpVerificationRequest("new@example.com", "000000")))
                .isInstanceOf(OtpException.class)
                .hasMessageContaining("4 attempts remaining");
        assertThat(challenge.getAttemptCount()).isEqualTo(1);
        verify(userRepository, never()).saveAndFlush(any(User.class));
    }

    @Test
    void cooldownPreventsImmediateRepeatedSignupEmail() {
        EmailOtpChallenge challenge = signupChallenge();
        challenge.setId(3L);
        challenge.setResendAvailableAt(LocalDateTime.now().plusSeconds(30));
        when(userRepository.existsByEmail("new@example.com")).thenReturn(false);
        when(challengeRepository.findByChallengeKey("signup:new@example.com")).thenReturn(Optional.of(challenge));

        assertThatThrownBy(() -> service.requestSignupOtp(new SignupRequest("New", "new@example.com", "secret123")))
                .isInstanceOf(OtpRateLimitException.class);
        verify(emailService, never()).sendSignupOtp(anyString(), anyString(), anyLong());
    }

    @Test
    void signupRejectsDomainWithoutMxBeforeCreatingChallengeOrSendingMail() {
        when(userRepository.existsByEmail("person@no-mail.invalid")).thenReturn(false);
        doThrow(new UndeliverableEmailDomainException())
                .when(emailDomainValidationService).requireMailAcceptingDomain("person@no-mail.invalid");

        assertThatThrownBy(() -> service.requestSignupOtp(
                new SignupRequest("New User", "person@no-mail.invalid", "secret123")
        )).isInstanceOf(UndeliverableEmailDomainException.class);

        verify(challengeRepository, never()).save(any(EmailOtpChallenge.class));
        verify(emailService, never()).sendSignupOtp(anyString(), anyString(), anyLong());
    }

    @Test
    void synchronousSmtpFailureIsReturnedInsteadOfOtpSuccess() {
        when(userRepository.existsByEmail("new@example.com")).thenReturn(false);
        when(challengeRepository.findByChallengeKey("signup:new@example.com")).thenReturn(Optional.empty());
        when(passwordEncoder.encode(anyString())).thenReturn("hash");
        doThrow(new MailDeliveryException("SMTP rejected the message", new RuntimeException("rejected")))
                .when(emailService).sendSignupOtp(eq("new@example.com"), anyString(), eq(10L));

        assertThatThrownBy(() -> service.requestSignupOtp(
                new SignupRequest("New User", "new@example.com", "secret123")
        )).isInstanceOf(MailDeliveryException.class);
    }

    @Test
    void emailChangeRejectsDomainWithoutMxBeforeCreatingChallengeOrSendingMail() {
        User user = User.builder().id(4L).name("Ayu").email("old@example.com").password("hash").build();
        when(userRepository.findById(4L)).thenReturn(Optional.of(user));
        when(userRepository.existsByEmailAndIdNot("person@no-mail.invalid", 4L)).thenReturn(false);
        doThrow(new UndeliverableEmailDomainException())
                .when(emailDomainValidationService).requireMailAcceptingDomain("person@no-mail.invalid");

        assertThatThrownBy(() -> service.requestEmailChange(
                4L, new EmailChangeRequest("person@no-mail.invalid")
        )).isInstanceOf(UndeliverableEmailDomainException.class);

        verify(challengeRepository, never()).save(any(EmailOtpChallenge.class));
        verify(emailService, never()).sendEmailChangeOtp(anyString(), anyString(), anyLong());
    }

    @Test
    void verifiedEmailChangeUpdatesOnlyEmailAndReturnsReplacementJwt() {
        User user = User.builder().id(4L).name("Ayu").email("old@example.com").password("password-hash").phoneNumber("1234567890").build();
        EmailOtpChallenge challenge = EmailOtpChallenge.builder()
                .id(12L).challengeKey("email-change:4").email("new@example.com")
                .purpose(OtpPurpose.EMAIL_CHANGE).userId(4L).otpHash("otp-hash")
                .expiresAt(LocalDateTime.now().plusMinutes(5)).resendAvailableAt(LocalDateTime.now()).attemptCount(0).build();
        when(userRepository.findById(4L)).thenReturn(Optional.of(user));
        when(challengeRepository.findByChallengeKey("email-change:4")).thenReturn(Optional.of(challenge));
        when(passwordEncoder.matches("123456", "otp-hash")).thenReturn(true);
        when(userRepository.existsByEmailAndIdNot("new@example.com", 4L)).thenReturn(false);
        when(userRepository.saveAndFlush(user)).thenReturn(user);
        when(jwtTokenProvider.generateToken(4L, "new@example.com")).thenReturn("replacement-token");

        LoginResponse response = service.verifyEmailChange(4L, new EmailChangeVerificationRequest("new@example.com", "123456"));

        assertThat(response.getToken()).isEqualTo("replacement-token");
        assertThat(user.getEmail()).isEqualTo("new@example.com");
        assertThat(user.getName()).isEqualTo("Ayu");
        assertThat(user.getPhoneNumber()).isEqualTo("1234567890");
        verify(challengeRepository).delete(challenge);
    }

    @Test
    void passwordResetRequestStoresHashedOtpForRegisteredUser() {
        User user = User.builder().id(7L).name("Reset User").email("reset@gmail.com").password("old-hash").build();
        when(userRepository.findByEmail("reset@gmail.com")).thenReturn(Optional.of(user));
        when(challengeRepository.findByChallengeKey("password-reset:7")).thenReturn(Optional.empty());
        when(passwordEncoder.encode(anyString())).thenAnswer(invocation -> "hash:" + invocation.getArgument(0));

        OtpDispatchResponse response = service.requestPasswordResetOtp(
                new EmailAddressRequest("RESET@gmail.com")
        );

        ArgumentCaptor<EmailOtpChallenge> challengeCaptor = ArgumentCaptor.forClass(EmailOtpChallenge.class);
        ArgumentCaptor<String> otpCaptor = ArgumentCaptor.forClass(String.class);
        verify(challengeRepository).save(challengeCaptor.capture());
        verify(emailService).sendPasswordResetOtp(eq("reset@gmail.com"), otpCaptor.capture(), eq(10L));
        EmailOtpChallenge challenge = challengeCaptor.getValue();
        assertThat(challenge.getPurpose()).isEqualTo(OtpPurpose.PASSWORD_RESET);
        assertThat(challenge.getUserId()).isEqualTo(7L);
        assertThat(challenge.getOtpHash()).isEqualTo("hash:" + otpCaptor.getValue());
        assertThat(challenge.getPendingPasswordHash()).isNull();
        assertThat(response.getMessage()).isEqualTo("If this email is registered, a code has been sent");
    }

    @Test
    void unknownPasswordResetEmailReturnsSameGenericResponseWithoutSending() {
        when(userRepository.findByEmail("missing@gmail.com")).thenReturn(Optional.empty());

        OtpDispatchResponse response = service.requestPasswordResetOtp(
                new EmailAddressRequest("missing@gmail.com")
        );

        assertThat(response.getMessage()).isEqualTo("If this email is registered, a code has been sent");
        verify(challengeRepository, never()).save(any(EmailOtpChallenge.class));
        verify(emailService, never()).sendPasswordResetOtp(anyString(), anyString(), anyLong());
    }

    @Test
    void passwordResetCooldownIsSilentToPreventEnumeration() {
        User user = User.builder().id(7L).email("reset@gmail.com").password("old-hash").build();
        EmailOtpChallenge challenge = passwordResetChallenge(user);
        challenge.setResendAvailableAt(LocalDateTime.now().plusSeconds(30));
        when(userRepository.findByEmail("reset@gmail.com")).thenReturn(Optional.of(user));
        when(challengeRepository.findByChallengeKey("password-reset:7")).thenReturn(Optional.of(challenge));

        OtpDispatchResponse response = service.requestPasswordResetOtp(
                new EmailAddressRequest("reset@gmail.com")
        );

        assertThat(response.getMessage()).isEqualTo("If this email is registered, a code has been sent");
        verify(emailService, never()).sendPasswordResetOtp(anyString(), anyString(), anyLong());
    }

    @Test
    void passwordResetSmtpFailureDoesNotRevealRegisteredAccount() {
        User user = User.builder().id(7L).email("reset@gmail.com").password("old-hash").build();
        when(userRepository.findByEmail("reset@gmail.com")).thenReturn(Optional.of(user));
        when(challengeRepository.findByChallengeKey("password-reset:7")).thenReturn(Optional.empty());
        when(passwordEncoder.encode(anyString())).thenReturn("otp-hash");
        doThrow(new MailDeliveryException("SMTP unavailable", new RuntimeException("unavailable")))
                .when(emailService).sendPasswordResetOtp(eq("reset@gmail.com"), anyString(), eq(10L));

        OtpDispatchResponse response = service.requestPasswordResetOtp(
                new EmailAddressRequest("reset@gmail.com")
        );

        assertThat(response.getMessage()).isEqualTo("If this email is registered, a code has been sent");
        ArgumentCaptor<EmailOtpChallenge> challengeCaptor = ArgumentCaptor.forClass(EmailOtpChallenge.class);
        verify(challengeRepository).save(challengeCaptor.capture());
        verify(challengeRepository).delete(challengeCaptor.getValue());
    }

    @Test
    void noMxPasswordResetRequestAlsoReturnsGenericResponse() {
        doThrow(new UndeliverableEmailDomainException())
                .when(emailDomainValidationService).requireMailAcceptingDomain("person@example.com");

        OtpDispatchResponse response = service.requestPasswordResetOtp(
                new EmailAddressRequest("person@example.com")
        );

        assertThat(response.getMessage()).isEqualTo("If this email is registered, a code has been sent");
        verify(userRepository, never()).findByEmail(anyString());
        verify(emailService, never()).sendPasswordResetOtp(anyString(), anyString(), anyLong());
    }

    @Test
    void validPasswordResetOtpCanBePreverifiedWithoutConsumingChallenge() {
        User user = User.builder().id(7L).name("Reset User").email("reset@gmail.com").password("old-hash").build();
        EmailOtpChallenge challenge = passwordResetChallenge(user);
        when(userRepository.findByEmail("reset@gmail.com")).thenReturn(Optional.of(user));
        when(challengeRepository.findByChallengeKey("password-reset:7")).thenReturn(Optional.of(challenge));
        when(passwordEncoder.matches("123456", "otp-hash")).thenReturn(true);

        MessageResponse response = service.verifyPasswordResetOtp(
                new OtpVerificationRequest("reset@gmail.com", "123456")
        );

        assertThat(response.getMessage()).isEqualTo("Verification code confirmed");
        assertThat(user.getPassword()).isEqualTo("old-hash");
        verify(challengeRepository, never()).delete(any());
        verify(userRepository, never()).saveAndFlush(any());
    }

    @Test
    void invalidPasswordResetPreverificationConsumesAttemptWithoutDeletingChallenge() {
        User user = User.builder().id(7L).email("reset@gmail.com").password("old-hash").build();
        EmailOtpChallenge challenge = passwordResetChallenge(user);
        when(userRepository.findByEmail("reset@gmail.com")).thenReturn(Optional.of(user));
        when(challengeRepository.findByChallengeKey("password-reset:7")).thenReturn(Optional.of(challenge));
        when(passwordEncoder.matches("000000", "otp-hash")).thenReturn(false);

        assertThatThrownBy(() -> service.verifyPasswordResetOtp(
                new OtpVerificationRequest("reset@gmail.com", "000000")
        )).isInstanceOf(OtpException.class).hasMessageContaining("4 attempts remaining");

        assertThat(challenge.getAttemptCount()).isEqualTo(1);
        verify(challengeRepository).save(challenge);
        verify(challengeRepository, never()).delete(any());
        verify(userRepository, never()).saveAndFlush(any());
    }

    @Test
    void validPasswordResetOtpUpdatesHashAndDeletesChallenge() {
        User user = User.builder().id(7L).name("Reset User").email("reset@gmail.com").password("old-hash").build();
        EmailOtpChallenge challenge = passwordResetChallenge(user);
        when(userRepository.findByEmail("reset@gmail.com")).thenReturn(Optional.of(user));
        when(challengeRepository.findByChallengeKey("password-reset:7")).thenReturn(Optional.of(challenge));
        when(passwordEncoder.matches("123456", "otp-hash")).thenReturn(true);
        when(passwordEncoder.encode("new-password")).thenReturn("new-hash");
        when(userRepository.saveAndFlush(user)).thenReturn(user);

        MessageResponse response = service.resetPassword(
                new PasswordResetRequest("reset@gmail.com", "123456", "new-password")
        );

        assertThat(user.getPassword()).isEqualTo("new-hash");
        assertThat(response.getMessage()).contains("Password reset successfully");
        verify(userRepository).saveAndFlush(user);
        verify(challengeRepository).delete(challenge);
    }

    @Test
    void invalidPasswordResetOtpDoesNotChangePasswordAndConsumesAttempt() {
        User user = User.builder().id(7L).email("reset@gmail.com").password("old-hash").build();
        EmailOtpChallenge challenge = passwordResetChallenge(user);
        when(userRepository.findByEmail("reset@gmail.com")).thenReturn(Optional.of(user));
        when(challengeRepository.findByChallengeKey("password-reset:7")).thenReturn(Optional.of(challenge));
        when(passwordEncoder.matches("000000", "otp-hash")).thenReturn(false);

        assertThatThrownBy(() -> service.resetPassword(
                new PasswordResetRequest("reset@gmail.com", "000000", "new-password")
        )).isInstanceOf(OtpException.class).hasMessageContaining("4 attempts remaining");

        assertThat(user.getPassword()).isEqualTo("old-hash");
        assertThat(challenge.getAttemptCount()).isEqualTo(1);
        verify(userRepository, never()).saveAndFlush(user);
    }

    private EmailOtpChallenge signupChallenge() {
        return EmailOtpChallenge.builder()
                .id(1L)
                .challengeKey("signup:new@example.com")
                .email("new@example.com")
                .purpose(OtpPurpose.SIGNUP)
                .otpHash("otp-hash")
                .pendingName("New User")
                .pendingPasswordHash("password-hash")
                .expiresAt(LocalDateTime.now().plusMinutes(5))
                .resendAvailableAt(LocalDateTime.now())
                .attemptCount(0)
                .build();
    }

    private EmailOtpChallenge passwordResetChallenge(User user) {
        return EmailOtpChallenge.builder()
                .id(21L)
                .challengeKey("password-reset:" + user.getId())
                .email(user.getEmail())
                .purpose(OtpPurpose.PASSWORD_RESET)
                .userId(user.getId())
                .otpHash("otp-hash")
                .expiresAt(LocalDateTime.now().plusMinutes(5))
                .resendAvailableAt(LocalDateTime.now())
                .attemptCount(0)
                .build();
    }
}
