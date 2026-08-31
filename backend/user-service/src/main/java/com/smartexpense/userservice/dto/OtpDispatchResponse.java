package com.smartexpense.userservice.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OtpDispatchResponse {
    private String message;
    private String email;
    private long expiresInSeconds;
    private long resendAvailableInSeconds;
}
