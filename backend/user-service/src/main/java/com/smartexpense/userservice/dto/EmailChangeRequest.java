package com.smartexpense.userservice.dto;

import com.smartexpense.userservice.validation.ValidEmail;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class EmailChangeRequest {
    @NotBlank(message = "New email is required")
    @ValidEmail
    @Size(max = 254, message = "Email must be at most 254 characters")
    private String newEmail;
}
