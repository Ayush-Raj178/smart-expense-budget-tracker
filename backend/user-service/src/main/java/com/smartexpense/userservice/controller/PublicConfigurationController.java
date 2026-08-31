package com.smartexpense.userservice.controller;

import com.smartexpense.userservice.config.OtpVerificationSettings;
import com.smartexpense.userservice.dto.FeatureFlagsResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/public")
@RequiredArgsConstructor
public class PublicConfigurationController {

    private final OtpVerificationSettings otpVerificationSettings;

    @GetMapping("/config")
    public ResponseEntity<FeatureFlagsResponse> getFeatureFlags() {
        return ResponseEntity.ok(new FeatureFlagsResponse(otpVerificationSettings.isEnabled()));
    }
}
