package com.smartexpense.userservice.service;

import com.smartexpense.userservice.dto.LoginRequest;
import com.smartexpense.userservice.dto.LoginResponse;
import com.smartexpense.userservice.dto.UpdateProfileRequest;
import com.smartexpense.userservice.dto.UserResponse;
import com.smartexpense.userservice.entity.User;
import com.smartexpense.userservice.exception.InvalidCredentialsException;
import com.smartexpense.userservice.exception.UserNotFoundException;
import com.smartexpense.userservice.repository.UserRepository;
import com.smartexpense.userservice.security.JwtTokenProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private JwtTokenProvider jwtTokenProvider;
    @InjectMocks private UserService userService;

    private LoginRequest loginRequest;
    private User existingUser;

    @BeforeEach
    void setUp() {
        loginRequest = new LoginRequest("ayu@example.com", "secret123");
        existingUser = User.builder()
                .id(1L)
                .name("Ayu")
                .email("ayu@example.com")
                .password("hashed-password")
                .phoneNumber("+91 9876543210")
                .build();
    }

    @Test
    void loginReturnsTokenWhenCredentialsAreValid() {
        when(userRepository.findByEmail("ayu@example.com")).thenReturn(Optional.of(existingUser));
        when(passwordEncoder.matches("secret123", "hashed-password")).thenReturn(true);
        when(jwtTokenProvider.generateToken(1L, "ayu@example.com")).thenReturn("jwt-token");

        LoginResponse response = userService.login(loginRequest);

        assertThat(response.getMessage()).isEqualTo("Login successful");
        assertThat(response.getToken()).isEqualTo("jwt-token");
        assertThat(response.getUser().getId()).isEqualTo(1L);
        assertThat(response.getUser().getName()).isEqualTo("Ayu");
        assertThat(response.getUser().getEmail()).isEqualTo("ayu@example.com");
        assertThat(response.getUser().getPhoneNumber()).isEqualTo("+91 9876543210");
    }

    @Test
    void loginThrowsWhenEmailNotFound() {
        when(userRepository.findByEmail("ayu@example.com")).thenReturn(Optional.empty());
        assertThatThrownBy(() -> userService.login(loginRequest))
                .isInstanceOf(InvalidCredentialsException.class);
        verify(jwtTokenProvider, never()).generateToken(any(), anyString());
    }

    @Test
    void loginThrowsWhenPasswordDoesNotMatch() {
        when(userRepository.findByEmail("ayu@example.com")).thenReturn(Optional.of(existingUser));
        when(passwordEncoder.matches("secret123", "hashed-password")).thenReturn(false);
        assertThatThrownBy(() -> userService.login(loginRequest))
                .isInstanceOf(InvalidCredentialsException.class);
        verify(jwtTokenProvider, never()).generateToken(any(), anyString());
    }

    @Test
    void getCurrentUserReturnsProfileWithoutPassword() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(existingUser));
        UserResponse response = userService.getCurrentUser(1L);
        assertThat(response.getId()).isEqualTo(1L);
        assertThat(response.getName()).isEqualTo("Ayu");
        assertThat(response.getEmail()).isEqualTo("ayu@example.com");
        assertThat(response.getPhoneNumber()).isEqualTo("+91 9876543210");
    }

    @Test
    void updateProfileChangesNameAndPhoneButNotEmailOrPassword() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(existingUser));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        UserResponse response = userService.updateProfile(1L, new UpdateProfileRequest("Ayush Raj", ""));

        assertThat(response.getName()).isEqualTo("Ayush Raj");
        assertThat(response.getPhoneNumber()).isNull();
        assertThat(existingUser.getEmail()).isEqualTo("ayu@example.com");
        assertThat(existingUser.getPassword()).isEqualTo("hashed-password");
    }

    @Test
    void getCurrentUserThrowsWhenUserNotFound() {
        when(userRepository.findById(99L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> userService.getCurrentUser(99L))
                .isInstanceOf(UserNotFoundException.class);
    }
}
