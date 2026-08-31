package com.smartexpense.userservice.controller;

import com.smartexpense.userservice.dto.EmailChangeRequest;
import com.smartexpense.userservice.dto.EmailChangeVerificationRequest;
import com.smartexpense.userservice.dto.LoginResponse;
import com.smartexpense.userservice.dto.OtpDispatchResponse;
import com.smartexpense.userservice.dto.UpdateProfileRequest;
import com.smartexpense.userservice.dto.UserResponse;
import com.smartexpense.userservice.security.SecurityUtils;
import com.smartexpense.userservice.service.AccountVerificationService;
import com.smartexpense.userservice.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;
    private final AccountVerificationService accountVerificationService;

    @GetMapping("/me")
    public ResponseEntity<UserResponse> getCurrentUser() {
        Long userId = SecurityUtils.getCurrentUserId();
        UserResponse response = userService.getCurrentUser(userId);
        return ResponseEntity.ok(response);
    }

    @PutMapping("/me")
    public ResponseEntity<UserResponse> updateProfile(@Valid @RequestBody UpdateProfileRequest request) {
        Long userId = SecurityUtils.getCurrentUserId();
        return ResponseEntity.ok(userService.updateProfile(userId, request));
    }

    @PostMapping("/me/email/request")
    public ResponseEntity<OtpDispatchResponse> requestEmailChange(@Valid @RequestBody EmailChangeRequest request) {
        Long userId = SecurityUtils.getCurrentUserId();
        return ResponseEntity.accepted().body(accountVerificationService.requestEmailChange(userId, request));
    }

    @PostMapping("/me/email/verify")
    public ResponseEntity<LoginResponse> verifyEmailChange(
            @Valid @RequestBody EmailChangeVerificationRequest request) {
        Long userId = SecurityUtils.getCurrentUserId();
        return ResponseEntity.ok(accountVerificationService.verifyEmailChange(userId, request));
    }
}
