package com.smartexpense.userservice.controller;

import com.smartexpense.userservice.dto.LoginRequest;
import com.smartexpense.userservice.dto.LoginResponse;
import com.smartexpense.userservice.dto.EmailAddressRequest;
import com.smartexpense.userservice.dto.OtpDispatchResponse;
import com.smartexpense.userservice.dto.OtpVerificationRequest;
import com.smartexpense.userservice.dto.PasswordResetRequest;
import com.smartexpense.userservice.dto.SignupRequest;
import com.smartexpense.userservice.dto.MessageResponse;
import com.smartexpense.userservice.service.AccountVerificationService;
import com.smartexpense.userservice.config.OtpVerificationSettings;
import com.smartexpense.userservice.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final UserService userService;
    private final AccountVerificationService accountVerificationService;
    private final OtpVerificationSettings otpVerificationSettings;

    @PostMapping("/signup")
    public ResponseEntity<?> signup(@Valid @RequestBody SignupRequest request) {
        if (!otpVerificationSettings.isEnabled()) {
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(accountVerificationService.signupWithoutOtp(request));
        }
        OtpDispatchResponse response = accountVerificationService.requestSignupOtp(request);
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(response);
    }

    @PostMapping("/signup/verify")
    public ResponseEntity<LoginResponse> verifySignup(@Valid @RequestBody OtpVerificationRequest request) {
        LoginResponse response = accountVerificationService.verifySignupOtp(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping("/signup/resend")
    public ResponseEntity<OtpDispatchResponse> resendSignup(@Valid @RequestBody EmailAddressRequest request) {
        OtpDispatchResponse response = accountVerificationService.resendSignupOtp(request);
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(response);
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<OtpDispatchResponse> forgotPassword(
            @Valid @RequestBody EmailAddressRequest request) {
        OtpDispatchResponse response = accountVerificationService.requestPasswordResetOtp(request);
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(response);
    }

    @PostMapping("/forgot-password/verify")
    public ResponseEntity<MessageResponse> verifyPasswordResetCode(
            @Valid @RequestBody OtpVerificationRequest request) {
        return ResponseEntity.ok(accountVerificationService.verifyPasswordResetOtp(request));
    }

    @PostMapping("/reset-password")
    public ResponseEntity<MessageResponse> resetPassword(
            @Valid @RequestBody PasswordResetRequest request) {
        return ResponseEntity.ok(accountVerificationService.resetPassword(request));
    }

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        LoginResponse response = userService.login(request);
        return ResponseEntity.ok(response);
    }
}
