package com.smartexpense.userservice.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class OtpVerificationSettings {

    private final boolean enabled;

    public OtpVerificationSettings(@Value("${app.otp.verification-enabled:true}") boolean enabled) {
        this.enabled = enabled;
    }

    public boolean isEnabled() {
        return enabled;
    }
}
